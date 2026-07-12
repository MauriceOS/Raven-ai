import { useState } from "react";
import { api } from "../api";

interface OnboardingProps {
  onComplete: () => void;
  onDismiss?: () => void;
  mode?: "setup" | "new-goal";
}

export function Onboarding({ onComplete, onDismiss, mode = "setup" }: OnboardingProps) {
  const [name, setName] = useState("");
  const [goalName, setGoalName] = useState("");
  const [northStar, setNorthStar] = useState("");
  const [challenge, setChallenge] = useState("");
  const [milestones, setMilestones] = useState(["", "", ""]);
  const [demoMode, setDemoMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const valid =
    mode === "new-goal"
      ? northStar.trim().length > 0 && milestones.some((m) => m.trim())
      : name.trim().length > 0 && northStar.trim().length > 0 && milestones.some((m) => m.trim());

  const applyExample = async () => {
    try {
      const res = await api.demoExample();
      const ex = res.data;
      if (!ex) return;
      setGoalName(ex.goal_name);
      setNorthStar(ex.north_star);
      setChallenge(ex.current_challenge);
      setMilestones([...ex.milestones]);
      setDemoMode(true);
    } catch {
      setError("Could not load example plan.");
    }
  };

  const clearExample = () => {
    setGoalName("");
    setNorthStar("");
    setChallenge("");
    setMilestones(["", "", ""]);
    setDemoMode(false);
  };

  const submit = async () => {
    setError(null);
    setSaving(true);
    const payload = {
      ...(mode === "setup" ? { name: name.trim() } : {}),
      vision_name: goalName.trim() || "My goal",
      north_star: northStar.trim(),
      current_challenge: challenge.trim(),
      milestones: milestones.filter((m) => m.trim()),
      demo_mode: demoMode,
    };
    try {
      if (mode === "new-goal") {
        await api.createGoal(payload);
      } else {
        await api.completeSetup(payload);
      }
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="onboarding-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      onKeyDown={(e) => {
        if (e.key === "Escape" && onDismiss) onDismiss();
      }}
    >
      <div className="onboarding-single">
        <div className="onboarding-head">
          <h2 id="onboarding-title">{mode === "new-goal" ? "New goal" : "Welcome to Raven"}</h2>
          {onDismiss && (
            <button type="button" className="onboarding-close" onClick={onDismiss} aria-label="Close">
              ×
            </button>
          )}
        </div>
        <p className="onboarding-lead">
          Raven recommends what to focus on each day — based on your goal, schedule, and energy.
        </p>

        {!demoMode && (
          <p className="example-link-row top">
            Prefer a filled example?{" "}
            <button type="button" className="text-link" onClick={() => void applyExample()}>
              Use example plan
            </button>
          </p>
        )}

        {demoMode && (
          <div className="demo-banner" role="status">
            <span>Using example plan — edit freely or start blank.</span>
            <button type="button" className="text-link" onClick={clearExample}>
              Clear example
            </button>
          </div>
        )}

        {mode === "setup" && (
          <label>
            Your name
            <input
              className="field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="Your first name"
            />
          </label>
        )}

        <label>
          Goal name
          <input
            className="field-input"
            value={goalName}
            onChange={(e) => {
              setGoalName(e.target.value);
              setDemoMode(false);
            }}
            placeholder="e.g. Ship beta, pass an exam, finish thesis"
          />
        </label>

        <label>
          Your goal (one sentence)
          <textarea
            className="field-input"
            rows={2}
            value={northStar}
            onChange={(e) => {
              setNorthStar(e.target.value);
              setDemoMode(false);
            }}
            placeholder="What are you working toward?"
          />
        </label>

        <label>
          Current challenge (optional)
          <input
            className="field-input"
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            placeholder="What's getting in the way?"
          />
        </label>

        <fieldset>
          <legend>Milestones</legend>
          {milestones.map((m, i) => (
            <input
              key={i}
              className="field-input"
              value={m}
              placeholder={`Milestone ${i + 1}`}
              onChange={(e) => {
                const n = [...milestones];
                n[i] = e.target.value;
                setMilestones(n);
                setDemoMode(false);
              }}
            />
          ))}
        </fieldset>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions onboarding-actions">
          {onDismiss && (
            <button type="button" className="btn btn-secondary" disabled={saving} onClick={onDismiss}>
              Cancel
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={!valid || saving}
            onClick={submit}
          >
            {saving ? "Saving..." : mode === "new-goal" ? "Create goal" : "Start — get my recommendation"}
          </button>
        </div>
      </div>
    </div>
  );
}
