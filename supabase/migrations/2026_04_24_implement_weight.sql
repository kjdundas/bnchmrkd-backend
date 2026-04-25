-- ═══════════════════════════════════════════════════════════════════
-- IMPLEMENT WEIGHT MIGRATION — bnchmrkd.
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Adds implement_weight_kg to throws data pipeline and updates
-- find_similar_athletes to filter by weight.
-- ═══════════════════════════════════════════════════════════════════

-- ── Step 1: Add columns and fix unique constraints ──────────────
ALTER TABLE race_results ADD COLUMN IF NOT EXISTS implement_weight_kg NUMERIC;
ALTER TABLE personal_bests ADD COLUMN IF NOT EXISTS implement_weight_kg NUMERIC;
ALTER TABLE season_bests ADD COLUMN IF NOT EXISTS implement_weight_kg NUMERIC;

-- Drop old unique constraints that don't include implement_weight_kg
ALTER TABLE personal_bests DROP CONSTRAINT IF EXISTS personal_bests_athlete_id_discipline_id_key;
ALTER TABLE personal_bests DROP CONSTRAINT IF EXISTS personal_bests_athlete_id_discipline_id_implement_weight_kg_key;

-- Create new unique constraint that includes implement weight
-- COALESCE handles NULLs (non-throws disciplines) — they get 0 as the weight key
CREATE UNIQUE INDEX IF NOT EXISTS personal_bests_athlete_discipline_weight_uniq
    ON personal_bests (athlete_id, discipline_id, COALESCE(implement_weight_kg, 0));

-- Same for season_bests
ALTER TABLE season_bests DROP CONSTRAINT IF EXISTS season_bests_athlete_id_discipline_id_season_year_key;
ALTER TABLE season_bests DROP CONSTRAINT IF EXISTS season_bests_athlete_id_discipline_id_season_year_implement_w_key;

CREATE UNIQUE INDEX IF NOT EXISTS season_bests_athlete_discipline_season_weight_uniq
    ON season_bests (athlete_id, discipline_id, season_year, COALESCE(implement_weight_kg, 0));

-- ── Step 2: Backfill implement weights on race_results ───────────
-- Uses IAAF/WA implement weight rules per age group.
-- Discipline IDs: MDT=21, FDT=22, MJT=23, FJT=24, MHT=25, FHT=26, MSP=27, FSP=28

-- Shot Put Male: U14=3kg, U16=4kg, U18=5kg, U20=6kg, Senior=7.26kg
UPDATE race_results SET implement_weight_kg = CASE
    WHEN age_years < 14 THEN 3
    WHEN age_years < 16 THEN 4
    WHEN age_years < 18 THEN 5
    WHEN age_years < 20 THEN 6
    ELSE 7.26
END WHERE discipline_id = 27 AND implement_weight_kg IS NULL;

-- Shot Put Female: U14=2kg, U18=3kg, Senior=4kg
UPDATE race_results SET implement_weight_kg = CASE
    WHEN age_years < 14 THEN 2
    WHEN age_years < 18 THEN 3
    ELSE 4
END WHERE discipline_id = 28 AND implement_weight_kg IS NULL;

-- Discus Male: U16=1kg, U18=1.5kg, U20=1.75kg, Senior=2kg
UPDATE race_results SET implement_weight_kg = CASE
    WHEN age_years < 16 THEN 1
    WHEN age_years < 18 THEN 1.5
    WHEN age_years < 20 THEN 1.75
    ELSE 2
END WHERE discipline_id = 21 AND implement_weight_kg IS NULL;

-- Discus Female: U18=0.75kg, Senior=1kg
UPDATE race_results SET implement_weight_kg = CASE
    WHEN age_years < 18 THEN 0.75
    ELSE 1
END WHERE discipline_id = 22 AND implement_weight_kg IS NULL;

-- Hammer Male: U14=3kg, U16=4kg, U18=5kg, U20=6kg, Senior=7.26kg
UPDATE race_results SET implement_weight_kg = CASE
    WHEN age_years < 14 THEN 3
    WHEN age_years < 16 THEN 4
    WHEN age_years < 18 THEN 5
    WHEN age_years < 20 THEN 6
    ELSE 7.26
END WHERE discipline_id = 25 AND implement_weight_kg IS NULL;

-- Hammer Female: U14=2kg, U18=3kg, Senior=4kg
UPDATE race_results SET implement_weight_kg = CASE
    WHEN age_years < 14 THEN 2
    WHEN age_years < 18 THEN 3
    ELSE 4
END WHERE discipline_id = 26 AND implement_weight_kg IS NULL;

-- Javelin Male: U16=0.6kg, U18=0.7kg, Senior=0.8kg
UPDATE race_results SET implement_weight_kg = CASE
    WHEN age_years < 16 THEN 0.6
    WHEN age_years < 18 THEN 0.7
    ELSE 0.8
