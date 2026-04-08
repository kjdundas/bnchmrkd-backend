"""
Main analytics engine for BnchMrkd athlete analysis.

Provides the AthleteAnalyzer class which takes an athlete's race history
and produces comprehensive analysis including trajectory classification,
percentile ranking, peak projection, and finalist prediction.
"""

from datetime import datetime
from statistics import mean, stdev
from typing import Any, Optional, List, Dict, Tuple
from enum import Enum

from pydantic import BaseModel, Field

from app.core.benchmarks import (
    AGE_PERFORMANCE_PERCENTILES,
    ROC_THRESHOLDS,
    TRAJECTORY_CENTROIDS,
    MODEL_COEFFICIENTS,
    THROWS_MODEL_COEFFICIENTS,
    IMPROVEMENT_NORMS,
    MODEL_CALIBRATION,
    get_event_code,
    is_throws_event,
    AgePercentile,
)
from app.core.projections import PeakProjector


# ==============================================================================
# DATA MODELS
# ==============================================================================


class RaceRecord(BaseModel):
    """A single race performance record."""

    date: datetime
    time_seconds: float
    wind_mps: Optional[float] = None
    wind_legal: Optional[bool] = None
    competition: str = ""
    age: int


class TrajectoryClassification(BaseModel):
    """Classification of athlete's performance trajectory."""

    cluster_name: str
    confidence: float = Field(
        ge=0.0, le=1.0, description="Confidence score 0-1"
    )
    description: str
    cluster_index: int


class PercentileAnalysis(BaseModel):
    """Percentile ranking analysis."""

    current_percentile: float = Field(
        ge=0.0, le=100.0, description="Percentile at current age"
    )
    percentile_at_18: Optional[float] = Field(
        default=None, ge=0.0, le=100.0
    )
    percentile_at_20: Optional[float] = Field(
        default=None, ge=0.0, le=100.0
    )
    percentile_trend: str = Field(
        description="Improving, Declining, or Stable"
    )
    benchmark_time_at_current_age: Optional[float] = None


class PeakProjection(BaseModel):
    """Projection of athlete's peak performance."""

    projected_peak_time: float
    projected_peak_age: int
    confidence_interval_lower: float
    confidence_interval_upper: float
    confidence: float = Field(ge=0.0, le=1.0)
    years_to_peak: int


class CompetitiveOutlook(BaseModel):
    """Probability of achieving different competitive levels."""

    finalist_probability: float = Field(ge=0.0, le=1.0)
    semifinalist_probability: float = Field(ge=0.0, le=1.0)
    olympic_qualifier_probability: float = Field(ge=0.0, le=1.0)


class ImprovementAnalysis(BaseModel):
    """Analysis of improvement rate relative to peers."""

    current_improvement_rate: Optional[float] = Field(
        default=None, description="% per year"
    )
    finalist_norm: float = Field(description="Expected improvement for finalists")
    comparison: str = Field(
        description="On Track, Above Average, Below Average, or Insufficient Data"
    )
    is_on_track: bool
    explanation: str


class BenchmarksAtAge(BaseModel):
    """Performance benchmarks at athlete's current age."""

    current_age_benchmark_p90: float
    current_age_benchmark_p75: float
    current_age_benchmark_p50: float
    current_age_benchmark_p25: float
    current_age_benchmark_p10: float
    athlete_current_time: float
    athlete_vs_benchmark_p50: float = Field(
        description="Seconds better (negative) or worse (positive) than median"
    )
    percentile_at_current_age: float


class AnnualBest(BaseModel):
    """Annual best performance summary."""

    age: int
    best_time: float
    n_races: int
    pct_off_pb: float


class AnalysisResult(BaseModel):
    """Complete analysis result for an athlete."""

    # Athlete summary
    athlete_summary: Dict[str, Any]

    # Time series
    annual_best_series: List[AnnualBest]

    # Classification
    trajectory_classification: TrajectoryClassification

    # Ranking
    percentile_analysis: PercentileAnalysis

    # Projection
    peak_projection: PeakProjection

    # Competitiveness
    competitive_outlook: CompetitiveOutlook

    # Improvement
    improvement_analysis: ImprovementAnalysis

    # Benchmarks
    benchmarks_at_age: BenchmarksAtAge

    # Recommendations
    recommendations: List[str]


# ==============================================================================
# ATHLETE ANALYZER
# ==============================================================================


