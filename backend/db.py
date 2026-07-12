"""DynamoDB helpers for Raven (single-table)."""

import os
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Optional
from uuid import uuid4

import boto3
from boto3.dynamodb.conditions import Key

TABLE_NAME = os.environ.get("TABLE_NAME", "raven-lite")
USER_ID = os.environ.get("USER_ID", "default")
MAX_CHAT_TURNS = 5
VALID_ENERGY = {"low", "ok", "high"}
VALID_EVENT_TYPES = {"meeting", "reminder", "study_block", "deadline"}

_dynamodb = boto3.resource("dynamodb")
_table = None


def get_table():
    global _table
    if _table is None:
        _table = _dynamodb.Table(TABLE_NAME)
    return _table


def _to_json(value: Any) -> Any:
    if isinstance(value, Decimal):
        if value % 1 == 0:
            return int(value)
        return float(value)
    if isinstance(value, list):
        return [_to_json(v) for v in value]
    if isinstance(value, dict):
        return {k: _to_json(v) for k, v in value.items()}
    return value


def pk() -> str:
    return f"USER#{USER_ID}"


def get_profile() -> Optional[dict]:
    resp = get_table().get_item(Key={"pk": pk(), "sk": "PROFILE"})
    item = resp.get("Item")
    return _to_json(item) if item else None


def is_setup_complete() -> bool:
    profile = get_profile()
    return bool(profile and profile.get("setup_complete"))


def _goal_sk(goal_id: str) -> str:
    return f"GOAL#{goal_id}"


def get_goal(goal_id: str) -> Optional[dict]:
    resp = get_table().get_item(Key={"pk": pk(), "sk": _goal_sk(goal_id)})
    item = resp.get("Item")
    return _to_json(item) if item else None


def list_goals() -> list[dict]:
    resp = get_table().query(
        KeyConditionExpression=Key("pk").eq(pk()) & Key("sk").begins_with("GOAL#")
    )
    goals = [_to_json(i) for i in resp.get("Items", [])]
    goals.sort(key=lambda g: g.get("created_at", ""), reverse=True)
    return goals


def _migrate_legacy_vision() -> Optional[dict]:
    """One-time: convert legacy VISION item to GOAL#default."""
    resp = get_table().get_item(Key={"pk": pk(), "sk": "VISION"})
    vision = resp.get("Item")
    if not vision:
        return None

    profile = get_profile() or {}
    goal_id = "default"
    goal = {
        "pk": pk(),
        "sk": _goal_sk(goal_id),
        "goal_id": goal_id,
        "name": vision.get("name", "My goal"),
        "north_star": profile.get("north_star") or vision.get("description", ""),
        "current_challenge": profile.get("current_challenge", ""),
        "milestones": vision.get("milestones", []),
        "created_at": vision.get("updated_at", datetime.utcnow().isoformat()),
        "updated_at": datetime.utcnow().isoformat(),
    }
    get_table().put_item(Item=goal)

    profile_item = {
        **profile,
        "pk": pk(),
        "sk": "PROFILE",
        "active_goal_id": goal_id,
        "setup_complete": profile.get("setup_complete", True),
        "updated_at": datetime.utcnow().isoformat(),
    }
    get_table().put_item(Item=profile_item)
    return _to_json(goal)


def get_active_goal() -> Optional[dict]:
    profile = get_profile()
    if profile and profile.get("active_goal_id"):
        goal = get_goal(profile["active_goal_id"])
        if goal:
            return goal

    goals = list_goals()
    if goals:
        if profile:
            get_table().put_item(
                Item={
                    **profile,
                    "pk": pk(),
                    "sk": "PROFILE",
                    "active_goal_id": goals[0]["goal_id"],
                    "updated_at": datetime.utcnow().isoformat(),
                }
            )
        return goals[0]

    return _migrate_legacy_vision()


def goal_summary(goal: dict) -> dict:
    milestones = goal.get("milestones", [])
    completed = sum(1 for m in milestones if m.get("completed"))
    total = len(milestones) or 1
    pct = round((completed / total) * 100)
    return {
        "goal_id": goal.get("goal_id"),
        "name": goal.get("name", "Goal"),
        "north_star": goal.get("north_star", ""),
        "current_challenge": goal.get("current_challenge", ""),
        "demo_mode": bool(goal.get("demo_mode")),
        "progress": pct,
        "milestones_count": len(milestones),
        "completed_count": completed,
        "milestones": milestones,
    }


