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
    RaceInput,
    ScrapedAthleteData,
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

        raw = await world_athletics_scraper.scrape(request.url)

        # Scraper returns a dict with "disciplines": { "100m": [...], "200m": [...] }
        # Pick the requested discipline or the one with the most races
        disciplines_dict = raw.get("disciplines", {})
        if not disciplines_dict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No competition results found for this athlete",
            )

        discipline = request.discipline
        if not discipline:
            # Auto-pick: prefer supported disciplines, then most races
            supported_discs = {d: races for d, races in disciplines_dict.items() if d in SUPPORTED_DISCIPLINES}
            if supported_discs:
                discipline = max(supported_discs, key=lambda d: len(supported_discs[d]))
            else:
                discipline = max(disciplines_dict, key=lambda d: len(disciplines_dict[d]))

        if discipline not in SUPPORTED_DISCIPLINES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported discipline: {discipline}. Found: {', '.join(disciplines_dict.keys())}",
            )

        raw_races = disciplines_dict.get(discipline, [])
        if not raw_races:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No races found for {discipline}. Available: {', '.join(disciplines_dict.keys())}",
            )

        # Convert raw race dicts to RaceInput objects
        from datetime import date as date_type
        race_inputs = []
        for r in raw_races:
            race_date = r.get("date")
            if isinstance(race_date, str):
                try:
                    race_date = date_type.fromisoformat(race_date)
                except ValueError:
                    continue
            elif not isinstance(race_date, date_type):
                continue

            time_val = r.get("time") or r.get("mark") or r.get("distance")
            if not time_val or not isinstance(time_val, (int, float)) or time_val <= 0:
                continue

            race_inputs.append(RaceInput(
                race_date=race_date,
                time_seconds=float(time_val),
                wind_mps=r.get("wind"),
                competition=r.get("competition"),
                wind_legal=r.get("wind_legal", True),
                implement_weight_kg=r.get("implement_weight_kg"),
            ))

        if not race_inputs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not parse any valid races for {discipline}",
            )

        # Build ScrapedAthleteData
        dob_str = raw.get("dob")
        dob = None
        if dob_str:
            try:
                dob = date_type.fromisoformat(dob_str) if isinstance(dob_str, str) else dob_str
            except ValueError:
                pass

        scraped_data = ScrapedAthleteData(
            athlete_name=raw.get("athlete_name", "Unknown"),
            discipline=discipline,
            gender=raw.get("gender", "M"),
            date_of_birth=dob,
            races=race_inputs,
        )

        result = await analysis_service.analyze(
            scraped_data=scraped_data,
            discipline=discipline,
            gender=scraped_data.gender,
        )

        # Build raw disciplines_data for ALL supported disciplines so the
        # frontend can analyze and toggle between them.
        disciplines_data: dict[str, list[dict]] = {}
        for disc_code, disc_races in disciplines_dict.items():
            if disc_code not in SUPPORTED_DISCIPLINES:
                continue
            cleaned = []
            for r in disc_races:
                rd = r.get("date")
                if isinstance(rd, str):
                    try:
                        rd_iso = date_type.fromisoformat(rd).isoformat()
                    except ValueError:
                        continue
                elif isinstance(rd, date_type):
                    rd_iso = rd.isoformat()
                else:
                    continue
                tv = r.get("time") or r.get("mark") or r.get("distance")
                if not tv or not isinstance(tv, (int, float)) or tv <= 0:
                    continue
                cleaned.append({
                    "date": rd_iso,
                    "value": float(tv),
                    "wind": r.get("wind"),
                    "competition": r.get("competition"),
                    "implement_weight_kg": r.get("implement_weight_kg"),
                })
            if cleaned:
                disciplines_data[disc_code] = cleaned

        # Include raw scraped info in response for the dashboard
        result["_scraped"] = {
            "athlete_name": raw.get("athlete_name"),
            "gender": raw.get("gender"),
            "dob": raw.get("dob"),
            "nationality": raw.get("nationality"),
            "discipline": discipline,
            "total_races": len(race_inputs),
            "all_disciplines": list(disciplines_dict.keys()),
            "supported_disciplines": list(disciplines_data.keys()),
            "disciplines_data": disciplines_data,
            "races": [{"date": str(r.race_date), "value": r.time_seconds, "wind": r.wind_mps, "competition": r.competition, "implement_weight_kg": r.implement_weight_kg} for r in race_inputs],
        }

        return AnalysisResponse(
            success=True,
            data=result,
            source="world_athletics",
            athlete_name=scraped_data.athlete_name,
            scraped_races=len(race_inputs),
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
            implement_weight_kg=request.implement_weight_kg,
        )

        return {
            "success": True,
            "discipline": request.discipline,
            "gender": request.gender,
            "age": request.age,
            "personal_best": request.personal_best,
            "implement_weight_kg": request.implement_weight_kg,
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
