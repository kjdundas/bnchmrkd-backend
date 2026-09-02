# ═══════════════════════════════════════════════════════════════════════
# ONE MARK PARSER.
#
# The Performance column holds seven different things in one text field:
# seconds (10.73), metres (14.16m), mm:ss.ss (3:50.20), h:mm:ss (1:19:14),
# mm:ss (39:27), a non-result (DNF, DQ, NH, NM, DNS), and any of the above
# carrying a flag that changes what the number MEANS.
#
# Two flags matter and both would corrupt the corpus silently if dropped:
#
#   h    HAND TIMED. Worth roughly 0.24 s against electronic timing over
#        short sprints. 8,793 rows carry it. Left unflagged, hand times
#        become inexplicably fast youth marks in exactly the age band where
#        the sample is thinnest.
#   OT   OVERSIZED TRACK. Not record-eligible. Rare, but it is a real
#        asterisk and the corpus should keep it.
#
# Non-results return value None WITH a status, never 0 and never dropped —
# a DNF is information about a race that happened.
# ═══════════════════════════════════════════════════════════════════════
import re

NON_RESULT = {
    'dnf':'DNF','dns':'DNS','dq':'DQ','nh':'NH','nm':'NM','ncr':'NCR',
    'dnq':'DNQ','r':'R','-':'NM','':'',
}

_FLAGS = re.compile(r'\((?P<f>[^)]*)\)|(?P<h>h)$')

def parse_mark(raw, group=None):
    """-> dict(value, unit, hand_timed, oversized, status, raw)

    value is seconds for a timed event and metres for a field event, or None
    when there is no mark. status is '' for a normal result.
    """
    out = {'value': None, 'unit': None, 'hand_timed': False,
           'oversized': False, 'status': '', 'raw': raw}
    if raw is None: return out
    s = str(raw).strip()
    if not s: return out

    # Parenthesised annotations: (DQ), (OT), (i), (A) …
    for m in re.finditer(r'\(([^)]*)\)', s):
        tag = m.group(1).strip().lower()
        if tag == 'ot': out['oversized'] = True
        elif tag in NON_RESULT: out['status'] = NON_RESULT[tag]
    s = re.sub(r'\([^)]*\)', '', s).strip()

    # Hand timing: a trailing h on a number
    if re.search(r'\dh$', s):
        out['hand_timed'] = True
        s = s[:-1]
    s = s.strip()

    # A disqualification in a field event arrives as "DQm" — the status with
    # the metres suffix still attached.
    low = s.lower().rstrip('.')
    if low.endswith('m') and low[:-1] in NON_RESULT: low = low[:-1]
    if low in NON_RESULT:
        out['status'] = out['status'] or NON_RESULT[low]
        return out

    # Combined events score in points, not seconds or metres.
    if s.lower().endswith('pts'):
        try:
            out['value'] = float(s[:-3].strip()); out['unit'] = 'pts'
        except ValueError:
            out['status'] = 'UNPARSED'
        return out

    # Field events carry a trailing m
    field = s.endswith('m') and not re.search(r'\d:', s)
    if field: s = s[:-1].strip()

    # w = wind assisted marker some sources append
    if s.endswith('w'): s = s[:-1].strip()

    parts = s.split(':')
    try:
        if len(parts) == 1:
            v = float(parts[0])
            out['unit'] = 'm' if field else 's'
            out['value'] = v
        elif len(parts) == 2:                       # mm:ss(.ss)
            out['value'] = int(parts[0]) * 60 + float(parts[1]); out['unit'] = 's'
        elif len(parts) == 3:
            # Cross-country times appear as mm:ss:00 — a spreadsheet
            # artefact, not 35 hours. Read it as minutes:seconds when the
            # trailing field is a bare 00 and the leading one is too large
            # to be an hours figure for a running race.
            if parts[2] == '00' and int(parts[0]) > 10:
                out['value'] = int(parts[0]) * 60 + float(parts[1]); out['unit'] = 's'
                out['status'] = 'REFORMATTED'
            else:                                   # h:mm:ss(.ss)
                out['value'] = int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2]); out['unit'] = 's'
        else:
            out['status'] = 'UNPARSED'
    except ValueError:
        out['status'] = 'UNPARSED'

    # A field event measured in metres cannot be 500. A time cannot be
    # negative. Cheap bounds that catch a parser bug rather than a bad athlete.
    v = out['value']
    if v is not None and (v <= 0 or (out['unit'] == 'm' and v > 200)
            or (out['unit'] == 'pts' and v > 12000) or (out['unit'] == 's' and v > 60*60*30)):
        out['status'] = 'IMPLAUSIBLE'; out['value'] = None
    return out
