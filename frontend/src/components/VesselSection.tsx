import type { DecisionResponse, FeasibleVessel, InfeasibleVessel } from "../types";

function pct(u: number | null | undefined) {
  if (u === null || u === undefined) return "—";
  return `${(u * 100).toFixed(1)}%`;
}
function money(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function VesselBar({ utilization, feasible }: { utilization?: number | null; feasible: boolean }) {
  const w = utilization === null || utilization === undefined ? 0 : Math.min(100, utilization * 100);
  const color = !feasible ? "bg-slate-300" : utilization !== null && utilization !== undefined && utilization > 0.98 ? "bg-amber-500" : "bg-ocean-600";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

export default function VesselSection({ result, loading }: { result: DecisionResponse | null; loading: boolean }) {
  if (loading) {
    return (
      <section className="card" aria-busy="true">
        <div className="card-head">
          <div><div className="card-kicker">03 · Fleet Feasibility</div><h2 className="card-title">Vessel Optimization</h2></div>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[132px] rounded-xl" />)}
        </div>
      </section>
    );
  }

  const feasible: FeasibleVessel[] = result?.feasible_vessels ?? [];
  const infeasible: InfeasibleVessel[] = result?.infeasible_vessels ?? [];
  const recommended = result?.recommended_vessel ?? null;

  if (!result || (feasible.length === 0 && infeasible.length === 0)) {
    return (
      <section className="card">
        <div className="card-head">
          <div><div className="card-kicker">03 · Fleet Feasibility</div><h2 className="card-title">Vessel Optimization</h2></div>
        </div>
        <div className="p-5">
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Vessel feasibility (Handysize · Supramax · Panamax · Capesize) will appear here after analysis.
          </div>
        </div>
      </section>
    );
  }

  const orderedFeasible = [...feasible].sort((a, b) =>
    a.vessel_class === recommended ? -1 : b.vessel_class === recommended ? 1 : (b.composite_score ?? -1) - (a.composite_score ?? -1)
  );

  return (
    <section className="card rise rise-1">
      <div className="card-head">
        <div>
          <div className="card-kicker">03 · Fleet Feasibility · hard constraints first</div>
          <h2 className="card-title">Vessel Optimization</h2>
        </div>
        {recommended && (
          <span className="pill bg-harbour-900 text-white">★ Recommended: {recommended}</span>
        )}
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        {orderedFeasible.map((v) => {
          const isRec = v.vessel_class === recommended;
          return (
            <article key={v.vessel_class}
              className={`rounded-xl border p-4 transition ${isRec ? "border-harbour-900 bg-harbour-950 text-white shadow-final" : "border-slate-200 bg-white"}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className={`font-display text-base font-bold ${isRec ? "text-white" : "text-harbour-950"}`}>
                  {isRec && <span className="mr-1.5 text-amber-300">★</span>}{v.vessel_class}
                </h3>
                <span className={`pill border ${isRec ? "bg-emerald-400/15 text-emerald-200 border-emerald-300/30" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                  Feasible
                </span>
              </div>
              <div className="mt-2">
                <div className={`flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] ${isRec ? "text-slate-300" : "text-slate-500"}`}>
                  <span>Utilization</span><span>{pct(v.utilization)}</span>
                </div>
                <div className="mt-1"><VesselBar utilization={v.utilization} feasible /></div>
              </div>
              <dl className={`mt-3 grid grid-cols-3 gap-2 text-center ${isRec ? "text-white" : ""}`}>
                <div className={`rounded-lg px-1 py-1.5 ${isRec ? "bg-white/10" : "bg-slate-50"}`}>
                  <dt className={`font-mono text-[9px] uppercase tracking-[0.12em] ${isRec ? "text-slate-300" : "text-slate-500"}`}>Est. cost</dt>
                  <dd className="font-display text-[13px] font-bold">{money(v.total_cost_usd)}</dd>
                </div>
                <div className={`rounded-lg px-1 py-1.5 ${isRec ? "bg-white/10" : "bg-slate-50"}`}>
                  <dt className={`font-mono text-[9px] uppercase tracking-[0.12em] ${isRec ? "text-slate-300" : "text-slate-500"}`}>$/t proxy</dt>
                  <dd className="font-display text-[13px] font-bold">{v.cost_per_ton_proxy !== null && v.cost_per_ton_proxy !== undefined ? `$${v.cost_per_ton_proxy.toFixed(2)}` : "—"}</dd>
                </div>
                <div className={`rounded-lg px-1 py-1.5 ${isRec ? "bg-white/10" : "bg-slate-50"}`}>
                  <dt className={`font-mono text-[9px] uppercase tracking-[0.12em] ${isRec ? "text-slate-300" : "text-slate-500"}`}>Score</dt>
                  <dd className="font-display text-[13px] font-bold">{v.composite_score !== null && v.composite_score !== undefined ? v.composite_score.toFixed(2) : "—"}</dd>
                </div>
              </dl>
              {v.explain && (
                <p className={`mt-2 text-[11px] leading-relaxed ${isRec ? "text-slate-300" : "text-slate-500"}`}>{v.explain}</p>
              )}
            </article>
          );
        })}
        {infeasible.map((v) => (
          <article key={v.vessel_class} className="rounded-xl border border-slate-200 bg-slate-50 p-4 opacity-90">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-slate-500">{v.vessel_class}</h3>
              <span className="pill bg-red-50 text-red-700 border border-red-200">Infeasible</span>
            </div>
            <div className="mt-2"><VesselBar utilization={null} feasible={false} /></div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-slate-600">
              <span className="font-semibold text-red-700">Why not: </span>{v.reason ?? "Failed hard-constraint check."}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
