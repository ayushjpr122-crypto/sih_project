import type { BackendStatus } from "../types";

const STATUS_STYLE: Record<BackendStatus, { dot: string; pill: string; label: string }> = {
  checking: { dot: "bg-amber-400", pill: "bg-amber-50 text-amber-800 border-amber-200", label: "Checking backend…" },
  connected: { dot: "bg-emerald-500 live-dot", pill: "bg-emerald-50 text-emerald-800 border-emerald-200", label: "Backend Connected" },
  down: { dot: "bg-red-500", pill: "bg-red-50 text-red-800 border-red-200", label: "Backend Unreachable" },
};

export default function Header({ status }: { status: BackendStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <header className="bg-harbour-950 text-white">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 py-4">
          {/* Brand mark: anchor in harbour chart ring */}
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-ocean-500 to-harbour-700 ring-1 ring-white/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="10.2" stroke="white" strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="3 3" />
                <path d="M12 4v13M12 6.5a2 2 0 1 0 0-.01M6.5 10.5h11M5 13.5c0 3.6 3.1 6 7 6s7-2.4 7-6M9 10.5 7.5 13M15 10.5l1.5 2.5" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="font-mono text-[10px] tracking-[0.24em] uppercase text-sky-300/90">
                SIH26006 · Ministry of Steel
              </div>
              <h1 className="font-display text-lg sm:text-xl font-bold leading-tight tracking-tight">
                Intelligent Freight &amp; Vessel Chartering Intelligence
              </h1>
              <p className="text-[12.5px] text-slate-300">
                AI-assisted decision support for bulk cargo procurement and vessel chartering
              </p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="pill bg-amber-400/15 text-amber-200 border border-amber-300/30">
              Prototype · Synthetic/Domain-Informed Data
            </span>
            <span className={`pill border ${s.pill}`}>
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
              {s.label}
            </span>
          </div>
        </div>
        {/* harbour-chart rule */}
        <div className="flex items-center gap-2 pb-3" aria-hidden>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />
          <span className="font-mono text-[9px] tracking-[0.3em] text-sky-300/60">OVERS EAS · EAST COAST OF INDIA</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />
        </div>
      </div>
    </header>
  );
}
