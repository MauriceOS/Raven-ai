"""
Raven — AWS Lambda handler (Function URL).
"""

import json
from datetime import datetime
from urllib.parse import parse_qs

from bedrock_client import TRIGGER_PROMPTS, converse, generate_recommendation
from demo_example import DEMO_EXAMPLE
from db import (
    append_chat_turn,
    claim_demo_goal,
    complete_setup,
    context_for_ai,
    create_event,
    create_goal,
    delete_event,
    is_setup_complete,
    mark_focus_done,
    plan_payload,
    progress_payload,
    save_energy,
    save_recommendation,
    setup_status,
    switch_goal,
    today_payload,
    toggle_milestone,
    goals_list_payload,
)

RESPONSE_HEADERS = {"Content-Type": "application/json"}


def _response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": RESPONSE_HEADERS,
        "body": json.dumps(body),
    }


def _parse_body(event) -> dict:
    raw = event.get("body") or "{}"
    if isinstance(raw, str):
        try:
            return json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            return {}
    return raw if isinstance(raw, dict) else {}


def _query(event) -> dict:
    raw = event.get("rawQueryString") or ""
    if raw:
        return {k: v[0] if len(v) == 1 else v for k, v in parse_qs(raw).items()}
    params = event.get("queryStringParameters") or {}
    return params


def _route(event) -> tuple[str, str]:
    method = (
        event.get("requestContext", {}).get("http", {}).get("method")
        or event.get("httpMethod")
        or "GET"
    )
    path = event.get("rawPath") or event.get("path") or "/"
    path = path.rstrip("/") or "/"
    return method.upper(), path


def _ensure_recommendation(trigger: str = "", date=None) -> dict:
    ctx = context_for_ai(date)
    rec = generate_recommendation(ctx, trigger=trigger or "refresh")
    save_recommendation(rec, date)
    return rec


