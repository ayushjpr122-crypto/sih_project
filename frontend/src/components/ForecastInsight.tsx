import type { ViewKey } from "../nav";
import type { DecisionResponse } from "../types";
import { StatusIndicator } from "./ui";

function fmtRate(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `$${v.toFixed(2)}/t`;
}

function retPct(current: number | null | undefined, f: number | null | undefined) {
  if (current === null || current === undefined || !f || current <= 0) return null;
  return ((f - current) / current) * 100;
}

function datePlus(days: number) {
  const d = new Date(Date.now() + Math.max(0, days) * 86400000);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/* ------------------------- HORIZON SELECTOR ------------------------- */

export function HorizonTabs({
  result,
  value,
  onChange,
}: {
  result: DecisionResponse | null;
  value: number;
  onChange: (h: number) => void;
}) {
  const current = result?.current_freight_usd_per_ton ?? null;
  const f = result?.forecast;
  const tabs = [
    { h: 7, v: f?.h7_usd_per_ton },
    { h: 14, v: f?.h14_usd_per_ton },
    { h: 30, v: f?.h30_usd_per_ton },
  ];
  return (
    <div
      className="panel px-5 sm:px-6 py-4"
      role="group"
      aria-label="Forecast horizon selector"
    >
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => {
          const active = value === t.h;
          const r = retPct(current, t.v);
          return (
            <button
              key={t.h}
              type="button"
              onClick={() => onChange(t.h)}
              aria-pressed={active}
              className={`rounded-[2px] border px-4 py-2 text-left transition ${
                active
                  ? "border-ocean-700 bg-ocean-700 text-white"
                  : "border-line bg-white text-harbour-900 hover:border-ocean-700/50"
              }`}
            >
              <span className={`block font-mono text-[10px] tracking-[0.14em] ${active ? "text-[#C9D8E2]" : "text-slate-400"}`}>
                HORIZON
              </span>
              <span className="block font-display text-[15px] font-bold">
                {t.h} days · {fmtRate(t.v)}
              </span>
              <span className={`block font-mono text-[11px] ${active ? "text-white/85" : "text-slate-500"}`}>
                {r === null ? "— vs current" : `${r > 0 ? "+" : ""}${r.toFixed(1)}% vs current`}
              </span>
            </button>
          );
        })}
        <p className="ml-1 max-w-[260px] text-[11.5px] leading-relaxed text-slate-500">
          Switching horizon re-highlights the outlook below and keeps the
          scenario form in sync. It does not re-run the model.
        </p>
      </div>
    </div>
  );
}

/* --------------------- RECOMMENDED CHARTER WINDOW -------------------- */

/** Compact window text shared with the decision summary (single source). */
export function charterWindowHint(result: DecisionResponse | null): string | null {
  if (!result?.forecast) return null;
  const timing = result.charter_timing ?? "WATCH";
  const trend = result.forecast_trend ?? "UNKNOWN";
  const cands = [result.forecast.h7_usd_per_ton, result.forecast.h14_usd_per_ton, result.forecast.h30_usd_per_ton]
    .filter((v): v is number => v !== null && v !== undefined);
  if (cands.length === 0) return null;
  const cheapest = Math.min(...cands);
  const h = [7, 14, 30][cands.indexOf(cheapest)];
  if (timing === "BUY_NOW") return `Charter now · ${datePlus(0)} → ${datePlus(7)}`;
  if (timing === "WAIT")
    return `Defer toward ${datePlus(h)} · ${datePlus(Math.max(0, h - 3))} → ${datePlus(h + 3)}`;
  if (trend === "RISING") return `Charter early · ${datePlus(0)} → ${datePlus(14)}`;
  if (trend === "FALLING")
    return `Defer toward ${datePlus(h)} · ${datePlus(Math.max(0, h - 3))} → ${datePlus(h + 3)}`;
  return `Flexible · ${datePlus(0)} → ${datePlus(30)}`;
}

