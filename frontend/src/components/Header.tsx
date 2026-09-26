export default function Header() {
  return (
    <header className="bg-harbour-950 text-white">
      <div className="mx-auto max-w-ops px-4 sm:px-6">
        <div className="flex items-center gap-3 py-3.5">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[2px] bg-[#2A6E8C] ring-1 ring-white/20"
            aria-hidden
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10.2" stroke="white" strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="3 3" />
              <path d="M12 4v13M12 6.5a2 2 0 1 0 0-.01M6.5 10.5h11M5 13.5c0 3.6 3.1 6 7 6s7-2.4 7-6M9 10.5 7.5 13M15 10.5l1.5 2.5" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-display text-[17px] font-bold leading-tight tracking-tight">
              MARINEAI <span className="font-medium text-slate-300">/ Freight Intelligence</span>
            </p>
            <p className="truncate text-[12px] text-slate-300">
              Maritime operations control center · East Coast India
            </p>
          </div>
          <div className="ml-auto hidden items-center gap-2 sm:flex" aria-hidden>
            <span className="live-dot inline-block h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] tracking-[0.18em] text-slate-300">
              OPS WATCH
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
