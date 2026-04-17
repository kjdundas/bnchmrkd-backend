-- ============================================================
-- bnchmrkd. Database Schema — Supabase PostgreSQL
-- ============================================================

-- 1. DISCIPLINES
CREATE TABLE disciplines (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(10) UNIQUE NOT NULL,   -- e.g. 'M100', 'F400H', 'MDT'
    name        VARCHAR(50) NOT NULL,          -- e.g. '100 Metres', 'Discus Throw'
    gender      CHAR(1) NOT NULL,              -- 'M' or 'F'
    distance_m  INT,                           -- 100, 200, 400 (NULL for throws)
    is_hurdles  BOOLEAN DEFAULT FALSE,
    is_throws   BOOLEAN DEFAULT FALSE,         -- true for throws disciplines
    direction   VARCHAR(10) DEFAULT 'asc',     -- 'asc' (lower=better) or 'desc' (higher=better)
    wind_applicable BOOLEAN DEFAULT FALSE      -- true for 100m, 200m, hurdles ≤110m
);

INSERT INTO disciplines (code, name, gender, distance_m, is_hurdles, is_throws, direction, wind_applicable) VALUES
    -- Sprints
    ('M100',  '100 Metres',           'M', 100,  FALSE, FALSE, 'asc',  TRUE),
    ('F100',  '100 Metres',           'F', 100,  FALSE, FALSE, 'asc',  TRUE),
    ('M200',  '200 Metres',           'M', 200,  FALSE, FALSE, 'asc',  TRUE),
    ('F200',  '200 Metres',           'F', 200,  FALSE, FALSE, 'asc',  TRUE),
    ('M400',  '400 Metres',           'M', 400,  FALSE, FALSE, 'asc',  FALSE),
    ('F400',  '400 Metres',           'F', 400,  FALSE, FALSE, 'asc',  FALSE),
    -- Hurdles
    ('M110H', '110 Metres Hurdles',   'M', 110,  TRUE,  FALSE, 'asc',  TRUE),
    ('F100H', '100 Metres Hurdles',   'F', 100,  TRUE,  FALSE, 'asc',  TRUE),
    ('M400H', '400 Metres Hurdles',   'M', 400,  TRUE,  FALSE, 'asc',  FALSE),
    ('F400H', '400 Metres Hurdles',   'F', 400,  TRUE,  FALSE, 'asc',  FALSE),
    -- Throws (distance_m is NULL, direction is descending = higher is better)
    ('MDT',   'Discus Throw',         'M', NULL, FALSE, TRUE,  'desc', FALSE),
    ('FDT',   'Discus Throw',         'F', NULL, FALSE, TRUE,  'desc', FALSE),
    ('MJT',   'Javelin Throw',        'M', NULL, FALSE, TRUE,  'desc', FALSE),
    ('FJT',   'Javelin Throw',        'F', NULL, FALSE, TRUE,  'desc', FALSE),
    ('MHT',   'Hammer Throw',         'M', NULL, FALSE, TRUE,  'desc', FALSE),
    ('FHT',   'Hammer Throw',         'F', NULL, FALSE, TRUE,  'desc', FALSE),
    ('MSP',   'Shot Put',             'M', NULL, FALSE, TRUE,  'desc', FALSE),
    ('FSP',   'Shot Put',             'F', NULL, FALSE, TRUE,  'desc', FALSE),
    -- Jumps (distance_m is NULL, direction is descending = higher is better)
    ('MHJ',   'High Jump',            'M', NULL, FALSE, FALSE, 'desc', FALSE),
    ('FHJ',   'High Jump',            'F', NULL, FALSE, FALSE, 'desc', FALSE),
    ('MLJ',   'Long Jump',            'M', NULL, FALSE, FALSE, 'desc', TRUE),
    ('FLJ',   'Long Jump',            'F', NULL, FALSE, FALSE, 'desc', TRUE),
    ('MTJ',   'Triple Jump',          'M', NULL, FALSE, FALSE, 'desc', TRUE),
    ('FTJ',   'Triple Jump',          'F', NULL, FALSE, FALSE, 'desc', TRUE),
    ('MPV',   'Pole Vault',           'M', NULL, FALSE, FALSE, 'desc', FALSE),
    ('FPV',   'Pole Vault',           'F', NULL, FALSE, FALSE, 'desc', FALSE);