def save_goal(goal: dict) -> dict:
    goal = {
        **goal,
        "pk": pk(),
        "sk": _goal_sk(goal["goal_id"]),
        "updated_at": datetime.utcnow().isoformat(),
    }
    get_table().put_item(Item=goal)
    return _to_json(goal)


def create_goal(payload: dict, set_active: bool = True) -> dict:
    goal_id = str(uuid4())[:8]
    milestones = []
    for title in payload.get("milestones", []):
        title = (title or "").strip()
        if title:
            milestones.append(
                {
                    "id": str(uuid4())[:8],
                    "title": title,
                    "description": "",
                    "completed": False,
                }
            )

    now = datetime.utcnow().isoformat()
    goal = {
        "goal_id": goal_id,
        "name": (payload.get("name") or payload.get("vision_name") or "My goal").strip(),
        "north_star": (payload.get("north_star") or "").strip(),
        "current_challenge": (payload.get("current_challenge") or "").strip(),
        "milestones": milestones,
        "demo_mode": bool(payload.get("demo_mode")),
        "created_at": now,
        "updated_at": now,
    }
    save_goal({**goal, "pk": pk(), "sk": _goal_sk(goal_id)})

    if set_active:
        profile = get_profile() or {}
        get_table().put_item(
            Item={
                **profile,
                "pk": pk(),
                "sk": "PROFILE",
                "active_goal_id": goal_id,
                "setup_complete": True,
                "updated_at": now,
            }
        )
    return goal_summary(_to_json(goal))


def switch_goal(goal_id: str) -> dict:
    goal = get_goal(goal_id)
    if not goal:
        raise ValueError(f"Goal not found: {goal_id}")
    profile = get_profile() or {}
    get_table().put_item(
        Item={
            **profile,
            "pk": pk(),
            "sk": "PROFILE",
            "active_goal_id": goal_id,
            "updated_at": datetime.utcnow().isoformat(),
        }
    )
    return goal_summary(goal)


def complete_setup(payload: dict) -> dict:
    now = datetime.utcnow().isoformat()
    profile = get_profile()

    profile_item = {
        "pk": pk(),
        "sk": "PROFILE",
        "name": (payload.get("name") or "User").strip(),
        "role": (payload.get("role") or "").strip(),
        "setup_complete": True,
        "created_at": profile.get("created_at", now) if profile else now,
        "updated_at": now,
    }

    if profile and profile.get("active_goal_id"):
        goal = get_goal(profile["active_goal_id"])
        if goal:
            milestones = []
            for title in payload.get("milestones", []):
                title = (title or "").strip()
                if title:
                    milestones.append(
                        {
                            "id": str(uuid4())[:8],
                            "title": title,
                            "description": "",
                            "completed": False,
                        }
                    )
            goal.update(
                {
                    "name": (payload.get("name") or payload.get("vision_name") or goal.get("name", "My goal")).strip(),
                    "north_star": (payload.get("north_star") or "").strip(),
                    "current_challenge": (payload.get("current_challenge") or "").strip(),
                    "milestones": milestones or goal.get("milestones", []),
                    "demo_mode": bool(payload.get("demo_mode", goal.get("demo_mode"))),
                }
            )
            save_goal({**goal, "pk": pk(), "sk": _goal_sk(goal["goal_id"])})
            profile_item["active_goal_id"] = goal["goal_id"]
            get_table().put_item(Item=profile_item)
            return {"profile": _to_json(profile_item), "goal": goal_summary(goal)}

    get_table().put_item(Item=profile_item)
    goal = create_goal(payload, set_active=True)
    profile_item["active_goal_id"] = goal["goal_id"]
    get_table().put_item(Item={**profile_item, "active_goal_id": goal["goal_id"]})
    return {"profile": _to_json(profile_item), "goal": goal}


