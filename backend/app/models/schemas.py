"""
Pydantic v2 models for API request/response schemas.

Defines all data validation, serialization, and API contracts.
"""

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class RaceInput(BaseModel):
    """
    Single race/performance result.

    Attributes:
        date: Date of the race
        time_seconds: Time in seconds (positive number)
        wind_mps: Wind assistance in meters per second (-10 to +10 range)
        competition: Optional name of the competition
        wind_legal: Computed flag indicating if wind is legal (auto-calculated)
    """

    race_date: date = Field(..., description="Date of the race")
    time_seconds: float = Field(
        ..., gt=0, description="Time in seconds (must be positive)"
    )
    wind_mps: Optional[float] = Field(
        None,
        ge=-10,
        le=10,
        description="Wind assistance in m/s (optional, -10 to +10)",
    )
    competition: Optional[str] = Field(None, description="Competition name (optional)")
    wind_legal: bool = Field(default=True, description="Whether wind is legal")

    @field_validator("wind_mps")
    @classmethod
    def validate_wind(cls, v: Optional[float]) -> Optional[float]:
        """Validate wind measurement is within acceptable range."""
        if v is not None and (v < -10 or v > 10):
            raise ValueError("Wind must be between -10 and +10 m/s")
        return v

    @model_validator(mode="after")
    def compute_wind_legal(self) -> "RaceInput":
        """Compute wind legality based on wind speed."""
        if self.wind_mps is None:
            self.wind_legal = True
        else:
            self.wind_legal = self.wind_mps <= 2.0
        return self


class ManualAnalysisRequest(BaseModel):
    """
    Request to analyze an athlete from manual race input.

    Attributes:
        discipline: Event code (e.g., '100m', '400m')
        gender: Gender identifier ('M' or 'F')
        athlete_name: Full name of the athlete
        date_of_birth: Athlete's date of birth
        races: List of RaceInput objects with performance results
    """

    discipline: str = Field(
        ...,
        min_length=1,
        max_length=20,
        description="Event code (e.g., '100m', '400m')",
    )
    gender: str = Field(
        ...,
        pattern="^[MF]$",
        description="Gender identifier ('M' or 'F')",
    )
    athlete_name: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Full name of the athlete",
    )
    date_of_birth: date = Field(..., description="Athlete's date of birth")
    races: list[RaceInput] = Field(
        ...,
        min_length=1,
        max_length=500,
        description="List of race results (minimum 1, maximum 500)",
    )

    @field_validator("date_of_birth")
    @classmethod
    def validate_dob(cls, v: date) -> date:
        """Validate date of birth is in the past."""
        if v > date.today():
            raise ValueError("Date of birth must be in the past")
        return v


class URLAnalysisRequest(BaseModel):
    """
    Request to analyze an athlete from a World Athletics profile URL.

    Attributes:
        url: World Athletics profile URL
        discipline: Optional event code (will be inferred if not provided)
    """

    url: str = Field(
        ...,
        min_length=10,
        description="World Athletics profile URL (worldathletics.org)",
    )
    discipline: Optional[str] = Field(
        None,
        min_length=1,
        max_length=20,
        description="Event code (optional, inferred from profile if not provided)",
    )

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        """Validate URL format and domain."""
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        if "worldathletics.org" not in v:
            raise ValueError("URL must be from worldathletics.org")
        return v


class QuickAnalysisRequest(BaseModel):
    """
    Request for quick analysis from personal best only.

    Attributes:
        discipline: Event code (e.g., '100m', '400m')
        gender: Gender identifier ('M' or 'F')
        age: Current age in years
        personal_best: Personal best time in seconds
    """

    discipline: str = Field(
        ...,
        min_length=1,
        max_length=20,
        description="Event code (e.g., '100m', '400m')",
    )
    gender: str = Field(
        ...,
        pattern="^[MF]$",
        description="Gender identifier ('M' or 'F')",
    )
    age: int = Field(
        ...,
        ge=10,
        le=120,
        description="Current age in years (10-120)",
    )
    personal_best: float = Field(
        ...,
        gt=0,
        description="Personal best time in seconds (must be positive)",
    )


class AnalysisResponse(BaseModel):
    """
    API response wrapper for analysis results.

    Wraps the full analysis output from the core analyzer
    with metadata about the request.
    """

    success: bool = Field(True, description="Whether analysis succeeded")
    data: dict[str, Any] = Field(..., description="Complete analysis result")
    source: str = Field(..., description="Data source ('manual' or 'world_athletics')")
    athlete_name: Optional[str] = Field(None, description="Athlete name")
    scraped_races: Optional[int] = Field(
        None, description="Number of races scraped (if from URL)"
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow, description="Response timestamp"
    )


class BenchmarkResponse(BaseModel):
    """
    API response for benchmark data.

    Attributes:
        success: Whether retrieval succeeded
        discipline: Event code
        gender: Gender identifier
        benchmarks: Dictionary of benchmark data (thresholds, percentiles, norms)
    """

    success: bool = Field(True, description="Whether retrieval succeeded")
    discipline: str = Field(..., description="Event code")
    gender: str = Field(..., description="Gender identifier")
    benchmarks: dict[str, Any] = Field(
        ..., description="Benchmark thresholds and percentile norms"
    )


class DisciplineInfo(BaseModel):
    """
    Metadata about a supported athletics discipline.

    Attributes:
        name: Full name of the discipline
        code: Short code (e.g., '100m')
        genders: List of supported genders
        supported: Whether this discipline is currently supported
    """

    name: str = Field(..., description="Full name of the discipline")
    code: str = Field(..., description="Short code (e.g., '100m', 'Discus Throw')")
    genders: list[str] = Field(..., description="Supported genders ('M', 'F')")
    category: str = Field("Sprints", description="Category: Sprints, Hurdles, or Throws")
    supported: bool = Field(True, description="Whether discipline is supported")


class ScrapedAthleteData(BaseModel):
    """
    Standardized athlete data format after scraping.

    Attributes:
        athlete_name: Full name of the athlete
        discipline: Event code
        gender: Gender identifier
        date_of_birth: Optional date of birth
        races: List of RaceInput objects
    """

    athlete_name: str = Field(..., description="Full name of the athlete")
    discipline: Optional[str] = Field(None, description="Event code")
    gender: str = Field(..., description="Gender identifier")
    date_of_birth: Optional[date] = Field(None, description="Date of birth")
    races: list[RaceInput] = Field(..., description="List of race results")
