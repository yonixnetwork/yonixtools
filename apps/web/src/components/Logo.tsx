export function Logo() {
  return (
    <a href="/" className="brand" aria-label="YoniXTools home">
      <span className="brand-mark" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 4l7 8 7-8" />
          <path d="M12 12v8" />
        </svg>
      </span>
      <span>
        Yoni<b>X</b>Tools
      </span>
    </a>
  );
}