def setup_status() -> dict:
    profile = get_profile()
    goal = get_active_goal()
    complete = is_setup_complete()
    return {
        "complete": complete,
        "profile": profile,
        "has_goal": goal is not None,
        "active_goal_id": profile.get("active_goal_id") if profile else None,
        "message": (
            "Ready — Raven has your context."
            if complete
            else "Complete setup so Raven knows your goal."
        ),
    }


def toggle_milestone(milestone_id: str, completed: bool) -> dict:
    goal = get_active_goal()
    if not goal:
        raise ValueError("No active goal")
    now = datetime.utcnow().isoformat()
    milestones = []
    for m in goal.get("milestones", []):
        if m.get("id") == milestone_id:
            m = {**m, "completed": completed}
            if completed:
                m["completed_at"] = now
            else:
                m.pop("completed_at", None)
        milestones.append(m)
    goal["milestones"] = milestones
    save_goal({**goal, "pk": pk(), "sk": _goal_sk(goal["goal_id"])})
    return goal_summary(goal)


def claim_demo_goal() -> dict:
    """Mark the active demo goal as the user's own plan."""
    goal = get_active_goal()
    if not goal:
        raise ValueError("No active goal")
    goal["demo_mode"] = False
    save_goal({**goal, "pk": pk(), "sk": _goal_sk(goal["goal_id"])})
    return goal_summary(goal)


def create_event(payload: dict) -> dict:
    title = (payload.get("title") or "").strip()
    if not title:
        raise ValueError("title required")
    date = (payload.get("date") or datetime.utcnow().date().isoformat()).strip()
    event_type = (payload.get("type") or "reminder").strip().lower()
    if event_type not in VALID_EVENT_TYPES:
        raise ValueError(f"type must be one of: {', '.join(sorted(VALID_EVENT_TYPES))}")
    event_id = str(uuid4())[:8]
    item = {
        "pk": pk(),
        "sk": f"EVENT#{date}#{event_id}",
        "event_id": event_id,
        "title": title,
        "date": date,
        "time": (payload.get("time") or "").strip(),
        "type": event_type,
        "notes": (payload.get("notes") or "").strip(),
        "created_at": datetime.utcnow().isoformat(),
    }
    get_table().put_item(Item=item)
    return _to_json(item)


def delete_event(event_id: str, date: str) -> None:
    get_table().delete_item(Key={"pk": pk(), "sk": f"EVENT#{date}#{event_id}"})


def list_events(from_date: str, to_date: str) -> list[dict]:
    resp = get_table().query(
        KeyConditionExpression=Key("pk").eq(pk()) & Key("sk").begins_with("EVENT#")
    )
    items = [_to_json(i) for i in resp.get("Items", [])]
    filtered = [e for e in items if from_date <= e.get("date", "") <= to_date]
    filtered.sort(key=lambda e: (e.get("date", ""), e.get("time") or "99:99", e.get("title", "")))
    return filtered


def events_for_date(date: str) -> list[dict]:
    return list_events(date, date)


def save_energy(level: str, date: Optional[str] = None) -> dict:
    level = level.lower().strip()
    if level not in VALID_ENERGY:
        raise ValueError("energy must be low, ok, or high")
    date = date or datetime.utcnow().date().isoformat()
    item = {
        "pk": pk(),
        "sk": f"ENERGY#{date}",
        "date": date,
        "level": level,
        "updated_at": datetime.utcnow().isoformat(),
    }
    get_table().put_item(Item=item)
    return _to_json(item)


def get_today_energy(date: Optional[str] = None) -> Optional[str]:
    date = date or datetime.utcnow().date().isoformat()
    resp = get_table().get_item(Key={"pk": pk(), "sk": f"ENERGY#{date}"})
    item = resp.get("Item")
    return item.get("level") if item else None


def get_energy_entries(days: int = 7) -> list[dict]:
    resp = get_table().query(
        KeyConditionExpression=Key("pk").eq(pk()) & Key("sk").begins_with("ENERGY#")
    )
    items = [_to_json(i) for i in resp.get("Items", [])]
    items.sort(key=lambda x: x.get("date", ""), reverse=True)
    return items[:days]