END WHERE discipline_id = 23 AND implement_weight_kg IS NULL;

-- Javelin Female: U16=0.4kg, U18=0.5kg, Senior=0.6kg
UPDATE race_results SET implement_weight_kg = CASE
    WHEN age_years < 16 THEN 0.4
    WHEN age_years < 18 THEN 0.5
    ELSE 0.6
END WHERE discipline_id = 24 AND implement_weight_kg IS NULL;


-- ── Step 3: Rebuild personal_bests for throws with weight grouping ─
DELETE FROM personal_bests WHERE discipline_id IN (21,22,23,24,25,26,27,28);

INSERT INTO personal_bests (athlete_id, discipline_id, pb_time, pb_date, total_races, avg_time, median_time, std_dev, implement_weight_kg)
SELECT
    r.athlete_id,
    r.discipline_id,
    CASE WHEN d.direction = 'desc' THEN MAX(r.time_seconds) ELSE MIN(r.time_seconds) END,
    NULL,
    COUNT(*),
    AVG(r.time_seconds),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY r.time_seconds),
    STDDEV(r.time_seconds),
    r.implement_weight_kg
FROM race_results r
JOIN disciplines d ON d.id = r.discipline_id
WHERE r.discipline_id IN (21,22,23,24,25,26,27,28)
  AND r.time_seconds > 0
GROUP BY r.athlete_id, r.discipline_id, d.direction, r.implement_weight_kg;


-- ── Step 4: Rebuild season_bests for throws with weight grouping ──
DELETE FROM season_bests WHERE discipline_id IN (21,22,23,24,25,26,27,28);

INSERT INTO season_bests (athlete_id, discipline_id, season_year, age_years, best_time, n_races, pct_off_pb, implement_weight_kg)
SELECT
    r.athlete_id,
    r.discipline_id,
    r.season_year,
    MODE() WITHIN GROUP (ORDER BY r.age_years),
    CASE WHEN d.direction = 'desc' THEN MAX(r.time_seconds) ELSE MIN(r.time_seconds) END,
    COUNT(*),
    ROUND(
        CASE WHEN d.direction = 'desc'
            THEN ((pb.pb_time - CASE WHEN d.direction = 'desc' THEN MAX(r.time_seconds) ELSE MIN(r.time_seconds) END) / NULLIF(pb.pb_time, 0) * 100)
            ELSE ((MIN(r.time_seconds) - pb.pb_time) / NULLIF(pb.pb_time, 0) * 100)
        END::NUMERIC, 4
    ),
    r.implement_weight_kg
FROM race_results r
JOIN personal_bests pb ON pb.athlete_id = r.athlete_id
    AND pb.discipline_id = r.discipline_id
    AND COALESCE(pb.implement_weight_kg, 0) = COALESCE(r.implement_weight_kg, 0)
JOIN disciplines d ON d.id = r.discipline_id
WHERE r.discipline_id IN (21,22,23,24,25,26,27,28)
  AND r.season_year IS NOT NULL
  AND r.time_seconds > 0
GROUP BY r.athlete_id, r.discipline_id, r.season_year, pb.pb_time, d.direction, r.implement_weight_kg;


-- ── Step 5: Update find_similar_athletes to support implement weight ─
CREATE OR REPLACE FUNCTION find_similar_athletes(
    p_discipline_code VARCHAR,
    p_pb NUMERIC,
    p_age INT,
    p_limit INT DEFAULT 5,
    p_implement_weight NUMERIC DEFAULT NULL
)
RETURNS TABLE (
    athlete_id INT,
    athlete_name VARCHAR,
    country VARCHAR,
    pb_time NUMERIC,
    time_at_similar_age NUMERIC,
    closest_age INT,
    time_diff NUMERIC,
    age_diff INT,
    similarity NUMERIC,
    implement_weight NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.name,
        a.country,
        pb.pb_time,
        sb.best_time,
        sb.age_years,
        ABS(sb.best_time - p_pb),
        ABS(sb.age_years - p_age),
        (ABS(sb.best_time - p_pb) * 2 + ABS(sb.age_years - p_age) * 0.3),
        sb.implement_weight_kg
    FROM athletes a
    JOIN personal_bests pb ON pb.athlete_id = a.id
    JOIN disciplines d ON d.id = pb.discipline_id
    JOIN season_bests sb ON sb.athlete_id = a.id AND sb.discipline_id = d.id
    WHERE d.code = p_discipline_code
      AND sb.age_years BETWEEN p_age - 3 AND p_age + 3
      -- Weight filter: when provided, match exact weight in both season_bests and personal_bests
      AND (p_implement_weight IS NULL
           OR (COALESCE(sb.implement_weight_kg, 0) = p_implement_weight
               AND COALESCE(pb.implement_weight_kg, 0) = p_implement_weight))
    ORDER BY (ABS(sb.best_time - p_pb) * 2 + ABS(sb.age_years - p_age) * 0.3)
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
