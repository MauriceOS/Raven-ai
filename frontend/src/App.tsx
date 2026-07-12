import { useState, useEffect, useCallback } from "react";
import { TodayView } from "./components/TodayView";
import { ProgressView } from "./components/ProgressView";
import { PlanView } from "./components/PlanView";
import { Onboarding } from "./components/Onboarding";
import { Sidebar } from "./components/Sidebar";
import { useShellHeader } from "./context/ShellHeaderContext";
import { api, isApiConfigured, type AppView } from "./api";

const PAGE_TITLES: Record<AppView, string> = {
  today: "Today",
  progress: "Progress",
  plan: "Plan",
};

function App() {
  const [view, setView] = useState<AppView>("today");
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [userName, setUserName] = useState<string>();
  const [onboardingMode, setOnboardingMode] = useState<"setup" | "new-goal" | null>(null);
  const { headerExtras, setHeaderExtras } = useShellHeader();
  const configured = isApiConfigured();

  const refreshSetupStatus = useCallback(async () => {
    if (!configured) return;
    try {
      const res = await api.setupStatus();
      const complete = Boolean(res.data?.complete);
      setSetupComplete(complete);
      setUserName(res.data?.profile?.name);
    } catch {
      setSetupComplete(false);
    }
  }, [configured]);

  useEffect(() => {
    refreshSetupStatus();
  }, [refreshSetupStatus]);

  useEffect(() => {
    setHeaderExtras(null);
  }, [view, setHeaderExtras]);

  const handleSetupComplete = () => {
    setSetupComplete(true);
    setOnboardingMode(null);
    setView("today");
    refreshSetupStatus();
  };

  const greeting = userName ? `Hey, ${userName.split(" ")[0]}` : "Welcome";

  return (
    <div className="shell">
      {onboardingMode && (
        <Onboarding
          mode={onboardingMode}
          onComplete={handleSetupComplete}
          onDismiss={() => setOnboardingMode(null)}
        />
      )}

      <Sidebar
        view={view}
        onNavigate={setView}
        setupComplete={Boolean(setupComplete)}
        userName={userName}
      />

      <div className="main">
        <header className="topbar">
          <div className="topbar-copy">
            <p className="eyebrow">{greeting}</p>
            <div className="topbar-title-row">
              <h1>{PAGE_TITLES[view]}</h1>
              {view === "today" && headerExtras}
            </div>
          </div>
          <div className="topbar-meta">
            {!configured && <span className="pill pill-warn">API not configured</span>}
            {setupComplete === false && !onboardingMode && (
              <button
                type="button"
                className="pill pill-action"
                onClick={() => setOnboardingMode("setup")}
              >
                Set goal
              </button>
            )}
          </div>
        </header>

        <div className="viewport">
          {view === "today" && (
            <TodayView
              onRequestSetup={() => setOnboardingMode("setup")}
              onNewGoal={() => setOnboardingMode("new-goal")}
              onOpenPlan={() => setView("plan")}
              onSetupComplete={refreshSetupStatus}
            />
          )}
          {view === "progress" && (
            <ProgressView onRequestSetup={() => setOnboardingMode("setup")} />
          )}
          {view === "plan" && (
            <PlanView
              onRequestSetup={() => setOnboardingMode("setup")}
              onOpenToday={() => setView("today")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
