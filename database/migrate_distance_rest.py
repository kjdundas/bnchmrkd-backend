"""
bnchmrkd. Middle & Long Distance Migration Script (REST API)
=============================================================
Loads 800m, 1500m, 3000m SC, 5000m, 10000m, Marathon data from CSVs.

Usage:
    python migrate_distance_rest.py --supabase-url URL --service-key KEY
"""

import argparse
import csv
import json
import math
import os
import re
import sys
import time
import urllib.request
import urllib.error

# ============================================================
# CONFIG
# ============================================================

DOWNLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "Downloads")
if not os.path.exists(DOWNLOADS_DIR):
    DOWNLOADS_DIR = "/sessions/adoring-wonderful-rubin/mnt/Downloads"

BATCH_SIZE = 500

# Discipline definitions: code, name, gender, target_discipline_name_in_csv
DISTANCE_DISCIPLINES = [
    {"code": "M800",  "name": "800 Metres",             "gender": "M", "csv_disc": "800 Metres",             "csv_file": "800m_Men_WA_Results.csv"},
    {"code": "F800",  "name": "800 Metres",             "gender": "F", "csv_disc": "800 Metres",             "csv_file": "800m_Women_WA_Results.csv"},
    {"code": "M1500", "name": "1500 Metres",            "gender": "M", "csv_disc": "1500 Metres",            "csv_file": "1500m_Men_WA_Results.csv"},
    {"code": "F1500", "name": "1500 Metres",            "gender": "F", "csv_disc": "1500 Metres",            "csv_file": "1500m_Women_WA_Results.csv"},
    {"code": "M3KSC", "name": "3000m Steeplechase",     "gender": "M", "csv_disc": "3000 Metres Steeplechase", "csv_file": "3000m_SC_Men_WA_Results.csv"},
    {"code": "F3KSC", "name": "3000m Steeplechase",     "gender": "F", "csv_disc": "3000 Metres Steeplechase", "csv_file": "3000m_SC_Women_WA_Results.csv"},
    {"code": "M5000", "name": "5000 Metres",            "gender": "M", "csv_disc": "5000 Metres",            "csv_file": "5000m_Men_WA_Results.csv"},
    {"code": "F5000", "name": "5000 Metres",            "gender": "F", "csv_disc": "5000 Metres",            "csv_file": "5000m_Women_WA_Results.csv"},
    {"code": "M10K",  "name": "10000 Metres",           "gender": "M", "csv_disc": "10,000 Metres",          "csv_file": "10000m_Men_WA_Results.csv"},
    {"code": "F10K",  "name": "10000 Metres",           "gender": "F", "csv_disc": "10,000 Metres",          "csv_file": "10000m_Women_WA_Results.csv"},
    {"code": "MMAR",  "name": "Marathon",               "gender": "M", "csv_disc": "Marathon",               "csv_file": "Marathon_Men_WA_Results.csv"},
    {"code": "FMAR",  "name": "Marathon",               "gender": "F", "csv_disc": "Marathon",               "csv_file": "Marathon_Women_WA_Results.csv"},
]

GENDER_MAP = {"Male": "M", "Female": "F", "M": "M", "F": "F", "male": "M", "female": "F"}


# ============================================================
# SUPABASE REST CLIENT
# ============================================================