def energy_stats() -> dict:
    entries = get_energy_entries(14)
    today = datetime.utcnow().date().isoformat()
    today_entry = next((e for e in entries if e.get("date") == today), None)

    streak = 0
    cursor = datetime.utcnow().date()
    dates = {e.get("date") for e in entries}
    while cursor.isoformat() in dates:
        streak += 1
        cursor -= timedelta(days=1)

    return {
        "today": today_entry.get("level") if today_entry else None,
        "streak": streak,
        "entries": entries,
    }


def get_recommendation(date: Optional[str] = None) -> Optional[dict]:
    date = date or datetime.utcnow().date().isoformat()
    resp = get_table().get_item(Key={"pk": pk(), "sk": f"REC#{date}"})
    item = resp.get("Item")
    if not item:
        return None
    return {
        "actions": item.get("actions", []),
        "why": item.get("why", ""),
        "raw": item.get("raw", ""),
        "updated_at": item.get("updated_at"),
    }


def get_focus_done(date: Optional[str] = None) -> Optional[dict]:
    date = date or datetime.utcnow().date().isoformat()
    resp = get_table().get_item(Key={"pk": pk(), "sk": f"FOCUS#{date}"})
    item = resp.get("Item")
    if not item:
        return None
    return {
        "text": item.get("text", ""),
        "completed_at": item.get("completed_at"),
        "milestone_id": item.get("milestone_id"),
        "milestone_title": item.get("milestone_title"),
    }


def _match_milestone_for_focus(focus_text: str, milestones: list) -> Optional[dict]:
    focus = focus_text.lower()
    open_ms = [m for m in milestones if not m.get("completed")]
    best = None
    best_score = 0
    for m in open_ms:
        title = (m.get("title") or "").lower()
        if not title:
            continue
        if title in focus or focus in title:
            return m
        title_words = {w for w in title.split() if len(w) > 3}
        focus_words = {w for w in focus.split() if len(w) > 3}
        score = len(title_words & focus_words)
        if score > best_score:
            best_score = score
            best = m
    if best_score >= 2:
        return best
    return None


def mark_focus_done(date: Optional[str] = None) -> dict:
    date = date or datetime.utcnow().date().isoformat()
    if get_focus_done(date):
        return {"focus_done": get_focus_done(date), "goal": None, "milestone_matched": False}

    rec = get_recommendation(date)
    focus_text = ""
    if rec and rec.get("actions"):
        focus_text = rec["actions"][0]

    milestone_id = None
    milestone_title = None
    goal_summary_after = None
    goal = get_active_goal()

    if goal and focus_text:
        match = _match_milestone_for_focus(focus_text, goal.get("milestones", []))
        if match:
            milestone_id = match.get("id")
            milestone_title = match.get("title")
            goal_summary_after = toggle_milestone(milestone_id, True)

    now = datetime.utcnow().isoformat()
    item = {
        "pk": pk(),
        "sk": f"FOCUS#{date}",
        "date": date,
        "text": focus_text,
        "completed_at": now,
        "milestone_id": milestone_id,
        "milestone_title": milestone_title,
    }
    get_table().put_item(Item=item)
    focus_done = {
        "text": focus_text,
        "completed_at": now,
        "milestone_id": milestone_id,
        "milestone_title": milestone_title,
    }
    return {
        "focus_done": focus_done,
        "goal": goal_summary_after,
        "milestone_matched": milestone_id is not None,
    }


def list_focus_completions(days: int = 30) -> list[dict]:
    resp = get_table().query(
        KeyConditionExpression=Key("pk").eq(pk()) & Key("sk").begins_with("FOCUS#")
    )
    items = [_to_json(i) for i in resp.get("Items", [])]
    items.sort(key=lambda i: i.get("date", ""), reverse=True)
    out = []
    for item in items[:days]:
        out.append(
            {
                "date": item.get("date"),
                "text": item.get("text", ""),
                "completed_at": item.get("completed_at"),
                "milestone_title": item.get("milestone_title"),
            }
        )
    return out


def save_recommendation(rec: dict, date: Optional[str] = None) -> dict:
    date = date or datetime.utcnow().date().isoformat()
    item = {
        "pk": pk(),
        "sk": f"REC#{date}",
        "date": date,
        "actions": rec.get("actions", []),
        "why": rec.get("why", ""),
        "raw": rec.get("raw", ""),
        "updated_at": datetime.utcnow().isoformat(),
    }
    get_table().put_item(Item=item)
    return _to_json(item)