export function CharterWindowCard({ result }: { result: DecisionResponse | null }) {
  if (!result?.forecast) return null;
  const current = result.current_freight_usd_per_ton ?? null;
  const f = result.forecast;
  const timing = result.charter_timing ?? "WATCH";
  const trend = result.forecast_trend ?? "UNKNOWN";

  const cands = [
    { h: 7, v: f.h7_usd_per_ton },
    { h: 14, v: f.h14_usd_per_ton },
    { h: 30, v: f.h30_usd_per_ton },
  ].filter((c): c is { h: number; v: number } => c.v !== null && c.v !== undefined);
  if (cands.length === 0) return null;
  const cheapest = cands.reduce((a, b) => (b.v < a.v ? b : a));

  let windowLabel: string;
  let windowDates: string;
  let reason: string;
  /* Timing signal leads; trend only breaks WATCH ties. */
  if (timing === "BUY_NOW") {
    windowLabel = "Charter now";
    windowDates = `${datePlus(0)} → ${datePlus(7)} · next 0–7 days`;
    const r = retPct(current, cheapest.v);
    reason =
      `Rates are modelled to rise (trend ${trend}, signal ${timing}). ` +
      `Fixing within the next 7 days avoids the projected increase` +
      (r !== null && r > 0 ? ` of ${r.toFixed(1)}%` : "") +
      ` to ${fmtRate(cheapest.v)} at ${cheapest.h} days.`;
  } else if (timing === "WAIT") {
    windowLabel = "Defer charter";
    const from = Math.max(0, cheapest.h - 3);
    windowDates = `${datePlus(from)} → ${datePlus(cheapest.h + 3)} · around ${datePlus(cheapest.h)}`;
    const saving = current !== null && current > 0 ? ((current - cheapest.v) / current) * 100 : null;
    reason =
      `Rates are modelled to ease (trend ${trend}, signal ${timing}). ` +
      `The lowest projected rate is ${fmtRate(cheapest.v)} at ${cheapest.h} days` +
      (saving !== null && saving > 0 ? `, about ${saving.toFixed(1)}% below current` : "") +
      `. Target fixture dates inside this window.`;
  } else if (trend === "RISING") {
    windowLabel = "Charter early";
    windowDates = `${datePlus(0)} → ${datePlus(14)} · next 0–14 days`;
    reason =
      `The timing signal is neutral (${timing}) but the trend is ${trend}: ` +
      `rates drift upward toward ${fmtRate(cheapest.v)} at ${cheapest.h} days. ` +
      `Prefer the early half of the month.`;
  } else if (trend === "FALLING") {
    windowLabel = "Defer charter";
    const from = Math.max(0, cheapest.h - 3);
    windowDates = `${datePlus(from)} → ${datePlus(cheapest.h + 3)} · around ${datePlus(cheapest.h)}`;
    reason =
      `The timing signal is neutral (${timing}) but the trend is ${trend}: ` +
      `the lowest projected rate is ${fmtRate(cheapest.v)} at ${cheapest.h} days. ` +
      `Target fixture dates inside this window.`;
  } else {
    windowLabel = "Flexible window";
    windowDates = `${datePlus(0)} → ${datePlus(30)} · monitor`;
    reason =
      `The forecast sits within the model's noise band (trend ${trend}, signal ${timing}). ` +
      `No strong timing edge — keep the fixture flexible and watch the ${cheapest.h}-day mark at ${fmtRate(cheapest.v)}.`;
  }

  return (
    <section className="panel rise" aria-labelledby="charter-window-heading">
      <div className="card-head">
        <div>
          <p className="card-kicker">Charter window · derived from forecast</p>
          <h2 id="charter-window-heading" className="card-title">Recommended Charter Window</h2>
        </div>
        <span className="pill border border-ocean-100 bg-ocean-50 text-ocean-700">
          {result.charter_timing === "BUY_NOW" ? "BUY NOW" : timing}
        </span>
      </div>
      <div className="px-5 sm:px-6 py-5">
        <p className="font-display text-xl font-bold tracking-tight text-harbour-950">{windowLabel}</p>
        <p className="mt-0.5 font-mono text-[13px] text-ocean-700">{windowDates}</p>
        <dl className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div>
            <dt className="metric-label">Market signal</dt>
            <dd className="mt-0.5 text-[13px] text-slate-700">
              {result.charter_timing_reason ?? "Model-generated timing signal."}
            </dd>
          </div>
          <div>
            <dt className="metric-label">Reason</dt>
            <dd className="mt-0.5 text-[13px] leading-relaxed text-slate-700">{reason}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[11.5px] text-slate-400">
          Window derived arithmetically from the model's 7/14/30-day forecast points and timing signal —
          not a guaranteed market call.
        </p>
      </div>
    </section>
  );
}

