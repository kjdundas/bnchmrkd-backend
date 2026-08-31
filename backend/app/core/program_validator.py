"""Check a generated program against the skeleton it was built from.

Nothing used to check this. The only guard was client-side — `if
(!program.title) throw` — so a program that ignored the maturity loading
ceiling shipped to the athlete unread. The ceiling is the child-safety
mechanism in this system: it is what stops a pre-PHV athlete being prescribed
"4 x 4 @ 82% 1RM". A safety rule that is stated in a prompt and never verified
is a hope, not a control.

Two classes of finding, and they are treated very differently:

  VIOLATIONS  Safety. The program contradicts the loading ceiling for this
              athlete's maturity stage. These are never shipped — the caller
              gets one repair attempt and then refuses.
  WARNINGS    Quality. Missing prescriptions, a session count that does not
              match the plan, a focus the skeleton did not ask for. Worth
              surfacing and not worth blocking a program over.

Everything here is string inspection of a model's output, so it is a filter,
not a proof: it catches what it is written to catch. That is the honest
framing — it makes a whole class of failure loud instead of silent, and it
does not make the generator trustworthy.
"""

from __future__ import annotations

import re
from typing import Any

# Language that means near-maximal external loading. Matched against the
# intensity and prescription of every exercise for athletes whose ceiling
# forbids it.
#
# The bar is deliberately low: "%1RM" written any of the ways a model writes
# it, explicit maximal-effort language, and 1RM testing. False positives here
# cost one regeneration; false negatives put a barbell on a growing spine.
_MAXIMAL_PATTERNS: list[tuple[str, str]] = [
    (r"\b\d{2,3}\s*%\s*(of\s*)?1\s*-?\s*rm\b", "a percentage of 1RM"),
    (r"\b1\s*-?\s*rm\b", "1RM"),
    (r"\bone[- ]rep(etition)?[- ]max", "one-rep max"),
    (r"\bmax(imal|imum)?\s+(load|effort\s+lift|lift|attempt)", "maximal lifting"),
    (r"\b[3-9]\s*rm\b", "a rep-max load"),
    (r"\bas\s+heavy\s+as\s+possible\b", "maximal loading"),
    (r"\btest(ing)?\s+(your\s+)?1\s*-?\s*rm\b", "1RM testing"),
]

# Depth jumps and high-impact plyometrics, restricted pre-PHV.
_HIGH_IMPACT_PATTERNS: list[tuple[str, str]] = [
    (r"\bdepth\s+jump", "depth jumps"),
    (r"\bdrop\s+jump\s+from\s+(6[0-9]|[7-9][0-9]|\d{3})\s*cm", "high drop jumps"),
    (r"\bshock\s+method\b", "shock-method plyometrics"),
]

_RESTRICTED_STAGES = ("pre-PHV", "circa-PHV")

SESSION_TYPES = ("track", "gym", "technical", "conditioning", "mobility", "recovery")

# Blocks where a load prescription is a category error rather than a safety
# problem. A technical drill's prescription IS its quality; putting %1RM on a
# hurdle walkover means the model reached for the gym template.
_NO_LOAD_TYPES = ("technical", "mobility", "recovery")
_LOAD_HINT = re.compile(r"(\d+\s*%|\brpe\b|\b\d+\s*kg\b|\b1\s*-?\s*rm\b)", re.I)


def normalise_types(program: dict[str, Any], skeleton: dict[str, Any]) -> None:
    """Put a valid type on every session and block, in place.

    The app switches its layout on these, so an absent or invented type would
    fall back to the gym row — which is the exact behaviour this replaced. The
    session type comes from the skeleton (deterministic); a block only keeps
    its own type if the model returned a real one.
    """
    layout = skeleton.get("week_layout") or []
    for i, sess in enumerate(program.get("sessions") or []):
        if not isinstance(sess, dict):
            continue
        planned = layout[i].get("session_type") if i < len(layout) else None
        st = str(sess.get("type") or "").strip().lower()
        sess["type"] = planned or (st if st in SESSION_TYPES else "track")

        for block in sess.get("blocks") or []:
            if not isinstance(block, dict):
                continue
            bt = str(block.get("type") or "").strip().lower()
            if bt not in SESSION_TYPES:
                # Fall back to the session's own archetype rather than to a
                # gym row, so an untyped block at least renders as the kind of
                # work the day is about.
                bt = sess["type"]
            block["type"] = bt


def _texts(exercise: dict[str, Any]) -> str:
    """Everything on an exercise a loading instruction could hide in."""
    parts = [
        exercise.get("name"), exercise.get("prescription"),
        exercise.get("intensity"), exercise.get("cue"), exercise.get("tempo"),
    ]
    return " ".join(str(p) for p in parts if p).lower()


def _stage(skeleton: dict[str, Any]) -> str:
    return str((skeleton.get("loading_ceiling") or {}).get("stage") or "")


