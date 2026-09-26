import type { DecisionResponse, PortInfo } from "../types";
import { EmptyState } from "./ui";

/** Schematic route overview — illustrative only, not live tracking. */
export function RouteCard({
  result, ports, onGoScenario,
}: { result: DecisionResponse | null; ports: PortInfo[]; onGoScenario: () => void }) {
  if (!result) {
    return (
      <EmptyState
        title="Configure a scenario to begin the analysis."
        actionLabel="Go to Scenario"
        onAction={onGoScenario}
      />
    );
  }
  const destName = result.normalized?.destination as string | undefined;
  const port: PortInfo | undefined = ports.find((p) => p.port_name === destName);
  const origin = (result.normalized?.origin as string | undefined) ?? "—";
  const dest = destName ?? "—";

  const constraints: { k: string; v: string }[] = port
    ? [
        { k: "Max draft", v: port.max_draft_m !== undefined ? `${port.max_draft_m} m` : "—" },
        { k: "Max LOA", v: port.max_loa_m !== undefined ? `${port.max_loa_m} m` : "—" },
        { k: "Max beam", v: port.max_beam_m !== undefined ? `${port.max_beam_m} m` : "—" },
        {
          k: "Handling capacity",
          v: port.cargo_handling_capacity_mtpa !== undefined ? `${port.cargo_handling_capacity_mtpa} MTPA` : "—",
        },
      ]
    : [];

  return (
    <section className="panel rise" aria-labelledby="route-overview-heading">
      <div className="card-head">
        <div>
          <p className="card-kicker">Trade lane · schematic</p>
          <h2 id="route-overview-heading" className="card-title">Route Overview</h2>
        </div>
      </div>
      <div className="px-5 sm:px-6 py-5">
        <svg viewBox="0 0 400 150" className="w-full rounded-lg border border-slate-200 bg-gradient-to-b from-ocean-50 to-white" role="img" aria-label={`Schematic route from ${origin} to ${dest}`}>
          {[30, 55, 80, 105].map((y) => (
            <path key={y} d={`M0 ${y} Q 100 ${y - 8} 200 ${y} T 400 ${y}`} stroke="#BFD9E8" strokeWidth="1" fill="none" strokeDasharray="2 5" opacity="0.8" />
          ))}
          <path d="M52 108 Q 200 10 348 96" stroke="#0B1F3A" strokeWidth="2.5" fill="none" className="route-dash" />
          <circle cx="52" cy="108" r="9" fill="#0E7C8C" />
          <circle cx="52" cy="108" r="4" fill="#fff" />
          <text x="52" y="130" textAnchor="middle" fontSize="10" fill="#0B1F3A" fontWeight="700" fontFamily="Space Grotesk">{String(origin).split("_")[0]}</text>
          <circle cx="348" cy="96" r="9" fill="#0B1F3A" />
          <path d="M344 96h8M348 92v8" stroke="#fff" strokeWidth="2" />
          <text x="348" y="118" textAnchor="middle" fontSize="10" fill="#0B1F3A" fontWeight="700" fontFamily="Space Grotesk">{dest}</text>
          <g transform="translate(200,52)">
            <rect x="-14" y="-6" width="28" height="10" rx="3" fill="#0B1F3A" />
            <rect x="-4" y="-12" width="8" height="7" rx="1" fill="#0B1F3A" />
          </g>
          <text x="200" y="24" textAnchor="middle" fontSize="9" fill="#0E7C8C" fontFamily="IBM Plex Mono" letterSpacing="2">BULK CARRIER · SCHEMATIC</text>
        </svg>
        <p className="mt-2 text-center font-mono text-[11.5px] text-slate-600">
          <strong className="text-harbour-900">{String(origin).replace(/_/g, " ")}</strong> → <strong className="text-harbour-900">{dest}</strong>
        </p>
        <p className="mt-1 text-center text-[11px] text-slate-400">Schematic route — illustrative only.</p>

        <hr className="rule my-4" />

        {port ? (
          <div>
            <h3 className="font-display text-sm font-bold text-harbour-950">
              {port.port_name}
              {port.state ? <span className="ml-2 font-body text-[12px] font-normal text-slate-500">{port.state}</span> : null}
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-4">
              {constraints.map((s) => (
                <div key={s.k}>
                  <dt className="metric-label">{s.k}</dt>
                  <dd className="font-display text-[15px] font-bold text-harbour-950">{s.v}</dd>
                </div>
              ))}
            </dl>
            {port.notes ? (
              <p className="mt-3 text-[12px] leading-relaxed text-slate-500">{port.notes}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-[12.5px] text-slate-500">
            Port constraint record not found for this destination.
          </p>
        )}
      </div>
    </section>
  );
}

export function OpsCard({ result, onGoScenario }: { result: DecisionResponse | null; onGoScenario: () => void }) {
  if (!result) {
    return (
      <EmptyState
        title="Configure a scenario to begin the analysis."
        actionLabel="Go to Scenario"
        onAction={onGoScenario}
      />
    );
  }
  const explain = result.recommended_detail?.explain;
  const rows: { k: string; v: string }[] = [];
  if (result.idle_insight) rows.push({ k: "Idle / utilization insight", v: result.idle_insight });
  if (explain) rows.push({ k: "Ranking explanation", v: explain });
  if (result.charter_timing_reason) rows.push({ k: "Timing basis", v: result.charter_timing_reason });

  return (
    <section className="panel" aria-labelledby="operational-insight-heading">
      <div className="card-head">
        <div>
          <p className="card-kicker">Operations</p>
          <h2 id="operational-insight-heading" className="card-title">Operational Insight</h2>
        </div>
        {result.idle_utilization !== null && result.idle_utilization !== undefined && (
          <span className="pill bg-ocean-50 text-ocean-700 border border-ocean-100">
            Util. {(result.idle_utilization * 100).toFixed(0)}%
          </span>
        )}
      </div>
      {rows.length > 0 ? (
        <dl className="divide-y divide-slate-100 px-5 sm:px-6">
          {rows.map((r) => (
            <div key={r.k} className="py-3.5">
              <dt className="metric-label">{r.k}</dt>
              <dd className="mt-1 text-[13px] leading-relaxed text-slate-700">{r.v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="px-5 sm:px-6 py-5 text-[13px] text-slate-500">
          No operational fields returned for this scenario.
        </p>
      )}
    </section>
  );
}
