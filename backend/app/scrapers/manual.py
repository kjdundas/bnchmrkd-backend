"""
Manual input adapter for athlete data.

Validates and normalizes manually entered race results into standardized format.
"""

from app.models.schemas import (
    ManualAnalysisRequest,
    RaceInput,
    ScrapedAthleteData,
)
from app.scrapers.base import BaseScraper


class ManualScraper(BaseScraper):
    """
    Adapter for manually entered athlete data.

    Validates race input, computes wind legality, and normalizes into
    standardized ScrapedAthleteData format for analysis.

    This is not a true scraper but follows the scraper interface for
    consistent data handling across input sources.
    """

    def can_handle(self, url: str) -> bool:
        """
        Manual scraper does not handle URLs.

        Args:
            url: URL (ignored)

        Returns:
            False - manual scraper only handles direct input
        """
        return False

    async def scrape(self, request: ManualAnalysisRequest) -> ScrapedAthleteData:
        """
        Convert manual input request to standardized athlete data.

        Validates all fields and normalizes race data.

        Args:
            request: ManualAnalysisRequest with athlete and race data

        Returns:
            ScrapedAthleteData in standardized format

        Raises:
            ValueError: If any validation fails
        """
        if not request.races:
            raise ValueError("At least one race result is required")

        # Validate and normalize races
        normalized_races = []
        for race in request.races:
            # Races are already RaceInput objects with validation applied
            # but we ensure wind_legal is set based on discipline
            self._compute_wind_legality(race, request.discipline)
            normalized_races.append(race)

        # Create standardized output
        return ScrapedAthleteData(
            athlete_name=request.athlete_name,
            discipline=request.discipline,
            gender=request.gender,
            date_of_birth=request.date_of_birth,
            races=normalized_races,
        )

    @staticmethod
    def _compute_wind_legality(race: RaceInput, discipline: str) -> None:
        """
        Compute wind legality flag based on discipline and wind speed.

        For sprints (100m, 200m), wind is legal if <= 2.0 m/s.
        For 400m+, wind is not a factor (always legal).

        Args:
            race: RaceInput object to update
            discipline: Event code

        Side effects:
            Updates race.wind_legal in place
        """
        if discipline in ("400m", "800m", "1500m", "5000m", "10000m"):
            # Wind not a factor for longer events
            race.wind_legal = True
        elif discipline in ("100m", "200m"):
            # Short sprints: wind <= 2.0 m/s is legal
            if race.wind_mps is None:
                race.wind_legal = True
            else:
                race.wind_legal = race.wind_mps <= 2.0
        else:
            # Default: mark as legal if no wind or wind <= 2.0
            race.wind_legal = (
                True if race.wind_mps is None else race.wind_mps <= 2.0
            )
