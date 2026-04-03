"""
API route handlers for BnchMrkd backend.

Defines endpoints for:
- Manual athlete analysis
- URL-based athlete scraping and analysis
- Quick analysis from personal best
- Benchmark data retrieval
- Discipline information
"""

from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.models.schemas import (
    AnalysisResponse,
    BenchmarkResponse,
    DisciplineInfo,
    ManualAnalysisRequest,
    QuickAnalysisRequest,
    URLAnalysisRequest,
)
from app.services.analysis_service import AnalysisService
from app.scrapers.manual import ManualScraper
from app.scrapers.world_athletics import WorldAthleticsScraper

# Create router
router = APIRouter(prefix="/api/v1", tags=["analysis"])

# Initialize services and scrapers
analysis_service = AnalysisService()
world_athletics_scraper = WorldAthleticsScraper()
manual_scraper = ManualScraper()

# Supported disciplines (matching benchmarks.py VALID_DISCIPLINES)
SUPPORTED_DISCIPLINES = {
    # Sprints
    "100m": {"name": "100 Metres", "code": "100m", "genders": ["M", "F"], "category": "Sprints"},
    "200m": {"name": "200 Metres", "code": "200m", "genders": ["M", "F"], "category": "Sprints"},
    "400m": {"name": "400 Metres", "code": "400m", "genders": ["M", "F"], "category": "Sprints"},
    # Hurdles
    "100mH": {"name": "100m Hurdles", "code": "100mH", "genders": ["F"], "category": "Hurdles"},
    "110mH": {"name": "110m Hurdles", "code": "110mH", "genders": ["M"], "category": "Hurdles"},
    "400mH": {"name": "400m Hurdles", "code": "400mH", "genders": ["M", "F"], "category": "Hurdles"},
    # Throws
    "Discus Throw": {"name": "Discus Throw", "code": "Discus Throw", "genders": ["M", "F"], "category": "Throws"},
    "Javelin Throw": {"name": "Javelin Throw", "code": "Javelin Throw", "genders": ["M", "F"], "category": "Throws"},
    "Hammer Throw": {"name": "Hammer Throw", "code": "Hammer Throw", "genders": ["M", "F"], "category": "Throws"},
    "Shot Put": {"name": "Shot Put", "code": "Shot Put", "genders": ["M", "F"], "category": "Throws"},
}


@router.post(
    "/analyze/manual",
    response_model=AnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze athlete from manual input",
    description="Analyze an athlete's performance based on manually provided race results",
)
async def analyze_manual(request: ManualAnalysisRequest) -> AnalysisResponse:
    """
    Analyze an athlete based on manually provided race data.

    Args:
        request: ManualAnalysisRequest containing discipline, gender, athlete name,
                date of birth, and list of race results

    Returns:
        AnalysisResponse: Complete analysis including projections and benchmarks
    """
    try:
        # Validate discipline
        if request.discipline not in SUPPORTED_DISCIPLINES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported discipline: {request.discipline}. "
                f"Supported: {list(SUPPORTED_DISCIPLINES.keys())}",
            )

        # Validate gender for discipline
        supported_genders = SUPPORTED_DISCIPLINES[request.discipline]["genders"]
        if request.gender not in supported_genders:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported gender for {request.discipline}: {request.gender}. "
                f"Supported: {supported_genders}",
            )

        # Process manual input through scraper for standardization
        scraped_data = await manual_scraper.scrape(request)

        # Run analysis
        result = await analysis_service.analyze(
            scraped_data=scraped_data,
            discipline=request.discipline,
            gender=request.gender,
        )

        return AnalysisResponse(
            success=True,
            data=result,
            source="manual",
            athlete_name=request.athlete_name,
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}",
        )