def validate_program(
    program: dict[str, Any], skeleton: dict[str, Any]
) -> tuple[list[str], list[str]]:
    """Return (violations, warnings).

    Violations are safety failures and must block. Warnings are quality notes.
    """
    violations: list[str] = []
    warnings: list[str] = []

    sessions = program.get("sessions")
    if not isinstance(sessions, list) or not sessions:
        # Not a safety failure, but there is no program without it.
        violations.append("The program came back with no sessions.")
        return violations, warnings

    planned = len(skeleton.get("week_layout") or [])
    if planned and len(sessions) != planned:
        warnings.append(
            f"Asked for {planned} sessions, got {len(sessions)}."
        )

    stage = _stage(skeleton)
    restricted = stage in _RESTRICTED_STAGES
    pre_phv = stage == "pre-PHV"

    for i, sess in enumerate(sessions):
        where = str((sess or {}).get("label") or f"session {i + 1}")
        stype = str((sess or {}).get("type") or "").strip().lower()
        if stype and stype not in SESSION_TYPES:
            warnings.append(f"{where}: unknown session type “{stype}”.")
        if not isinstance(sess, dict):
            warnings.append(f"{where}: not a session object.")
            continue

        blocks = sess.get("blocks")
        if not isinstance(blocks, list) or not blocks:
            warnings.append(f"{where}: no blocks.")
            continue

        for block in blocks:
            if not isinstance(block, dict):
                continue
            for ex in block.get("exercises") or []:
                if not isinstance(ex, dict):
                    continue
                name = str(ex.get("name") or "unnamed exercise")
                blob = _texts(ex)

                # ── Safety: the loading ceiling ──
                if restricted:
                    for pattern, human in _MAXIMAL_PATTERNS:
                        if re.search(pattern, blob):
                            violations.append(
                                f"{where} — “{name}” prescribes {human}, which the "
                                f"{stage} loading ceiling forbids."
                            )
                            break
                if pre_phv:
                    for pattern, human in _HIGH_IMPACT_PATTERNS:
                        if re.search(pattern, blob):
                            violations.append(
                                f"{where} — “{name}” prescribes {human}, which is "
                                f"not appropriate pre-PHV."
                            )
                            break

                # ── Quality: is it actually prescribed? ──
                if not str(ex.get("prescription") or "").strip():
                    warnings.append(f"{where} — “{name}” has no prescription.")

                # ── Quality: does the block match its type? ──
                btype = str(block.get("type") or "").strip().lower()
                if btype in _NO_LOAD_TYPES:
                    loaded = _LOAD_HINT.search(str(ex.get("intensity") or ""))
                    if loaded:
                        warnings.append(
                            f"{where} — “{name}” is in a {btype} block but carries a load "
                            f"(“{ex.get('intensity')}”). Quality is the prescription there."
                        )
                    if btype == "technical" and not str(ex.get("good_rep") or "").strip():
                        warnings.append(
                            f"{where} — technical drill “{name}” does not say what a good rep "
                            f"looks like, which is the whole prescription."
                        )
                elif btype == "gym":
                    if not str(ex.get("intensity") or "").strip().strip("—-"):
                        warnings.append(f"{where} — gym exercise “{name}” has no load or RPE.")
                elif btype == "track":
                    # Two recoveries, and the difference between them is the
                    # session. One number is a different workout.
                    has_sets = re.search(r"\d+\s*[x×]\s*\d+\s*[x×]", str(ex.get("prescription") or ""))
                    if has_sets and not str(ex.get("rest_between_sets") or "").strip():
                        warnings.append(
                            f"{where} — “{name}” is prescribed in sets but gives only one "
                            f"recovery. Between reps and between sets are different numbers."
                        )

    # The week plan is the skeleton's, and the guidance must line up with it.
    plan = skeleton.get("week_plan") or []
    guidance = program.get("week_guidance")
    if plan and isinstance(guidance, list) and len(guidance) != len(plan):
        warnings.append(
            f"Week guidance covers {len(guidance)} of {len(plan)} weeks."
        )

    return violations, warnings


def align_week_guidance(
    program: dict[str, Any], skeleton: dict[str, Any]
) -> list[dict[str, Any]]:
    """One guidance entry per planned week, whatever the model returned.

    The app renders "you are in week 3 of 4" against this, so a short or
    misaligned list would silently show the wrong week's instruction — worse
    than showing none. The skeleton's phase and intent always win; the model
    only supplies the event-specific sentence, and where it did not supply one
    the deterministic intent stands on its own.
    """
    plan = skeleton.get("week_plan") or []
    raw = program.get("week_guidance")
    by_week: dict[int, str] = {}
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, dict):
                try:
                    w = int(item.get("week"))
                except (TypeError, ValueError):
                    continue
                text = str(item.get("adjustment") or "").strip()
                if text:
                    by_week[w] = text

    return [
        {
            "week": entry["week"],
            "phase": entry["phase"],
            "intent": entry["intent"],
            "adjustment": by_week.get(entry["week"], ""),
        }
        for entry in plan
    ]