class AthleteAnalyzer:
    """
    Main analytics engine for athlete analysis.

    Takes race history and produces comprehensive analysis including
    trajectory classification, percentile ranking, peak projection, and
    finalist prediction.
    """

    def __init__(
        self,
        discipline: str,
        gender: str,
        athlete_name: str = "Unknown",
    ):
        """
        Initialize analyzer for a specific discipline and gender.

        Args:
            discipline: Event name (e.g., "100m", "110mH")
            gender: "M" or "F"
            athlete_name: Optional athlete name for reporting

        Raises:
            ValueError: If discipline or gender is invalid
        """
        self.discipline = discipline
        self.gender = gender
        self.athlete_name = athlete_name
        self.event_code = get_event_code(discipline, gender)
        self.is_throws = is_throws_event(self.event_code)

        # Load benchmarks
        if self.event_code not in AGE_PERFORMANCE_PERCENTILES:
            raise ValueError(
                f"No benchmark data for {discipline} ({gender})"
            )

        self.age_percentiles = AGE_PERFORMANCE_PERCENTILES[self.event_code]
        self.roc_threshold = ROC_THRESHOLDS[self.event_code]
        self.trajectory_clusters = TRAJECTORY_CENTROIDS[self.event_code]
        self.improvement_norm = IMPROVEMENT_NORMS[self.event_code]
        self.calibration = MODEL_CALIBRATION[self.event_code]
        self.projector = PeakProjector(self.event_code, is_throws=self.is_throws)

    def analyze(self, races: List[RaceRecord]) -> AnalysisResult:
        """
        Analyze athlete's race history and produce comprehensive report.

        Args:
            races: List of race records with date, time, age, etc.

        Returns:
            AnalysisResult with all analysis components

        Raises:
            ValueError: If insufficient race data or invalid ages
        """
        if not races:
            raise ValueError("No race records provided")

        # Sort races chronologically
        races = sorted(races, key=lambda r: r.date)

        # Extract basic stats
        all_times = [r.time_seconds for r in races]
        # For throws, higher distance = better; for sprints, lower time = better
        pb = max(all_times) if self.is_throws else min(all_times)
        current_age = races[-1].age
        n_races = len(races)

        # Step 1: Build annual best time series
        annual_bests = self._compute_annual_bests(races, pb)

        # Data sufficiency: trajectory / peak / improvement need at least 3
        # distinct ages to be meaningful. With 1-2 ages we have no curve to fit.
        n_distinct_ages = len(annual_bests)
        sufficient_for_trajectory = n_distinct_ages >= 3

        # Step 2: Compute current % off PB trajectory
        current_pct_off_pb = self._compute_pct_off_pb(
            races[-1].time_seconds, pb
        )

        # Step 3: Classify trajectory cluster (guarded)
        if sufficient_for_trajectory:
            trajectory_class = self._classify_trajectory(annual_bests)
        else:
            trajectory_class = TrajectoryClassification(
                cluster_name="Insufficient Data",
                confidence=0.0,
                description=(
                    f"Need results from at least 3 different ages to classify "
                    f"trajectory (currently {n_distinct_ages})."
                ),
                cluster_index=-1,
            )

        # Step 4: Compute percentile rank at current age — age-conditioned
        # absolute time vs the qualifier cohort distribution. This replaces
        # the old % off PB interpolation which always returned P95 when the
        # athlete's most recent race equalled their PB.
        percentile_analysis = self._analyze_percentiles_absolute(
            athlete_pb=pb,
            current_age=current_age,
            annual_bests=annual_bests,
        )

        # Step 5: Project peak time (guarded)
        if sufficient_for_trajectory:
            peak_projection = self._project_peak(annual_bests, current_age)
        else:
            # No trajectory to project — return current PB at current age with
            # zero confidence so the UI can render "needs more data".
            peak_projection = PeakProjection(
                projected_peak_time=pb,
                projected_peak_age=current_age,
                confidence_interval_lower=pb,
                confidence_interval_upper=pb,
                confidence=0.0,
                years_to_peak=0,
            )

        # Step 6: Run predictive model (finalist probability) — age aware
        competitive_outlook = self._predict_competitiveness_age_aware(
            races=races,
            pb=pb,
            current_age=current_age,
            annual_bests=annual_bests,
            sufficient_for_trajectory=sufficient_for_trajectory,
        )

        # Step 7: Compare improvement rate against norms (guarded)
        if sufficient_for_trajectory:
            improvement_analysis = self._analyze_improvement(
                races, pb, annual_bests, competitive_outlook.finalist_probability
            )
        else:
            improvement_analysis = ImprovementAnalysis(
                current_improvement_rate=None,
                finalist_norm=self.improvement_norm.finalist_median_pct,
                comparison="Insufficient Data",
                is_on_track=False,
                explanation=(
                    "Improvement rate cannot be computed until results are "
                    "logged across at least 3 different ages."
                ),
            )

        # Step 8: Generate age-specific benchmarks
        benchmarks_at_age = self._generate_benchmarks(
            current_pct_off_pb, current_age, races[-1].time_seconds
        )

        # Step 9: Generate recommendations
        recommendations = self._generate_recommendations(
            trajectory_class,
            percentile_analysis,
            competitive_outlook,
            improvement_analysis,
            annual_bests,
        )

        # Compile athlete summary
        athlete_summary = {
            "name": self.athlete_name,
            "discipline": self.discipline,
            "gender": self.gender,
            "current_age": current_age,
            "career_pb": pb,
            "n_races": n_races,
            "current_time": races[-1].time_seconds,
        }

        return AnalysisResult(
            athlete_summary=athlete_summary,
            annual_best_series=annual_bests,
            trajectory_classification=trajectory_class,
            percentile_analysis=percentile_analysis,
            peak_projection=peak_projection,
            competitive_outlook=competitive_outlook,
            improvement_analysis=improvement_analysis,
            benchmarks_at_age=benchmarks_at_age,
            recommendations=recommendations,
        )

    def _compute_annual_bests(
        self, races: List[RaceRecord], pb: float
    ) -> List[AnnualBest]:
        """
        Compute annual best time for each age.

        Args:
            races: List of race records
            pb: Personal best time

        Returns:
            List of annual best times by age
        """
        age_races: Dict[int, List[float]] = {}
        for race in races:
            if race.age not in age_races:
                age_races[race.age] = []
            age_races[race.age].append(race.time_seconds)

        annual_bests = []
        for age in sorted(age_races.keys()):
            times = age_races[age]
            best = max(times) if self.is_throws else min(times)
            pct_off = self._compute_pct_off_pb(best, pb)
            annual_bests.append(
                AnnualBest(
                    age=age,
                    best_time=best,
                    n_races=len(times),
                    pct_off_pb=pct_off,
                )
            )

        return annual_bests

    def _compute_pct_off_pb(self, time: float, pb: float) -> float:
        """
        Compute percentage off personal best.

        For sprints/hurdles: ((time - pb) / pb) * 100 (positive = slower)
        For throws: ((pb - distance) / pb) * 100 (positive = shorter)
        Both preserve: 0 = at PB, positive = worse than PB.

        Args:
            time: Current time/distance
            pb: Personal best time/distance

        Returns:
            Percentage off PB (0 = equals PB)
        """
        if pb <= 0:
            return 0.0
        if self.is_throws:
            return ((pb - time) / pb) * 100.0
        return ((time - pb) / pb) * 100.0

    def _classify_trajectory(
        self, annual_bests: List[AnnualBest]
    ) -> TrajectoryClassification:
        """
        Classify trajectory into one of three clusters.

        Args:
            annual_bests: List of annual best performances

        Returns:
            TrajectoryClassification with cluster assignment and confidence
        """
        if not annual_bests:
            return TrajectoryClassification(
                cluster_name="Unknown",
                confidence=0.0,
                description="Insufficient data",
                cluster_index=-1,
            )

        # Extract current trajectory (% off PB at different ages)
        athlete_trajectory = [ab.pct_off_pb for ab in annual_bests]

        # Find nearest centroid
        min_distance = float("inf")
        best_cluster_idx = 0

        for i, cluster in enumerate(self.trajectory_clusters):
            # Compute distance to centroid
            centroid = cluster.pct_off_pb
            distance = self._euclidean_distance(
                athlete_trajectory, centroid
            )

            if distance < min_distance:
                min_distance = distance
                best_cluster_idx = i

        best_cluster = self.trajectory_clusters[best_cluster_idx]

        # Confidence based on distance (inverse)
        # Normalize distance to 0-1 confidence scale
        confidence = max(
            0.0, 1.0 - (min_distance / 20.0)
        )  # Empirically normalized
        confidence = min(1.0, confidence)

        return TrajectoryClassification(
            cluster_name=best_cluster.name,
            confidence=confidence,
            description=best_cluster.description,
            cluster_index=best_cluster_idx,
        )

    def _euclidean_distance(
        self, v1: List[float], v2: List[float]
    ) -> float:
        """
        Compute Euclidean distance between two vectors.

        Handles vectors of different lengths by padding.
        """
        max_len = max(len(v1), len(v2))
        sum_sq = 0.0

        for i in range(max_len):
            a = v1[i] if i < len(v1) else v1[-1] if v1 else 0.0
            b = v2[i] if i < len(v2) else v2[-1] if v2 else 0.0
            sum_sq += (a - b) ** 2

        return sum_sq ** 0.5

    def _analyze_percentiles(
        self,
        current_pct_off_pb: float,
        current_age: int,
        annual_bests: List[AnnualBest],
    ) -> PercentileAnalysis:
        """
        Compute percentile ranking at current and earlier ages.

        Args:
            current_pct_off_pb: Current % off PB
            current_age: Athlete's current age
            annual_bests: Annual best performances

        Returns:
            PercentileAnalysis with percentile rankings
        """
        # Get benchmarks at current age
        current_benchmark = self.age_percentiles.get(current_age)
        if not current_benchmark:
            # Interpolate nearest benchmark
            ages = sorted(self.age_percentiles.keys())
            if current_age < ages[0]:
                current_benchmark = self.age_percentiles[ages[0]]
            else:
                current_benchmark = self.age_percentiles[ages[-1]]

        # Compute percentile at current age
        current_percentile = self._interpolate_percentile(
            current_pct_off_pb, current_benchmark
        )

        # Compute percentile at age 18 and 20 if data exists
        percentile_at_18 = None
        percentile_at_20 = None

        ab_by_age = {ab.age: ab for ab in annual_bests}

        if 18 in ab_by_age and 18 in self.age_percentiles:
            benchmark_18 = self.age_percentiles[18]
            percentile_at_18 = self._interpolate_percentile(
                ab_by_age[18].pct_off_pb, benchmark_18
            )

        if 20 in ab_by_age and 20 in self.age_percentiles:
            benchmark_20 = self.age_percentiles[20]
            percentile_at_20 = self._interpolate_percentile(
                ab_by_age[20].pct_off_pb, benchmark_20
            )

        # Determine trend
        if percentile_at_18 and percentile_at_20:
            trend_change = percentile_at_20 - percentile_at_18
        elif percentile_at_20:
            trend_change = current_percentile - percentile_at_20
        else:
            trend_change = 0.0

        if trend_change > 2:
            percentile_trend = "Improving"
        elif trend_change < -2:
            percentile_trend = "Declining"
        else:
            percentile_trend = "Stable"

        # Benchmark time at current age (P50)
        benchmark_time_at_current_age = None
        if current_benchmark:
            # Use the benchmark time calculation from calibration
            # P50 value from benchmarks represents % off PB
            # We need to estimate the actual time
            pass

        return PercentileAnalysis(
            current_percentile=current_percentile,
            percentile_at_18=percentile_at_18,
            percentile_at_20=percentile_at_20,
            percentile_trend=percentile_trend,
            benchmark_time_at_current_age=benchmark_time_at_current_age,
        )

    # ------------------------------------------------------------------
    # Age-conditioned absolute-time percentile (replaces % off PB logic)
    # ------------------------------------------------------------------
    def _expected_time_at_age(self, age: int) -> float:
        """
        Expected qualifier-cohort median absolute time at a given age.

        Uses the cohort PB mean from MODEL_CALIBRATION as the "peak time"
        and applies a simple aging curve so that veterans are correctly
        compared against age-matched expectations rather than peak-age PBs.

        For sprints/hurdles: lower = better, expected_time grows with
        distance from peak age in either direction.
        For throws: higher = better, expected_distance shrinks with
        distance from peak age in either direction.
        """
        # Piecewise aging curve calibrated to Olympic qualifier cohort
        # behaviour. Returns "% off cohort peak time" as a positive number.
        if age <= 18:
            pct_off = 8.0 + max(0, (18 - age)) * 1.5
        elif age < 25:
            # Linear improvement from 18 to 25
            pct_off = 8.0 * (25 - age) / 7.0
        elif age <= 27:
            pct_off = 0.0  # peak window
        elif age <= 30:
            pct_off = 0.3 * (age - 27)  # gentle decline
        else:
            pct_off = 0.9 + 0.5 * (age - 30)  # steeper after 30
        if self.is_throws:
            return self.calibration.mean_time * (1.0 - pct_off / 100.0)
        return self.calibration.mean_time * (1.0 + pct_off / 100.0)

    def _normal_cdf(self, z: float) -> float:
        """Standard normal CDF using the error-function approximation."""
        # Abramowitz & Stegun 7.1.26 via math.erf
        import math
        return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))

    def _absolute_percentile(self, athlete_time: float, age: int) -> float:
        """
        Percentile rank of an absolute time at a given age vs the
        Olympic-qualifier (Q/SF/F) cohort distribution.

        Returns 0-100 where higher = better.
        """
        expected = self._expected_time_at_age(age)
        std = max(0.05, self.calibration.std_time)
        # Inflate std modestly with distance from peak age — older cohort
        # is more variable.
        std_age = std * (1.0 + 0.02 * abs(age - 25))
        z = (athlete_time - expected) / std_age
        if self.is_throws:
            # higher = better → larger time/distance gives lower z directly,
            # so percentile is the CDF of z.
            return max(0.0, min(100.0, 100.0 * self._normal_cdf(z)))
        # sprints/hurdles: lower = better → percentile is upper tail.
        return max(0.0, min(100.0, 100.0 * (1.0 - self._normal_cdf(z))))

    def _analyze_percentiles_absolute(
        self,
        athlete_pb: float,
        current_age: int,
        annual_bests: List[AnnualBest],
    ) -> PercentileAnalysis:
        """
        Build a PercentileAnalysis using absolute-time, age-conditioned
        comparisons against the Olympic qualifier cohort.
        """
        current_percentile = self._absolute_percentile(athlete_pb, current_age)

        # Optional historical context if the athlete has annual bests at 18/20
        ab_by_age = {ab.age: ab for ab in annual_bests}
        percentile_at_18 = (
            self._absolute_percentile(ab_by_age[18].best_time, 18)
            if 18 in ab_by_age else None
        )
        percentile_at_20 = (
            self._absolute_percentile(ab_by_age[20].best_time, 20)
            if 20 in ab_by_age else None
        )

        if percentile_at_18 is not None and percentile_at_20 is not None:
            change = percentile_at_20 - percentile_at_18
        elif percentile_at_20 is not None:
            change = current_percentile - percentile_at_20
        else:
            change = 0.0

        if change > 2:
            trend = "Improving"
        elif change < -2:
            trend = "Declining"
        else:
            trend = "Stable"

        return PercentileAnalysis(
            current_percentile=current_percentile,
            percentile_at_18=percentile_at_18,
            percentile_at_20=percentile_at_20,
            percentile_trend=trend,
            benchmark_time_at_current_age=self._expected_time_at_age(current_age),
        )

    # ------------------------------------------------------------------
    # Age-aware competitive outlook (replaces immature-feature regression
    # for athletes who are past the typical peak window)
    # ------------------------------------------------------------------
    def _predict_competitiveness_age_aware(
        self,
        races: List[RaceRecord],
        pb: float,
        current_age: int,
        annual_bests: List[AnnualBest],
        sufficient_for_trajectory: bool,
    ) -> CompetitiveOutlook:
        """
        For developing athletes (age <= 24 with usable history) we keep the
        original logistic regression. For everyone else we score directly
        against the ROC thresholds, which is what those thresholds are for.
        """
        is_developing = current_age <= 24 and sufficient_for_trajectory
        if is_developing:
            return self._predict_competitiveness(races, pb, current_age, annual_bests)

        # Direct PB-vs-threshold scoring. Use a smooth logistic on the gap
        # between PB and the 80%-sensitivity threshold so the curve is
        # continuous rather than stepwise.
        import math
        thr_finalist = self.roc_threshold.optimal_threshold
        thr_semi = self.roc_threshold.threshold_80_sensitivity
        thr_qual = self.roc_threshold.threshold_90_sensitivity

        def _logit_prob(pb_val: float, thr: float, scale: float) -> float:
            # For sprints (lower=better) the athlete is "above threshold"
            # when pb_val <= thr. Convert gap to a logit.
            if self.is_throws:
                gap = pb_val - thr
            else:
                gap = thr - pb_val
            return 1.0 / (1.0 + math.exp(-gap / scale))

        # Scale ~ typical performance spread within the qualifier cohort.
        scale = max(0.05, self.calibration.std_time * 0.5)

        finalist_prob = _logit_prob(pb, thr_finalist, scale)
        semi_prob = _logit_prob(pb, thr_semi, scale)
        qualifier_prob = _logit_prob(pb, thr_qual, scale)

        # Apply a veteran haircut: a 31-year-old hitting a qualifier mark
        # has lower forward probability than a 22-year-old at the same time
        # because they have fewer remaining seasons.
        if current_age > 27:
            haircut = max(0.4, 1.0 - 0.08 * (current_age - 27))
            finalist_prob *= haircut
            semi_prob *= haircut
            qualifier_prob *= haircut

        # Ensure ordering qualifier >= semi >= finalist
        semi_prob = max(semi_prob, finalist_prob)
        qualifier_prob = max(qualifier_prob, semi_prob)

        return CompetitiveOutlook(
            finalist_probability=min(1.0, finalist_prob),
            semifinalist_probability=min(1.0, semi_prob),
            olympic_qualifier_probability=min(1.0, qualifier_prob),
        )

    def _interpolate_percentile(
        self, pct_off_pb: float, benchmark: AgePercentile
    ) -> float:
        """
        Interpolate percentile rank given % off PB and benchmark percentiles.

        Args:
            pct_off_pb: % off personal best
            benchmark: Age percentile benchmarks

        Returns:
            Percentile rank (0-100)
        """
        # Map % off PB to percentile
        # Better (lower) values are higher percentiles

        if pct_off_pb <= benchmark.p10:
            # Better than 90th percentile
            return 95.0  # Extrapolate above P90
        elif pct_off_pb <= benchmark.p25:
            # Between P25 and P10 (90th and 75th percentile)
            return 75.0 + (
                (benchmark.p10 - pct_off_pb)
                / (benchmark.p25 - benchmark.p10)
                * 15.0
            )
        elif pct_off_pb <= benchmark.p50:
            # Between P50 and P25
            return 50.0 + (
                (benchmark.p25 - pct_off_pb)
                / (benchmark.p50 - benchmark.p25)
                * 25.0
            )
        elif pct_off_pb <= benchmark.p75:
            # Between P75 and P50
            return 25.0 + (
                (benchmark.p50 - pct_off_pb)
                / (benchmark.p75 - benchmark.p50)
                * 25.0
            )
        elif pct_off_pb <= benchmark.p90:
            # Between P90 and P75
            return 10.0 + (
                (benchmark.p75 - pct_off_pb)
                / (benchmark.p90 - benchmark.p75)
                * 15.0
            )
        else:
            # Worse than P90
            return 5.0

    def _project_peak(
        self, annual_bests: List[AnnualBest], current_age: int
    ) -> PeakProjection:
        """
        Project athlete's peak performance and age.

        Args:
            annual_bests: Annual best performances
            current_age: Current age

        Returns:
            PeakProjection with projected peak time and confidence
        """
        # Use projector to estimate peak
        projection = self.projector.project_peak(
            annual_bests, current_age
        )

        return PeakProjection(
            projected_peak_time=projection["peak_time"],
            projected_peak_age=projection["peak_age"],
            confidence_interval_lower=projection["ci_lower"],
            confidence_interval_upper=projection["ci_upper"],
            confidence=projection["confidence"],
            years_to_peak=projection["peak_age"] - current_age,
        )

    def _predict_competitiveness(
        self,
        races: List[RaceRecord],
        pb: float,
        current_age: int,
        annual_bests: List[AnnualBest],
    ) -> CompetitiveOutlook:
        """
        Predict finalist and Olympic qualifier probabilities.

        Uses logistic regression model based on early performance indicators.

        Args:
            races: All race records
            pb: Personal best
            current_age: Current age
            annual_bests: Annual best performances

        Returns:
            CompetitiveOutlook with probability estimates
        """
        # Compute features for logistic regression
        races_18_20 = [r for r in races if 18 <= r.age <= 20]
        if races_18_20:
            if self.is_throws:
                best_18_20 = max(r.time_seconds for r in races_18_20)
            else:
                best_18_20 = min(r.time_seconds for r in races_18_20)
        else:
            best_18_20 = pb

        # Z-score best at 18-20
        best_18_20_z = (best_18_20 - self.calibration.mean_time) / (
            self.calibration.std_time + 1e-6
        )

        # Percentile rank at age 20
        ab_by_age = {ab.age: ab for ab in annual_bests}
        if 20 in ab_by_age:
            pct_off_pb_20 = ab_by_age[20].pct_off_pb
            benchmark_20 = self.age_percentiles.get(20)
            if benchmark_20:
                pct_rank_at_20 = self._interpolate_percentile(
                    pct_off_pb_20, benchmark_20
                ) / 100.0
            else:
                pct_rank_at_20 = 0.5
        else:
            pct_rank_at_20 = 0.5

        # Improvement from age 18-19 to PB
        improvement_y0_y2 = 0.0
        if 18 in ab_by_age:
            improvement_y0_y2 = (
                ab_by_age[18].pct_off_pb - ab_by_age.get(20, ab_by_age[18]).pct_off_pb
            )

        # Z-score improvement
        improvement_y0_y2_z = (
            (improvement_y0_y2 - self.improvement_norm.finalist_median_pct)
            / (self.improvement_norm.finalist_std_pct + 1e-6)
        )

        # Consistency (std dev of annual improvements)
        annual_improvements = []
        for i in range(len(annual_bests) - 1):
            improvement = (
                annual_bests[i].pct_off_pb - annual_bests[i + 1].pct_off_pb
            )
            annual_improvements.append(improvement)

        consistency_std = (
            stdev(annual_improvements)
            if len(annual_improvements) > 1
            else 0.0
        )
        consistency_std_z = (consistency_std - 1.0) / (
            0.5 + 1e-6
        )  # Empirical normalization

        # Number of races at 18-20
        races_count = len(races_18_20)
        races_18_20_z = (races_count - 8.0) / (4.0 + 1e-6)

        # Logistic regression
        features = [
            best_18_20_z,
            pct_rank_at_20,
            improvement_y0_y2_z,
            consistency_std_z,
            races_18_20_z,
        ]

        # Use throws-specific model coefficients for throws events
        coeff = THROWS_MODEL_COEFFICIENTS if self.is_throws else MODEL_COEFFICIENTS

        logit = coeff.intercept
        logit += coeff.best_18_20_z * features[0]
        logit += coeff.pct_rank_at_20 * features[1]
        logit += coeff.improvement_y0_y2_z * features[2]
        logit += coeff.consistency_std_z * features[3]
        logit += coeff.races_18_20 * features[4]

        # Convert logit to probability
        finalist_prob = 1.0 / (1.0 + (2.71828 ** (-logit)))

        # Estimate semifinalist and qualifier probabilities
        # (These scale proportionally from finalist probability)
        semifinalist_prob = finalist_prob * 1.3
        semifinalist_prob = min(1.0, semifinalist_prob)

        # Olympic qualifier (top ~0.1% of population)
        # Much stricter threshold
        # For throws: higher PB = better (>=), for sprints: lower PB = better (<=)
        if self.is_throws:
            meets_90 = pb >= self.roc_threshold.threshold_90_sensitivity
            meets_80 = pb >= self.roc_threshold.threshold_80_sensitivity
            meets_70 = pb >= self.roc_threshold.threshold_70_sensitivity
        else:
            meets_90 = pb <= self.roc_threshold.threshold_90_sensitivity
            meets_80 = pb <= self.roc_threshold.threshold_80_sensitivity
            meets_70 = pb <= self.roc_threshold.threshold_70_sensitivity

        if meets_90:
            olympic_qualifier_prob = 0.8
        elif meets_80:
            olympic_qualifier_prob = 0.5
        elif meets_70:
            olympic_qualifier_prob = 0.25
        else:
            olympic_qualifier_prob = finalist_prob * 0.3
            olympic_qualifier_prob = min(0.15, olympic_qualifier_prob)

        return CompetitiveOutlook(
            finalist_probability=finalist_prob,
            semifinalist_probability=semifinalist_prob,
            olympic_qualifier_probability=olympic_qualifier_prob,
        )

    def _analyze_improvement(
        self,
        races: List[RaceRecord],
        pb: float,
        annual_bests: List[AnnualBest],
        finalist_probability: float,
    ) -> ImprovementAnalysis:
        """
        Analyze improvement rate relative to peer norms.

        Args:
            races: All race records
            pb: Personal best
            annual_bests: Annual best performances
            finalist_probability: Probability of becoming a finalist

        Returns:
            ImprovementAnalysis with improvement comparison
        """
        # Compute improvement rate (% per year) if sufficient data
        current_improvement_rate = None
        is_on_track = False
        comparison = "Insufficient Data"
        explanation = ""

        if len(annual_bests) >= 2:
            # Calculate linear improvement rate
            first_year = annual_bests[0]
            last_year = annual_bests[-1]

            years_elapsed = last_year.age - first_year.age
            if years_elapsed > 0:
                pct_improvement = (
                    first_year.pct_off_pb - last_year.pct_off_pb
                )
                current_improvement_rate = pct_improvement / years_elapsed

                # Expected improvement for finalists
                finalist_norm = self.improvement_norm.finalist_median_pct

                if current_improvement_rate >= finalist_norm * 0.8:
                    comparison = "On Track"
                    is_on_track = True
                    explanation = (
                        f"Improving at {current_improvement_rate:.2f}% per year, "
                        f"which matches or exceeds finalist norms "
                        f"({finalist_norm:.2f}% per year)."
                    )
                elif current_improvement_rate >= finalist_norm * 0.6:
                    comparison = "Above Average"
                    explanation = (
                        f"Improving at {current_improvement_rate:.2f}% per year, "
                        f"which is above non-finalist norms but below finalist "
                        f"norms ({finalist_norm:.2f}% per year)."
                    )
                else:
                    comparison = "Below Average"
                    explanation = (
                        f"Improving at {current_improvement_rate:.2f}% per year, "
                        f"which is below typical rates for elite athletes. "
                        f"Finalist norm: {finalist_norm:.2f}% per year."
                    )

        return ImprovementAnalysis(
            current_improvement_rate=current_improvement_rate,
            finalist_norm=self.improvement_norm.finalist_median_pct,
            comparison=comparison,
            is_on_track=is_on_track,
            explanation=explanation,
        )

    def _generate_benchmarks(
        self,
        current_pct_off_pb: float,
        current_age: int,
        current_time: float,
    ) -> BenchmarksAtAge:
        """
        Generate age-specific performance benchmarks.

        Args:
            current_pct_off_pb: Current % off PB
            current_age: Current age
            current_time: Current best time

        Returns:
            BenchmarksAtAge with percentile thresholds
        """
        benchmark = self.age_percentiles.get(current_age)
        if not benchmark:
            # Use nearest age
            ages = sorted(self.age_percentiles.keys())
            if current_age < ages[0]:
                benchmark = self.age_percentiles[ages[0]]
            else:
                benchmark = self.age_percentiles[ages[-1]]

        # Convert % off PB to actual times/distances using calibration mean
        estimated_pb = self.calibration.mean_time

        if self.is_throws:
            # For throws: distance = pb * (1 - pct_off_pb/100)
            # P90 pct_off_pb is highest (worst), so P90 distance is lowest
            benchmark_p90_time = estimated_pb * (1.0 - benchmark.p90 / 100.0)
            benchmark_p75_time = estimated_pb * (1.0 - benchmark.p75 / 100.0)
            benchmark_p50_time = estimated_pb * (1.0 - benchmark.p50 / 100.0)
            benchmark_p25_time = estimated_pb * (1.0 - benchmark.p25 / 100.0)
            benchmark_p10_time = estimated_pb * (1.0 - benchmark.p10 / 100.0)
        else:
            # For sprints/hurdles: time = pb * (1 + pct_off_pb/100)
            benchmark_p90_time = estimated_pb * (1.0 + benchmark.p90 / 100.0)
            benchmark_p75_time = estimated_pb * (1.0 + benchmark.p75 / 100.0)
            benchmark_p50_time = estimated_pb * (1.0 + benchmark.p50 / 100.0)
            benchmark_p25_time = estimated_pb * (1.0 + benchmark.p25 / 100.0)
            benchmark_p10_time = estimated_pb * (1.0 + benchmark.p10 / 100.0)

        current_percentile = self._interpolate_percentile(
            current_pct_off_pb, benchmark
        )

        # athlete_vs_p50: negative = better than median, positive = worse
        if self.is_throws:
            # For throws: athlete is better if distance > benchmark
            athlete_vs_p50 = benchmark_p50_time - current_time
        else:
            athlete_vs_p50 = current_time - benchmark_p50_time

        return BenchmarksAtAge(
            current_age_benchmark_p90=benchmark_p90_time,
            current_age_benchmark_p75=benchmark_p75_time,
            current_age_benchmark_p50=benchmark_p50_time,
            current_age_benchmark_p25=benchmark_p25_time,
            current_age_benchmark_p10=benchmark_p10_time,
            athlete_current_time=current_time,
            athlete_vs_benchmark_p50=athlete_vs_p50,
            percentile_at_current_age=current_percentile,
        )

    def _generate_recommendations(
        self,
        trajectory_class: TrajectoryClassification,
        percentile_analysis: PercentileAnalysis,
        competitive_outlook: CompetitiveOutlook,
        improvement_analysis: ImprovementAnalysis,
        annual_bests: List[AnnualBest],
    ) -> List[str]:
        """
        Generate actionable recommendations based on analysis.

        Args:
            trajectory_class: Trajectory classification result
            percentile_analysis: Percentile analysis result
            competitive_outlook: Competitive outlook result
            improvement_analysis: Improvement analysis result
            annual_bests: Annual best performances

        Returns:
            List of recommendation strings
        """
        recommendations = []

        # Trajectory-based recommendations
        if trajectory_class.cluster_name == "Early Peaker":
            recommendations.append(
                "You match the 'Early Peaker' trajectory: peak performance in "
                "early-to-mid 20s. Focus on competition strategy and consistency "
                "to maintain peak performance in key competitions."
            )
        elif trajectory_class.cluster_name == "Late Developer":
            recommendations.append(
                "You match the 'Late Developer' trajectory: still improving "
                "into your late 20s. Continue your current training approach "
                "and expect to reach peak around age 26-28."
            )
        elif trajectory_class.cluster_name == "Plateau Pattern":
            recommendations.append(
                "You show a 'Plateau Pattern' with steady performance. Consider "
                "periodically introducing new training stimuli to avoid "
                "long-term plateaus."
            )
        elif trajectory_class.cluster_name == "Prime Peaker":
            recommendations.append(
                "You match the 'Prime Peaker' trajectory: peak performance "
                "concentrated in prime competitive years. Focus on maximizing "
                "performance in major championship windows."
            )
        elif trajectory_class.cluster_name == "Consistent Performer":
            recommendations.append(
                "You match the 'Consistent Performer' trajectory: maintaining "
                "a high level across many years. Your longevity is an asset — "
                "continue smart training to extend your competitive window."
            )

        # Percentile-based recommendations
        if percentile_analysis.percentile_trend == "Improving":
            recommendations.append(
                "Your percentile rank is improving with age. Maintain your "
                "current approach and focus on consistency."
            )
        elif percentile_analysis.percentile_trend == "Declining":
            recommendations.append(
                "Your percentile rank is declining with age. Consider consulting "
                "with a coach to assess training quality, recovery, and "
                "competition strategy."
            )

        # Improvement-based recommendations
        if improvement_analysis.is_on_track:
            recommendations.append(
                f"You're on track for elite performance with improvement rates "
                f"matching finalist norms."
            )
        elif improvement_analysis.comparison == "Below Average":
            recommendations.append(
                f"Your improvement rate ({improvement_analysis.current_improvement_rate:.2f}% "
                f"per year) is below typical elite rates. Consider intensifying "
                f"training or seeking specialized coaching."
            )

        # Competitive outlook-based recommendations
        if competitive_outlook.finalist_probability > 0.7:
            recommendations.append(
                "You have a strong probability of becoming an Olympic finalist. "
                "Focus on peaking for major competitions and minimizing injuries."
            )
        elif competitive_outlook.finalist_probability > 0.4:
            recommendations.append(
                "You have a moderate probability of reaching the Olympic level. "
                "Continued improvement and competition experience are critical."
            )
        else:
            recommendations.append(
                "While your current performance is below the elite threshold, "
                "continued development and strategic competition planning could "
                "improve your prospects."
            )

        # Age-based recommendations
        if annual_bests and annual_bests[-1].age < 24:
            recommendations.append(
                "You're still in your development years. Emphasize long-term "
                "development and injury prevention over short-term results."
            )
        elif annual_bests and annual_bests[-1].age > 28:
            recommendations.append(
                "You're in the veteran stage. Prioritize recovery and managing "
                "training load to maintain performance."
            )

        return recommendations


# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================


def create_analyzer(
    discipline: str, gender: str, athlete_name: str = "Unknown"
) -> AthleteAnalyzer:
    """
    Factory function to create an AthleteAnalyzer instance.

    Args:
        discipline: Event name (e.g., "100m", "110mH")
        gender: "M" or "F"
        athlete_name: Optional athlete name

    Returns:
        AthleteAnalyzer instance

    Raises:
        ValueError: If discipline or gender is invalid
    """
    return AthleteAnalyzer(discipline, gender, athlete_name)