class SupabaseREST:
    def __init__(self, base_url, service_key):
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }

    def get(self, table, params=""):
        """GET with auto-pagination."""
        all_rows, offset = [], 0
        while True:
            sep = "&" if params else ""
            h = {**self.headers, "Range": f"{offset}-{offset+999}"}
            url = f"{self.base_url}/rest/v1/{table}?{params}{sep}limit=1000&offset={offset}"
            req = urllib.request.Request(url, headers=h)
            rows = json.loads(urllib.request.urlopen(req, timeout=60).read())
            all_rows.extend(rows)
            if len(rows) < 1000:
                break
            offset += 1000
        return all_rows

    def post(self, table, rows, upsert=False, on_conflict=None):
        url = f"{self.base_url}/rest/v1/{table}"
        if upsert and on_conflict:
            url += f"?on_conflict={on_conflict}"
        headers = {**self.headers}
        if upsert:
            headers["Prefer"] = "resolution=merge-duplicates,return=minimal"
        data = json.dumps(rows).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        try:
            urllib.request.urlopen(req, timeout=60)
            return len(rows)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8")
            print(f"\n    REST ERROR {e.code}: {body[:300]}")
            return 0

    def batch_insert(self, table, rows, label="rows", upsert=False, on_conflict=None):
        total = len(rows)
        loaded = 0
        start = time.time()
        for i in range(0, total, BATCH_SIZE):
            batch = rows[i:i + BATCH_SIZE]
            count = self.post(table, batch, upsert=upsert, on_conflict=on_conflict)
            loaded += count
            elapsed = time.time() - start
            rate = loaded / elapsed if elapsed > 0 else 0
            print(f"    {loaded:,}/{total:,} {label} ({rate:.0f}/sec)...", end="\r")
        elapsed = time.time() - start
        print(f"    {loaded:,}/{total:,} {label} in {elapsed:.1f}s                    ")
        return loaded

    def rpc(self, function_name, params=None):
        url = f"{self.base_url}/rest/v1/rpc/{function_name}"
        data = json.dumps(params or {}).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=self.headers, method="POST")
        try:
            urllib.request.urlopen(req, timeout=300)
            return True
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8")
            print(f"\n    RPC ERROR {e.code}: {body[:300]}")
            return False

    def count(self, table, filter_str=""):
        h = {**self.headers, "Prefer": "count=exact", "Range": "0-0"}
        url = f"{self.base_url}/rest/v1/{table}?select=id{('&' + filter_str) if filter_str else ''}"
        req = urllib.request.Request(url, headers=h)
        resp = urllib.request.urlopen(req)
        cr = resp.headers.get("Content-Range", "")
        return int(cr.split("/")[-1]) if "/" in cr else 0


# ============================================================
# HELPERS
# ============================================================

def parse_time_to_seconds(perf_str):
    """Parse performance time string to seconds.
    Handles: SS.xx, M:SS.xx, MM:SS.xx, H:MM:SS, H:MM:SS.x
    """
    if not perf_str:
        return None
    s = str(perf_str).strip()
    if not s:
        return None

    # Remove any trailing characters like 'h' or 'A' etc
    s = re.sub(r'[a-zA-Z]+$', '', s).strip()
    if not s:
        return None

    try:
        parts = s.split(":")
        if len(parts) == 1:
            # Just seconds: SS.xx
            return round(float(parts[0]), 3)
        elif len(parts) == 2:
            # M:SS.xx or MM:SS.xx
            minutes = int(parts[0])
            seconds = float(parts[1])
            return round(minutes * 60 + seconds, 3)
        elif len(parts) == 3:
            # H:MM:SS or H:MM:SS.x
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = float(parts[2])
            return round(hours * 3600 + minutes * 60 + seconds, 3)
    except (ValueError, IndexError):
        return None
    return None


def to_float(v):
    if v is None:
        return None
    try:
        return float(str(v).replace(",", ".").strip())
    except (ValueError, TypeError):
        return None


def to_int(v):
    if v is None:
        return None
    try:
        return int(float(str(v)))
    except (ValueError, TypeError):
        return None


