export function IconProgress() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 19V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="7" y="11" width="3" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12" y="7" width="3" height="9" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="17" y="9" width="3" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function IconPlan() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconToday() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconRaven() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="url(#ravenGrad)" />
      <path
        d="M8 19c1.8-5.2 3.8-8 6-8s4.2 2.8 6 8M10.5 13.5h11"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12.5" cy="12" r="1" fill="#fff" />
      <defs>
        <linearGradient id="ravenGrad" x1="4" y1="4" x2="28" y2="28">
          <stop stopColor="#ff7139" />
          <stop offset="1" stopColor="#ff5a1f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function IconSend() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12l16-7-7 16-2-7-7-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSpark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
