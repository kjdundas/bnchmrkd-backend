"""
Program skeleton — the deterministic coaching layer (Expert Assistant · Phase 2).

Given a structured intake (event, season phase, emphasis, maturity, injuries,
availability), this produces a periodization-aware SKELETON: the weekly quality
distribution, loading ceilings, phase guidance, and injury modifications. The
LLM then fills in detailed sessions that MUST respect this skeleton. Keeping the
structure deterministic makes the output reliable and hard to hallucinate.

This encodes coaching principles (periodization, event-specific quality
priorities, maturation-aware loading, growth-injury awareness). It is guidance,
not medical advice; the injury logic flags + adapts + refers — it never
diagnoses or programs through pain.
"""
from __future__ import annotations

from typing import Any

# ── Event → discipline group ─────────────────────────────────────────────
_GROUPS: dict[str, list[str]] = {
    "sprint": ["60m", "100m", "200m"],
    "long_sprint": ["400m"],
    "hurdles": ["60mh", "100mh", "110mh", "400mh"],
    "middle": ["800m", "1500m"],
    "distance": ["3000m", "3000m steeplechase", "5000m", "10000m", "marathon"],
    "jump": ["long jump", "triple jump", "high jump", "pole vault"],
    "throw": ["shot put", "discus throw", "javelin throw", "hammer throw", "discus", "javelin", "hammer", "shot"],
}

def _group_for(event: str) -> str:
    e = (event or "").strip().lower()
    for grp, names in _GROUPS.items():
        if e in names:
            return grp
    # loose contains-match fallback
    for grp, names in _GROUPS.items():
        if any(n in e for n in names):
            return grp
    return "sprint"

# ── Group → ordered quality priorities ───────────────────────────────────
_PRIORITIES: dict[str, list[str]] = {
    "sprint": ["max velocity", "acceleration", "power", "max strength", "speed endurance", "technique"],
    "long_sprint": ["speed endurance", "special endurance", "speed", "power", "strength"],
    "hurdles": ["speed", "hurdle technique", "power", "mobility", "rhythm"],
    "middle": ["aerobic capacity", "anaerobic/lactate", "speed", "strength endurance"],
    "distance": ["aerobic base", "threshold", "running economy", "speed", "strength endurance"],
    "jump": ["speed", "power", "plyometric/elastic", "jump technique", "strength"],
    "throw": ["max strength", "power", "throw technique", "mobility", "speed"],
}

# ── Season phase → emphasis ──────────────────────────────────────────────
_PHASES: dict[str, dict[str, str]] = {
    "off_season": {
        "label": "Off-season / General Prep (GPP)",
        "volume": "high", "intensity": "low–moderate",
        "bias": "general qualities, work capacity, strength base, technique, mobility",
        "note": "Build a broad foundation. Higher volume, lower intensity, general before specific.",
    },
    "pre_season": {
        "label": "Pre-season / Specific Prep (SPP)",
        "volume": "moderate", "intensity": "rising",
        "bias": "event-specific qualities; convert strength toward power and speed",
        "note": "Sharpen toward the event. Intensity rises as volume eases; work gets specific.",
    },
    "competition": {
        "label": "Competition / In-season",
        "volume": "low", "intensity": "high",
        "bias": "maintain qualities, sharpen the primary competitive quality, prioritise recovery and tapering around meets",
        "note": "Maintain and sharpen. Low volume, high quality, manage fatigue and taper into key meets.",
    },
    "transition": {
        "label": "Transition / Recovery",
        "volume": "low", "intensity": "low",
        "bias": "active recovery, cross-training, mobility, address niggles",
        "note": "Recover and regenerate. Low load, varied/cross-training, fix lingering issues.",
    },
}

