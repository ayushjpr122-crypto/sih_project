export default function Header() {
  return (
    <header className="bg-harbour-950 text-white">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="flex items-center gap-3 py-3.5">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ocean-600 ring-1 ring-white/20"
            aria-hidden
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10.2" stroke="white" strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="3 3" />
              <path d="M12 4v13M12 6.5a2 2 0 1 0 0-.01M6.5 10.5h11M5 13.5c0 3.6 3.1 6 7 6s7-2.4 7-6M9 10.5 7.5 13M15 10.5l1.5 2.5" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-display text-[17px] font-bold leading-tight tracking-tight">
              Freight Intelligence
            </p>
            <p className="truncate text-[12px] text-slate-300">
              Bulk cargo forecasting &amp; vessel chartering
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
