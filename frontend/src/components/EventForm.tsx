import { useState } from "react";
import { api, type EventType, type ScheduleEvent } from "../api";

const TYPE_LABELS: Record<EventType, string> = {
  meeting: "Meeting",
  reminder: "Reminder",
  study_block: "Study block",
  deadline: "Deadline",
};

interface EventFormProps {
  defaultDate: string;
  onSaved: () => void;
  compact?: boolean;
}

export function EventForm({ defaultDate, onSaved, compact }: EventFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [type, setType] = useState<EventType>("reminder");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.addEvent({
        title: title.trim(),
        date,
        time: time || undefined,
        type,
        notes: notes.trim() || undefined,
      });
      setTitle("");
      setTime("");
      setNotes("");
      setOpen(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add event");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        + Add {compact ? "to schedule" : "meeting / reminder"}
      </button>
    );
  }

  return (
    <div className="event-form">
      <label>
        Title
        <input
          className="field-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Team standup, Practice exam, ..."
          autoFocus
        />
      </label>
      <div className="event-form-row">
        <label>
          Date
          <input
            className="field-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Time (optional)
          <input
            className="field-input"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
      </div>
      <label>
        Type
        <select
          className="field-input"
          value={type}
          onChange={(e) => setType(e.target.value as EventType)}
        >
          {(Object.keys(TYPE_LABELS) as EventType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Notes (optional)
        <input
          className="field-input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Prep slides / 90 min focus"
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={submit}
          disabled={busy || !title.trim()}
        >
          {busy ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

interface EventListProps {
  events: ScheduleEvent[];
  onChanged: () => void;
  canDelete?: boolean;
}

export function EventList({ events, onChanged, canDelete = true }: EventListProps) {
  const [busy, setBusy] = useState(false);

  if (events.length === 0) {
    return <p className="hint">No meetings or reminders scheduled.</p>;
  }

  return (
    <ul className="event-list">
      {events.map((e) => (
        <li key={e.event_id} className="event-item">
          <div>
            <span className={`event-type type-${e.type}`}>{TYPE_LABELS[e.type]}</span>
            <strong>{e.title}</strong>
            <span className="event-meta">
              {e.time ? e.time : "Anytime"}
              {e.notes ? ` · ${e.notes}` : ""}
            </span>
          </div>
          {canDelete && (
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              aria-label={`Remove ${e.title}`}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.deleteEvent(e.event_id, e.date);
                  onChanged();
                } finally {
                  setBusy(false);
                }
              }}
            >
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