# ── Maturity status → loading ceilings ───────────────────────────────────
def _ceilings(maturity_status: str | None, age: int | None) -> dict[str, str]:
    pre = maturity_status == "pre-PHV" or (maturity_status is None and age is not None and age < 13)
    circa = maturity_status == "circa-PHV" or (maturity_status is None and age is not None and 13 <= age < 15)
    if pre:
        return {
            "stage": "pre-PHV",
            "external_load": "Bodyweight and light implements only — NO near-maximal lifts, no 1RM testing.",
            "plyometrics": "Low-intensity, low-volume, technique-led (skips, low hops); avoid high-impact depth jumps.",
            "intensity": "Submaximal — speed work emphasises mechanics/coordination over all-out effort.",
            "emphasis": "Movement skill, coordination, sprint/jump/throw technique, multi-directional athleticism. Keep it varied and playful.",
        }
    if circa:
        return {
            "stage": "circa-PHV",
            "external_load": "Light–moderate, technique-led; NO maximal lifts. Monitor for growth-related discomfort.",
            "plyometrics": "Moderate, controlled; reduce impact volume during rapid growth.",
            "intensity": "Moderate; manage total volume around the growth spurt.",
            "emphasis": "Re-groove technique as limbs lengthen; introduce strength patterns with light load and strict form; watch knees/heels.",
        }
    return {
        "stage": maturity_status or "post-PHV / adult",
        "external_load": "Progressive loading appropriate to TRAINING AGE (years of structured training), not just biological age.",
        "plyometrics": "Programmed per training age and event needs.",
        "intensity": "Full range as appropriate to phase and recovery.",
        "emphasis": "Structured progressive development of the event's priority qualities.",
    }

# ── Injury flags → modifications (flag + adapt + refer; never diagnose) ───
_INJURY_MODS: dict[str, str] = {
    "knee": "Reduce jumping/plyometric and deep-knee loading; avoid loading through pain. Knee pain around PHV can signal conditions like Osgood-Schlatter or Sinding-Larsen-Johansson — refer to a physio/doctor for assessment.",
    "heel": "Reduce running and impact/plyometric volume; check footwear and surfaces. Heel pain in growing athletes can signal Sever's (calcaneal apophysitis) — refer for assessment.",
    "ankle": "Reduce impact and change-of-direction volume; prioritise controlled rehab-style work. Refer if pain persists.",
    "hip": "Reduce sprint volume and aggressive change-of-direction; avoid end-range loading through pain. Refer for groin/hip pain.",
    "shin": "Reduce running volume and hard-surface impact (possible shin splints / stress reaction risk). Refer if pain is focal or worsening.",
    "back": "Reduce axial/spinal loading; emphasise core control and technique; avoid loaded flexion through pain. Refer for assessment.",
}


_WEEKDAY_NAMES = {
    1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday",
    5: "Friday", 6: "Saturday", 7: "Sunday",
}

# Fallback weekday layouts, recovery-spaced rather than packed against the
# front of the week. Mirrors AUTO_SPREAD in mobile/src/lib/schedule.ts — the
# two must agree, or a program laid out here lands on different days in the
# app than the ones it was written for.
_AUTO_SPREAD = {
    1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5],
    5: [1, 2, 4, 5, 6], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7],
}


# ── DNA axis → the quality vocabulary the program is written in ───────────
# The radar scores six physical axes; the generator prescribes against eleven
# named qualities. This is the join between them, and it is deliberately not
# one-to-one: "conditioning" means a different session for a 400m runner than
# for a 5000m runner, so the mapping asks the discipline group.
_AXIS_QUALITY: dict[str, str] = {
    "acceleration": "acceleration",
    "topSpeed": "max velocity",
    "power": "power",
    "strength": "max strength",
    "mobility": "mobility",
    "conditioning": "aerobic capacity",
}


def _axis_to_quality(axis: str, group: str) -> str | None:
    if axis == "conditioning":
        # A long sprinter's conditioning limiter is a speed-endurance problem,
        # not an aerobic-base one. Prescribing tempo runs for a 400m athlete
        # who cannot hold form through the last 80m is the wrong session.
        # NOTE the group keys here are this module's (_GROUPS: sprint,
        # long_sprint, hurdles, middle, distance, jump, throw) — NOT the
        # mobile radar's camelCase families. They look alike and are not.
        if group in ("sprint", "long_sprint", "hurdles", "jump", "throw"):
            return "speed endurance"
        return "aerobic capacity"
    return _AXIS_QUALITY.get(axis)


def _focus_from_limiters(dna: dict[str, Any] | None, group: str) -> list[str]:
    """The athlete's weakest high-priority qualities, worst first.

    buildDnaSummary has already done the diagnosis: limiters are the top-4
    priority axes scoring under 60, sorted lowest first. This only translates
    them into the prescribing vocabulary. An athlete with no limiter is not a
    problem to solve — they are strong across their event's key qualities, and
    the caller falls back to the event default.
    """
    out: list[str] = []
    for lim in (dna or {}).get("limiters") or []:
        if not isinstance(lim, dict):
            continue
        q = _axis_to_quality(str(lim.get("axis") or ""), group)
        if q and q not in out:
            out.append(q)
    return out


