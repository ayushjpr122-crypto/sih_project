import { useEffect, useRef, useState } from "react";
import type { ViewKey } from "../nav";
import { LOCKED_WITHOUT_RESULT, VIEWS } from "../nav";
import { api } from "../services/api";
import type { BackendStatus } from "../types";

type Props = {
  view: ViewKey;
  onNavigate: (v: ViewKey) => void;
  hasResult: boolean;
};

const STATUS_META: Record<BackendStatus, { dot: string; label: string; title: string }> = {
  checking: {
    dot: "bg-amber-500",
    label: "Checking…",
    title: "Contacting the model service",
  },
  connected: {
    dot: "bg-emerald-500",
    label: "Model Online",
    title: "Model service reachable (GET /health)",
  },
  down: {
    dot: "bg-red-500",
    label: "Model Offline",
    title: "Model service unreachable — check the backend",
  },
};

function BrandMark() {
  return (
    <span
      className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[2px] bg-harbour-950"
      aria-hidden
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10.2" stroke="white" strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="3 3" />
        <path d="M12 4v13M12 6.5a2 2 0 1 0 0-.01M6.5 10.5h11M5 13.5c0 3.6 3.1 6 7 6s7-2.4 7-6M9 10.5 7.5 13M15 10.5l1.5 2.5" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9.5a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13.5 6 9.5M10 19a2.2 2.2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NavList({ view, onNavigate, hasResult, query }: Props & { query: string }) {
  const q = query.trim().toLowerCase();
  const items = q ? VIEWS.filter((v) => v.label.toLowerCase().includes(q)) : VIEWS;
  if (items.length === 0) {
    return <p className="px-3 py-2.5 text-[12.5px] text-slate-400">No sections match “{query.trim()}”.</p>;
  }
  return (
    <ul className="flex items-center gap-0.5">
      {items.map((v) => {
        const disabled = !hasResult && LOCKED_WITHOUT_RESULT.includes(v.key);
        if (disabled) {
          return (
            <li key={v.key} className="shrink-0">
              <span
                className="nav-link inline-block cursor-not-allowed opacity-40"
                aria-disabled="true"
                title="Run an analysis to unlock this section"
              >
                <span className="mr-1.5 font-mono text-[10px] text-slate-400">{v.index}</span>
                {v.label}
              </span>
            </li>
          );
        }
        return (
          <li key={v.key} className="shrink-0">
            <a
              href={`#/${v.key}`}
              className="nav-link inline-block"
              aria-current={view === v.key ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(v.key);
              }}
            >
              <span className="mr-1.5 font-mono text-[10px] text-ocean-600">{v.index}</span>
              {v.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export default function Header({ view, onNavigate, hasResult }: Props) {
  const [backend, setBackend] = useState<BackendStatus>("checking");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Real backend health — same /health endpoint the services layer uses.
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const h = await api.getHealth();
        if (alive) setBackend(h && h.status === "ok" ? "connected" : "down");
      } catch {
        if (alive) setBackend("down");
      }
    };
    check();
    const t = window.setInterval(check, 30000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };

  const status = STATUS_META[backend];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="mx-auto max-w-ops px-4 sm:px-6">
        <div className="flex h-14 items-center gap-3">
          {/* Brand — compact, keeps the existing MARINEAI identity */}
          <a
            href="#/overview"
            className="flex shrink-0 items-center gap-2.5"
            aria-label="MARINEAI Freight Intelligence — go to Overview"
            onClick={(e) => {
              e.preventDefault();
              onNavigate("overview");
            }}
          >
            <BrandMark />
            <span className="leading-none">
              <span className="block font-display text-[13px] font-bold tracking-tight text-harbour-950">
                MARINEAI
              </span>
              <span className="mt-1 block font-mono text-[8.5px] tracking-[0.22em] text-ink-soft">
                FREIGHT INTELLIGENCE
              </span>
            </span>
          </a>

          {/* Center navigation — existing routes, numbered style, scrolls on overflow */}
          <nav aria-label="Primary" className="hidden min-w-0 flex-1 justify-center md:flex">
            <div className="max-w-full overflow-x-auto">
              <NavList view={view} onNavigate={onNavigate} hasResult={hasResult} query={query} />
            </div>
          </nav>

          {/* Right-side utility controls */}
          <div className="ml-auto flex shrink-0 items-center gap-0.5 md:ml-0">
            <button
              type="button"
              className="header-icon-btn"
              aria-label={searchOpen ? "Close section search" : "Search sections"}
              aria-expanded={searchOpen}
              title="Search sections"
              onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            >
              <SearchIcon />
            </button>
            <button
              type="button"
              className="header-icon-btn"
              aria-label="Go to Alerts"
              title="Alerts"
              onClick={() => onNavigate("alerts")}
            >
              <BellIcon />
            </button>
            <span
              className="ml-1 hidden items-center gap-1.5 border-l border-line pl-3 sm:inline-flex"
              title={status.title}
              role="status"
            >
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden />
              <span className="whitespace-nowrap text-[11px] font-semibold text-harbour-900">
                {status.label}
              </span>
            </span>
            <span
              className="ml-2 grid h-7 w-7 place-items-center rounded-full bg-harbour-900 font-mono text-[10px] font-semibold text-white"
              title="Operations watch"
              aria-label="Signed in as operations watch"
            >
              OP
            </span>
          </div>
        </div>

        {/* Mobile navigation row — same header container, scrollable, no overflow */}
        <nav aria-label="Primary mobile" className="border-t border-line/60 md:hidden">
          <div className="overflow-x-auto py-0.5">
            <NavList view={view} onNavigate={onNavigate} hasResult={hasResult} query={query} />
          </div>
        </nav>

        {/* Expanding section search — filters the real nav items above */}
        {searchOpen && (
          <div className="border-t border-line/60 py-2">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeSearch();
              }}
              placeholder="Filter sections… (Esc to close)"
              aria-label="Filter navigation sections"
              className="header-search-input"
            />
          </div>
        )}
      </div>
    </header>
  );
}
