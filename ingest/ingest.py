#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════
# INGEST — 1,090,930 World Athletics results into reference.*
#
# Resumable by design. Every command on this machine gets about two
# minutes, and a bulk load that dies halfway through leaving a half-full
# table is worse than one that never started. So the work is chunked per
# source file and each chunk records itself; re-running skips what is
# already in.
#
# Idempotent per file: a file's rows are deleted before being reloaded, so
# running this twice gives the same database as running it once.
#
#   python ingest.py disciplines   -- 211 aliases -> 207 events
#   python ingest.py athletes      -- ~7,000, keyed on name + dob
#   python ingest.py results       -- streams until the clock runs out
#   python ingest.py status        -- what is loaded, what is left
#
# Connection comes from SUPABASE_DB_URL in ingest/.env, which is
# gitignored and never read by anything else.
# ═══════════════════════════════════════════════════════════════════════
import csv, io, json, os, re, sys, time, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from marks import parse_mark

HERE = os.path.dirname(os.path.abspath(__file__))
SRC  = os.path.join(HERE, '..', 'World athletics data')
BUDGET = 95          # seconds of work before stopping cleanly

def dburl():
    env = os.path.join(HERE, '.env')
    if os.path.exists(env):
        for line in open(env, encoding='utf-8'):
            line = line.strip()
            if line.startswith('SUPABASE_DB_URL='):
                os.environ.setdefault('SUPABASE_DB_URL', line.split('=', 1)[1].strip().strip('"\''))
    u = os.environ.get('SUPABASE_DB_URL')
    if not u:
        sys.exit("No SUPABASE_DB_URL. Put it in ingest/.env — see the README line printed by `status`.")
    return u

def connect():
    import psycopg2
    c = psycopg2.connect(dburl()); c.autocommit = False
    return c