def get_chat_history() -> list[dict]:
    resp = get_table().get_item(Key={"pk": pk(), "sk": "CHAT_HISTORY"})
    item = resp.get("Item")
    if not item:
        return []
    return _to_json(item).get("messages", [])


def append_chat_turn(user_message: str, assistant_response: str) -> None:
    messages = get_chat_history()
    messages.append(
        {
            "user": user_message,
            "assistant": assistant_response,
            "timestamp": datetime.utcnow().isoformat(),
        }
    )
    messages = messages[-MAX_CHAT_TURNS:]
    get_table().put_item(
        Item={
            "pk": pk(),
            "sk": "CHAT_HISTORY",
            "messages": messages,
            "updated_at": datetime.utcnow().isoformat(),
        }
    )


def context_for_ai(date: Optional[str] = None) -> str:
    date = date or datetime.utcnow().date().isoformat()
    profile = get_profile()
    goal = get_active_goal()
    energy = get_today_energy(date)
    energy_info = energy_stats()
    history = get_chat_history()
    events = events_for_date(date)
    lines = []

    if profile:
        lines.append(f"User: {profile.get('name', 'User')}")
        if profile.get("role"):
            lines.append(f"Role: {profile['role']}")

    lines.append(f"Advice date: {date}")

    if goal:
        summary = goal_summary(goal)
        if summary.get("demo_mode"):
            lines.append("Note: this is an EXAMPLE demo plan — still give useful advice.")
        lines.append(f"Active goal: {summary['name']}")
        lines.append(f"North star: {summary['north_star']}")
        if summary.get("current_challenge"):
            lines.append(f"Current challenge: {summary['current_challenge']}")
        lines.append(
            f"Progress: {summary['completed_count']}/{summary['milestones_count']} milestones "
            f"({summary['progress']}%)"
        )
        open_ms = [m for m in summary["milestones"] if not m.get("completed")]
        done_ms = [m for m in summary["milestones"] if m.get("completed")]
        if open_ms:
            lines.append("Open milestones:")
            for m in open_ms[:8]:
                lines.append(f"  - {m.get('title')}")
        if done_ms:
            lines.append("Completed milestones:")
            for m in done_ms[:5]:
                when = m.get("completed_at", "")[:10]
                lines.append(f"  - {m.get('title')}" + (f" (done {when})" if when else ""))
        if not open_ms and summary["milestones_count"] > 0:
            lines.append("All milestones complete — suggest next-phase milestones.")
    else:
        lines.append("Goal: not configured")

    lines.append(f"Energy for this day: {energy or 'not logged yet'}")
    lines.append(f"Check-in streak: {energy_info.get('streak', 0)} days")

    if events:
        lines.append("Schedule for this day (factor into recommendations — protect meeting times):")
        for e in events:
            t = e.get("time") or "anytime"
            lines.append(f"  - {t} [{e.get('type')}] {e.get('title')}")
            if e.get("notes"):
                lines.append(f"    note: {e['notes'][:80]}")
    else:
        lines.append("Schedule for this day: empty")

    focus_done = get_focus_done(date)
    if focus_done:
        lines.append(f"Today's focus marked done: {focus_done.get('text', '')[:120]}")
        if focus_done.get("milestone_title"):
            lines.append(f"Linked milestone completed: {focus_done['milestone_title']}")

    upcoming = list_events(date, (datetime.fromisoformat(date).date() + timedelta(days=3)).isoformat())
    upcoming = [e for e in upcoming if e.get("date") != date][:5]
    if upcoming:
        lines.append("Upcoming (next 3 days):")
        for e in upcoming:
            lines.append(f"  - {e.get('date')} {e.get('time') or ''} [{e.get('type')}] {e.get('title')}")

    if history:
        lines.append("Recent questions:")
        for turn in history[-2:]:
            lines.append(f"  Q: {turn.get('user', '')[:100]}")
            lines.append(f"  A: {turn.get('assistant', '')[:100]}")

    return "\n".join(lines)


