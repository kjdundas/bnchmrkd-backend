"""
AnalysisService orchestrates the analysis pipeline.

Bridges the API layer (schemas) with the core analyzer engine.
Handles data preprocessing, age computation, and result formatting.
"""

from datetime import date, datetime
from typing import Any, Optional

from app.models.schemas import (
    RaceInput,
    ScrapedAthleteData,
)
from app.core.analyzer import (
    AthleteAnalyzer,
    RaceRecord,
    AnalysisResult as CoreAnalysisResult,
)
from app.core.benchmarks import (
    AGE_PERFORMANCE_PERCENTILES,
    ROC_THRESHOLDS,
    IMPROVEMENT_NORMS,
    get_event_code,
    VALID_DISCIPLINES,
    THROWS_DISCIPLINES,
    get_implement_weight_for_age,
    SENIOR_WEIGHTS,
)


class AnalysisService:
    """
    Service layer for athlete analysis orchestration.

    Converts API-layer schemas into core analyzer inputs, runs the
    analysis pipeline, and formats results for the API response.
    """

    async def analyze(
        self,
        scraped_data: ScrapedAthleteData,
        discipline: str,
        gender: str,
    ) -> dict[str, Any]:
        """
        Run full analysis pipeline on scraped athlete data.

        Args:
            scraped_data: Standardized athlete data from scraper
            discipline: Event code (e.g., '100m')
            gender: Gender identifier ('M' or 'F')

        Returns:
            Dictionary with full analysis output

        Raises:
            ValueError: If data validation fails
        """
        if not scraped_data.races:
            raise ValueError("No race data provided for analysis")

        # Compute age from DOB if available
        dob = scraped_data.date_of_birth

        # Convert API RaceInput objects to core RaceRecord objects
        core_races = []
        for race in scraped_data.races:
            # Compute age at time of race
            race_date = datetime.combine(race.race_date, datetime.min.time())
            if dob:
                age_at_race = self._age_at_date(dob, race.race_date)
            else:
                raise ValueError(
                    "Date of birth is required to compute age at each race"
                )

            core_races.append(
                RaceRecord(
                    date=race_date,
                    time_seconds=race.time_seconds,
                    wind_mps=race.wind_mps,
                    wind_legal=race.wind_legal,
                    competition=race.competition or "",
                    age=age_at_race,
                )
            )

        # Initialize the core analyzer
        analyzer = AthleteAnalyzer(
            discipline=discipline,
            gender=gender,
            athlete_name=scraped_data.athlete_name,
        )

        # Run analysis
        result: CoreAnalysisResult = analyzer.analyze(core_races)

        # Format into API-friendly dictionary
        return self._format_result(result)

    async def quick_analyze(
        self,
        discipline: str,
        gender: str,
        age: int,
        personal_best: float,
        implement_weight_kg: Optional[float] = None,
    ) -> dict[str, Any]:
        """
        Quick analysis from personal best only.

        Creates a minimal race record and runs the analyzer.

        Args:
            discipline: Event code
            gender: Gender identifier
            age: Current age in years
            personal_best: Personal best time in seconds (sprints) or metres (throws)
            implement_weight_kg: Implement weight in kg for throws (optional)

        Returns:
            Dictionary with percentile, projection, and outlook
        """
        if personal_best <= 0:
            raise ValueError("Personal best must be positive")
        if age < 10 or age > 120:
            raise ValueError("Age must be between 10 and 120")

        # For throws, resolve implement weight if not provided
        is_throws = discipline in THROWS_DISCIPLINES
        resolved_weight = implement_weight_kg
        if is_throws and resolved_weight is None:
            # Default to WA standard weight for the athlete's age group
            resolved_weight = get_implement_weight_for_age(discipline, gender, age)

        # Create a single race record for quick analysis
        core_races = [
            RaceRecord(
                date=datetime.now(),
                time_seconds=personal_best,
                wind_mps=None,
                wind_legal=True,
                competition="Quick Analysis",
                age=age,
            )
        ]

        analyzer = AthleteAnalyzer(
            discipline=discipline,
            gender=gender,
            athlete_name="Quick Analysis",
        )

        result: CoreAnalysisResult = analyzer.analyze(core_races)

        response = {
            "percentile": result.percentile_analysis.current_percentile,
            "age_category": self._age_category(age),
            "projection_peak_time": result.peak_projection.projected_peak_time,
            "projection_peak_age": result.peak_projection.projected_peak_age,
            "outlook": self._outlook_label(
                result.competitive_outlook.finalist_probability
            ),
            "finalist_probability": result.competitive_outlook.finalist_probability,
            "trajectory": result.trajectory_classification.cluster_name,
            "recommendations": result.recommendations,
        }

        # Include weight info for throws
        if is_throws and resolved_weight:
            senior_weight = SENIOR_WEIGHTS.get((discipline, gender))
            response["implement_weight_kg"] = resolved_weight
            response["is_senior_weight"] = (
                senior_weight is not None and abs(resolved_weight - senior_weight) < 0.01
            )

        return response

    async def get_benchmarks(
        self, discipline: str, gender: str
    ) -> dict[str, Any]:
        """
        Retrieve benchmark data for a discipline and gender.

        Args:
            discipline: Event code
            gender: Gender identifier

        Returns:
            Dictionary of benchmark data (thresholds, percentiles, norms)
        """
        event_code = get_event_code(discipline, gender)

        age_percentiles = AGE_PERFORMANCE_PERCENTILES.get(event_code, {})
        roc_thresholds = ROC_THRESHOLDS.get(event_code)
        improvement_norms = IMPROVEMENT_NORMS.get(event_code)

        # Format age percentiles
        formatted_percentiles = {}
        for age, ap in age_percentiles.items():
            formatted_percentiles[age] = {
                "p10": ap.p10,
                "p25": ap.p25,
                "p50": ap.p50,
                "p75": ap.p75,
                "p90": ap.p90,
            }

        benchmarks: dict[str, Any] = {
            "event_code": event_code,
            "age_percentiles": formatted_percentiles,
        }

        if roc_thresholds:
            benchmarks["roc_thresholds"] = {
                "optimal_threshold": roc_thresholds.optimal_threshold,
                "threshold_90_sensitivity": roc_thresholds.threshold_90_sensitivity,
                "threshold_80_sensitivity": roc_thresholds.threshold_80_sensitivity,
                "threshold_70_sensitivity": roc_thresholds.threshold_70_sensitivity,
            }

        if improvement_norms:
            benchmarks["improvement_norms"] = {
                "finalist_median_pct": improvement_norms.finalist_median_pct,
                "finalist_std_pct": improvement_norms.finalist_std_pct,
                "non_finalist_median_pct": improvement_norms.non_finalist_median_pct,
                "non_finalist_std_pct": improvement_norms.non_finalist_std_pct,
            }

        return benchmarks

    def _format_result(self, result: CoreAnalysisResult) -> dict[str, Any]:
        """
        Format CoreAnalysisResult into API response dictionary.

        Args:
            result: Core analysis result

        Returns:
            Formatted dictionary for API consumption
        """
        summary = result.athlete_summary

        return {
            "athlete_summary": summary,
            "annual_best_series": [
                {
                    "age": ab.age,
                    "best_time": ab.best_time,
                    "n_races": ab.n_races,
                    "pct_off_pb": ab.pct_off_pb,
                }
                for ab in result.annual_best_series
            ],
            "trajectory_classification": {
                "cluster_name": result.trajectory_classification.cluster_name,
                "confidence": result.trajectory_classification.confidence,
                "description": result.trajectory_classification.description,
                "cluster_index": result.trajectory_classification.cluster_index,
            },
            "percentile_analysis": {
                "current_percentile": result.percentile_analysis.current_percentile,
                "percentile_at_18": result.percentile_analysis.percentile_at_18,
                "percentile_at_20": result.percentile_analysis.percentile_at_20,
                "percentile_trend": result.percentile_analysis.percentile_trend,
                "benchmark_time_at_current_age": result.percentile_analysis.benchmark_time_at_current_age,
            },
            "peak_projection": {
                "projected_peak_time": result.peak_projection.projected_peak_time,
                "projected_peak_age": result.peak_projection.projected_peak_age,
                "confidence_interval_lower": result.peak_projection.confidence_interval_lower,
                "confidence_interval_upper": result.peak_projection.confidence_interval_upper,
                "confidence": result.peak_projection.confidence,
                "years_to_peak": result.peak_projection.years_to_peak,
            },
            "competitive_outlook": {
                "finalist_probability": result.competitive_outlook.finalist_probability,
                "semifinalist_probability": result.competitive_outlook.semifinalist_probability,
                "olympic_qualifier_probability": result.competitive_outlook.olympic_qualifier_probability,
            },
            "improvement_analysis": {
                "current_improvement_rate": result.improvement_analysis.current_improvement_rate,
                "finalist_norm": result.improvement_analysis.finalist_norm,
                "comparison": result.improvement_analysis.comparison,
                "is_on_track": result.improvement_analysis.is_on_track,
                "explanation": result.improvement_analysis.explanation,
            },
            "benchmarks_at_age": {
                "current_age_benchmark_p90": result.benchmarks_at_age.current_age_benchmark_p90,
                "current_age_benchmark_p75": result.benchmarks_at_age.current_age_benchmark_p75,
                "current_age_benchmark_p50": result.benchmarks_at_age.current_age_benchmark_p50,
                "current_age_benchmark_p25": result.benchmarks_at_age.current_age_benchmark_p25,
                "current_age_benchmark_p10": result.benchmarks_at_age.current_age_benchmark_p10,
                "athlete_current_time": result.benchmarks_at_age.athlete_current_time,
                "athlete_vs_benchmark_p50": result.benchmarks_at_age.athlete_vs_benchmark_p50,
                "percentile_at_current_age": result.benchmarks_at_age.percentile_at_current_age,
            },
            "recommendations": result.recommendations,
        }

    @staticmethod
    def _age_at_date(dob: date, race_date: date) -> int:
        """Compute age at a specific date."""
        age = race_date.year - dob.year
        if (race_date.month, race_date.day) < (dob.month, dob.day):
            age -= 1
        return age

    @staticmethod
    def _age_category(age: int) -> str:
        """Classify age into development category."""
        if age < 18:
            return "Youth"
        elif age < 20:
            return "Junior"
        elif age < 23:
            return "U23"
        elif age < 28:
            return "Peak Development"
        elif age < 32:
            return "Prime"
        else:
            return "Veteran"

    @staticmethod
    def _outlook_label(finalist_probability: float) -> str:
        """Convert finalist probability to human-readable outlook."""
        if finalist_probability >= 0.8:
            return "Elite — Strong finalist potential"
        elif finalist_probability >= 0.6:
            return "Competitive — Developing finalist profile"
        elif finalist_probability >= 0.4:
            return "Promising — On the radar"
        elif finalist_probability >= 0.2:
            return "Emerging — Early signs of talent"
        else:
            return "Developing — Building foundations"
