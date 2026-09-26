import type { DecisionResponse, FeasibleVessel, InfeasibleVessel } from "../types";
import { Analyzing, EmptyState } from "./ui";

function pct(u: number | null | undefined) {
  if (u === null || u === undefined) return "—";
  return `${(u * 100).toFixed(1)}%`;
}
function money(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function UtilizationBar({ utilization, feasible }: { utilization?: number | null; feasible: boolean }) {
  const w = utilization === null || utilization === undefined ? 0 : Math.min(100, utilization * 100);
  const color = !feasible ? "bg-slate-300" : utilization !== null && utilization !== undefined && utilization > 0.98 ? "bg-amber-500" : "bg-ocean-600";
  return (
    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Utilization ${pct(utilization)}`}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

export default function VesselSection({
  result,
  loading,
  onGoScenario,
}: {
  result: DecisionResponse | null;
  loading: boolean;
  onGoScenario: () => void;
}) {
  if (loading) {
    return <Analyzing label="Analyzing scenario…" />;
  }

  const feasible: FeasibleVessel[] = result?.feasible_vessels ?? [];
  const infeasible: InfeasibleVessel[] = result?.infeasible_vessels ?? [];
  const recommended = result?.recommended_vessel ?? null;
  const recommendedDetail = result?.recommended_detail ?? null;

  if (!result || (feasible.length === 0 && infeasible.length === 0)) {
    return (
      <EmptyState
        title="Configure a scenario to begin the analysis."
        actionLabel="Go to Scenario"
        onAction={onGoScenario}
      />
    );
  }

  const orderedFeasible = [...feasible].sort((a, b) =>
    a.vessel_class === recommended ? -1 : b.vessel_class === recommended ? 1 : (b.composite_score ?? -1) - (a.composite_score ?? -1)
  );

  return (
    <div className="space-y-5 rise">
      {/* Recommended vessel — single highlighted strip */}
      {recommended && (
        <div className="panel border-l-4 border-l-ocean-600 px-5 sm:px-6 py-4">
          <p className="section-kicker">Recommended by the model</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="font-display text-2xl font-bold text-harbour-950">{recommended}</p>
            {recommendedDetail?.utilization !== null && recommendedDetail?.utilization !== undefined && (
              <p className="text-sm text-slate-600">
                {pct(recommendedDetail.utilization)} utilization
                {recommendedDetail.total_cost_usd !== null && recommendedDetail.total_cost_usd !== undefined &&
                  ` · ${money(recommendedDetail.total_cost_usd)} estimated cost`}
              </p>
            )}
          </div>
          {recommendedDetail?.explain && (
            <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-slate-600">{recommendedDetail.explain}</p>
          )}
        </div>
      )}

      {/* Feasible fleet as a table */}
      {orderedFeasible.length > 0 && (
        <section className="panel overflow-hidden" aria-labelledby="vessel-optimization-heading">
          <div className="card-head">
            <div>
              <p className="card-kicker">Feasible fleet · hard constraints first</p>
              <h2 id="vessel-optimization-heading" className="card-title">Vessel Optimization</h2>
            </div>
            <span className="pill bg-emerald-50 text-emerald-700 border border-emerald-200">
              {orderedFeasible.length} feasible
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[640px]">
              <thead>
                <tr>
                  <th scope="col">Vessel class</th>
                  <th scope="col">Status</th>
                  <th scope="col">Utilization</th>
                  <th scope="col" className="text-right">Est. cost</th>
                  <th scope="col" className="text-right">$/t</th>
                  <th scope="col" className="text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {orderedFeasible.map((v) => {
                  const isRec = v.vessel_class === recommended;
                  return (
                    <tr key={v.vessel_class} className={isRec ? "bg-ocean-50/60" : undefined}>
                      <td>
                        <span className="font-display font-bold text-harbour-950">
                          {isRec && <span className="mr-1 text-ocean-600" aria-hidden>★</span>}
                          {v.vessel_class}
                        </span>
                        {isRec && <span className="sr-only">(recommended)</span>}
                      </td>
                      <td>
                        <span className="pill bg-emerald-50 text-emerald-700 border border-emerald-200">Feasible</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <UtilizationBar utilization={v.utilization} feasible />
                          <span className="font-mono text-xs text-slate-600">{pct(v.utilization)}</span>
                        </div>
                      </td>
                      <td className="text-right font-mono text-[13px]">{money(v.total_cost_usd)}</td>
                      <td className="text-right font-mono text-[13px]">
                        {v.cost_per_ton_proxy !== null && v.cost_per_ton_proxy !== undefined ? `$${v.cost_per_ton_proxy.toFixed(2)}` : "—"}
                      </td>
                      <td className="text-right font-mono text-[13px]">
                        {v.composite_score !== null && v.composite_score !== undefined ? v.composite_score.toFixed(2) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {orderedFeasible.some((v) => v.vessel_class !== recommended && v.explain) && (
            <ul className="border-t border-slate-100 px-5 sm:px-6 py-4 space-y-2">
              {orderedFeasible.filter((v) => v.vessel_class !== recommended && v.explain).map((v) => (
                <li key={v.vessel_class} className="text-[12.5px] leading-relaxed text-slate-600">
                  <strong className="text-harbour-900">{v.vessel_class}:</strong> {v.explain}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Infeasible vessels with reasons */}
      {infeasible.length > 0 && (
        <section className="panel" aria-label="Infeasible vessels">
          <div className="card-head">
            <div>
              <p className="card-kicker">Failed constraint checks</p>
              <h3 className="card-title">Not feasible</h3>
            </div>
            <span className="pill bg-red-50 text-red-700 border border-red-200">
              {infeasible.length} infeasible
            </span>
          </div>
          <ul className="divide-y divide-slate-100 px-5 sm:px-6">
            {infeasible.map((v) => (
              <li key={v.vessel_class} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display font-bold text-slate-500">{v.vessel_class}</p>
                  <span className="pill bg-slate-100 text-slate-600 border border-slate-200">Infeasible</span>
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
                  <span className="font-semibold text-red-700">Why not: </span>
                  {v.reason ?? "Failed hard-constraint check."}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
