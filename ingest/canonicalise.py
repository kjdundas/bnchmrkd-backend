# ═══════════════════════════════════════════════════════════════════════
# 211 discipline strings -> one canonical vocabulary.
#
# Rules, not a hand-typed table, so it can be re-run when the corpus grows.
# Anything the rules cannot classify confidently is emitted with
# confidence=REVIEW rather than guessed at — a wrong canonical id silently
# merges two events, and that is the one error nobody would notice.
#
# Implement mass and barrier height are part of the IDENTITY, not modifiers.
# Shot Put (5kg) is its own event. Merging it into Shot Put produces a curve
# that says throwers get worse at seventeen.
# ═══════════════════════════════════════════════════════════════════════
import csv, json, re, sys
from collections import Counter, defaultdict

man = json.load(open('manifest.json'))
import os
os.chdir('../World athletics data')

counts = Counter(); sexes = defaultdict(set)
for f in man['files']:
    with open(f, encoding='utf-8', errors='ignore') as fh:
        for r in csv.DictReader(fh):
            d = (r.get('Discipline') or '').strip()
            counts[d] += 1
            g = (r.get('Gender') or '').strip()[:1].upper()
            if g: sexes[d].add(g)

def parse(raw):
    s = raw.strip()
    out = {'indoor': False, 'implement_kg': None, 'barrier_cm': None,
           'spacing_m': None, 'rankable': True, 'confidence': 'OK', 'note': ''}

    # Indoor / short track
    if re.search(r'\bshort track\b', s, re.I):
        out['indoor'] = True
        s = re.sub(r'\s*short track\s*', ' ', s, flags=re.I).strip()

    # Bracketed spec: implement mass, barrier height, or height/spacing
    m = re.search(r'\(([^)]+)\)', s)
    spec = m.group(1).strip() if m else ''
    if m: s = (s[:m.start()] + s[m.end():]).strip()
    if spec:
        sp = spec.replace(',', '.')
        if re.fullmatch(r'[\d.]+\s*kg', sp, re.I):
            out['implement_kg'] = float(re.findall(r'[\d.]+', sp)[0])
        elif re.fullmatch(r'[\d.]+\s*(g|gr)', sp, re.I):
            out['implement_kg'] = float(re.findall(r'[\d.]+', sp)[0]) / 1000
        elif re.fullmatch(r'[\d.]+\s*cm', sp, re.I):
            out['barrier_cm'] = float(re.findall(r'[\d.]+', sp)[0])
        elif re.fullmatch(r'[\d.]+/[\d.]+', sp):          # height/spacing in m
            h, gap = sp.split('/')
            out['barrier_cm'] = float(h) * 100
            # Same height at different spacing is a different race. Merging
            # them is the same error as merging a 5kg and a 7.26kg shot.
            out['spacing_m'] = float(gap)
        elif re.fullmatch(r'[\d.]+kg/[\d.]+cm', sp, re.I): # weight throw
            out['implement_kg'] = float(sp.split('kg')[0])
        elif sp.lower() == 'old':
            out['note'] = 'pre-1986 javelin spec'
        elif re.fullmatch(r'[\d.]+', sp) and re.search(r'thlon', s, re.I):
            out['barrier_cm'] = float(sp) * 100      # decathlon hurdle height
        else:
            out['confidence'] = 'REVIEW'; out['note'] = f'unparsed spec "{spec}"'

    # Trailing age-group / sex qualifiers on combined events
    q = re.search(r'\b(U1[2-9]|U20|Boys|Girls|Men|Women|[A-C])\s*$', s)
    if q and re.search(r'thlon', s, re.I):
        # Kept, not stripped: a U18 heptathlon is thrown and hurdled with
        # different specifications from a senior one, so it is a different
        # event even though the name is the same word.
        out['age_band'] = q.group(1)
        out['note'] = (out['note'] + f'; age band {q.group(1)}').strip('; ')

    n = re.sub(r'\s+', ' ', s).strip(' -')
    low = n.lower()

    # ── group ──
    if re.search(r'relay|medley|2x2x|3x\d', low):          g, rank = 'relay', False
    elif 'race walk' in low or low.startswith('walk'):     g, rank = 'walk', True
    elif re.search(r'thlon', low):                         g, rank = 'combined', True
    elif re.search(r'mountain|trail|uphill|vertical', low): g, rank = 'mountain', True
    elif 'cross country' in low:                           g, rank = 'xc', True
    elif re.search(r'steeplechase', low):                  g, rank = 'distance', True
    elif re.search(r'hurdles', low):                       g, rank = 'hurdles', True
    elif re.search(r'shot put|discus|javelin|hammer|weight throw', low): g, rank = 'throw', True
    elif re.search(r'jump|vault', low):                    g, rank = 'jump', True
    elif re.fullmatch(r'(road )?mile', low):            g, rank = ('road' if 'road' in low else 'middle'), True
    elif re.search(r'marathon|kilometres road|miles|kilometers road|\bmile\b', low): g, rank = 'road', True
    else:
        m2 = re.match(r'^([\d,]+)\s*(metres|m)\b', low)
        if m2:
            d = int(m2.group(1).replace(',', ''))
            g = 'sprint' if d <= 400 else 'middle' if d <= 1500 else 'distance'
            rank = True
        elif re.match(r'^([\d,.]+)\s*kilometres', low):    g, rank = 'road', True
        elif re.search(r'\byards?\b', low):                g, rank = 'sprint', True
        elif low in ('one hour', 'two hours'):             g, rank = 'distance', True
        elif low == 'road race':
            # No distance stated, so it cannot be compared with anything.
            # Kept as a row, never ranked.
            g, rank = 'road', False
            out['note'] = (out['note'] + '; distance not stated').strip('; ')
        else:
            g, rank = 'other', True
            out['confidence'] = 'REVIEW'; out['note'] = (out['note'] + '; unclassified').strip('; ')
    out['rankable'] = rank
    out['group'] = g
    out['lower_better'] = g not in ('jump', 'throw', 'combined')

    # ── canonical name ──
    n = re.sub(r'\bMetres\b', 'm', n, flags=re.I)
    n = re.sub(r'\bKilometres?\b', 'km', n, flags=re.I)
    n = re.sub(r'\bKilometers?\b', 'km', n, flags=re.I)
    n = re.sub(r'(\d),(\d)', r'\1\2', n)
    n = re.sub(r'(\d)\s+m\b', r'\1m', n)
    n = re.sub(r'\s+', ' ', n).strip()
    out['canonical'] = n

    bits = [n]
    if out.get('age_band'): bits.append(out['age_band'])
    if out['indoor']: bits.append('indoor')
    if out['implement_kg'] is not None: bits.append(f"{out['implement_kg']:g}kg")
    if out['barrier_cm'] is not None: bits.append(f"{out['barrier_cm']:g}cm")
    if out['spacing_m'] is not None: bits.append(f"sp{out['spacing_m']:g}")
    if 'pre-1986' in out['note']: bits.append('old')
    out['id'] = re.sub(r'[^a-z0-9]+', '_', ' '.join(bits).lower()).strip('_')
    return out

