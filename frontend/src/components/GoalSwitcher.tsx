import { useState } from "react";
import { api, type GoalSummary } from "../api";

interface GoalSwitcherProps {
  goals: GoalSummary[];
  activeGoalId?: string;
  onSwitched: () => void;
  onNewGoal: () => void;
}

export function GoalSwitcher({ goals, activeGoalId, onSwitched, onNewGoal }: GoalSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const active = goals.find((g) => g.goal_id === activeGoalId);

  const switchTo = async (goalId: string) => {
    if (goalId === activeGoalId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      await api.switchGoal(goalId);
      onSwitched();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="goal-switcher">
      <button
        type="button"
        className="goal-switcher-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={busy}
      >
        {active?.name || "Your goal"} ▾
      </button>
      {open && (
        <div className="goal-menu">
          {goals.map((g) => (
            <button
              key={g.goal_id}
              type="button"
              className={g.is_active ? "goal-menu-item active" : "goal-menu-item"}
              onClick={() => switchTo(g.goal_id)}
              disabled={busy}
            >
              <strong>{g.name}</strong>
              <span>{g.progress}% · {g.north_star.slice(0, 40)}{g.north_star.length > 40 ? "…" : ""}</span>
            </button>
          ))}
          <button
            type="button"
            className="goal-menu-item new"
            onClick={() => {
              setOpen(false);
              onNewGoal();
            }}
          >
            + New goal
          </button>
        </div>
      )}
    </div>
  );
}
