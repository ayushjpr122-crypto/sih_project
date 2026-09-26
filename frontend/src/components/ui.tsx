import type { ReactNode } from "react";
import type { ViewKey } from "../nav";
import { LOCKED_WITHOUT_RESULT, VIEWS } from "../nav";

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
        className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#F5F1E8] text-[#2A6E8C]"
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
  const order: ViewKey[] = ["overview", "forecast", "optimizer", "route", "vessels", "ports", "simulator", "alerts"];
  const idx = order.indexOf(view);
  const prev = idx > 0 ? order[idx - 1] : null;
  const next = idx < order.length - 1 ? order[idx + 1] : null;
  const label = (k: ViewKey) => VIEWS.find((v) => v.key === k)?.label ?? k;
  const nextLocked = next !== null && !hasResult && (LOCKED_WITHOUT_RESULT as string[]).includes(next);

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

/** Status indicator: dot plus text label (never color-only). */
export function StatusIndicator({
  tone,
  label,
}: {
  tone: "ok" | "warn" | "bad" | "info" | "muted";
  label: string;
}) {
  const color =
    tone === "ok"
      ? "bg-emerald-500"
      : tone === "warn"
        ? "bg-amber-500"
        : tone === "bad"
          ? "bg-[#8F5251]"
          : tone === "info"
            ? "bg-ocean-700"
            : "bg-slate-300";
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700">
      <span className={`status-dot ${color}`} aria-hidden />
      {label}
    </span>
  );
}

/** Metric strip: divided key-values, not nested cards. */
export function MetricStrip({ items }: { items: { k: string; v: string; sub?: string }[] }) {
  return (
    <section className="panel" aria-label="Key metrics">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 sm:px-6 py-5 sm:grid-cols-4">
        {items.map((s) => (
          <div key={s.k}>
            <dt className="metric-label">{s.k}</dt>
            <dd className="mt-0.5 font-display text-[15px] font-bold text-harbour-950">{s.v}</dd>
            {s.sub ? <dd className="text-[11.5px] text-slate-500">{s.sub}</dd> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Section heading for dense operational pages. */
export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 className="font-display text-lg font-bold tracking-tight text-harbour-950">{title}</h3>
        {description ? <p className="mt-0.5 max-w-2xl text-[13px] text-slate-600">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
