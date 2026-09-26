import type { DecisionResponse } from "../types";
import { EmptyState } from "./ui";

function timingStyle(t?: string) {
  switch (t) {
    case "BUY_NOW": return { band: "bg-emerald-600", label: "BUY NOW", hint: "Rates rising — charter now" };
    case "WAIT": return { band: "bg-amber-500", label: "WAIT", hint: "Rates easing — defer charter" };
    default: return { band: "bg-ocean-500", label: "WATCH", hint: "Within noise band — monitor" };
  }
}

function riskStyle(r?: string) {
  switch (r) {
    case "HIGH": return "bg-red-50 text-red-700 border-red-200";
    case "MEDIUM": return "bg-amber-50 text-amber-800 border-amber-200";
    case "LOW": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default: return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

export function TimingCard({
  result,
  onGoScenario,
}: {
  result: DecisionResponse | null;
  onGoScenario: () => void;
}) {
  if (!result?.charter_timing) {
    return (
      <EmptyState
        title="Configure a scenario to begin the analysis."
        actionLabel="Go to Scenario"
        onAction={onGoScenario}
      />
    );
  }
  const t = timingStyle(result.charter_timing);
  return (
    <section className="panel" aria-labelledby="timing-signal-heading">
      <div className="card-head">
        <div>
          <p className="card-kicker">Charter timing</p>
          <h2 id="timing-signal-heading" className="card-title">Timing Signal</h2>
        </div>
      </div>
      <div className="px-5 sm:px-6 py-5">
        <div className="flex items-center gap-4">
          <span className={`h-14 w-1.5 shrink-0 rounded-full ${t.band}`} aria-hidden />
          <div>
            <p className="font-display text-3xl font-bold tracking-tight text-harbour-950">{t.label}</p>
            <p className="mt-0.5 text-[13px] text-slate-600">{t.hint}</p>
          </div>
          {result.charter_timing_return_pct !== null && result.charter_timing_return_pct !== undefined && (
            <p className="ml-auto font-mono text-sm font-semibold text-harbour-900">
              {result.charter_timing_return_pct > 0 ? "+" : ""}{result.charter_timing_return_pct.toFixed(1)}%
              <span className="block text-[10px] font-normal text-slate-500">vs current</span>
            </p>
          )}
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-slate-500">
          Model-generated timing signal. {result.charter_timing_reason ?? ""} Not a guaranteed
          financial recommendation.
        </p>
      </div>
    </section>
  );
}

export function RiskCard({
  result,
  onGoScenario,
}: {
  result: DecisionResponse | null;
  onGoScenario: () => void;
}) {
  if (!result?.risk) {
    return (
      <EmptyState
        title="Configure a scenario to begin the analysis."
        actionLabel="Go to Scenario"
        onAction={onGoScenario}
      />
    );
  }
  return (
    <section className="panel" aria-labelledby="risk-heading">
      <div className="card-head">
        <div>
          <p className="card-kicker">Risk intelligence</p>
          <h2 id="risk-heading" className="card-title">Risk</h2>
        </div>
        <span className={`pill border ${riskStyle(result.risk)}`}>{result.risk} risk</span>
      </div>
      <div className="px-5 sm:px-6 py-5">
        <div className="flex items-center gap-1.5" aria-label={`Risk level ${result.risk}`}>
          {(["LOW", "MEDIUM", "HIGH"] as const).map((lvl) => {
            const order = { LOW: 0, MEDIUM: 1, HIGH: 2 } as Record<string, number>;
            const active = order[result.risk ?? "LOW"] >= order[lvl];
            const color = lvl === "LOW" ? "bg-emerald-500" : lvl === "MEDIUM" ? "bg-amber-500" : "bg-red-500";
            return <div key={lvl} className={`h-2.5 flex-1 rounded-full ${active ? color : "bg-slate-200"}`} title={lvl} />;
          })}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-slate-400">
          <span>Low</span><span>Medium</span><span>High</span>
        </div>
        {result.risk_drivers && result.risk_drivers.length > 0 ? (
          <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
            {result.risk_drivers.map((d) => (
              <li key={d.driver} className="flex items-start gap-2.5 py-2.5 text-[12.5px]">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${d.level === "HIGH" ? "bg-red-500" : d.level === "MEDIUM" ? "bg-amber-500" : "bg-emerald-500"}`}
                  aria-hidden
                />
                <span>
                  <strong className="text-harbour-900">{d.driver}</strong>
                  <span className="text-slate-500"> · {d.level ?? "—"}</span>
                  {d.explain && <span className="block text-slate-500">{d.explain}</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[12.5px] text-slate-500">No discrete risk drivers returned for this scenario.</p>
        )}
      </div>
    </section>
  );
}
