import type { DecisionResponse } from "../types";

function timingStyle(t?: string) {
  switch (t) {
    case "BUY_NOW": return { pill: "bg-emerald-500 text-white", ring: "border-emerald-600", label: "BUY NOW", hint: "Rates rising — charter now" };
    case "WAIT": return { pill: "bg-amber-500 text-white", ring: "border-amber-600", label: "WAIT", hint: "Rates easing — defer charter" };
    default: return { pill: "bg-ocean-500 text-white", ring: "border-ocean-600", label: "WATCH", hint: "Within noise band — monitor" };
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

export function TimingCard({ result, loading }: { result: DecisionResponse | null; loading: boolean }) {
  const t = timingStyle(result?.charter_timing);
  return (
    <section className={`card overflow-hidden rise rise-2 ${result ? "" : ""}`}>
      <div className="card-head">
        <div><div className="card-kicker">04 · Charter Timing</div><h2 className="card-title">Timing Signal</h2></div>
      </div>
      <div className="p-5">
        {loading ? (
          <div className="skeleton h-[118px] rounded-xl" />
        ) : !result?.charter_timing ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Timing signal appears after analysis.
          </div>
        ) : (
          <>
            <div className={`rounded-2xl border-2 ${t.ring} p-4 text-center`}>
              <div className={`pill ${t.pill} mx-auto`}>● {t.label}</div>
              <p className="mt-2 text-[12px] text-slate-600">{t.hint}</p>
              {result.charter_timing_return_pct !== null && result.charter_timing_return_pct !== undefined && (
                <p className="mt-1 font-mono text-[12px] font-semibold text-harbour-900">
                  {result.charter_timing_return_pct > 0 ? "+" : ""}{result.charter_timing_return_pct.toFixed(1)}% vs current
                </p>
              )}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-700">Model-generated charter timing signal.</span>{" "}
              {result.charter_timing_reason ?? ""} Not a guaranteed financial recommendation.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

export function RiskCard({ result, loading }: { result: DecisionResponse | null; loading: boolean }) {
  return (
    <section className="card rise rise-2">
      <div className="card-head">
        <div><div className="card-kicker">05 · Risk Intelligence</div><h2 className="card-title">Risk</h2></div>
        {result?.risk && <span className={`pill border ${riskStyle(result.risk)}`}>{result.risk} risk</span>}
      </div>
      <div className="p-5">
        {loading ? (
          <div className="space-y-2">
            <div className="skeleton h-[38px] rounded-xl" />
            <div className="skeleton h-[38px] rounded-xl" />
          </div>
        ) : !result?.risk ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Risk assessment appears after analysis.
          </div>
        ) : (
          <>
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
              <ul className="mt-3 space-y-1.5">
                {result.risk_drivers.map((d) => (
                  <li key={d.driver} className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5 text-[11.5px]">
                    <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${d.level === "HIGH" ? "bg-red-500" : d.level === "MEDIUM" ? "bg-amber-500" : "bg-emerald-500"}`} />
                    <span>
                      <strong className="text-harbour-900">{d.driver}</strong>
                      <span className="text-slate-500"> · {d.level ?? "—"}</span>
                      {d.explain && <span className="block text-slate-500">{d.explain}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[11.5px] text-slate-500">No discrete risk drivers returned by the backend for this scenario.</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
