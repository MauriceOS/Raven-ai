import { formatDayLabel, shiftDate } from "../api";

interface DateNavProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  showPicker: boolean;
  onTogglePicker: () => void;
  onClosePicker: () => void;
  className?: string;
}

export function DateNav({
  selectedDate,
  onDateChange,
  showPicker,
  onTogglePicker,
  onClosePicker,
  className = "date-nav-compact",
}: DateNavProps) {
  return (
    <div className={className}>
      <button
        type="button"
        className="btn-icon-sm"
        onClick={() => onDateChange(shiftDate(selectedDate, -1))}
        aria-label="Previous day"
      >
        ←
      </button>
      <button type="button" className="date-label-btn" onClick={onTogglePicker}>
        {formatDayLabel(selectedDate)}
      </button>
      <button
        type="button"
        className="btn-icon-sm"
        onClick={() => onDateChange(shiftDate(selectedDate, 1))}
        aria-label="Next day"
      >
        →
      </button>
      {showPicker && (
        <input
          type="date"
          className="date-input-pop"
          value={selectedDate}
          onChange={(e) => {
            onDateChange(e.target.value);
            onClosePicker();
          }}
        />
      )}
    </div>
  );
}

export function nextStudyBlockTime(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.toTimeString().slice(0, 5);
}

export function studyBlockTitle(focus: string): string {
  const trimmed = focus.trim();
  if (!trimmed) return "Focus session";
  const label = trimmed.length > 55 ? `${trimmed.slice(0, 52)}…` : trimmed;
  return label.toLowerCase().startsWith("study:") ? label : `Study: ${label}`;
}
