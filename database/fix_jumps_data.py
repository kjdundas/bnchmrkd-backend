#!/usr/bin/env python3
"""
Fix corrupted jumps data in Supabase.

Problem: The original migration loaded ALL career results for each athlete
into jumps disciplines, instead of filtering by the Discipline column.
This means 400m hurdle times, sprint times, throws, etc. all got assigned
as long jump / triple jump / etc. results.

Fix:
1. Delete all race_results, personal_bests, season_bests for jumps disciplines (IDs 13-20)
2. Re-load race_results from CSVs, filtering by correct discipline name
3. Recompute personal_bests from the filtered race_results
4. Recompute season_bests from the corrected data
"""

import csv, json, math, os, sys, time, urllib.request, urllib.parse
from datetime import datetime

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://bmbqjyrhzusidxmfrssi.supabase.co")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]  # must be set in environment
JUMPS_DIR = os.environ.get("JUMPS_DIR", "./jumps_data")

# CSV file -> (discipline filter string, gender, DB code)
JUMPS_CSV_MAP = {
    "High_Jump_Men_WA_Results.csv":    ("High Jump",    "M", "MHJ"),
    "High_Jump_Women_WA_Results.csv":  ("High Jump",    "F", "FHJ"),
    "Long_Jump_Men_WA_Results.csv":    ("Long Jump",    "M", "MLJ"),
    "Long_Jump_Women_WA_Results.csv":  ("Long Jump",    "F", "FLJ"),
    "Triple_Jump_Men_WA_Results.csv":  ("Triple Jump",  "M", "MTJ"),
    "Triple_Jump_Women_WA_Results.csv":("Triple Jump",  "F", "FTJ"),
    "Pole_Vault_Men_WA_Results.csv":   ("Pole Vault",   "M", "MPV"),
    "Pole_Vault_Women_WA_Results.csv": ("Pole Vault",   "F", "FPV"),
}

JUMPS_DISC_IDS = {
    "MHJ": 13, "FHJ": 14, "MLJ": 15, "FLJ": 16,
    "MTJ": 17, "FTJ": 18, "MPV": 19, "FPV": 20,
}


# ── Helpers ──

def to_float(val):
    if val is None: return None
    s = str(val).strip().rstrip("m").replace(",", ".")
    try: return round(float(s), 3)
    except: return None

def to_int(val):
    if val is None: return None
    try: return int(float(str(val).strip()))
    except: return None

