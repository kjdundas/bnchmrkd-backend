"""
Peak projection and trajectory forecasting for athlete performance analysis.

Provides the PeakProjector class which estimates an athlete's peak
performance time and age based on historical data and population curves.
"""

from typing import Any, Dict, List, Tuple, Optional
from statistics import mean, stdev
import math

from app.core.benchmarks import AGE_PERFORMANCE_PERCENTILES


class PeakProjector:
    """
    Projects an athlete's peak performance and age based on historical data.

    Uses population age-performance curves combined with individual trajectory
    analysis to estimate ceiling performance and optimal timing.
    """

    def __init__(self, event_code: str):
        """
        Initialize projector for a specific event.

        Args:
            event_code: Internal event code (e.g., "M100", "F100H")

        Raises:
            ValueError: If event_code has no benchmark data
        """
        if event_code not in AGE_PERFORMANCE_PERCENTILES:
            raise ValueError(f"No benchmark data for event {event_code}")

        self.event_code = event_code
        self.age_percentiles = AGE_PERFORMANCE_PERCENTILES[event_code]

    def project_peak(
        self,
        annual_bests: List,  # List[AnnualBest]
        current_age: int,
    ) -> Dict[str, Any]:
        """
        Project athlete's peak performance and age.

        Uses a combination of:
        1. Population age-performance curve (median trajectory)
        2. Athlete's personal improvement trajectory
        3. Estimated improvement potential based on current percentile

        Args:
            annual_bests: List of AnnualBest objects with age and pct_off_pb
            current_age: Athlete's current age

        Returns:
            Dictionary with:
                - peak_time: Estimated peak time in seconds
                - peak_age: Estimated age at peak
                - ci_lower: Lower bound of confidence interval
                - ci_upper: Upper bound of confidence interval
                - confidence: Confidence score (0-1)
        """
        if not annual_bests:
            raise ValueError("No annual best data provided")

        # Extract trajectory data
        ages = [ab.age for ab in annual_bests]
        times = [ab.best_time for ab in annual_bests]
        pct_off_pbs = [ab.pct_off_pb for ab in annual_bests]

        # Current best
        current_pb = min(times)

        # Step 1: Fit personal trajectory curve
        personal_curve_params = self._fit_personal_curve(ages, pct_off_pbs)

        # Step 2: Estimate improvement potential using population curve
        improvement_potential = self._estimate_improvement_potential(
            current_pb, current_age, pct_off_pbs
        )

        # Step 3: Project when diminishing returns set in (peak age)
        peak_age = self._estimate_peak_age(
            ages, pct_off_pbs, personal_curve_params
        )

        # Ensure peak age is not in the past
        peak_age = max(peak_age, current_age)

        # Step 4: Project peak time
        projected_peak_pct_off_pb = self._project_pct_off_pb_at_age(
            peak_age,
            personal_curve_params,
            improvement_potential,
        )

        # Ensure reasonable bounds
        projected_peak_pct_off_pb = max(
            0.5, min(projected_peak_pct_off_pb, pct_off_pbs[0])
        )

        # Convert % off PB to actual time
        # Using current PB as the reference
        projected_peak_time = current_pb * (
            1.0 + projected_peak_pct_off_pb / 100.0
        )

        # Step 5: Calculate confidence interval
        ci_lower, ci_upper, confidence = self._calculate_confidence_interval(
            ages,
            pct_off_pbs,
            projected_peak_time,
            improvement_potential,
        )

        return {
            "peak_time": projected_peak_time,
            "peak_age": peak_age,
            "ci_lower": ci_lower,
            "ci_upper": ci_upper,
            "confidence": confidence,
        }

    def _fit_personal_curve(
        self, ages: List[int], pct_off_pbs: List[float]
    ) -> Dict[str, float]:
        """
        Fit a quadratic curve to personal performance trajectory.

        Models trajectory as: pct_off_pb = a*(age-peak_age)^2 + c
        This captures both improvement phase (negative slope) and
        decline phase (positive slope after peak).

        Args:
            ages: List of ages
            pct_off_pbs: List of % off PB values

        Returns:
            Dictionary with fitted parameters
        """
        if len(ages) < 2:
            return {
                "improvement_rate": 0.0,
                "decline_rate": 0.5,
                "peak_age_estimate": ages[0] + 4,
            }

        # Simple linear fit for improvement rate
        age_diffs = [ages[i + 1] - ages[i] for i in range(len(ages) - 1)]
        pct_diffs = [pct_off_pbs[i + 1] - pct_off_pbs[i] for i in range(len(pct_off_pbs) - 1)]

        # Improvement rate (negative is good)
        if sum(age_diffs) > 0:
            improvement_rate = sum(pct_diffs) / sum(age_diffs)
        else:
            improvement_rate = 0.0

        # Estimate where improvement will stop
        # Use curvature to estimate peak age
        if len(ages) >= 3:
            # Compute second derivative (acceleration of improvement)
            second_derivatives = []
            for i in range(len(pct_diffs) - 1):
                if age_diffs[i + 1] > 0:
                    second_deriv = (pct_diffs[i + 1] - pct_diffs[i]) / age_diffs[i + 1]
                    second_derivatives.append(second_deriv)

            decline_rate = mean(second_derivatives) if second_derivatives else 0.5
        else:
            decline_rate = 0.5  # Default: 0.5% per year squared

        # Estimate peak age: where improvement rate becomes zero
        if decline_rate < 0:
            decline_rate = 0.5  # Ensure positive for quadratic curvature

        if decline_rate != 0:
            peak_age_offset = abs(improvement_rate) / decline_rate
        else:
            peak_age_offset = 5.0

        peak_age_estimate = ages[-1] + peak_age_offset

        return {
            "improvement_rate": improvement_rate,
            "decline_rate": max(0.1, decline_rate),
            "peak_age_estimate": peak_age_estimate,
        }

    def _estimate_improvement_potential(
        self,
        current_pb: float,
        current_age: int,
        pct_off_pbs: List[float],
    ) -> float:
        """
        Estimate how much further an athlete can improve.

        Based on:
        1. Current percentile (better athletes have less room to improve)
        2. Age (younger athletes typically have more potential)
        3. Personal trajectory (recent trend)

        Args:
            current_pb: Current personal best time
            current_age: Current age
            pct_off_pbs: Historical % off PB values

        Returns:
            Estimated remaining improvement potential (% off PB)
        """
        current_pct_off_pb = pct_off_pbs[-1] if pct_off_pbs else 5.0

        # Compute percentile at current age
        age_benchmark = self.age_percentiles.get(current_age)
        if age_benchmark:
            # Estimate percentile: compare to P50 benchmark
            percentile_offset = (
                age_benchmark.p50 - current_pct_off_pb
            ) / age_benchmark.p50 if age_benchmark.p50 > 0 else 0.5

            # Better athletes (higher percentile) have less room
            potential_multiplier = max(0.1, 1.0 - (percentile_offset * 0.5))
        else:
            potential_multiplier = 0.7

        # Age factor: younger athletes have more potential
        age_factor = max(0.3, 1.0 - ((current_age - 18) * 0.05))

        # Trend factor: if improving, has more potential
        if len(pct_off_pbs) >= 2:
            recent_trend = pct_off_pbs[-1] - pct_off_pbs[-2]
            # Positive trend (worsening) reduces potential
            trend_factor = max(0.2, 1.0 - (recent_trend * 0.2))
        else:
            trend_factor = 0.8

        # Combine factors
        base_improvement_potential = current_pct_off_pb * 0.5

        combined_potential = (
            base_improvement_potential
            * potential_multiplier
            * age_factor
            * trend_factor
        )

        return max(0.2, combined_potential)

    def _estimate_peak_age(
        self,
        ages: List[int],
        pct_off_pbs: List[float],
        curve_params: Dict[str, float],
    ) -> int:
        """
        Estimate the age at which athlete will reach peak performance.

        Args:
            ages: Historical ages
            pct_off_pbs: Historical % off PB values
            curve_params: Fitted curve parameters

        Returns:
            Estimated age at peak
        """
        current_age = ages[-1] if ages else 20

        # Use curve-fitted estimate as primary
        peak_age = curve_params.get("peak_age_estimate", current_age + 4)

        # Constrain to reasonable bounds
        min_peak_age = current_age
        max_peak_age = current_age + 8

        peak_age = max(min_peak_age, min(max_peak_age, peak_age))

        return int(round(peak_age))

    def _project_pct_off_pb_at_age(
        self,
        age: int,
        curve_params: Dict[str, float],
        improvement_potential: float,
    ) -> float:
        """
        Project % off PB at a given future age.

        Uses quadratic trajectory model.

        Args:
            age: Age to project for
            curve_params: Fitted curve parameters
            improvement_potential: Remaining improvement available

        Returns:
            Projected % off PB
        """
        peak_age = curve_params.get("peak_age_estimate", 25)
        improvement_rate = curve_params.get("improvement_rate", -0.5)
        decline_rate = curve_params.get("decline_rate", 0.3)

        # Distance from peak age
        distance_from_peak = age - peak_age

        if distance_from_peak <= 0:
            # Before peak: apply improvement
            years_to_peak = abs(distance_from_peak)
            improvement = improvement_rate * years_to_peak * improvement_potential / 5.0
            return max(0.5, improvement)
        else:
            # After peak: quadratic decline
            decline = decline_rate * (distance_from_peak ** 2)
            return max(0.5, decline)

    def _calculate_confidence_interval(
        self,
        ages: List[int],
        pct_off_pbs: List[float],
        projected_peak_time: float,
        improvement_potential: float,
    ) -> Tuple[float, float, float]:
        """
        Calculate confidence interval for peak projection.

        Based on:
        1. Number of data points (more data = higher confidence)
        2. Variability in historical data
        3. Distance into the future

        Args:
            ages: Historical ages
            pct_off_pbs: Historical % off PB values
            projected_peak_time: Projected peak time
            improvement_potential: Remaining improvement potential

        Returns:
            Tuple of (ci_lower, ci_upper, confidence_score)
        """
        n_data_points = len(ages)

        # Variability in historical trajectory
        if len(pct_off_pbs) > 1:
            variability = stdev(pct_off_pbs)
        else:
            variability = 0.5

        # Confidence based on sample size
        sample_confidence = min(0.9, n_data_points / 8.0)

        # Confidence decreases with projection distance
        max_age = max(ages) if ages else 20
        projection_distance = max_age + 5 - max_age
        distance_factor = max(0.5, 1.0 - (projection_distance * 0.05))

        # Combined confidence
        confidence = sample_confidence * distance_factor

        # Confidence interval width
        ci_width = (1.0 - confidence) * improvement_potential * 2.0

        ci_lower = max(
            0.5, projected_peak_time - ci_width
        )
        ci_upper = projected_peak_time + ci_width

        return ci_lower, ci_upper, confidence

    def project_future_times(
        self,
        annual_bests: List,  # List[AnnualBest]
        current_age: int,
        years_ahead: int = 5,
    ) -> Dict[int, float]:
        """
        Project performance times for multiple future years.

        Args:
            annual_bests: List of AnnualBest objects
            current_age: Current age
            years_ahead: How many years to project

        Returns:
            Dictionary mapping future age to projected time
        """
        # Get peak projection first
        peak_projection = self.project_peak(annual_bests, current_age)

        # Current best time
        current_pb = min(ab.best_time for ab in annual_bests)

        projections = {}

        for offset in range(1, years_ahead + 1):
            future_age = current_age + offset
            pct_off_pb = self._project_pct_off_pb_at_age(
                future_age,
                {
                    "peak_age_estimate": peak_projection["peak_age"],
                    "improvement_rate": -0.5,
                    "decline_rate": 0.3,
                },
                0.5,
            )

            future_time = current_pb * (1.0 + pct_off_pb / 100.0)
            projections[future_age] = future_time

        return projections

    def estimate_pb_ceiling(
        self,
        annual_bests: List,  # List[AnnualBest]
        current_age: int,
    ) -> Dict[str, Any]:
        """
        Estimate the best-case scenario (ceiling) for athlete's PB.

        Assumes optimal training, no injuries, peak performance.

        Args:
            annual_bests: List of AnnualBest objects
            current_age: Current age

        Returns:
            Dictionary with:
                - ceiling_time: Estimated ceiling
                - improvement_needed: How much faster from current
                - improvement_pct: As percentage
        """
        current_pb = min(ab.best_time for ab in annual_bests)

        # Get the peak projection
        peak_proj = self.project_peak(annual_bests, current_age)
        peak_time = peak_proj["peak_time"]

        improvement_seconds = current_pb - peak_time
        improvement_pct = (improvement_seconds / current_pb) * 100.0

        return {
            "ceiling_time": peak_time,
            "improvement_needed": improvement_seconds,
            "improvement_pct": improvement_pct,
        }
