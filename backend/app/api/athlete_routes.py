"""
API routes for athlete browsing, career trajectories, and similar athlete matching.

These endpoints query the Supabase PostgreSQL database directly,
replacing the embedded SIMILAR_ATHLETES data in the frontend.
"""

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.core.database import get_db

router = APIRouter(prefix="/api/v1", tags=["athletes"])


# ============================================================
# ATHLETE SEARCH & BROWSE
# ============================================================

@router.get(
    "/athletes",
    status_code=status.HTTP_200_OK,
    summary="Search and browse athletes",
    description="Search athletes by name with optional discipline filter. Powers the dropdown autocomplete.",
)
async def search_athletes(
    search: Optional[str] = Query(None, description="Name search query"),
    discipline: Optional[str] = Query(None, description="Discipline code filter (e.g. M100, F400H)"),
    limit: int = Query(50, ge=1, le=200, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
) -> dict[str, Any]:
    """Search athletes with optional filters."""
    with get_db() as (conn, cur):
        conditions = []
        params = []

        if search:
            conditions.append("a.name ILIKE %s")
            params.append(f"%{search}%")

        if discipline:
            conditions.append("d.code = %s")
            params.append(discipline)

        where = "WHERE " + " AND ".join(conditions) if conditions else ""

        cur.execute(f"""
            SELECT
                a.id,
                a.name,
                a.gender,
                a.country,
                a.date_of_birth,
                d.code AS discipline_code,
                d.name AS discipline_name,
                pb.pb_time,
                (SELECT COUNT(DISTINCT sb.season_year)
                 FROM season_bests sb
                 WHERE sb.athlete_id = a.id AND sb.discipline_id = pb.discipline_id
                ) AS n_seasons
            FROM athletes a
            JOIN personal_bests pb ON pb.athlete_id = a.id
            JOIN disciplines d ON d.id = pb.discipline_id
            {where}
            ORDER BY a.name, d.code
            LIMIT %s OFFSET %s
        """, params + [limit, offset])

        athletes = cur.fetchall()

        # Get total count
        cur.execute(f"""
            SELECT COUNT(DISTINCT a.id)
            FROM athletes a
            JOIN personal_bests pb ON pb.athlete_id = a.id
            JOIN disciplines d ON d.id = pb.discipline_id
            {where}
        """, params)
        total = cur.fetchone()["count"]

    return {
        "success": True,
        "total": total,
        "limit": limit,
        "offset": offset,
        "athletes": [dict(row) for row in athletes],
    }


@router.get(
    "/athletes/{athlete_id}",
    status_code=status.HTTP_200_OK,
    summary="Get athlete profile",
    description="Full athlete profile with personal bests across all disciplines.",
)
async def get_athlete(athlete_id: int) -> dict[str, Any]:
    """Get a single athlete's full profile."""
    with get_db() as (conn, cur):
        # Basic info
        cur.execute("""
            SELECT id, name, gender, country, date_of_birth, doping_flag
            FROM athletes WHERE id = %s
        """, [athlete_id])
        athlete = cur.fetchone()

        if not athlete:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Athlete with id {athlete_id} not found",
            )

        # Personal bests per discipline
        cur.execute("""
            SELECT d.code AS discipline_code, d.name AS discipline_name,
                   pb.pb_time, pb.pb_date, pb.total_races, pb.avg_time, pb.std_dev
            FROM personal_bests pb
            JOIN disciplines d ON d.id = pb.discipline_id
            WHERE pb.athlete_id = %s
            ORDER BY d.code
        """, [athlete_id])
        pbs = cur.fetchall()

        # Olympic results
        cur.execute("""
            SELECT d.code AS discipline_code, o.games, o.year, o.round,
                   o.time_seconds, o.rank, o.status
            FROM olympic_results o
            JOIN disciplines d ON d.id = o.discipline_id
            WHERE o.athlete_id = %s
            ORDER BY o.year, d.code
        """, [athlete_id])
        olympics = cur.fetchall()

    return {
        "success": True,
        "athlete": dict(athlete),
        "personal_bests": [dict(pb) for pb in pbs],
        "olympic_results": [dict(o) for o in olympics],
    }


# ============================================================
# CAREER TRAJECTORY
# ============================================================

@router.get(
    "/athletes/{athlete_id}/trajectory",
    status_code=status.HTTP_200_OK,
    summary="Get career trajectory",
    description="Season-by-season performance data for plotting career curves.",
)
async def get_trajectory(
    athlete_id: int,
    discipline: str = Query(..., description="Discipline code (e.g. M100)"),
) -> dict[str, Any]:
    """Get an athlete's career trajectory for a specific discipline."""
    with get_db() as (conn, cur):
        # Verify athlete exists
        cur.execute("SELECT name FROM athletes WHERE id = %s", [athlete_id])
        athlete = cur.fetchone()
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")

        # Get season bests
        cur.execute("""
            SELECT sb.season_year, sb.age_years, sb.best_time, sb.n_races, sb.pct_off_pb
            FROM season_bests sb
            JOIN disciplines d ON d.id = sb.discipline_id
            WHERE sb.athlete_id = %s AND d.code = %s
            ORDER BY sb.season_year
        """, [athlete_id, discipline])
        seasons = cur.fetchall()

        # Get PB for context
        cur.execute("""
            SELECT pb.pb_time, pb.pb_date
            FROM personal_bests pb
            JOIN disciplines d ON d.id = pb.discipline_id
            WHERE pb.athlete_id = %s AND d.code = %s
        """, [athlete_id, discipline])
        pb = cur.fetchone()

    return {
        "success": True,
        "athlete_name": athlete["name"],
        "discipline": discipline,
        "personal_best": dict(pb) if pb else None,
        "seasons": [dict(s) for s in seasons],
    }