def _training_days(intake: dict[str, Any]) -> list[int]:
    """The athlete's chosen weekdays (ISO: Monday=1), de-duplicated and sorted.

    Empty when they have not chosen — the caller then falls back to a spread,
    and the app is told the days were assumed rather than asked for.
    """
    raw = intake.get("training_days") or []
    if isinstance(raw, (str, int)):
        raw = [raw]
    out: set[int] = set()
    for v in raw:
        try:
            n = int(v)
        except (TypeError, ValueError):
            continue
        if 1 <= n <= 7:
            out.add(n)
    return sorted(out)


# ── Session archetypes ───────────────────────────────────────────────────
#
# A hurdle walkover and a back squat were rendering as the same row: name,
# prescription, intensity, rest, tempo, cue. That is a GYM row, and every
# other kind of session was being squeezed into it. A technical drill has no
# load and its whole point is what a good rep looks like; a track rep needs
# two different recoveries (between reps and between sets) and the difference
# between them IS the session.
#
# The archetype is derived here from the quality the skeleton already assigned
# to that day, rather than left to the model, so the app can rely on it being
# present and being one of a known set.
SESSION_TYPES = ("track", "gym", "technical", "conditioning", "mobility", "recovery")

_QUALITY_TYPE: dict[str, str] = {
    # On the track, running fast.
    "acceleration": "track",
    "max velocity": "track",
    "speed": "track",
    "speed endurance": "track",
    "special endurance": "track",
    # In the gym, moving load.
    "max strength": "gym",
    "strength": "gym",
    "power": "gym",
    "plyometric/elastic": "gym",
    "strength endurance": "gym",
    # Skill work, where load is beside the point.
    "technique": "technical",
    "hurdle technique": "technical",
    "jump technique": "technical",
    "throw technique": "technical",
    "rhythm": "technical",
    # Aerobic and lactate work.
    "aerobic capacity": "conditioning",
    "aerobic base": "conditioning",
    "threshold": "conditioning",
    "anaerobic/lactate": "conditioning",
    "running economy": "conditioning",
    # Range and tissue work.
    "mobility": "mobility",
}


def session_type_for(quality: str | None) -> str:
    """The archetype a session built around this quality belongs to."""
    return _QUALITY_TYPE.get(str(quality or "").strip().lower(), "track")


# ── Week-by-week shape of the block ──────────────────────────────────────
#
# The program used to be ONE template week plus a paragraph of prose about
# progression. Nothing in the app knew about week 3, so an athlete in week 3
# saw exactly what they saw in week 1 and the deload the paragraph described
# never appeared on any calendar.
#
# This gives the block a shape the app can actually read. It deliberately does
# NOT emit multipliers for the app to apply to prescriptions: you cannot take
# "5 x 20 m sled push" and multiply its volume by 0.6 and get a coherent
# session, and %1RM does not scale linearly either. The skeleton owns the
# SHAPE — which weeks build and which unload — and the generator writes the
# specific adjustment for each one.


def _deload_every(maturity_status: str | None, age: int | None) -> int:
    """How many weeks of loading before an unloading week.

    Three-week cycles for growing athletes rather than four. Around peak
    height velocity, tissue tolerance lags behind the training an athlete is
    keen to do, and the conservative cycle is the same reasoning as the
    loading ceilings — this is not the population to run 3:1 on by default.
    """
    if maturity_status in ("pre-PHV", "circa-PHV"):
        return 2
    if maturity_status is None and age is not None and age < 15:
        return 2
    return 3


def build_week_plan(
    weeks: int,
    maturity_status: str | None = None,
    age: int | None = None,
) -> list[dict[str, Any]]:
    """One entry per week of the block: is this a loading week or an unload?"""
    load_run = _deload_every(maturity_status, age)
    plan: list[dict[str, Any]] = []
    since_unload = 0

    for w in range(1, max(1, weeks) + 1):
        # A block too short to need one never gets an unloading week; two
        # weeks of building is not a mesocycle that needs unloading.
        deload = weeks >= 3 and since_unload >= load_run
        if deload:
            since_unload = 0
        else:
            since_unload += 1
        plan.append({
            "week": w,
            "phase": "deload" if deload else "build",
            "intent": (
                "Unload. Cut total volume to roughly 60% and keep the intensity "
                "of the quality work — the point is to absorb the last block, "
                "not to lose the adaptation."
                if deload else
                "Build. Small progression on the previous week — one more rep, "
                "one more run, or a modest load increase on the main lifts."
            ),
        })
    return plan


