const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export type Energy = "low" | "ok" | "high";
export type Trigger = "stuck" | "ahead" | "reprioritize" | "refresh";
export type EventType = "meeting" | "reminder" | "study_block" | "deadline";
export type AppView = "today" | "progress" | "plan";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: string;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  completed_at?: string;
}

export interface ScheduleEvent {
  event_id: string;
  title: string;
  date: string;
  time?: string;
  type: EventType;
  notes?: string;
}

export interface Recommendation {
  actions: string[];
  why: string;
  raw?: string;
  updated_at?: string;
}

export interface FocusDone {
  text: string;
  completed_at: string;
  milestone_id?: string;
  milestone_title?: string;
}

export interface GoalSummary {
  goal_id: string;
  name: string;
  north_star: string;
  progress: number;
  demo_mode?: boolean;
  is_active: boolean;
}

export interface TodayData {
  setup_complete: boolean;
  date: string;
  is_today: boolean;
  profile?: { name?: string };
  goal?: {
    goal_id: string;
    name: string;
    north_star: string;
    progress: number;
    milestones_count: number;
    completed_count: number;
    demo_mode?: boolean;
  };
  milestones: Milestone[];
  events: ScheduleEvent[];
  energy: Energy | null;
  energy_streak: number;
  recommendation: Recommendation | null;
  focus_done: FocusDone | null;
  goals: GoalSummary[];
}

export interface ProgressData {
  setup_complete: boolean;
  goal?: {
    name: string;
    north_star: string;
    progress: number;
    completed_count: number;
    milestones_count: number;
    demo_mode?: boolean;
  };
  completions: { id: string; title: string; completed_at?: string }[];
  focus_completions: {
    date: string;
    text: string;
    completed_at?: string;
    milestone_title?: string;
  }[];
  open_milestones: Milestone[];
  energy_history: { date: string; level: string }[];
  streak: number;
  recommendation_history: { date: string; actions: string[]; why: string }[];
}

export interface PlanDay {
  date: string;
  label: string;
  events: ScheduleEvent[];
}

export interface PlanData {
  setup_complete: boolean;
  from: string;
  to: string;
  days: PlanDay[];
  event_types: EventType[];
}

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  if (!API_BASE) {
    throw new Error("VITE_API_URL is not set. Deploy backend and add .env file.");
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || json.message || `HTTP ${res.status}`) as Error & {
      code?: string;
    };
    err.code = json.code;
    throw err;
  }
  return json;
}

export interface DemoExample {
  goal_name: string;
  north_star: string;
  current_challenge: string;
  milestones: string[];
}

export const api = {
  health: () => request("/health"),
  demoExample: () => request<DemoExample>("/demo-example"),
  setupStatus: () =>
    request<{ complete: boolean; profile?: { name?: string }; active_goal_id?: string }>(
      "/setup-status"
    ),
  completeSetup: (payload: Record<string, unknown>) =>
    request("/setup", { method: "POST", body: JSON.stringify(payload) }),
  today: (date?: string) =>
    request<TodayData>(date ? `/today?date=${encodeURIComponent(date)}` : "/today"),
  progress: () => request<ProgressData>("/progress"),
  plan: () => request<PlanData>("/plan"),
  goals: () => request<GoalSummary[]>("/goals"),
  checkIn: (energy: Energy, date?: string) =>
    request<{ energy: unknown; recommendation: Recommendation }>("/check-in", {
      method: "POST",
      body: JSON.stringify({ energy, date }),
    }),
  refreshRecommendation: (trigger: Trigger = "refresh", date?: string) =>
    request<Recommendation>("/recommendation", {
      method: "POST",
      body: JSON.stringify({ trigger, date }),
    }),
  focusDone: (date?: string) =>
    request<{
      focus_done: FocusDone;
      recommendation: Recommendation;
      today: TodayData;
      milestone_matched?: boolean;
    }>("/focus/done", {
      method: "POST",
      body: JSON.stringify({ date }),
    }),
  switchGoal: (goalId: string) =>
    request("/goal/switch", {
      method: "POST",
      body: JSON.stringify({ goal_id: goalId }),
    }),
  createGoal: (payload: Record<string, unknown>) =>
    request("/goal", { method: "POST", body: JSON.stringify(payload) }),
  claimDemo: () => request("/goal/claim-demo", { method: "POST", body: "{}" }),
  chat: (message: string, date?: string) =>
    request<{ response?: string }>("/chat", {
      method: "POST",
      body: JSON.stringify({ message, date }),
    }),
  toggleMilestone: (id: string, completed: boolean) =>
    request<{ goal: unknown; recommendation: Recommendation }>("/vision/milestone/toggle", {
      method: "POST",
      body: JSON.stringify({ id, completed }),
    }),
  addEvent: (payload: {
    title: string;
    date: string;
    time?: string;
    type: EventType;
    notes?: string;
  }) =>
    request<{ event: ScheduleEvent; recommendation?: Recommendation }>("/event", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteEvent: (eventId: string, date: string) =>
    request<{ recommendation?: Recommendation }>("/event/delete", {
      method: "POST",
      body: JSON.stringify({ event_id: eventId, date }),
    }),
};

export function isApiConfigured(): boolean {
  return Boolean(API_BASE);
}

export function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDayLabel(iso: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = shiftDate(today, 1);
  const yesterday = shiftDate(today, -1);
  if (iso === today) return "Today";
  if (iso === tomorrow) return "Tomorrow";
  if (iso === yesterday) return "Yesterday";
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
