"""Amazon Bedrock client — Nova Micro only (lowest cost)."""

import os
import re

import boto3

MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-micro-v1:0")
MAX_TOKENS = int(os.environ.get("BEDROCK_MAX_TOKENS", "500"))

_bedrock = None

RAVEN_SYSTEM = """You are Raven, a focused AI coach.
You ONLY advise from the user's provided context (goal, milestones, energy, history).
Never invent facts. Be concise, specific, and actionable."""

TRIGGER_PROMPTS = {
    "stuck": (
        "I'm stuck. Diagnose what's blocking me from the data and give "
        "the smallest concrete next step I can do in under 30 minutes."
    ),
    "ahead": (
        "I'm ahead of plan. Should I push the next milestone or consolidate? "
        "Give a specific recommendation."
    ),
    "reprioritize": (
        "Review my open milestones and energy. What should I drop, defer, or double down on?"
    ),
    "refresh": "Refresh my recommendation for today based on current context.",
}

RECOMMEND_FORMAT = """
Respond in EXACTLY this format (no extra sections):

ACTIONS:
- [ONE primary focus for the next 30–90 minutes — verb-first, specific, tied to an open milestone]

MORE:
- [optional second action only if truly needed; omit this section if one action is enough]

WHY:
[One short sentence — why this fits today given energy, schedule, and open milestones]

Rules:
- The first ACTIONS line is the only thing the user should do right now. Make it scannable in under 5 seconds.
- If all milestones are complete, recommend one concrete next-phase action (not a vague new certification).
- Energy: low = smallest step, ok = normal, high = stretch. None logged = assume ok.
"""


def get_client():
    global _bedrock
    if _bedrock is None:
        _bedrock = boto3.client("bedrock-runtime")
    return _bedrock


def parse_recommendation(text: str) -> dict:
    actions: list[str] = []
    why = ""
    if not text:
        return {"actions": actions, "why": why, "raw": text}

    why_match = re.split(r"\nWHY:\s*\n?", text, maxsplit=1, flags=re.IGNORECASE)
    body = why_match[0]
    if len(why_match) > 1:
        why = why_match[1].strip()

    action_block = re.split(r"ACTIONS:\s*\n?", body, maxsplit=1, flags=re.IGNORECASE)
    action_lines = action_block[1] if len(action_block) > 1 else body

    more_split = re.split(r"\nMORE:\s*\n?", action_lines, maxsplit=1, flags=re.IGNORECASE)
    primary_lines = more_split[0]
    if len(more_split) > 1:
        action_lines = more_split[1]
    else:
        action_lines = ""

    for line in primary_lines.splitlines():
        line = line.strip()
        if line.startswith("- "):
            actions.append(line[2:].strip())
        elif line.startswith("• "):
            actions.append(line[2:].strip())

    for line in action_lines.splitlines():
        line = line.strip()
        if line.startswith("- "):
            actions.append(line[2:].strip())
        elif line.startswith("• "):
            actions.append(line[2:].strip())

    if not actions and not why:
        why = text.strip()

    return {"actions": actions, "why": why, "raw": text}


def converse(user_message: str, context: str = "", mode: str = "chat") -> str:
    client = get_client()

    if mode == "recommend":
        system = RAVEN_SYSTEM + RECOMMEND_FORMAT
    elif mode == "analyze":
        system = (
            RAVEN_SYSTEM
            + "\n\nBrief progress analysis: what's working, gaps, 2-3 actions for today."
        )
    else:
        system = RAVEN_SYSTEM + "\n\nAnswer in 2-4 sentences. Be specific to their goal and milestones."

    user_content = user_message
    if context:
        user_content = f"User data:\n{context}\n\nUser message: {user_message}"

    response = client.converse(
        modelId=MODEL_ID,
        system=[{"text": system}],
        messages=[{"role": "user", "content": [{"text": user_content}]}],
        inferenceConfig={"maxTokens": MAX_TOKENS, "temperature": 0.65},
    )

    output = response.get("output", {})
    message = output.get("message", {})
    content = message.get("content", [])
    if content and "text" in content[0]:
        return content[0]["text"].strip()
    return "I could not generate a response. Please try again."


def generate_recommendation(context: str, trigger: str = "") -> dict:
    prompt = TRIGGER_PROMPTS.get(trigger, "What should I focus on today?")
    raw = converse(prompt, context=context, mode="recommend")
    parsed = parse_recommendation(raw)
    parsed["raw"] = raw
    return parsed
