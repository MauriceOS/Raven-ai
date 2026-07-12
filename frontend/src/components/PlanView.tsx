import { useState, useEffect, useCallback } from "react";
import { api, type PlanData } from "../api";
import { EventForm, EventList } from "./EventForm";

interface PlanViewProps {
  onRequestSetup: () => void;
  onOpenToday?: () => void;
}

export function PlanView({ onRequestSetup, onOpenToday }: PlanViewProps) {
  const [data, setData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    try {
      const res = await api.plan();
      if (res.data) setData(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="content-well">
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
      </div>
    );
  }

  if (!data?.setup_complete) {
    return (
      <div className="content-well">
        <div className="state-card">
          <h2>Plan your week</h2>
          <p>Add meetings and study blocks so Raven can recommend around your real schedule.</p>
          <button type="button" className="btn btn-primary" onClick={onRequestSetup}>
            Set goal
          </button>
        </div>
      </div>
    );
  }

  const totalEvents = data.days.reduce((n, d) => n + d.events.length, 0);

  return (
    <div className="content-well panel-scroll">
      <div className="workspace-panel">
      <header className="plan-header">
        <div className="section-head plan-head-row">
          <p className="plan-lead">Raven reads this when building today&apos;s focus.</p>
          {onOpenToday && (
            <button type="button" className="text-link" onClick={onOpenToday}>
              Today →
            </button>
          )}
        </div>
        <EventForm defaultDate={today} onSaved={load} />
      </header>

      {totalEvents === 0 ? (
        <p className="hint plan-empty">No events this week. Add a meeting, reminder, or study block above.</p>
      ) : (
        <ol className="week-timeline">
          {data.days.map((day) => (
            <li key={day.date} className={day.date === today ? "week-day today" : "week-day"}>
              <div className="week-day-marker" aria-hidden="true" />
              <div className="week-day-body">
                <div className="week-day-head">
                  <strong>{day.label}</strong>
                  <span className="tabular">{day.date}</span>
                </div>
                {day.events.length > 0 ? (
                  <EventList events={day.events} onChanged={load} />
                ) : (
                  <p className="hint week-day-empty">Nothing scheduled</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      </div>
    </div>
  );
}