def build_skeleton(
    intake: dict[str, Any],
    maturity: dict[str, Any] | None,
    age: int | None,
    dna: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Produce the deterministic program skeleton the LLM must follow."""
    event = intake.get("event") or ""
    group = _group_for(event)
    priorities = _PRIORITIES.get(group, _PRIORITIES["sprint"])

    phase_key = (intake.get("season_phase") or "pre_season").lower()
    phase = _PHASES.get(phase_key, _PHASES["pre_season"])

    # WHICH days the athlete trains decides HOW MANY sessions there are. The
    # count is only consulted when they have not said which days — asking for
    # both invites the two to disagree.
    chosen_days = _training_days(intake)
    if chosen_days:
        days = len(chosen_days)
        weekdays = list(chosen_days)
        days_source = "athlete"
    else:
        days = max(2, min(int(intake.get("days_per_week") or 3), 6))
        weekdays = _AUTO_SPREAD.get(days) or [(i % 7) + 1 for i in range(days)]
        days_source = "assumed"
    # ── Where the focus comes from ────────────────────────────────────
    # Three sources, and the skeleton records which one it used so the plan
    # can tell the athlete honestly why it targets what it targets.
    #
    #   limiters      they asked for it to be built from their data, and the
    #                 data names a weak point in one of the event's key
    #                 qualities.
    #   athlete       they chose the focus themselves.
    #   event_default nothing to go on — either no tests, or no weakness in
    #                 the qualities that matter for the event.
    focus_mode = str(intake.get("focus_mode") or "manual").strip().lower()
    limiter_qualities = _focus_from_limiters(dna, group) if focus_mode == "data" else []

    if limiter_qualities:
        primary = limiter_qualities[0]
        secondary = limiter_qualities[1] if len(limiter_qualities) > 1 else None
        focus_source = "limiters"
    elif (intake.get("primary_quality") or "").strip():
        primary = intake["primary_quality"].strip()
        secondary = (intake.get("secondary_quality") or "").strip() or None
        focus_source = "athlete"
    else:
        primary = priorities[0]
        secondary = None
        focus_source = "event_default"

    maturity_status = (maturity or {}).get("status")
    ceilings = _ceilings(maturity_status, age)

    # Injury modifications from the screen.
    raw_injuries = intake.get("injuries") or []
    if isinstance(raw_injuries, str):
        raw_injuries = [raw_injuries]
    injuries = [str(i).strip().lower() for i in raw_injuries if str(i).strip().lower() not in ("", "none")]
    injury_mods = [_INJURY_MODS[i] for i in injuries if i in _INJURY_MODS]
    other_injuries = [i for i in injuries if i not in _INJURY_MODS]

    # Weekly quality layout: primary gets the most touches, then rotate priorities.
    ordered = [primary] + [q for q in ([secondary] if secondary else []) if q] + [q for q in priorities if q not in (primary, secondary)]
    week_layout = []
    for d in range(days):
        q = ordered[d % len(ordered)]
        wd = weekdays[d % len(weekdays)]
        week_layout.append({
            "day": d + 1,
            "day_of_week": wd,
            "weekday": _WEEKDAY_NAMES[wd],
            "primary_quality": q,
            "session_type": session_type_for(q),
        })

    weeks_in_block = max(1, min(int(intake.get("weeks") or 4), 12))

    return {
        "discipline_group": group,
        "event_quality_priorities": priorities,
        "primary_quality": primary,
        "secondary_quality": secondary,
        "focus_source": focus_source,
        "focus_mode": focus_mode,
        "season_phase": phase,
        "days_per_week": days,
        "training_days": weekdays,
        "training_days_source": days_source,
        "session_minutes": intake.get("session_minutes"),
        "equipment": intake.get("equipment"),
        "training_age_years": intake.get("training_age_years"),
        "target_competition_date": intake.get("target_competition_date"),
        "loading_ceiling": ceilings,
        "week_layout": week_layout,
        "weeks": weeks_in_block,
        "week_plan": build_week_plan(weeks_in_block, maturity_status, age),
        "deload_every": _deload_every(maturity_status, age),
        "injury_flags": injuries,
        "injury_modifications": injury_mods,
        "unrecognised_injury_notes": other_injuries,
    }