def handler(event, context):
    method, path = _route(event)
    qs = _query(event)

    try:
        if method == "GET" and path in ("/", "/health"):
            return _response(
                200,
                {"service": "Raven", "version": "2.2.0", "status": "ok"},
            )

        if method == "GET" and path == "/setup-status":
            return _response(200, {"success": True, "data": setup_status()})

        if method == "GET" and path == "/demo-example":
            return _response(200, {"success": True, "data": DEMO_EXAMPLE})

        if method == "GET" and path == "/goals":
            return _response(200, {"success": True, "data": goals_list_payload()})

        if method == "GET" and path == "/today":
            date = (qs.get("date") or "").strip() or None
            data = today_payload(date)
            # Only auto-generate for today when missing
            if (
                data.get("setup_complete")
                and data.get("is_today")
                and not data.get("recommendation")
            ):
                rec = _ensure_recommendation(date=data["date"])
                data["recommendation"] = rec
            return _response(200, {"success": True, "data": data})

        if method == "GET" and path == "/progress":
            return _response(200, {"success": True, "data": progress_payload()})

        if method == "GET" and path == "/plan":
            return _response(200, {"success": True, "data": plan_payload()})

        if method == "POST" and path == "/setup":
            body = _parse_body(event)
            north_star = (body.get("north_star") or "").strip()
            if not north_star:
                return _response(
                    400,
                    {"success": False, "error": "north_star (your main goal) is required"},
                )
            milestones = body.get("milestones") or []
            if isinstance(milestones, str):
                milestones = [m.strip() for m in milestones.split("\n") if m.strip()]
            if len([m for m in milestones if (m or "").strip()]) < 1:
                return _response(
                    400,
                    {"success": False, "error": "Add at least one milestone"},
                )
            body["milestones"] = milestones
            data = complete_setup(body)
            rec = _ensure_recommendation()
            return _response(
                200,
                {
                    "success": True,
                    "message": "Setup complete",
                    "data": {**data, "recommendation": rec},
                },
            )

        if method == "POST" and path == "/goal":
            if not is_setup_complete():
                return _response(403, {"success": False, "error": "Complete setup first"})
            body = _parse_body(event)
            north_star = (body.get("north_star") or "").strip()
            if not north_star:
                return _response(400, {"success": False, "error": "north_star required"})
            milestones = body.get("milestones") or []
            if isinstance(milestones, str):
                milestones = [m.strip() for m in milestones.split("\n") if m.strip()]
            body["milestones"] = milestones
            goal = create_goal(body, set_active=True)
            rec = _ensure_recommendation()
            return _response(
                200,
                {
                    "success": True,
                    "message": "Goal created",
                    "data": {"goal": goal, "recommendation": rec},
                },
            )

        if method == "POST" and path == "/goal/switch":
            body = _parse_body(event)
            goal_id = (body.get("goal_id") or "").strip()
            if not goal_id:
                return _response(400, {"success": False, "error": "goal_id required"})
            goal = switch_goal(goal_id)
            rec = _ensure_recommendation()
            return _response(
                200,
                {
                    "success": True,
                    "message": "Goal switched",
                    "data": {"goal": goal, "recommendation": rec},
                },
            )

        if method == "POST" and path == "/goal/claim-demo":
            if not is_setup_complete():
                return _response(403, {"success": False, "error": "Complete setup first"})
            goal = claim_demo_goal()
            return _response(
                200,
                {"success": True, "message": "Demo plan is now yours", "data": {"goal": goal}},
            )

        if method == "POST" and path == "/check-in":
            if not is_setup_complete():
                return _response(
                    403,
                    {"success": False, "error": "Complete setup first", "code": "SETUP_REQUIRED"},
                )
            body = _parse_body(event)
            energy = (body.get("energy") or "").strip().lower()
            if energy not in ("low", "ok", "high"):
                return _response(
                    400,
                    {"success": False, "error": "energy must be low, ok, or high"},
                )
            date = (body.get("date") or datetime.utcnow().date().isoformat()).strip()
            entry = save_energy(energy, date)
            rec = _ensure_recommendation(date=date)
            return _response(
                200,
                {
                    "success": True,
                    "message": f"Energy logged: {energy}",
                    "data": {"energy": entry, "recommendation": rec},
                },
            )

        if method == "POST" and path == "/recommendation":
            if not is_setup_complete():
                return _response(
                    403,
                    {"success": False, "error": "Complete setup first", "code": "SETUP_REQUIRED"},
                )
            body = _parse_body(event)
            trigger = (body.get("trigger") or "refresh").strip()
            if trigger not in TRIGGER_PROMPTS:
                return _response(
                    400,
                    {"success": False, "error": f"Unknown trigger: {trigger}"},
                )
            date = (body.get("date") or datetime.utcnow().date().isoformat()).strip()
            rec = _ensure_recommendation(trigger=trigger, date=date)
            return _response(
                200,
                {"success": True, "message": "Recommendation updated", "data": rec},
            )

        if method == "POST" and path == "/event":
            if not is_setup_complete():
                return _response(403, {"success": False, "error": "Complete setup first"})
            body = _parse_body(event)
            item = create_event(body)
            # Refresh today's rec if event is for today
            today = datetime.utcnow().date().isoformat()
            rec = None
            if item.get("date") == today:
                rec = _ensure_recommendation(date=today)
            return _response(
                200,
                {
                    "success": True,
                    "message": "Event added",
                    "data": {"event": item, "recommendation": rec},
                },
            )

        if method == "POST" and path == "/event/delete":
            if not is_setup_complete():
                return _response(403, {"success": False, "error": "Complete setup first"})
            body = _parse_body(event)
            eid = (body.get("event_id") or "").strip()
            date = (body.get("date") or "").strip()
            if not eid or not date:
                return _response(400, {"success": False, "error": "event_id and date required"})
            delete_event(eid, date)
            today = datetime.utcnow().date().isoformat()
            rec = _ensure_recommendation(date=today) if date == today else None
            return _response(
                200,
                {"success": True, "message": "Event deleted", "data": {"recommendation": rec}},
            )

        if method == "POST" and path == "/vision/milestone/toggle":
            if not is_setup_complete():
                return _response(403, {"success": False, "error": "Complete setup first"})
            body = _parse_body(event)
            mid = body.get("id")
            if not mid:
                return _response(400, {"success": False, "error": "id required"})
            goal = toggle_milestone(mid, bool(body.get("completed", True)))
            rec = _ensure_recommendation()
            return _response(
                200,
                {
                    "success": True,
                    "message": "Milestone updated",
                    "data": {"goal": goal, "recommendation": rec},
                },
            )

        if method == "POST" and path == "/focus/done":
            if not is_setup_complete():
                return _response(403, {"success": False, "error": "Complete setup first"})
            body = _parse_body(event)
            today = datetime.utcnow().date().isoformat()
            date = (body.get("date") or today).strip()
            if date != today:
                return _response(
                    403,
                    {"success": False, "error": "Focus can only be marked done on today."},
                )
            result = mark_focus_done(date)
            rec = _ensure_recommendation(trigger="ahead", date=date)
            payload = today_payload(date)
            payload["recommendation"] = rec
            return _response(
                200,
                {
                    "success": True,
                    "message": "Focus marked done",
                    "data": {**result, "recommendation": rec, "today": payload},
                },
            )

        if method == "POST" and path == "/chat":
            if not is_setup_complete():
                return _response(
                    403,
                    {
                        "success": False,
                        "error": "Complete setup first.",
                        "code": "SETUP_REQUIRED",
                    },
                )
            body = _parse_body(event)
            message = (body.get("message") or "").strip()
            if not message:
                return _response(400, {"success": False, "error": "message required"})
            date = (body.get("date") or datetime.utcnow().date().isoformat()).strip()
            ctx = context_for_ai(date)
            reply = converse(message, context=ctx, mode="chat")
            append_chat_turn(message, reply)
            return _response(
                200,
                {"success": True, "message": reply, "data": {"response": reply}},
            )

        return _response(404, {"success": False, "error": f"Not found: {method} {path}"})

    except Exception as exc:
        return _response(500, {"success": False, "error": str(exc)})