/* ------------------------- VOYAGE + PORT TIME ------------------------ */

function congestionBand(idx: number | null | undefined) {
  if (idx === null || idx === undefined) return { label: "Unknown", tone: "muted" as const, hint: "No congestion reading for this lane." };
  if (idx < 0.35) return { label: "Fluid", tone: "ok" as const, hint: "Index below 0.35 — normal berthing pressure expected." };
  if (idx <= 0.6) return { label: "Building", tone: "warn" as const, hint: "Index 0.35–0.60 — allow buffer for berth queues." };
  return { label: "Congested", tone: "bad" as const, hint: "Index above 0.60 — elevated waiting-time risk." };
}

export function VoyagePortCard({ result }: { result: DecisionResponse | null }) {
  if (!result) return null;
  const ctx = result.market_context;
  const dist = ctx?.route_distance_nm;
  const voyage = ctx?.voyage_duration_days;
  const cong = ctx?.port_congestion_index;
  const band = congestionBand(typeof cong === "number" ? cong : null);
  const hasAny = dist !== undefined || voyage !== undefined || cong !== undefined;
  if (!hasAny) return null;

  return (
    <section className="panel" aria-labelledby="voyage-port-heading">
      <div className="card-head">
        <div>
          <p className="card-kicker">Operations · lane data</p>
          <h2 id="voyage-port-heading" className="card-title">Voyage + Port Time</h2>
        </div>
      </div>
      <div className="px-5 sm:px-6 py-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <div>
            <dt className="metric-label">Route distance</dt>
            <dd className="mt-0.5 font-display text-[15px] font-bold text-harbour-950">
              {dist !== undefined ? `${Number(dist).toLocaleString("en-US")} nm` : "—"}
            </dd>
          </div>
          <div>
            <dt className="metric-label">Lane voyage time</dt>
            <dd className="mt-0.5 font-display text-[15px] font-bold text-harbour-950">
              {voyage !== undefined ? `≈ ${Number(voyage).toFixed(1)} days` : "—"}
            </dd>
            <dd className="text-[11px] text-slate-400">sailing, dataset lane average</dd>
          </div>
          <div>
            <dt className="metric-label">Port congestion</dt>
            <dd className="mt-0.5">
              <StatusIndicator tone={band.tone} label={`${typeof cong === "number" ? cong.toFixed(2) : "—"} · ${band.label}`} />
            </dd>
            <dd className="mt-0.5 text-[11px] text-slate-400">{band.hint}</dd>
          </div>
        </dl>
        <p className="mt-4 border-t border-slate-100 pt-3 text-[11.5px] leading-relaxed text-slate-500">
          Congestion bands (0.35 / 0.60) are display thresholds, not measured
          wait times. Berth-level waiting and demurrage exposure are{" "}
          <strong className="text-harbour-900">not quantified</strong> in this
          prototype — no demurrage rate or allowed laytime data is available.
          Confirm laytime and waiting terms against the charter party and port
          notices before fixing.
        </p>
      </div>
    </section>
  );
}

/* --------------------------- RISK, COMPACT --------------------------- */

