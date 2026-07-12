import { useState, useEffect, useCallback } from "react";
import { api, type ProgressData } from "../api";

interface ProgressViewProps {
  onRequestSetup: () => void;
}

export function ProgressView({ onRequestSetup }: ProgressViewProps) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPastRecs, setShowPastRecs] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.progress();
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
        <div className="skeleton-line short" />
      </div>
    );
  }

  if (!data?.setup_complete || !data.goal) {
    return (
      <div className="content-well">
        <div className="state-card">
          <h2>No progress yet</h2>
          <p>Set a goal and complete milestones to see your history here.</p>
          <button type="button" className="btn btn-primary" onClick={onRequestSetup}>
            Set goal
          </button>
        </div>
      </div>
    );
  }

  const pastRecs = data.recommendation_history.slice(0, 7);

  return (
    <div className="content-well panel-scroll">
      <div className="workspace-panel">
      <section className="flat-section">
        <p className="goal-line">{data.goal.north_star}</p>
        <div className="stat-row-inline tabular">
          <span>
            <strong className="accent">{data.goal.progress}%</strong> done
          </span>
          <span>{data.streak}-day streak</span>
          <span>
            {data.goal.completed_count}/{data.goal.milestones_count} milestones
          </span>
        </div>
        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${data.goal.progress}%` }} />
        </div>
      </section>

      <section className="flat-section">
        <h2 className="section-title">Focus sessions</h2>
        {(data.focus_completions ?? []).length === 0 ? (
          <p className="hint">
            Mark &ldquo;Done for now&rdquo; on Today — completed focus appears here.
          </p>
        ) : (
          <ul className="timeline">
            {(data.focus_completions ?? []).map((f, i) => (
              <li key={`${f.date}-${i}`}>
                <span className="timeline-date tabular">
                  {f.completed_at
                    ? new Date(f.completed_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    : f.date}
                </span>
                <span>
                  {f.text}
                  {f.milestone_title && (
                    <span className="focus-done-note"> · {f.milestone_title}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flat-section">
        <h2 className="section-title">Completed</h2>
        {data.completions.length === 0 ? (
          <p className="hint">Check off milestones on Today — they appear here with a date.</p>
        ) : (
          <ul className="timeline">
            {data.completions.map((c) => (
              <li key={c.id}>
                <span className="timeline-date tabular">
                  {c.completed_at
                    ? new Date(c.completed_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </span>
                <span>{c.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.open_milestones.length > 0 && (
        <section className="flat-section">
          <h2 className="section-title">Still open</h2>
          <ul className="simple-list">
            {data.open_milestones.map((m) => (
              <li key={m.id}>{m.title}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="flat-section">
        <h2 className="section-title">Energy history</h2>
        {data.energy_history.length === 0 ? (
          <p className="hint">Log Low / OK / High on Today to build a pattern.</p>
        ) : (
          <ul className="energy-history">
            {data.energy_history.map((e) => (
              <li key={e.date}>
                <span className="tabular">{e.date}</span>
                <span className={`energy-chip ${e.level}`}>{e.level}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pastRecs.length > 0 && (
        <section className="flat-section">
          <button
            type="button"
            className="section-toggle"
            onClick={() => setShowPastRecs((v) => !v)}
            aria-expanded={showPastRecs}
          >
            Past recommendations ({pastRecs.length})
            <span>{showPastRecs ? "−" : "+"}</span>
          </button>
          {showPastRecs && (
            <ul className="rec-history">
              {pastRecs.map((r) => (
                <li key={r.date}>
                  <strong className="tabular">{r.date}</strong>
                  <ul>
                    {r.actions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                  {r.why && <p className="rec-why-mini">{r.why}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      </div>
    </div>
  );
}