@router.post(
    "/analyze/url",
    response_model=AnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze athlete from URL",
    description="Scrape and analyze an athlete's performance from a World Athletics profile URL",
)
async def analyze_url(request: URLAnalysisRequest) -> AnalysisResponse:
    """
    Analyze an athlete by scraping their profile from World Athletics.

    Args:
        request: URLAnalysisRequest containing World Athletics profile URL

    Returns:
        AnalysisResponse: Complete analysis including scraped race data
    """
    try:
        if not world_athletics_scraper.can_handle(request.url):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="URL must be a World Athletics profile (worldathletics.org/athlete/...)",
            )

        scraped_data = await world_athletics_scraper.scrape(request.url)

        discipline = request.discipline or scraped_data.discipline
        if not discipline:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not determine discipline from URL. Please provide discipline parameter.",
            )

        if discipline not in SUPPORTED_DISCIPLINES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported discipline: {discipline}",
            )

        result = await analysis_service.analyze(
            scraped_data=scraped_data,
            discipline=discipline,
            gender=scraped_data.gender,
        )

        return AnalysisResponse(
            success=True,
            data=result,
            source="world_athletics",
            athlete_name=scraped_data.athlete_name,
            scraped_races=len(scraped_data.races),
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scraping or analysis failed: {str(e)}",
        )


@router.post(
    "/analyze/quick",
    status_code=status.HTTP_200_OK,
    summary="Quick analysis from personal best",
    description="Perform a quick analysis using only an athlete's personal best time",
)
async def analyze_quick(request: QuickAnalysisRequest) -> dict[str, Any]:
    """
    Quick analysis based solely on personal best time.

    Args:
        request: QuickAnalysisRequest with discipline, gender, age, PB

    Returns:
        Dictionary with percentile, projection, and outlook
    """
    try:
        if request.discipline not in SUPPORTED_DISCIPLINES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported discipline: {request.discipline}",
            )

        supported_genders = SUPPORTED_DISCIPLINES[request.discipline]["genders"]
        if request.gender not in supported_genders:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported gender for {request.discipline}",
            )

        result = await analysis_service.quick_analyze(
            discipline=request.discipline,
            gender=request.gender,
            age=request.age,
            personal_best=request.personal_best,
        )

        return {
            "success": True,
            "discipline": request.discipline,
            "gender": request.gender,
            "age": request.age,
            "personal_best": request.personal_best,
            "analysis": result,
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Quick analysis failed: {str(e)}",
        )


@router.get(
    "/benchmarks/{discipline}/{gender}",
    response_model=BenchmarkResponse,
    status_code=status.HTTP_200_OK,
    summary="Get benchmark data",
    description="Retrieve benchmark thresholds and percentile norms for a discipline and gender",
)
async def get_benchmarks(discipline: str, gender: str) -> BenchmarkResponse:
    """
    Retrieve benchmark data for a specific discipline and gender.

    Args:
        discipline: Event code (e.g., '100m', '400m')
        gender: Gender identifier ('M' or 'F')

    Returns:
        BenchmarkResponse: Benchmark thresholds, percentiles, and norms
    """
    try:
        if discipline not in SUPPORTED_DISCIPLINES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported discipline: {discipline}",
            )

        supported_genders = SUPPORTED_DISCIPLINES[discipline]["genders"]
        if gender not in supported_genders:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported gender for {discipline}",
            )

        benchmark_data = await analysis_service.get_benchmarks(
            discipline=discipline,
            gender=gender,
        )

        return BenchmarkResponse(
            success=True,
            discipline=discipline,
            gender=gender,
            benchmarks=benchmark_data,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve benchmarks: {str(e)}",
        )


@router.get(
    "/disciplines",
    status_code=status.HTTP_200_OK,
    summary="Get supported disciplines",
    description="List all supported athletics disciplines with metadata",
)
async def get_disciplines() -> dict[str, Any]:
    """
    Retrieve list of supported athletics disciplines.

    Returns:
        Dictionary containing list of DisciplineInfo objects and count
    """
    disciplines = [
        DisciplineInfo(
            name=info["name"],
            code=info["code"],
            genders=info["genders"],
            category=info.get("category", "Sprints"),
            supported=True,
        )
        for info in SUPPORTED_DISCIPLINES.values()
    ]

    return {
        "success": True,
        "count": len(disciplines),
        "disciplines": disciplines,
    }
