"""
Safeguarding for the athlete-facing assistant.

WHY THIS FILE EXISTS
--------------------
The assistant is an open text box. It is available to a thirteen-year-old,
and the app's age groups start at U13. Before this file, the entire codebase
contained no occurrence of "self-harm", "suicide", "crisis", "helpline" or
"moderation": the system prompt was careful about what the assistant should
not ADVISE — no weight-loss guidance for youth, never train through pain —
and completely silent on what it should DO when a child discloses something.

A young athlete who types that they have stopped eating, or that they want
to hurt themselves, was being answered by a coaching model. That model would
most likely have handled it decently, because it is a good model. "Most
likely" is not a safeguarding policy for children.

Two layers, because one is a hope:

  1. MODERATION (here)  — a deterministic check, before the coaching model
     ever sees the message, and again on what it says back.
  2. THE PROMPT (assistant_routes._SAFEGUARDING) — what the model does with
     everything moderation does not catch, which is most of it. Distress
     rarely arrives in language a classifier flags.

WHAT THIS IS NOT
----------------
This is not a crisis service and it does not pretend to be one. It stops the
app from coaching someone who needs a person, says so plainly and warmly,
and points at the adults in that young athlete's life. Anything more —
follow-up, escalation to a coach, a duty-of-care workflow — is a product and
policy decision, not a code one, and it should be made deliberately with
advice. See ESCALATION below.
"""
from __future__ import annotations

import logging
import os
from typing import Any

log = logging.getLogger(__name__)

# Categories that mean "stop coaching and respond as a person would".
# Deliberately narrow. A moderation flag is not a diagnosis and this must not
# fire on an athlete describing a hard session or a bad race.
_STOP_CATEGORIES = (
    "self-harm",
    "self-harm/intent",
    "self-harm/instructions",
    "sexual/minors",
    "violence/graphic",
)

# Said once, warmly, without clinical language, without probing, and without
# any technique that uses pain or discomfort as a coping strategy.
#
# No specific helpline number: this app has athletes in the UAE, the UK,
# Costa Rica and Nigeria, and a US number given to a child in Dubai is worse
# than no number. The offer to help find the right one is the honest version.
SAFE_REPLY = (
    "I'm glad you told me, and I don't want to answer that like a coaching question, "
    "because it isn't one.\n\n"
    "I'm a training tool. I'm not the right kind of help for this, and you deserve "
    "the right kind.\n\n"
    "Please tell someone today — a parent or carer, your coach, a teacher, or your "
    "doctor. Saying it out loud to one person is the whole first step, and it is "
    "allowed to be awkward. If you feel unsafe right now, contact your local "
    "emergency number.\n\n"
    "If it would help to know where to find support where you live, ask me and I'll "
    "point you in the right direction. Nothing about your training matters more "
    "than this does."
)


def _client() -> Any | None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        from openai import OpenAI
    except ImportError:
        return None
    return OpenAI(api_key=api_key)


def flagged_categories(text: str) -> list[str]:
    """Return the STOP categories this text trips, or [].

    FAILS OPEN, on purpose, and this is a real trade-off worth stating rather
    than burying. If the moderation call errors or times out, this returns []
    and the request proceeds to the model — which still carries the
    safeguarding prompt. The alternative, failing closed, takes the whole
    assistant offline whenever OpenAI has a wobble, and an assistant that is
    down is not a safer assistant; it is one nobody is using when the prompt
    layer would have done its job.

    The failure is logged at WARNING so it is visible rather than silent.
    """
    text = (text or "").strip()
    if not text:
        return []
    client = _client()
    if client is None:
        log.warning("moderation skipped: no OpenAI client")
        return []
    try:
        resp = client.moderations.create(
            model="omni-moderation-latest",
            input=text[:4000],
        )
        result = resp.results[0]
        cats = result.categories
        # The SDK exposes categories as an object with attribute names that
        # replace / and - with _, so read it as a dict where possible and fall
        # back to attribute access.
        as_dict = cats.model_dump() if hasattr(cats, "model_dump") else dict(cats)
        hits = []
        for name in _STOP_CATEGORIES:
            key = name.replace("/", "_").replace("-", "_")
            if as_dict.get(key) or as_dict.get(name):
                hits.append(name)
        return hits
    except Exception as e:  # noqa: BLE001
        log.warning("moderation call failed, proceeding to model: %s", e)
        return []


def check_athlete_message(text: str) -> list[str]:
    """Moderate something an ATHLETE typed, before the model sees it.

    Only the athlete path hard-stops. A coach writing "she's showing signs of
    RED-S and I'm worried about her eating" is doing their job, and a tool
    that refuses to discuss a safeguarding concern with the adult responsible
    for the child is obstructing the very thing it exists to support. Coach
    messages are moderated for the log, not for the gate — see
    assistant_routes.
    """
    return flagged_categories(text)


# ── ESCALATION ────────────────────────────────────────────────────────
# Nothing here notifies anyone. A flagged message is answered and logged
# WITHOUT its content — never log what a child wrote about wanting to hurt
# themselves into an application log that was not built to hold it.
#
# Whether a disclosure should reach that athlete's coach or their parent is
# a genuine safeguarding question with a real answer either way: telling an
# adult may be exactly right, and may also be the reason a young person never
# says anything to the app again. It needs a written policy, a consent
# position and probably advice. It is not a thing to quietly add.
def record_stop(role: str, categories: list[str]) -> None:
    log.warning(
        "assistant safeguarding stop: role=%s categories=%s (content not logged)",
        role, ",".join(categories) or "-",
    )