-- 2. ATHLETES
CREATE TABLE athletes (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    gender          CHAR(1) NOT NULL,            -- 'M' or 'F'
    country         VARCHAR(100),                -- NOC or country name
    date_of_birth   DATE,
    is_olympic      BOOLEAN DEFAULT TRUE,
    doping_flag     VARCHAR(50),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_athletes_name ON athletes (name);
CREATE INDEX idx_athletes_gender ON athletes (gender);
CREATE INDEX idx_athletes_name_trgm ON athletes USING gin (name gin_trgm_ops);


-- 3. RACE RESULTS (the big table — 496K+ rows)
CREATE TABLE race_results (
    id              SERIAL PRIMARY KEY,
    athlete_id      INT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    discipline_id   INT NOT NULL REFERENCES disciplines(id),
    race_date       DATE,
    time_seconds    NUMERIC(7,3) NOT NULL,
    wind_mps        NUMERIC(5,2),
    wind_legal      BOOLEAN,
    competition     VARCHAR(300),
    country         VARCHAR(150),
    category        VARCHAR(50),
    race_type       VARCHAR(50),
    place           VARCHAR(10),
    score           INT,
    age_decimal     NUMERIC(6,3),
    age_years       INT,
    is_olympic_race BOOLEAN DEFAULT FALSE,
    season_year     INT,
    implement_weight_kg  NUMERIC(5,3)    -- throws only: implement weight in kg (NULL for sprints/hurdles)
);

CREATE INDEX idx_races_athlete ON race_results (athlete_id);
CREATE INDEX idx_races_discipline ON race_results (discipline_id);
CREATE INDEX idx_races_athlete_disc ON race_results (athlete_id, discipline_id);
CREATE INDEX idx_races_season ON race_results (athlete_id, discipline_id, season_year);
CREATE INDEX idx_races_date ON race_results (race_date);


-- 4. PERSONAL BESTS
CREATE TABLE personal_bests (
    id              SERIAL PRIMARY KEY,
    athlete_id      INT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    discipline_id   INT NOT NULL REFERENCES disciplines(id),
    pb_time         NUMERIC(7,3) NOT NULL,
    pb_date         DATE,
    total_races     INT,
    avg_time        NUMERIC(7,3),
    median_time     NUMERIC(7,3),
    std_dev         NUMERIC(7,4),
    implement_weight_kg  NUMERIC(5,3),   -- throws only: weight class for this PB
    UNIQUE (athlete_id, discipline_id, implement_weight_kg)
);


-- 5. OLYMPIC RESULTS
CREATE TABLE olympic_results (
    id              SERIAL PRIMARY KEY,
    athlete_id      INT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    discipline_id   INT NOT NULL REFERENCES disciplines(id),
    games           VARCHAR(50),
    year            INT,
    round           VARCHAR(20),
    heat            VARCHAR(30),
    rank            INT,
    lane            INT,
    time_seconds    NUMERIC(7,3),
    reaction_time   NUMERIC(5,3),
    status          VARCHAR(50),
    qualified       VARCHAR(10),
    notes           TEXT
);

CREATE INDEX idx_olympic_athlete ON olympic_results (athlete_id);
CREATE INDEX idx_olympic_discipline ON olympic_results (discipline_id);


-- 6. SEASON BESTS (materialized from race_results after migration)
CREATE TABLE season_bests (
    id              SERIAL PRIMARY KEY,
    athlete_id      INT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    discipline_id   INT NOT NULL REFERENCES disciplines(id),
    season_year     INT NOT NULL,
    age_years       INT,
    best_time       NUMERIC(7,3) NOT NULL,
    n_races         INT,
    pct_off_pb      NUMERIC(7,4),
    implement_weight_kg  NUMERIC(5,3),   -- throws only: weight class for this season best
    UNIQUE (athlete_id, discipline_id, season_year, implement_weight_kg)
);

CREATE INDEX idx_sb_athlete_disc ON season_bests (athlete_id, discipline_id);


-- 7. BENCHMARK TABLES (statistical analysis data)

CREATE TABLE age_percentile_benchmarks (
    id              SERIAL PRIMARY KEY,
    discipline_id   INT NOT NULL REFERENCES disciplines(id),
    age             INT NOT NULL,
    p10             NUMERIC(7,4),
    p25             NUMERIC(7,4),
    p50             NUMERIC(7,4),
    p75             NUMERIC(7,4),
    p90             NUMERIC(7,4),
    implement_weight_kg  NUMERIC(5,3),   -- throws only: weight class (NULL = senior/default)
    UNIQUE (discipline_id, age, implement_weight_kg)
);

CREATE TABLE roc_thresholds (
    id                       SERIAL PRIMARY KEY,
    discipline_id            INT NOT NULL REFERENCES disciplines(id) UNIQUE,
    optimal_threshold        NUMERIC(7,3),
    threshold_90_sensitivity NUMERIC(7,3),
    threshold_80_sensitivity NUMERIC(7,3),
    threshold_70_sensitivity NUMERIC(7,3)
);

CREATE TABLE trajectory_clusters (
    id              SERIAL PRIMARY KEY,
    discipline_id   INT NOT NULL REFERENCES disciplines(id),
    cluster_index   INT NOT NULL,
    cluster_name    VARCHAR(50),
    description     TEXT,
    centroid_values  NUMERIC(7,4)[],
    UNIQUE (discipline_id, cluster_index)
);

CREATE TABLE improvement_norms (
    id                        SERIAL PRIMARY KEY,
    discipline_id             INT NOT NULL REFERENCES disciplines(id) UNIQUE,
    finalist_median_pct       NUMERIC(7,4),
    finalist_std_pct          NUMERIC(7,4),
    non_finalist_median_pct   NUMERIC(7,4),
    non_finalist_std_pct      NUMERIC(7,4)
);

CREATE TABLE model_calibration (
    id              SERIAL PRIMARY KEY,
    discipline_id   INT NOT NULL REFERENCES disciplines(id) UNIQUE,
    mean_time       NUMERIC(7,3),
    std_time        NUMERIC(7,3)
);

CREATE TABLE model_coefficients (
    id                  SERIAL PRIMARY KEY,
    coefficient_name    VARCHAR(50) UNIQUE NOT NULL,
    coefficient_value   NUMERIC(12,6)
);


-- ============================================================
-- SQL FUNCTIONS (called via Supabase RPC or FastAPI)
-- ============================================================

-- Search athletes by name (for dropdown autocomplete)
CREATE OR REPLACE FUNCTION search_athletes(
    p_query TEXT,
    p_discipline_code VARCHAR DEFAULT NULL,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    athlete_id INT,
    athlete_name VARCHAR,
    country VARCHAR,
    gender CHAR,
    pb_time NUMERIC,
    discipline_code VARCHAR,
    n_seasons BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.name,
        a.country,
        a.gender,
        pb.pb_time,
        d.code,
        COUNT(DISTINCT sb.season_year)
    FROM athletes a
    LEFT JOIN personal_bests pb ON pb.athlete_id = a.id
    LEFT JOIN disciplines d ON d.id = pb.discipline_id
    LEFT JOIN season_bests sb ON sb.athlete_id = a.id AND sb.discipline_id = d.id
    WHERE a.name ILIKE '%' || p_query || '%'
      AND (p_discipline_code IS NULL OR d.code = p_discipline_code)
    GROUP BY a.id, a.name, a.country, a.gender, pb.pb_time, d.code
    ORDER BY a.name
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;


-- Get an athlete's full career trajectory for a discipline
CREATE OR REPLACE FUNCTION get_career_trajectory(
    p_athlete_id INT,
    p_discipline_code VARCHAR
)
RETURNS TABLE (
    season_year INT,
    age_years INT,
    best_time NUMERIC,
    n_races INT,
    pct_off_pb NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sb.season_year,
        sb.age_years,
        sb.best_time,
        sb.n_races,
        sb.pct_off_pb
    FROM season_bests sb
    JOIN disciplines d ON d.id = sb.discipline_id
    WHERE sb.athlete_id = p_athlete_id
      AND d.code = p_discipline_code
    ORDER BY sb.season_year;
END;
$$ LANGUAGE plpgsql;


-- Find similar athletes by PB and age
CREATE OR REPLACE FUNCTION find_similar_athletes(
    p_discipline_code VARCHAR,
    p_pb NUMERIC,
    p_age INT,
    p_limit INT DEFAULT 5
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
    similarity NUMERIC
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
        (ABS(sb.best_time - p_pb) * 2 + ABS(sb.age_years - p_age) * 0.3)
    FROM athletes a
    JOIN personal_bests pb ON pb.athlete_id = a.id
    JOIN disciplines d ON d.id = pb.discipline_id
    JOIN season_bests sb ON sb.athlete_id = a.id AND sb.discipline_id = d.id
    WHERE d.code = p_discipline_code
      AND sb.age_years BETWEEN p_age - 3 AND p_age + 3
    ORDER BY (ABS(sb.best_time - p_pb) * 2 + ABS(sb.age_years - p_age) * 0.3)
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;


-- Populate season_bests from race_results (run after migration)
-- Weight-aware: groups throws by implement_weight_kg so each weight class gets separate season bests
CREATE OR REPLACE FUNCTION populate_season_bests()
RETURNS void AS $$
BEGIN
    INSERT INTO season_bests (athlete_id, discipline_id, season_year, age_years, best_time, n_races, pct_off_pb, implement_weight_kg)
    SELECT
        r.athlete_id,
        r.discipline_id,
        r.season_year,
        MODE() WITHIN GROUP (ORDER BY r.age_years) AS age_years,
        -- For throws (desc direction): best = MAX; for sprints/hurdles (asc): best = MIN
        CASE WHEN d.direction = 'desc' THEN MAX(r.time_seconds) ELSE MIN(r.time_seconds) END AS best_time,
        COUNT(*) AS n_races,
        ROUND(
            CASE WHEN d.direction = 'desc'
                THEN ((pb.pb_time - CASE WHEN d.direction = 'desc' THEN MAX(r.time_seconds) ELSE MIN(r.time_seconds) END) / pb.pb_time * 100)
                ELSE ((MIN(r.time_seconds) - pb.pb_time) / pb.pb_time * 100)
            END::NUMERIC,
            4
        ) AS pct_off_pb,
        r.implement_weight_kg
    FROM race_results r
    JOIN personal_bests pb ON pb.athlete_id = r.athlete_id
        AND pb.discipline_id = r.discipline_id
        AND COALESCE(pb.implement_weight_kg, 0) = COALESCE(r.implement_weight_kg, 0)
    JOIN disciplines d ON d.id = r.discipline_id
    WHERE r.season_year IS NOT NULL
      AND r.time_seconds > 0
    GROUP BY r.athlete_id, r.discipline_id, r.season_year, pb.pb_time, d.direction, r.implement_weight_kg
    ON CONFLICT (athlete_id, discipline_id, season_year, implement_weight_kg)
    DO UPDATE SET
        best_time = EXCLUDED.best_time,
        n_races = EXCLUDED.n_races,
        pct_off_pb = EXCLUDED.pct_off_pb,
        age_years = EXCLUDED.age_years;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- MIGRATION: Add implement_weight_kg to existing tables
-- Run this on existing databases to add weight support
-- ============================================================

-- ALTER TABLE race_results ADD COLUMN IF NOT EXISTS implement_weight_kg NUMERIC(5,3);
-- ALTER TABLE personal_bests ADD COLUMN IF NOT EXISTS implement_weight_kg NUMERIC(5,3);
-- ALTER TABLE season_bests ADD COLUMN IF NOT EXISTS implement_weight_kg NUMERIC(5,3);
-- ALTER TABLE age_percentile_benchmarks ADD COLUMN IF NOT EXISTS implement_weight_kg NUMERIC(5,3);

-- Update unique constraints for weight-aware tables:
-- ALTER TABLE personal_bests DROP CONSTRAINT IF EXISTS personal_bests_athlete_id_discipline_id_key;
-- ALTER TABLE personal_bests ADD CONSTRAINT personal_bests_athlete_disc_weight_key UNIQUE (athlete_id, discipline_id, implement_weight_kg);
-- ALTER TABLE season_bests DROP CONSTRAINT IF EXISTS season_bests_athlete_id_discipline_id_season_year_key;
-- ALTER TABLE season_bests ADD CONSTRAINT season_bests_athlete_disc_season_weight_key UNIQUE (athlete_id, discipline_id, season_year, implement_weight_kg);
-- ALTER TABLE age_percentile_benchmarks DROP CONSTRAINT IF EXISTS age_percentile_benchmarks_discipline_id_age_key;
-- ALTER TABLE age_percentile_benchmarks ADD CONSTRAINT age_percentile_benchmarks_disc_age_weight_key UNIQUE (discipline_id, age, implement_weight_kg);

-- Index for fast weight-class filtering
-- CREATE INDEX IF NOT EXISTS idx_races_weight ON race_results (discipline_id, implement_weight_kg) WHERE implement_weight_kg IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_sb_weight ON season_bests (discipline_id, implement_weight_kg) WHERE implement_weight_kg IS NOT NULL;
