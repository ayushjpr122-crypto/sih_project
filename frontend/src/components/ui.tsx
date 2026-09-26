import type { ReactNode } from "react";
import type { ViewKey } from "../nav";
import { VIEWS } from "../nav";

/** Page heading block: kicker + title + description. */
export function PageHeader({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <p className="section-kicker">{kicker}</p>
      <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-harbour-950">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p>
    </div>
  );
}

/** User-facing empty state with a single action. */
export function EmptyState({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="panel px-6 py-12 text-center">
      <div
        className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-ocean-50 text-ocean-600"
        aria-hidden
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 3" />
          <path d="M12 7v10M7 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <p className="mt-4 font-display text-base font-bold text-harbour-950">{title}</p>
      <button type="button" className="btn-inline mt-4" onClick={onAction}>
        {actionLabel} →
      </button>
    </div>
  );
}

/** Inline loading state for analysis runs. */
export function Analyzing({ label = "Analyzing scenario…" }: { label?: string }) {
  return (
    <div
      className="panel px-5 py-4"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex items-center gap-3 text-sm font-medium text-harbour-900">
        <svg className="animate-spin shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        {label}
      </div>
      <div className="mt-4 space-y-2" aria-hidden>
        <div className="skeleton h-10 rounded-lg" />
        <div className="skeleton h-24 rounded-lg" />
      </div>
    </div>
  );
}

/** Prev / next pager shown at the bottom of content views. */
export function Pager({
  view,
  onNavigate,
  hasResult,
}: {
  view: ViewKey;
  onNavigate: (v: ViewKey) => void;
  hasResult: boolean;
}) {
  const order: ViewKey[] = ["overview", "scenario", "forecast", "vessels", "route", "decision"];
  const idx = order.indexOf(view);
  const prev = idx > 0 ? order[idx - 1] : null;
  const next = idx < order.length - 1 ? order[idx + 1] : null;
  const label = (k: ViewKey) => VIEWS.find((v) => v.key === k)?.label ?? k;
  const nextLocked = next !== null && !hasResult && next !== "overview" && next !== "scenario";

  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      <div>
        {prev && (
          <button type="button" className="btn-outline" onClick={() => onNavigate(prev)}>
            ← {label(prev)}
          </button>
        )}
      </div>
      <div>
        {next && !nextLocked && (
          <button type="button" className="btn-inline" onClick={() => onNavigate(next)}>
            {label(next)} →
          </button>
        )}
      </div>
    </div>
  );
}

/** Small section wrapper: heading + body, separated by whitespace not nested cards. */
export function Section({
  kicker,
  title,
  action,
  children,
}: {
  kicker?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="card-head">
        <div>
          {kicker && <p className="card-kicker">{kicker}</p>}
          <h3 className="card-title">{title}</h3>
        </div>
        {action}
      </div>
      <div className="px-5 sm:px-6 py-5">{children}</div>
    </section>
  );
}