MONTHS = {m: i + 1 for i, m in enumerate(
    ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'])}

def parse_dob(raw):
    """-> (iso date or None, precision)

    Four shapes in the corpus. The two-digit year is the only judgement
    call: the pivot is 30, so 06 reads as 2006 and 79 as 1979. That is
    right for anyone competing and would be wrong for a centenarian, which
    is a trade this corpus can make.
    """
    s = (raw or '').strip()
    if not s or s.upper() in ('N/A', 'NA', '-'): return None, 'none'
    m = re.fullmatch(r'(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ -](\d{2}|\d{4})', s)
    if m:
        d, mon, y = int(m.group(1)), MONTHS.get(m.group(2).lower()), int(m.group(3))
        if mon:
            if len(m.group(3)) == 2: y = 2000 + y if y <= 30 else 1900 + y
            try:
                import datetime; datetime.date(y, mon, d)
                return f'{y:04d}-{mon:02d}-{d:02d}', 'day'
            except ValueError:
                return None, 'none'
    m = re.fullmatch(r'([A-Za-z]{3})[a-z]*[ -](\d{4})', s)
    if m and MONTHS.get(m.group(1).lower()):
        return None, 'month'
    if re.fullmatch(r'\d{4}', s): return None, 'year'
    return None, 'none'

def name_key(n):
    """Fold case, accents and punctuation so 'Ta Lou' and 'TA LOU' meet."""
    s = unicodedata.normalize('NFKD', str(n or '')).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()

def manifest():
    return json.load(open(os.path.join(HERE, 'manifest.json')))['files']

def rows_of(f):
    with open(os.path.join(SRC, f), encoding='utf-8', errors='ignore') as fh:
        for r in csv.DictReader(fh):
            yield r

# ── steps ────────────────────────────────────────────────────────────
def step_disciplines(cx):
    cur = cx.cursor()
    seen = {}
    with open(os.path.join(HERE, 'disciplines.csv'), encoding='utf-8') as fh:
        rows = list(csv.DictReader(fh))
    for r in rows:
        seen.setdefault(r['id'], r)
    def num(v): return None if v in ('', None) else float(v)
    cur.executemany("""
        insert into reference.disciplines
          (id, canonical, event_group, indoor, implement_kg, barrier_cm,
           spacing_m, age_band, rankable, lower_better)
        values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        on conflict (id) do update set
          canonical=excluded.canonical, event_group=excluded.event_group,
          indoor=excluded.indoor, implement_kg=excluded.implement_kg,
          barrier_cm=excluded.barrier_cm, spacing_m=excluded.spacing_m,
          age_band=excluded.age_band, rankable=excluded.rankable,
          lower_better=excluded.lower_better
    """, [(d['id'], d['canonical'], d['group'], d['indoor'] == 'True',
           num(d['implement_kg']), num(d['barrier_cm']), num(d['spacing_m']),
           d['age_band'] or None, d['rankable'] == 'True', d['lower_better'] == 'True')
          for d in seen.values()])
    cur.executemany("""
        insert into reference.discipline_aliases (raw, discipline_id, n_seen)
        values (%s,%s,%s)
        on conflict (raw) do update set discipline_id=excluded.discipline_id,
                                        n_seen=excluded.n_seen
    """, [(r['raw'], r['id'], int(r['n'])) for r in rows])
    cx.commit()
    print(f"disciplines {len(seen)}   aliases {len(rows)}")

def step_athletes(cx):
    ath = {}
    for f in manifest():
        for r in rows_of(f):
            n = (r.get('athlete_name') or '').strip()
            if not n: continue
            raw = (r.get('DOB') or '').strip()
            k = (name_key(n), raw)
            if k not in ath:
                iso, prec = parse_dob(raw)
                ath[k] = (n, (r.get('Gender') or '').strip()[:1].upper() or None,
                          (r.get('Nationality') or '').strip() or None, iso, prec)
    cur = cx.cursor()
    buf = io.StringIO(); w = csv.writer(buf)
    for (nk, raw), (nm, sex, nat, iso, prec) in ath.items():
        w.writerow([nm, nk, raw, iso or '', prec, sex or '', nat or ''])
    buf.seek(0)
    cur.execute("create temp table _a (name text, name_key text, dob_raw text, dob text, dob_precision text, sex text, nationality text) on commit drop")
    cur.copy_expert("copy _a from stdin with (format csv)", buf)
    cur.execute("""
        insert into reference.athletes (name, name_key, dob_raw, dob, dob_precision, sex, nationality)
        select name, name_key, dob_raw, nullif(dob,'')::date, dob_precision,
               nullif(sex,''), nullif(nationality,'')
        from _a
        on conflict (name_key, coalesce(dob_raw,'')) do nothing
    """)
    cx.commit()
    cur.execute("select count(*) from reference.athletes")
    print(f"athletes in file {len(ath):,}   in database {cur.fetchone()[0]:,}")

def load_ids(cx):
    cur = cx.cursor()
    cur.execute("select name_key, coalesce(dob_raw,''), id from reference.athletes")
    return {(k, d): i for k, d, i in cur.fetchall()}

def load_alias(cx):
    cur = cx.cursor()
    cur.execute("select raw, discipline_id from reference.discipline_aliases")
    return dict(cur.fetchall())

def step_results(cx):
    t0 = time.time()
    ids, alias = load_ids(cx), load_alias(cx)
    cur = cx.cursor()
    cur.execute("select distinct source_file from reference.results")
    done = {r[0] for r in cur.fetchall()}
    todo = [f for f in manifest() if f not in done]
    if not todo:
        print("results: nothing left"); return
    for f in todo:
        if time.time() - t0 > BUDGET:
            print(f"stopping cleanly with {len(todo)} file(s) still to do — run again"); return
        buf = io.StringIO(); w = csv.writer(buf); n = 0; skipped = 0
        for r in rows_of(f):
            nm = (r.get('athlete_name') or '').strip()
            aid = ids.get((name_key(nm), (r.get('DOB') or '').strip()))
            did = alias.get((r.get('Discipline') or '').strip())
            if not aid or not did: skipped += 1; continue
            p = parse_mark(r.get('Performance'))
            age = (r.get('Age_At_Event_Decimal') or '').strip()
            try: age = float(age)
            except ValueError: age = None
            # A date of birth that makes an athlete younger than ten is a
            # bad DOB, not a prodigy. Kept as a row, age dropped.
            if age is not None and age < 10: age = None
            d = (r.get('Date') or '').strip()
            # DD-Mon-YY (three files) -> ISO. Same pivot as the DOB parser:
            # results run to 2026, so 26 is 2026 and 88 is 1988.
            md = re.fullmatch(r'(\d{1,2})-([A-Za-z]{3})-(\d{2})', d)
            if md and MONTHS.get(md.group(2).lower()):
                yy = int(md.group(3)); yy = 2000 + yy if yy <= 30 else 1900 + yy
                d = f'{yy:04d}-{MONTHS[md.group(2).lower()]:02d}-{int(md.group(1)):02d}'
            sc = (r.get('Score') or '').strip()
            # Wind is mostly a number but carries "NWI" (no wind information)
            # and other markers. Anything non-numeric means the wind is
            # unknown, which is not the same as zero and must stay null.
            wnd = (r.get('Wind') or '').strip().replace('+', '')
            try: wnd = str(float(wnd))
            except ValueError: wnd = ''
            w.writerow([aid, did, d, '' if p['value'] is None else p['value'],
                        p['unit'] or '', (r.get('Performance') or '').strip(),
                        p['status'], p['hand_timed'], p['oversized'],
                        wnd, '' if age is None else age,
                        (r.get('Competition') or '').strip()[:200],
                        (r.get('Category') or '').strip()[:20],
                        (r.get('Place') or '').strip()[:20],
                        sc if sc.isdigit() else '', f])
            n += 1
        buf.seek(0)
        cur.execute("""create temp table _r (
            athlete_id bigint, discipline_id text, event_date text, mark text,
            unit text, raw_mark text, status text, hand_timed boolean,
            oversized boolean, wind text, age_years text, competition text,
            category text, place text, score text, source_file text)
            on commit drop""")
        cur.copy_expert("copy _r from stdin with (format csv)", buf)
        cur.execute("delete from reference.results where source_file = %s", (f,))
        cur.execute("""
            insert into reference.results
              (athlete_id, discipline_id, event_date, mark, unit, raw_mark, status,
               hand_timed, oversized, wind, age_years, competition, category,
               place, score, source_file)
            select athlete_id, discipline_id,
                   case when event_date ~ '^\\d{4}-\\d{2}-\\d{2}' then event_date::date
                        when event_date ~ '^\\d{2} \\w{3} \\d{4}$' then to_date(event_date,'DD Mon YYYY')
                        else null end,
                   nullif(mark,'')::numeric, nullif(unit,''), raw_mark, coalesce(status,''),
                   hand_timed, oversized, nullif(wind,'')::numeric,
                   nullif(age_years,'')::numeric, competition, category, place,
                   nullif(score,'')::int, source_file
            from _r""")
        cx.commit()
        print(f"  {n:>7,} rows  {'(' + str(skipped) + ' unmatched) ' if skipped else ''}{f}")

def step_status(cx):
    cur = cx.cursor()
    for q, label in [("select count(*) from reference.disciplines", "disciplines"),
                     ("select count(*) from reference.discipline_aliases", "aliases"),
                     ("select count(*) from reference.athletes", "athletes"),
                     ("select count(*) from reference.results", "results"),
                     ("select count(distinct source_file) from reference.results", "files loaded")]:
        cur.execute(q); print(f"  {label:<14}{cur.fetchone()[0]:>12,}")
    print(f"  {'files total':<14}{len(manifest()):>12,}")

if __name__ == '__main__':
    step = (sys.argv[1] if len(sys.argv) > 1 else 'status').lower()
    cx = connect()
    {'disciplines': step_disciplines, 'athletes': step_athletes,
     'results': step_results, 'status': step_status}[step](cx)
    cx.close()