# ============================================================
# INDIVIDUAL RACE RESULTS
# ============================================================

@router.get(
    "/athletes/{athlete_id}/races",
    status_code=status.HTTP_200_OK,
    summary="Get individual race results",
    description="All race results for an athlete in a discipline, optionally filtered by season.",
)
async def get_races(
    athlete_id: int,
    discipline: str = Query(..., description="Discipline code (e.g. M100)"),
    season: Optional[int] = Query(None, description="Filter by season year"),
    limit: int = Query(200, ge=1, le=1000),
) -> dict[str, Any]:
    """Get individual race results for an athlete."""
    with get_db() as (conn, cur):
        conditions = ["r.athlete_id = %s", "d.code = %s"]
        params = [athlete_id, discipline]

        if season:
            conditions.append("r.season_year = %s")
            params.append(season)

        where = " AND ".join(conditions)

        cur.execute(f"""
            SELECT r.race_date, r.time_seconds, r.wind_mps, r.wind_legal,
                   r.competition, r.country, r.category, r.race_type,
                   r.place, r.age_years, r.age_decimal, r.is_olympic_race,
                   r.season_year
            FROM race_results r
            JOIN disciplines d ON d.id = r.discipline_id
            WHERE {where}
            ORDER BY r.race_date DESC
            LIMIT %s
        """, params + [limit])
        races = cur.fetchall()

    return {
        "success": True,
        "count": len(races),
        "races": [dict(r) for r in races],
    }


# ============================================================
# SIMILAR ATHLETES (replaces embedded SIMILAR_ATHLETES)
# ============================================================

@router.get(
    "/similar-athletes",
    status_code=status.HTTP_200_OK,
    summary="Find similar athletes",
    description="Find athletes with similar performance at a similar age. "
                "Replaces the hardcoded SIMILAR_ATHLETES pool.",
)
async def find_similar_athletes(
    discipline: str = Query(..., description="Discipline code (e.g. M100)"),
    pb: float = Query(..., gt=0, description="Personal best time in seconds"),
    age: int = Query(..., ge=10, le=50, description="Current age"),
    limit: int = Query(5, ge=1, le=20, description="Number of similar athletes"),
) -> dict[str, Any]:
    """
    Find athletes from the database who performed similarly at a similar age.
    Uses the same similarity formula as the frontend:
        similarity = timeDiff * 2 + ageDiff * 0.3
    """
    with get_db() as (conn, cur):
        cur.execute("""
            SELECT
                a.id AS athlete_id,
                a.name,
                a.country,
                pb_table.pb_time,
                sb.best_time AS time_at_similar_age,
                sb.age_years AS closest_age,
                sb.n_races,
                ABS(sb.best_time - %s) AS time_diff,
                ABS(sb.age_years - %s) AS age_diff,
                (ABS(sb.best_time - %s) * 2 + ABS(sb.age_years - %s) * 0.3) AS similarity
            FROM season_bests sb
            JOIN athletes a ON a.id = sb.athlete_id
            JOIN disciplines d ON d.id = sb.discipline_id
            JOIN personal_bests pb_table ON pb_table.athlete_id = a.id AND pb_table.discipline_id = d.id
            WHERE d.code = %s
              AND sb.age_years BETWEEN %s AND %s
            ORDER BY (ABS(sb.best_time - %s) * 2 + ABS(sb.age_years - %s) * 0.3) ASC
            LIMIT %s
        """, [pb, age, pb, age, discipline, age - 3, age + 3, pb, age, limit])

        results = cur.fetchall()

    return {
        "success": True,
        "query": {"discipline": discipline, "pb": pb, "age": age},
        "count": len(results),
        "athletes": [dict(r) for r in results],
    }


# ============================================================
# DISCIPLINE STATS
# ============================================================

@router.get(
    "/stats/discipline/{code}",
    status_code=status.HTTP_200_OK,
    summary="Get discipline statistics",
    description="Aggregate statistics for a discipline.",
)
async def get_discipline_stats(code: str) -> dict[str, Any]:
    """Get aggregate stats for a discipline."""
    with get_db() as (conn, cur):
        cur.execute("SELECT id, name, gender FROM disciplines WHERE code = %s", [code])
        disc = cur.fetchone()
        if not disc:
            raise HTTPException(status_code=404, detail=f"Discipline {code} not found")

        disc_id = disc["id"]

        cur.execute("""
            SELECT
                COUNT(DISTINCT r.athlete_id) AS total_athletes,
                COUNT(*) AS total_races,
                MIN(r.time_seconds) AS fastest_time,
                AVG(r.time_seconds) AS avg_time,
                MIN(r.season_year) AS earliest_season,
                MAX(r.season_year) AS latest_season
            FROM race_results r
            WHERE r.discipline_id = %s
        """, [disc_id])
        stats = cur.fetchone()

        # PB distribution
        cur.execute("""
            SELECT
                MIN(pb_time) AS min_pb,
                MAX(pb_time) AS max_pb,
                AVG(pb_time) AS avg_pb,
                PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY pb_time) AS p25_pb,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pb_time) AS median_pb,
                PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY pb_time) AS p75_pb
            FROM personal_bests pb
            WHERE pb.discipline_id = %s
        """, [disc_id])
        pb_stats = cur.fetchone()

    return {
        "success": True,
        "discipline": dict(disc),
        "stats": dict(stats),
        "pb_distribution": dict(pb_stats),
    }
