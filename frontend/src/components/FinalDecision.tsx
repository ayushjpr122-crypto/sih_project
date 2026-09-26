import type { DecisionResponse } from "../types";

function prettyTiming(t?: string) {
  return t === "BUY_NOW" ? "BUY NOW" : t === "WAIT" ? "WAIT" : t ? "WATCH" : "—";
}

export default function FinalDecision({ result, loading }: { result: DecisionResponse | null; loading: boolean }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-harbour-950 text-white shadow-final rise rise-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 sm:px-6 pt-4 pb-3">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-sky-300">08 · Final Decision · model-generated decision support</div>
          <h2 className="font-display text-[13px] font-bold tracking-[0.14em] uppercase">Charter Recommendation</h2>
        </div>
        <span className="pill bg-amber-400/15 text-amber-200 border border-amber-300/30">Prototype data</span>
      </div>
      {loading ? (
        <div className="px-5 sm:px-6 py-6">
          <div className="flex items-center gap-3 text-sm text-slate-200">
            <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Running freight forecast and vessel feasibility analysis…
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[64px] rounded-xl bg-white/10" />)}
          </div>
        </div>
      ) : !result ? (
        <p className="px-5 sm:px-6 py-8 text-center text-sm text-slate-300">
          The final charter decision — vessel, timing, risk, trend and key reason — will be composed here from the live backend response.
        </p>
      ) : (
        <div className="px-5 sm:px-6 py-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { k: "Recommended vessel", v: result.recommended_vessel ?? "No feasible vessel" },
              { k: "Charter timing", v: prettyTiming(result.charter_timing) },
              { k: "Risk level", v: result.risk ?? "—" },
              { k: "Freight trend", v: result.forecast_trend ?? "—" },
              {
                k: "30-day rate",
                v: result.forecast?.h30_usd_per_ton !== undefined ? `$${Number(result.forecast.h30_usd_per_ton).toFixed(2)}/t` : "—",
              },
            ].map((s) => (
              <div key={s.k} className="rounded-xl bg-white/[0.07] ring-1 ring-white/10 px-3 py-2.5">
                <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-sky-200/80">{s.k}</div>
                <div className="font-display text-[15px] font-bold leading-snug">{s.v}</div>
              </div>
            ))}
          </div>
          {result.recommendation && (
            <blockquote className="mt-4 rounded-xl border-l-4 border-sky-400 bg-white/[0.06] px-4 py-3 text-[13px] leading-relaxed text-slate-100">
              {result.recommendation}
            </blockquote>
          )}
          <p className="mt-3 font-mono text-[10px] leading-relaxed text-slate-400">
            {result.scenario_summary ?? ""} · Model-generated decision support — validate against firm freight, vessel, port and voyage data before commercial use.
          </p>
        </div>
      )}
    </section>
  );
}
