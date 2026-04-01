"""
Abstract base class for athlete data scrapers.

Defines the interface that all scraper implementations must follow.
"""

from abc import ABC, abstractmethod

from app.models.schemas import ScrapedAthleteData


class BaseScraper(ABC):
    """
    Abstract base class for athlete profile scrapers.

    All scraper implementations must inherit from this class and implement
    the required methods.
    """

    @abstractmethod
    async def scrape(self, url: str) -> ScrapedAthleteData:
        """
        Scrape athlete data from a URL.

        Returns standardized race records and athlete information.

        Args:
            url: URL of the athlete profile to scrape

        Returns:
            ScrapedAthleteData with athlete info and race results

        Raises:
            ValueError: If URL format is invalid or data cannot be parsed
            RuntimeError: If scraping fails due to network or parsing issues
        """
        pass

    @abstractmethod
    def can_handle(self, url: str) -> bool:
        """
        Check if this scraper can handle the given URL.

        Args:
            url: URL to check

        Returns:
            True if this scraper can handle the URL, False otherwise
        """
        pass