export function ForecastRiskStrip({ result }: { result: DecisionResponse | null }) {
  if (!result?.risk) return null;
  const top =
    (result.risk_drivers ?? []).find((d) => d.level === "HIGH") ??
    (result.risk_drivers ?? []).find((d) => d.level === "MEDIUM") ??
    (result.risk_drivers ?? [])[0];
  const tone = result.risk === "HIGH" ? "bad" : result.risk === "MEDIUM" ? "warn" : "ok";
  return (
    <section className="panel" aria-labelledby="forecast-risk-heading">
      <div className="card-head">
        <div>
          <p className="card-kicker">Risk · why it matters here</p>
          <h2 id="forecast-risk-heading" className="card-title">Risk</h2>
        </div>
        <StatusIndicator tone={tone} label={`${result.risk} risk`} />
      </div>
      <div className="px-5 sm:px-6 py-4">
        {top ? (
          <p className="text-[13px] leading-relaxed text-slate-700">
            <strong className="text-harbour-900">{top.driver}</strong>
            <span className="text-slate-500"> · {top.level ?? "—"}</span>
            {top.explain ? <span className="block text-slate-500">{top.explain}</span> : null}
          </p>
        ) : (
          <p className="text-[13px] text-slate-500">No discrete risk drivers returned for this scenario.</p>
        )}
        <p className="mt-2 text-[11.5px] text-slate-400">
          Full driver breakdown lives under Alerts — scoring comes from the risk model, not this page.
        </p>
      </div>
    </section>
  );
}

/* ------------------------- DECISION SUMMARY -------------------------- */

export function ForecastSummaryCard({
  result,
  windowHint,
  onNavigate,
}: {
  result: DecisionResponse | null;
  windowHint: string | null;
  onNavigate: (v: ViewKey) => void;
}) {
  if (!result) return null;
  const ctx = result.market_context;
  const cong = typeof ctx?.port_congestion_index === "number" ? ctx.port_congestion_index : null;
  const rows: { k: string; v: string }[] = [
    { k: "Market trend", v: `${result.forecast_trend ?? "—"} · 30-day ${fmtRate(result.forecast?.h30_usd_per_ton)}` },
    { k: "Recommended charter window", v: windowHint ?? "—" },
    {
      k: "Expected voyage time",
      v: ctx?.voyage_duration_days !== undefined ? `≈ ${Number(ctx.voyage_duration_days).toFixed(1)} days sailing` : "—",
    },
    { k: "Port delay risk", v: cong === null ? "—" : `${congestionBand(cong).label} (index ${cong.toFixed(2)})` },
    { k: "Demurrage exposure", v: "Not quantified — no rate data" },
    {
      k: "Action",
      v: `${result.charter_timing === "BUY_NOW" ? "BUY NOW" : result.charter_timing ?? "—"}${result.recommended_vessel ? ` · ${result.recommended_vessel}` : ""}`,
    },
  ];
  const links: { label: string; view: ViewKey }[] = [
    { label: "Vessel fit", view: "optimizer" },
    { label: "Port limits", view: "ports" },
    { label: "What-if simulator", view: "simulator" },
    { label: "Alerts", view: "alerts" },
  ];
  return (
    <section className="panel" aria-labelledby="forecast-decision-heading">
      <div className="card-head">
        <div>
          <p className="card-kicker">Forecast decision · summary</p>
          <h2 id="forecast-decision-heading" className="card-title">Decision Summary</h2>
        </div>
      </div>
      <dl className="divide-y divide-slate-100 px-5 sm:px-6">
        {rows.map((r) => (
          <div key={r.k} className="grid gap-0.5 py-2.5 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4">
            <dt className="metric-label sm:pt-0.5">{r.k}</dt>
            <dd className="text-[13px] font-medium text-harbour-950">{r.v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 sm:px-6 py-4">
        {links.map((l) => (
          <button key={l.view} type="button" className="btn-outline" onClick={() => onNavigate(l.view)}>
            {l.label} →
          </button>
        ))}
      </div>
    </section>
  );
}
