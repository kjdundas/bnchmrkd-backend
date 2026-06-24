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


def build_skeleton(intake: dict[str, Any], maturity: dict[str, Any] | None, age: int | None) -> dict[str, Any]:
    """Produce the deterministic program skeleton the LLM must follow."""
    event = intake.get("event") or ""
    group = _group_for(event)
    priorities = _PRIORITIES.get(group, _PRIORITIES["sprint"])

    phase_key = (intake.get("season_phase") or "pre_season").lower()
    phase = _PHASES.get(phase_key, _PHASES["pre_season"])

    days = max(2, min(int(intake.get("days_per_week") or 3), 6))
    primary = (intake.get("primary_quality") or priorities[0]).strip()
    secondary = (intake.get("secondary_quality") or "").strip() or None

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
        week_layout.append({"day": d + 1, "primary_quality": q})

    return {
        "discipline_group": group,
        "event_quality_priorities": priorities,
        "primary_quality": primary,
        "secondary_quality": secondary,
        "season_phase": phase,
        "days_per_week": days,
        "session_minutes": intake.get("session_minutes"),
        "equipment": intake.get("equipment"),
        "training_age_years": intake.get("training_age_years"),
        "target_competition_date": intake.get("target_competition_date"),
        "loading_ceiling": ceilings,
        "week_layout": week_layout,
        "injury_flags": injuries,
        "injury_modifications": injury_mods,
        "unrecognised_injury_notes": other_injuries,
    }
