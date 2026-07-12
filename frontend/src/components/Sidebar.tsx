import { IconPlan, IconProgress, IconRaven, IconToday } from "./Icons";
import type { AppView } from "../api";

interface SidebarProps {
  view: AppView;
  onNavigate: (view: AppView) => void;
  setupComplete: boolean;
  userName?: string;
}

const NAV: { id: AppView; label: string; Icon: () => JSX.Element }[] = [
  { id: "today", label: "Today", Icon: IconToday },
  { id: "progress", label: "Progress", Icon: IconProgress },
  { id: "plan", label: "Plan", Icon: IconPlan },
];

export function Sidebar({ view, onNavigate, setupComplete, userName }: SidebarProps) {
  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <IconRaven />
          <div>
            <strong>Raven</strong>
            <span>Personal focus coach</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={view === id ? "nav-item active" : "nav-item"}
              onClick={() => onNavigate(id)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          {userName ? (
            <div className="user-chip">
              <span className="user-avatar">{userName.charAt(0).toUpperCase()}</span>
              <span className="user-name">{userName}</span>
            </div>
          ) : (
            <span className="sidebar-note">
              {setupComplete ? "Ready for check-in." : "Complete setup to begin."}
            </span>
          )}
        </div>
      </aside>

      <nav className="mobile-nav" aria-label="Mobile">
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={view === id ? "nav-item active" : "nav-item"}
            onClick={() => onNavigate(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
