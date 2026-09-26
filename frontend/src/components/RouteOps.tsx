import type { DecisionResponse, PortInfo } from "../types";

/** Small schematic "Route Overview" — NOT live AIS / vessel tracking. */
export function RouteCard({
  result, ports, portsNote, loading,
}: { result: DecisionResponse | null; ports: PortInfo[]; portsNote?: string; loading: boolean }) {
  const destName = result?.normalized?.destination ?? result ? (result?.normalized?.destination as string | undefined) : undefined;
  const port: PortInfo | undefined = ports.find((p) => p.port_name === destName);
  const origin = result?.normalized?.origin ?? "—";
  const dest = destName ?? "—";

  return (
    <section className="card rise rise-3">
      <div className="card-head">
        <div><div className="card-kicker">06 · Port &amp; Route · schematic only</div><h2 className="card-title">Route Overview</h2></div>
        <span className="pill bg-slate-100 text-slate-600 border border-slate-200">Not live AIS</span>
      </div>
      <div className="p-5">
        {loading ? (
          <div className="skeleton h-[190px] rounded-xl" />
        ) : (
          <>
            <svg viewBox="0 0 400 150" className="w-full rounded-xl border border-slate-200 bg-gradient-to-b from-ocean-50 to-white" role="img" aria-label={`Schematic route from ${origin} to ${dest}`}>
              {/* stylised sea lanes */}
              {[30, 55, 80, 105].map((y) => (
                <path key={y} d={`M0 ${y} Q 100 ${y - 8} 200 ${y} T 400 ${y}`} stroke="#BFD9E8" strokeWidth="1" fill="none" strokeDasharray="2 5" opacity="0.8" />
              ))}
              {/* route arc */}
              <path d="M52 108 Q 200 10 348 96" stroke="#0B1F3A" strokeWidth="2.5" fill="none" className="route-dash" />
              {/* origin */}
              <circle cx="52" cy="108" r="9" fill="#0E7C8C" />
              <circle cx="52" cy="108" r="4" fill="#fff" />
              <text x="52" y="130" textAnchor="middle" fontSize="10" fill="#0B1F3A" fontWeight="700" fontFamily="Space Grotesk">{String(origin).split("_")[0]}</text>
              {/* destination */}
              <circle cx="348" cy="96" r="9" fill="#0B1F3A" />
              <path d="M344 96h8M348 92v8" stroke="#fff" strokeWidth="2" />
              <text x="348" y="118" textAnchor="middle" fontSize="10" fill="#0B1F3A" fontWeight="700" fontFamily="Space Grotesk">{dest}</text>
              {/* ship glyph mid-route */}
              <g transform="translate(200,52)">
                <rect x="-14" y="-6" width="28" height="10" rx="3" fill="#0B1F3A" />
                <rect x="-4" y="-12" width="8" height="7" rx="1" fill="#0B1F3A" />
              </g>
              <text x="200" y="24" textAnchor="middle" fontSize="9" fill="#0E7C8C" fontFamily="IBM Plex Mono" letterSpacing="2">BULK CARRIER · SCHEMATIC</text>
            </svg>
            <p className="mt-2 text-center font-mono text-[11px] text-slate-600">
              {result ? <><strong className="text-harbour-900">{String(origin).replace(/_/g, " ")}</strong> → <strong className="text-harbour-900">{dest}</strong></> : "Origin → Destination"}
            </p>
            {port ? (
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  { k: "Max draft", v: port.max_draft_m !== undefined ? `${port.max_draft_m} m` : "—" },
                  { k: "Max LOA", v: port.max_loa_m !== undefined ? `${port.max_loa_m} m` : "—" },
                  { k: "Max beam", v: port.max_beam_m !== undefined ? `${port.max_beam_m} m` : "—" },
                ].map((s) => (
                  <div key={s.k} className="rounded-lg bg-slate-50 border border-slate-100 px-1 py-2">
                    <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">{s.k}</dt>
                    <dd className="font-display text-sm font-bold text-harbour-950">{s.v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 text-[11.5px] text-slate-500">
                {result ? "Port constraint record not found for this destination." : "Destination port draft / LOA / beam limits will appear here after analysis."}
              </p>
            )}
            {portsNote && <p className="mt-2 text-[10px] leading-relaxed text-slate-400">{portsNote}</p>}
          </>
        )}
      </div>
    </section>
  );
}

export function OpsCard({ result, loading }: { result: DecisionResponse | null; loading: boolean }) {
  const explain = result?.recommended_detail?.explain;
  return (
    <section className="card rise rise-3">
      <div className="card-head">
        <div><div className="card-kicker">07 · Operations</div><h2 className="card-title">Operational Insight</h2></div>
        {result?.idle_utilization !== null && result?.idle_utilization !== undefined && (
          <span className="pill bg-ocean-50 text-ocean-700 border border-ocean-100">
            Util. {(result.idle_utilization * 100).toFixed(0)}%
          </span>
        )}
      </div>
      <div className="p-5">
        {loading ? (
          <div className="space-y-2">
            <div className="skeleton h-[52px] rounded-xl" />
            <div className="skeleton h-[52px] rounded-xl" />
          </div>
        ) : !result ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Utilization, vessel constraints and idle insight will appear here after analysis — only from backend fields.
          </div>
        ) : (
          <ul className="space-y-2.5 text-[12.5px] leading-relaxed">
            {result.idle_insight && (
              <li className="rounded-xl border border-ocean-100 bg-ocean-50 px-3.5 py-2.5 text-harbour-900">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ocean-600 block mb-0.5">Idle / utilization insight</span>
                {result.idle_insight}
              </li>
            )}
            {explain && (
              <li className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-700">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500 block mb-0.5">Ranking explanation</span>
                {explain}
              </li>
            )}
            {result.charter_timing_reason && (
              <li className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-700">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500 block mb-0.5">Timing basis</span>
                {result.charter_timing_reason}
              </li>
            )}
            {!result.idle_insight && !explain && (
              <li className="text-slate-500">No operational fields returned for this scenario.</li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
