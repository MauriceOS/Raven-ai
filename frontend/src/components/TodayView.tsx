import { useState, useEffect, useCallback } from "react";

import {

  api,

  formatDayLabel,

  type Energy,

  type Milestone,

  type Recommendation,

  type TodayData,

  type Trigger,

} from "../api";

import { useShellHeader } from "../context/ShellHeaderContext";

import { AskPanel } from "./AskPanel";

import { DateNav, nextStudyBlockTime, studyBlockTitle } from "./DateNav";

import { GoalSwitcher } from "./GoalSwitcher";

import { EventForm, EventList } from "./EventForm";



const ENERGY: { id: Energy; label: string }[] = [

  { id: "low", label: "Low" },

  { id: "ok", label: "OK" },

  { id: "high", label: "High" },

];



const TRIGGERS: { id: Trigger; label: string }[] = [

  { id: "stuck", label: "Stuck" },

  { id: "ahead", label: "Ahead" },

  { id: "reprioritize", label: "Reprioritize" },

];



interface TodayViewProps {

  onRequestSetup: () => void;

  onNewGoal: () => void;

  onOpenPlan?: () => void;

  onSetupComplete?: () => void;

}



export function TodayView({

  onRequestSetup,

  onNewGoal,

  onOpenPlan,

  onSetupComplete,

}: TodayViewProps) {

  const { setHeaderExtras } = useShellHeader();

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [showDatePicker, setShowDatePicker] = useState(false);

  const [showWhy, setShowWhy] = useState(false);

  const [data, setData] = useState<TodayData | null>(null);

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);

  const [sideExpanded, setSideExpanded] = useState(true);



  const load = useCallback(async () => {

    try {

      const res = await api.today(selectedDate);

      if (res.data) setData(res.data);

    } finally {

      setLoading(false);

    }

  }, [selectedDate]);



  useEffect(() => {

    setLoading(true);

    load();

  }, [load]);



  useEffect(() => {

    if (!data?.goal) {

      setHeaderExtras(null);

      return;

    }



    const interactive = data.is_today;

    setHeaderExtras(

      <div className="topbar-inline-tools">

        <DateNav

          selectedDate={selectedDate}

          onDateChange={setSelectedDate}

          showPicker={showDatePicker}

          onTogglePicker={() => setShowDatePicker((v) => !v)}

          onClosePicker={() => setShowDatePicker(false)}

        />

        <GoalSwitcher

          goals={data.goals}

          activeGoalId={data.goal.goal_id}

          onSwitched={load}

          onNewGoal={onNewGoal}

        />

        {data.energy_streak > 0 && interactive && (

          <span className="streak-badge">{data.energy_streak}d streak</span>

        )}

      </div>

    );



    return () => setHeaderExtras(null);

  }, [

    data,

    selectedDate,

    showDatePicker,

    load,

    onNewGoal,

    setHeaderExtras,

  ]);



  useEffect(() => {

    if (!data) return;

    setSideExpanded(data.events.length > 0);

  }, [selectedDate, data?.events.length]);



  const applyRecommendation = (rec: Recommendation) => {

    setData((prev) => (prev ? { ...prev, recommendation: rec } : prev));

  };



  const checkIn = async (energy: Energy) => {

    if (!data?.is_today) return;

    setBusy(true);

    try {

      const res = await api.checkIn(energy, selectedDate);

      if (res.data?.recommendation) applyRecommendation(res.data.recommendation);

      setData((prev) => (prev ? { ...prev, energy } : prev));

    } finally {

      setBusy(false);

    }

  };



  const runTrigger = async (trigger: Trigger) => {

    if (!data?.is_today) return;

    setBusy(true);

    try {

      const res = await api.refreshRecommendation(trigger, selectedDate);

      if (res.data) applyRecommendation(res.data);

    } finally {

      setBusy(false);

    }

  };



  const toggleMilestone = async (m: Milestone) => {

    if (!data?.is_today) return;

    setBusy(true);

    try {

      const res = await api.toggleMilestone(m.id, !m.completed);

      if (res.data?.recommendation) applyRecommendation(res.data.recommendation);

      await load();

    } finally {

      setBusy(false);

    }

  };



  const claimDemo = async () => {

    setBusy(true);

    try {

      await api.claimDemo();

      await load();

    } finally {

      setBusy(false);

    }

  };



  const markFocusDone = async () => {

    if (!data?.is_today || data.focus_done) return;

    setBusy(true);

    try {

      const res = await api.focusDone(selectedDate);

      if (res.data?.today) setData(res.data.today);

      else await load();

      setShowWhy(false);

    } finally {

      setBusy(false);

    }

  };



  const startWithExample = async () => {

    setBusy(true);

    try {

      const exRes = await api.demoExample();

      const ex = exRes.data;

      if (!ex) throw new Error("Example plan unavailable");

      await api.completeSetup({

        name: "Guest",

        vision_name: ex.goal_name,

        north_star: ex.north_star,

        current_challenge: ex.current_challenge,

        milestones: ex.milestones,

        demo_mode: true,

      });

      onSetupComplete?.();

      await load();

    } finally {

      setBusy(false);

    }

  };



  const addStudyBlock = async (focusText: string) => {

    if (!data?.is_today || busy) return;

    setBusy(true);

    try {

      const res = await api.addEvent({

        title: studyBlockTitle(focusText),

        date: selectedDate,

        time: nextStudyBlockTime(),

        type: "study_block",

        notes: "45 min block from today's focus",

      });

      if (res.data?.recommendation) applyRecommendation(res.data.recommendation);

      setSideExpanded(true);

      await load();

    } finally {

      setBusy(false);

    }

  };



  if (loading && !data) {

    return (

      <div className="content-well">

        <div className="skeleton-hero" />

        <div className="skeleton-line" />

        <div className="skeleton-line short" />

      </div>

    );

  }



  if (!data) {

    return (

      <div className="content-well">

        <div className="state-card">

          <h2>Connection failed</h2>

          <p>Check VITE_API_URL and redeploy the backend if routes changed.</p>

          <button type="button" className="btn btn-primary" onClick={load}>

            Retry

          </button>

        </div>

      </div>

    );

  }



  if (!data.setup_complete || !data.goal) {

    return (

      <div className="content-well">

        <div className="state-card welcome-card">

          <h2>What should you focus on today?</h2>

          <p>

            Raven reads your goal, energy, and schedule — then recommends one clear next step.

          </p>

          <div className="welcome-actions">

            <button

              type="button"

              className="btn btn-primary btn-lg"

              disabled={busy}

              onClick={startWithExample}

            >

              Try example goal

            </button>

            <button

              type="button"

              className="btn btn-secondary btn-lg"

              disabled={busy}

              onClick={onRequestSetup}

            >

              Set your own goal

            </button>

          </div>

        </div>

      </div>

    );

  }



  const rec = data.recommendation;

  const interactive = data.is_today;

  const focusDone = data.focus_done;

  const primaryLine = focusDone?.text ?? rec?.actions[0];

  const upNext =

    focusDone && rec?.actions[0] && rec.actions[0] !== focusDone.text ? rec.actions[0] : undefined;

  const alsoConsider = focusDone ? [] : (rec?.actions.slice(1) ?? []);

  const openMilestones = data.milestones.filter((m) => !m.completed).length;



  const contextToolbar = (

    <>

      <DateNav

        selectedDate={selectedDate}

        onDateChange={setSelectedDate}

        showPicker={showDatePicker}

        onTogglePicker={() => setShowDatePicker((v) => !v)}

        onClosePicker={() => setShowDatePicker(false)}

      />

      <GoalSwitcher

        goals={data.goals}

        activeGoalId={data.goal.goal_id}

        onSwitched={load}

        onNewGoal={onNewGoal}

      />

      {data.energy_streak > 0 && interactive && (

        <span className="streak-badge">{data.energy_streak}d streak</span>

      )}

    </>

  );



  return (

    <div className="content-well panel-scroll">

      {data.goal.demo_mode && (

        <div className="demo-banner" role="status">

          <span>Sample goal loaded — edit milestones or replace with your own.</span>

          <div className="demo-banner-actions">

            <button type="button" className="text-link" onClick={claimDemo} disabled={busy}>

              Make this mine

            </button>

            <button type="button" className="text-link" onClick={onNewGoal}>

              Start fresh

            </button>

          </div>

        </div>

      )}



      {!interactive && (

        <div className="readonly-banner" role="status">

          Viewing {formatDayLabel(selectedDate)} — log energy and update milestones on today.

          <button

            type="button"

            className="text-link"

            onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}

          >

            Go to today

          </button>

        </div>

      )}



      <header className="context-strip context-strip-mobile">{contextToolbar}</header>



      <div className="workspace-panel today-workspace">

        <p className="goal-line">{data.goal.north_star}</p>



        <div className={`today-layout${sideExpanded ? "" : " side-collapsed"}`}>

          <div className="today-primary">

            <section

              className={focusDone ? "rec-hero focus-block is-complete" : "rec-hero focus-block"}

              aria-labelledby="rec-heading"

            >

              <h2 id="rec-heading">{focusDone ? "Done for today" : "Focus now"}</h2>

              {rec || focusDone ? (

                <>

                  {primaryLine ? (

                    <p className="focus-primary">{primaryLine}</p>

                  ) : (

                    <p className="focus-primary muted">

                      {rec?.raw || "No recommendation saved for this day."}

                    </p>

                  )}

                  {interactive && primaryLine && !focusDone && (

                    <label className="focus-done-row">

                      <input

                        type="checkbox"

                        checked={false}

                        disabled={busy}

                        onChange={() => markFocusDone()}

                      />

                      <span className="focus-done-label">Done for now</span>

                    </label>

                  )}

                  {focusDone && (

                    <p className="focus-done-row checked">

                      <span aria-hidden="true">✓</span>

                      <span className="focus-done-label">

                        Done for now

                        {focusDone.milestone_title && (

                          <span className="focus-done-note">

                            {" "}

                            — also checked off &ldquo;{focusDone.milestone_title}&rdquo;

                          </span>

                        )}

                      </span>

                    </p>

                  )}

                  {upNext && (

                    <div className="focus-up-next">

                      <span className="focus-also-label">Up next</span>

                      <p className="focus-up-next-text">{upNext}</p>

                    </div>

                  )}

                  {alsoConsider.length > 0 && !focusDone && (

                    <div className="focus-also">

                      <span className="focus-also-label">Also consider</span>

                      <ul>

                        {alsoConsider.map((a) => (

                          <li key={a}>{a}</li>

                        ))}

                      </ul>

                    </div>

                  )}

                  {rec?.why && (

                    <button

                      type="button"

                      className="why-toggle"

                      onClick={() => setShowWhy((v) => !v)}

                      aria-expanded={showWhy}

                    >

                      Why this?

                      <span>{showWhy ? "−" : "+"}</span>

                    </button>

                  )}

                  {showWhy && rec?.why && <p className="rec-why-text">{rec.why}</p>}

                </>

              ) : interactive ? (

                <p className="rec-loading">Generating recommendation…</p>

              ) : (

                <p className="rec-loading">Nothing saved for this day.</p>

              )}



              {interactive && (

                <>

                  <div className={`rec-energy${!data.energy ? " needs-checkin" : ""}`}>

                    <span className="rec-energy-label">

                      Energy today

                      {!data.energy && (

                        <span className="rec-energy-hint"> — pick one to sharpen focus</span>

                      )}

                    </span>

                    <div className="energy-row compact" role="group" aria-label="Today's energy">

                      {ENERGY.map((e) => (

                        <button

                          key={e.id}

                          type="button"

                          className={data.energy === e.id ? "energy-btn on" : "energy-btn"}

                          onClick={() => checkIn(e.id)}

                          disabled={busy}

                          aria-pressed={data.energy === e.id}

                        >

                          {e.label}

                        </button>

                      ))}

                    </div>

                  </div>

                  <div className="trigger-row compact">

                    {TRIGGERS.map((t) => (

                      <button

                        key={t.id}

                        type="button"

                        className="trigger-link"

                        disabled={busy}

                        onClick={() => runTrigger(t.id)}

                      >

                        {t.label}

                      </button>

                    ))}

                    <button

                      type="button"

                      className="trigger-link"

                      disabled={busy}

                      onClick={() => runTrigger("refresh")}

                    >

                      Refresh

                    </button>

                  </div>

                </>

              )}



              {!interactive && data.energy && (

                <p className="rec-energy-readonly">

                  Energy that day: <span className="capitalize">{data.energy}</span>

                </p>

              )}

            </section>

          </div>



          <aside className="today-secondary">

              <div className="side-panel-head">

                <span className="side-panel-label">Schedule & milestones</span>

                <button

                  type="button"

                  className="side-collapse-btn"

                  onClick={() => setSideExpanded(false)}

                  aria-label="Collapse schedule and milestones"

                >

                  Hide

                </button>

              </div>

              <section className="flat-section" aria-labelledby="schedule-heading">

                <div className="section-head">

                  <h2 id="schedule-heading">Schedule</h2>

                  {onOpenPlan && (

                    <button type="button" className="text-link" onClick={onOpenPlan}>

                      Week in Plan →

                    </button>

                  )}

                </div>

                <EventList events={data.events} onChanged={load} canDelete={interactive} />

                {interactive && data.events.length === 0 && (

                  <div className="schedule-empty-actions">

                    <p className="hint">Nothing on today&apos;s schedule yet.</p>

                    {primaryLine && (

                      <button

                        type="button"

                        className="btn btn-secondary study-block-btn"

                        disabled={busy}

                        onClick={() => addStudyBlock(primaryLine)}

                      >

                        Block 45 min for today&apos;s focus

                      </button>

                    )}

                    {onOpenPlan && (

                      <button type="button" className="text-link" onClick={onOpenPlan}>

                        Or add events in Plan

                      </button>

                    )}

                  </div>

                )}

                {interactive && <EventForm defaultDate={selectedDate} onSaved={load} compact />}

                {!interactive && data.events.length === 0 && (

                  <p className="hint">No events this day.</p>

                )}

              </section>



              <section className="flat-section" aria-labelledby="milestones-heading">

                <div className="section-head">

                  <h2 id="milestones-heading">Milestones</h2>

                  <span className="section-meta tabular">

                    {data.goal.completed_count}/{data.goal.milestones_count} · {data.goal.progress}%

                  </span>

                </div>

                <ul className="milestone-checklist">

                  {data.milestones.map((m) => (

                    <li key={m.id}>

                      <label className={m.completed ? "milestone-item done" : "milestone-item"}>

                        <input

                          type="checkbox"

                          checked={m.completed}

                          disabled={busy || !interactive}

                          onChange={() => toggleMilestone(m)}

                        />

                        <span>{m.title}</span>

                      </label>

                    </li>

                  ))}

                </ul>

              </section>

            </aside>

          <button

            type="button"

            className="today-side-expand"

            onClick={() => setSideExpanded(true)}

            hidden={sideExpanded}

          >

              <span>Schedule & milestones</span>

              <span className="today-side-expand-meta tabular">

                {data.events.length} events · {openMilestones} open

              </span>

            </button>

        </div>



        {interactive && <AskPanel onAsk={(msg) => api.chat(msg, selectedDate)} />}

      </div>

    </div>

  );

}


