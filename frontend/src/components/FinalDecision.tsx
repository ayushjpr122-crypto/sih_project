import type { DecisionResponse } from "../types";
import { EmptyState } from "./ui";

function prettyTiming(t?: string) {
  return t === "BUY_NOW" ? "BUY NOW" : t === "WAIT" ? "WAIT" : t ? "WATCH" : "—";
}

export default function FinalDecision({
  result,
  onGoScenario,
}: {
  result: DecisionResponse | null;
  onGoScenario: () => void;
}) {
  if (!result) {
    return (
      <EmptyState
        title="Configure a scenario to begin the analysis."
        actionLabel="Go to Scenario"
        onAction={onGoScenario}
      />
    );
  }
  return (
    <section
      className="overflow-hidden rounded-[2px] bg-harbour-950 text-white shadow-final rise"
      aria-labelledby="charter-recommendation-heading"
    >
      <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-white/10">
        <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#D8CFB8]">
          Final decision · decision support
        </p>
        <h2 id="charter-recommendation-heading" className="font-display text-[13px] font-bold tracking-[0.14em] uppercase">
          Charter Recommendation
        </h2>
      </div>
      <div className="px-5 sm:px-6 py-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
          {[
            { k: "Recommended Vessel", v: result.recommended_vessel ?? "No feasible vessel" },
            { k: "Charter Timing", v: prettyTiming(result.charter_timing) },
            { k: "Risk Level", v: result.risk ?? "—" },
            { k: "Freight Trend", v: result.forecast_trend ?? "—" },
            {
              k: "30-day rate",
              v: result.forecast?.h30_usd_per_ton !== undefined ? `$${Number(result.forecast.h30_usd_per_ton).toFixed(2)}/t` : "—",
            },
          ].map((s) => (
            <div key={s.k}>
              <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#C9D8E2]">{s.k}</dt>
              <dd className="mt-0.5 font-display text-[15px] font-bold leading-snug">{s.v}</dd>
            </div>
          ))}
        </dl>
        {result.recommendation && (
          <blockquote className="mt-5 rounded-[2px] border-l-4 border-[#2A6E8C] bg-white/[0.06] px-4 py-3 text-[13.5px] leading-relaxed text-slate-100">
            {result.recommendation}
          </blockquote>
        )}
        <p className="mt-4 text-[11.5px] leading-relaxed text-slate-400">
          Decision support only — validate against firm freight, vessel, port and voyage data before commercial use.
        </p>
      </div>
    </section>
  );
}