def to_date_str(v):
    if v is None:
        return None
    s = str(v).strip()
    if not s or s == "None":
        return None
    if "T" in s:
        s = s.split("T")[0]
    # Validate YYYY-MM-DD
    if len(s) >= 10:
        s = s[:10]
        parts = s.split("-")
        if len(parts) == 3 and len(parts[0]) == 4:
            try:
                int(parts[0]); int(parts[1]); int(parts[2])
                return s
            except ValueError:
                pass
    # Try parsing DD MON YYYY format
    months = {"jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,
              "jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12}
    parts = s.split()
    if len(parts) == 3:
        try:
            day = int(parts[0])
            mon = months.get(parts[1].lower()[:3])
            year = int(parts[2])
            if mon and 1 <= day <= 31 and 1900 <= year <= 2030:
                return f"{year:04d}-{mon:02d}-{day:02d}"
        except (ValueError, IndexError):
            pass
    return None


# ============================================================
# MAIN MIGRATION
# ============================================================

def run_migration(supabase_url, service_key):
    api = SupabaseREST(supabase_url, service_key)

    # ── Test connection ──
    print("Testing connection...")
    disc_count = api.count("disciplines")
    print(f"  Connected! {disc_count} disciplines in DB\n")

    # ── Step 1: Register disciplines ──
    print("--- Registering Distance Disciplines ---")
    existing = api.get("disciplines", "select=id,code")
    existing_codes = {d["code"] for d in existing}

    new_discs = []
    for dd in DISTANCE_DISCIPLINES:
        if dd["code"] not in existing_codes:
            new_discs.append({
                "code": dd["code"],
                "name": dd["name"],
                "gender": dd["gender"],
                "distance_m": {"M800":800,"F800":800,"M1500":1500,"F1500":1500,"M3KSC":3000,"F3KSC":3000,"M5000":5000,"F5000":5000,"M10K":10000,"F10K":10000,"MMAR":42195,"FMAR":42195}[dd["code"]],
                "is_hurdles": False,
                "is_throws": False,
                "direction": "asc",
                "wind_applicable": False,
            })

    if new_discs:
        count = api.post("disciplines", new_discs)
        print(f"  Registered {count} new disciplines")
    else:
        print("  All distance disciplines already exist")

    # Refresh discipline lookup
    all_discs = api.get("disciplines", "select=id,code")
    disc_lookup = {d["code"]: d["id"] for d in all_discs}
    print(f"  Total disciplines: {len(disc_lookup)}")

    # ── Step 2: Load athlete lookup ──
    print("\n--- Loading Athlete Lookup ---")
    athletes = api.get("athletes", "select=id,name")
    athlete_lookup = {a["name"]: a["id"] for a in athletes}
    print(f"  {len(athlete_lookup)} existing athletes")

    # ── Step 3: Process each discipline CSV ──
    grand_total_races = 0
    grand_total_pbs = 0
    new_athletes_total = 0

    for dd in DISTANCE_DISCIPLINES:
        code = dd["code"]
        csv_file = dd["csv_file"]
        csv_disc = dd["csv_disc"]
        filepath = os.path.join(DOWNLOADS_DIR, csv_file)

        if not os.path.exists(filepath):
            print(f"\n  SKIP {code}: {csv_file} not found")
            continue

        disc_id = disc_lookup.get(code)
        if not disc_id:
            print(f"\n  SKIP {code}: discipline not in DB")
            continue

        print(f"\n{'='*60}")
        print(f"  {code} — {dd['name']} ({dd['gender']}) from {csv_file}")
        print(f"  Filtering for discipline: '{csv_disc}'")
        print(f"{'='*60}")

        # Read and filter CSV
        all_rows = []
        skipped_disc = 0
        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("Discipline", "").strip() == csv_disc:
                    all_rows.append(row)
                else:
                    skipped_disc += 1

        print(f"  {len(all_rows):,} matching rows (filtered out {skipped_disc:,} other-discipline rows)")

        if not all_rows:
            continue

        # ── Find new athletes ──
        new_names = set()
        for row in all_rows:
            name = row.get("athlete_name", "").strip()
            if name and name not in athlete_lookup:
                new_names.add((name, row.get("Gender", ""), row.get("Nationality", ""), row.get("DOB", "")))

        if new_names:
            print(f"  Registering {len(new_names)} new athletes...")
            new_athlete_rows = []
            for name, gender, nat, dob in new_names:
                g = GENDER_MAP.get(gender, dd["gender"])
                dob_str = to_date_str(dob)
                new_athlete_rows.append({
                    "name": name,
                    "gender": g,
                    "country": str(nat)[:100] if nat else None,
                    "date_of_birth": dob_str,
                    "is_olympic": True,
                })
            api.batch_insert("athletes", new_athlete_rows, "new athletes")
            new_athletes_total += len(new_names)

            # Refresh lookup
            athletes = api.get("athletes", "select=id,name")
            athlete_lookup = {a["name"]: a["id"] for a in athletes}
            print(f"  Athletes now: {len(athlete_lookup)}")

        # ── Build race results ──
        race_rows = []
        pb_tracker = {}
        skipped = 0

        for row in all_rows:
            name = row.get("athlete_name", "").strip()
            athlete_id = athlete_lookup.get(name)
            if not athlete_id:
                skipped += 1
                continue

            perf = parse_time_to_seconds(row.get("Performance", ""))
            if not perf or perf <= 0:
                skipped += 1
                continue

            date_str = to_date_str(row.get("Date", ""))
            age_years = to_int(row.get("Age_At_Event_Years"))
            age_decimal = to_float(row.get("Age_At_Event_Decimal"))
            season_year = to_int(row.get("Year"))
            wind_str = row.get("Wind", "")
            wind_mps = to_float(wind_str) if wind_str else None

            race_rows.append({
                "athlete_id": athlete_id,
                "discipline_id": disc_id,
                "race_date": date_str,
                "time_seconds": perf,
                "wind_mps": wind_mps,
                "wind_legal": None,
                "competition": str(row.get("Competition", ""))[:300] if row.get("Competition") else None,
                "country": None,
                "category": str(row.get("Category", ""))[:50] if row.get("Category") else None,
                "race_type": str(row.get("Race", ""))[:50] if row.get("Race") else None,
                "place": str(row.get("Place", ""))[:10] if row.get("Place") else None,
                "score": to_int(row.get("Score")),
                "age_decimal": age_decimal,
                "age_years": age_years,
                "is_olympic_race": False,
                "season_year": season_year,
            })

            # Track PBs (asc = lower is better)
            key = (athlete_id, disc_id)
            if key not in pb_tracker:
                pb_tracker[key] = {"best": perf, "date": date_str, "count": 0, "sum": 0, "values": []}
            entry = pb_tracker[key]
            entry["count"] += 1
            entry["sum"] += perf
            entry["values"].append(perf)
            if perf < entry["best"]:  # asc: lower is better
                entry["best"] = perf
                entry["date"] = date_str

        print(f"  {len(race_rows):,} race results to load (skipped {skipped:,})")
        if race_rows:
            api.batch_insert("race_results", race_rows, "race results")
            grand_total_races += len(race_rows)

        # ── Insert PBs ──
        pb_data = []
        for (aid, did), info in pb_tracker.items():
            avg_val = info["sum"] / info["count"] if info["count"] else None
            vals = sorted(info["values"])
            median_val = vals[len(vals) // 2] if vals else None
            std_dev = None
            if len(vals) > 1 and avg_val:
                std_dev = round(math.sqrt(sum((v - avg_val) ** 2 for v in vals) / (len(vals) - 1)), 4)
            pb_data.append({
                "athlete_id": aid,
                "discipline_id": did,
                "pb_time": info["best"],
                "pb_date": info["date"],
                "total_races": info["count"],
                "avg_time": round(avg_val, 3) if avg_val else None,
                "median_time": round(median_val, 3) if median_val else None,
                "std_dev": std_dev,
            })

        print(f"  {len(pb_data):,} PBs to upsert")
        if pb_data:
            api.batch_insert("personal_bests", pb_data, "personal bests",
                           upsert=True, on_conflict="athlete_id,discipline_id")
            grand_total_pbs += len(pb_data)

    # ── Step 4: Populate season bests ──
    print(f"\n{'='*60}")
    print("POPULATING SEASON BESTS")
    print(f"{'='*60}")
    print("  Running populate_season_bests()...")
    if api.rpc("populate_season_bests"):
        print("  Done!")
    else:
        print("  Failed — may need retry")

    # ── Final stats ──
    print(f"\n{'='*60}")
    print("FINAL STATS")
    print(f"{'='*60}")
    for table in ["disciplines", "athletes", "race_results", "personal_bests", "season_bests"]:
        count = api.count(table)
        print(f"  {table}: {count:,} rows")

    print(f"\n  New athletes added: {new_athletes_total:,}")
    print(f"  Race results loaded: {grand_total_races:,}")
    print(f"  PBs upserted: {grand_total_pbs:,}")
    print("\nDone!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--supabase-url", required=True)
    parser.add_argument("--service-key", required=True)
    args = parser.parse_args()
    run_migration(args.supabase_url, args.service_key)