rows = []
for raw, n in counts.most_common():
    p = parse(raw)
    rows.append({'raw': raw, 'n': n, 'sexes': ''.join(sorted(sexes[raw])),
                 'id': p['id'], 'canonical': p['canonical'], 'group': p['group'],
                 'indoor': p['indoor'], 'implement_kg': p['implement_kg'],
                 'barrier_cm': p['barrier_cm'], 'spacing_m': p['spacing_m'],
                 'age_band': p.get('age_band'), 'rankable': p['rankable'],
                 'lower_better': p['lower_better'],
                 'confidence': p['confidence'], 'note': p['note']})

with open('../ingest/disciplines.csv', 'w', newline='', encoding='utf-8') as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

ids = Counter(r['id'] for r in rows)
merged = {i: [r['raw'] for r in rows if r['id'] == i] for i, c in ids.items() if c > 1}
review = [r for r in rows if r['confidence'] == 'REVIEW']
print(f"{len(rows)} strings -> {len(ids)} canonical ids")
print(f"groups: {dict(Counter(r['group'] for r in rows).most_common())}")
print(f"not rankable (relays): {sum(1 for r in rows if not r['rankable'])}")
print(f"with implement: {sum(1 for r in rows if r['implement_kg'] is not None)}   with barrier: {sum(1 for r in rows if r['barrier_cm'] is not None)}")
print(f"\nNEEDS REVIEW: {len(review)}")
for r in review: print(f"   {r['n']:>6,}  {r['raw']}   -> {r['note']}")
print(f"\nSTRINGS THAT MERGE INTO ONE ID: {len(merged)}")
for i, raws in sorted(merged.items(), key=lambda kv: -sum(counts[x] for x in kv[1]))[:12]:
    print(f"   {i}")
    for x in raws: print(f"        {counts[x]:>7,}  {x}")