def goals_list_payload() -> list[dict]:
    profile = get_profile()
    active = profile.get("active_goal_id") if profile else None
    result = []
    for g in list_goals():
        s = goal_summary(g)
        result.append(
            {
                "goal_id": s["goal_id"],
                "name": s["name"],
                "north_star": s["north_star"],
                "progress": s["progress"],
                "demo_mode": s["demo_mode"],
                "is_active": s["goal_id"] == active,
            }
        )
    return result


def today_payload(date: Optional[str] = None) -> dict:
    today = datetime.utcnow().date().isoformat()
    date = date or today
    profile = get_profile()
    goal = get_active_goal()
    energy_info = energy_stats()
    is_today = date == today

    if not goal or not is_setup_complete():
        return {
            "setup_complete": False,
            "date": date,
            "is_today": is_today,
            "profile": profile,
            "goal": None,
            "milestones": [],
            "events": [],
            "energy": None,
            "energy_streak": 0,
            "recommendation": None,
            "goals": goals_list_payload(),
        }

    summary = goal_summary(goal)
    rec = get_recommendation(date)
    day_energy = get_today_energy(date)

    return {
        "setup_complete": True,
        "date": date,
        "is_today": is_today,
        "profile": profile,
        "goal": {
            "goal_id": summary["goal_id"],
            "name": summary["name"],
            "north_star": summary["north_star"],
            "progress": summary["progress"],
            "milestones_count": summary["milestones_count"],
            "completed_count": summary["completed_count"],
            "demo_mode": summary["demo_mode"],
        },
        "milestones": summary["milestones"],
        "events": events_for_date(date),
        "energy": day_energy,
        "energy_streak": energy_info.get("streak", 0),
        "recommendation": rec,
        "focus_done": get_focus_done(date),
        "goals": goals_list_payload(),
    }


def progress_payload() -> dict:
    goal = get_active_goal()
    energy = get_energy_entries(14)
    if not goal:
        return {"setup_complete": is_setup_complete(), "completions": [], "focus_completions": [], "energy_history": energy, "streak": 0}

    summary = goal_summary(goal)
    completions = []
    for m in summary["milestones"]:
        if m.get("completed"):
            completions.append(
                {
                    "id": m.get("id"),
                    "title": m.get("title"),
                    "completed_at": m.get("completed_at"),
                }
            )
    completions.sort(key=lambda c: c.get("completed_at") or "", reverse=True)

    # Daily recommendation history (last 14 days)
    today = datetime.utcnow().date()
    rec_history = []
    for i in range(14):
        d = (today - timedelta(days=i)).isoformat()
        rec = get_recommendation(d)
        if rec:
            rec_history.append({"date": d, "actions": rec.get("actions", []), "why": rec.get("why", "")})

    return {
        "setup_complete": True,
        "goal": {
            "name": summary["name"],
            "north_star": summary["north_star"],
            "progress": summary["progress"],
            "completed_count": summary["completed_count"],
            "milestones_count": summary["milestones_count"],
            "demo_mode": summary["demo_mode"],
        },
        "completions": completions,
        "focus_completions": list_focus_completions(30),
        "open_milestones": [m for m in summary["milestones"] if not m.get("completed")],
        "energy_history": energy,
        "streak": energy_stats().get("streak", 0),
        "recommendation_history": rec_history,
    }


def plan_payload(days: int = 7) -> dict:
    today = datetime.utcnow().date()
    end = today + timedelta(days=days)
    events = list_events(today.isoformat(), end.isoformat())
    by_date: dict[str, list] = {}
    for e in events:
        by_date.setdefault(e["date"], []).append(e)

    days_out = []
    for i in range(days + 1):
        d = (today + timedelta(days=i)).isoformat()
        days_out.append(
            {
                "date": d,
                "label": "Today" if i == 0 else "Tomorrow" if i == 1 else d,
                "events": by_date.get(d, []),
            }
        )

    return {
        "setup_complete": is_setup_complete(),
        "from": today.isoformat(),
        "to": end.isoformat(),
        "days": days_out,
        "event_types": sorted(VALID_EVENT_TYPES),
    }