def to_date_str(val):
    if not val: return None
    s = str(val).strip()
    for fmt in ("%d %b %Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try: return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except: continue
    return None


class SupabaseREST:
    def __init__(self, url, key):
        self.base_url = url
        self.key = key
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    def _request(self, method, path, body=None, extra_headers=None, retries=3):
        url = f"{self.base_url}/rest/v1{path}"
        h = dict(self.headers)
        if extra_headers:
            h.update(extra_headers)
        data = json.dumps(body).encode() if body else None

        for attempt in range(retries):
            try:
                req = urllib.request.Request(url, data=data, headers=h, method=method)
                with urllib.request.urlopen(req, timeout=30) as resp:
                    raw = resp.read().decode()
                    return json.loads(raw) if raw else None
            except Exception as e:
                if attempt < retries - 1 and ("502" in str(e) or "520" in str(e) or "timeout" in str(e).lower()):
                    print(f"      Retry {attempt+1} after error: {e}")
                    time.sleep(3)
                else:
                    raise

    def delete(self, table, filter_str):
        self._request("DELETE", f"/{table}?{filter_str}")

    def get(self, table, params=""):
        return self._request("GET", f"/{table}?{params}")

    def get_all(self, table, params=""):
        """Paginated GET to fetch all rows."""
        all_rows = []
        offset = 0
        batch = 1000
        while True:
            sep = "&" if params else ""
            rows = self._request("GET", f"/{table}?{params}{sep}limit={batch}&offset={offset}")
            if not rows:
                break
            all_rows.extend(rows)
            if len(rows) < batch:
                break
            offset += batch
        return all_rows

    def batch_insert(self, table, rows, label="rows", upsert=False, on_conflict=None):
        BATCH = 500
        total = len(rows)
        for i in range(0, total, BATCH):
            chunk = rows[i:i+BATCH]
            path = f"/{table}"
            if upsert and on_conflict:
                path += f"?on_conflict={on_conflict}"
            h = {"Prefer": "resolution=merge-duplicates"} if upsert else {}
            self._request("POST", path, body=chunk, extra_headers=h)
            done = min(i + BATCH, total)
            print(f"      {label}: {done:,}/{total:,}")


def main():
    api = SupabaseREST(SUPABASE_URL, SERVICE_KEY)

    # Test connection
    print("Testing connection...")
    discs = api.get("disciplines", "select=id,code&code=in.(MHJ,FHJ,MLJ,FLJ,MTJ,FTJ,MPV,FPV)")
    print(f"  Found {len(discs)} jumps disciplines")

    # Load athlete lookup
    print("\nLoading athlete lookup...")
    all_athletes = api.get_all("athletes", "select=id,name")
    athlete_lookup = {a["name"]: a["id"] for a in all_athletes}
    print(f"  {len(athlete_lookup)} athletes in DB")

    # ── Step 1: Delete corrupted data ──
    print("\n=== Step 1: Deleting corrupted jumps data ===")
    disc_ids = list(JUMPS_DISC_IDS.values())
    disc_filter = f"discipline_id=in.({','.join(str(d) for d in disc_ids)})"

    print("  Deleting season_bests...")
    api.delete("season_bests", disc_filter)
    print("  Deleting personal_bests...")
    api.delete("personal_bests", disc_filter)
    print("  Deleting race_results...")
    # Delete in batches by discipline to avoid timeout
    for code, did in JUMPS_DISC_IDS.items():
        print(f"    Deleting race_results for {code} (disc_id={did})...")
        api.delete("race_results", f"discipline_id=eq.{did}")
        time.sleep(1)
    print("  Done deleting!")

    # ── Step 2: Re-load race_results with discipline filtering ──
    print("\n=== Step 2: Re-loading filtered race results ===")
    grand_total = 0
    all_race_rows_by_disc = {}

    for csv_file, (disc_name, gender, disc_code) in JUMPS_CSV_MAP.items():
        filepath = os.path.join(JUMPS_DIR, csv_file)
        if not os.path.exists(filepath):
            print(f"  SKIP: {csv_file} not found")
            continue

        disc_id = JUMPS_DISC_IDS[disc_code]
        race_rows = []
        skipped = 0
        filtered_out = 0

        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                # *** THE FIX: Filter by discipline column ***
                row_disc = row.get("Discipline", "").strip()
                if row_disc != disc_name:
                    filtered_out += 1
                    continue

                name = row.get("athlete_name", "").strip()
                if not name:
                    skipped += 1
                    continue
                athlete_id = athlete_lookup.get(name)
                if not athlete_id:
                    skipped += 1
                    continue
                perf = to_float(row.get("Performance", ""))
                if not perf or perf <= 0:
                    skipped += 1
                    continue

                wind = to_float(row.get("Wind", ""))
                wind_legal = True if wind is not None and wind <= 2.0 else (None if wind is None else False)
                category_val = (row.get("Category", "") or "")[:50] or None
                is_olympic = "OW" in (category_val or "") or "OG" in (category_val or "")

                race_rows.append({
                    "athlete_id": athlete_id,
                    "discipline_id": disc_id,
                    "race_date": to_date_str(row.get("Date", "")),
                    "time_seconds": perf,
                    "wind_mps": wind,
                    "wind_legal": wind_legal,
                    "competition": (row.get("Competition", "") or "")[:300] or None,
                    "country": None,
                    "category": category_val,
                    "race_type": (row.get("Race", "") or "")[:50] or None,
                    "place": (row.get("Place", "") or "")[:10] or None,
                    "score": to_int(row.get("Score", "")),
                    "age_decimal": to_float(row.get("Age_At_Event_Decimal", "")),
                    "age_years": to_int(row.get("Age_At_Event_Years", "")),
                    "is_olympic_race": is_olympic,
                    "season_year": to_int(row.get("Year", "")),
                })

        print(f"  {csv_file}: {len(race_rows):,} {disc_name} rows (filtered out {filtered_out:,} other disciplines, skipped {skipped})")
        if race_rows:
            api.batch_insert("race_results", race_rows, f"{disc_code} results")
            grand_total += len(race_rows)
            all_race_rows_by_disc[disc_code] = race_rows

    print(f"\n  Total jumps race results loaded: {grand_total:,}")

    # ── Step 3: Compute and load Personal Bests from filtered data ──
    print("\n=== Step 3: Computing Personal Bests ===")
    pb_tracker = {}

    for disc_code, race_rows in all_race_rows_by_disc.items():
        for row in race_rows:
            key = (row["athlete_id"], disc_code)
            perf = row["time_seconds"]
            if key not in pb_tracker:
                pb_tracker[key] = {"best": perf, "date": row["race_date"],
                                   "count": 0, "sum": 0, "values": []}
            entry = pb_tracker[key]
            entry["count"] += 1
            entry["sum"] += perf
            entry["values"].append(perf)
            # Jumps are 'desc' — higher is better
            if perf > entry["best"]:
                entry["best"] = perf
                entry["date"] = row["race_date"]

    pb_data = []
    for (athlete_id, disc_code), info in pb_tracker.items():
        disc_id = JUMPS_DISC_IDS[disc_code]
        avg_val = info["sum"] / info["count"] if info["count"] else None
        vals = sorted(info["values"])
        median_val = vals[len(vals) // 2] if vals else None
        std_dev = None
        if len(vals) > 1 and avg_val:
            std_dev = round(math.sqrt(sum((v - avg_val) ** 2 for v in vals) / (len(vals) - 1)), 4)

        pb_data.append({
            "athlete_id": athlete_id,
            "discipline_id": disc_id,
            "pb_time": info["best"],
            "pb_date": info["date"],
            "total_races": info["count"],
            "avg_time": round(avg_val, 3) if avg_val else None,
            "median_time": round(median_val, 3) if median_val else None,
            "std_dev": std_dev,
        })

    print(f"  {len(pb_data)} PBs computed")
    if pb_data:
        api.batch_insert("personal_bests", pb_data, "personal bests", upsert=True, on_conflict="athlete_id,discipline_id")

    # ── Step 4: Compute and load Season Bests ──
    print("\n=== Step 4: Computing Season Bests ===")
    sb_tracker = {}

    for disc_code, race_rows in all_race_rows_by_disc.items():
        for row in race_rows:
            yr = row.get("season_year")
            if not yr:
                continue
            key = (row["athlete_id"], disc_code, yr)
            perf = row["time_seconds"]
            if key not in sb_tracker:
                sb_tracker[key] = {"best": perf, "count": 0, "ages": []}
            entry = sb_tracker[key]
            entry["count"] += 1
            if row.get("age_years"):
                entry["ages"].append(row["age_years"])
            if perf > entry["best"]:  # desc = higher is better
                entry["best"] = perf

    # Build PB lookup for pct_off_pb
    pb_lookup = {}
    for (athlete_id, disc_code), info in pb_tracker.items():
        pb_lookup[(athlete_id, disc_code)] = info["best"]

    sb_data = []
    for (athlete_id, disc_code, yr), info in sb_tracker.items():
        disc_id = JUMPS_DISC_IDS[disc_code]
        pb = pb_lookup.get((athlete_id, disc_code))
        pct_off = None
        if pb and pb > 0:
            # For desc: pct_off = (pb - sb) / pb * 100
            pct_off = round((pb - info["best"]) / pb * 100, 4)

        age = None
        if info["ages"]:
            # mode
            from collections import Counter
            age = Counter(info["ages"]).most_common(1)[0][0]

        sb_data.append({
            "athlete_id": athlete_id,
            "discipline_id": disc_id,
            "season_year": yr,
            "age_years": age,
            "best_time": info["best"],
            "n_races": info["count"],
            "pct_off_pb": pct_off,
        })

    print(f"  {len(sb_data)} season bests computed")
    if sb_data:
        api.batch_insert("season_bests", sb_data, "season bests", upsert=True, on_conflict="athlete_id,discipline_id,season_year")

    # ── Step 5: Verify ──
    print("\n=== Verification ===")
    for code, did in JUMPS_DISC_IDS.items():
        pbs = api.get("personal_bests", f"discipline_id=eq.{did}&select=pb_time&order=pb_time.desc&limit=3")
        top = [f"{p['pb_time']:.2f}m" for p in pbs] if pbs else ["none"]
        count_r = api.get("race_results", f"discipline_id=eq.{did}&select=id")
        count_s = api.get("season_bests", f"discipline_id=eq.{did}&select=id")
        print(f"  {code}: top PBs = {', '.join(top)} | races={len(count_r or [])} | SBs={len(count_s or [])}")

    print("\nDone!")


if __name__ == "__main__":
    main()
