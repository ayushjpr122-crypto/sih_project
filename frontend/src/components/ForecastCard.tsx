import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DecisionResponse } from "../types";
import { Analyzing, EmptyState } from "./ui";

const TREND_STYLE: Record<string, string> = {
  RISING: "bg-red-50 text-red-700 border-red-200",
  FALLING: "bg-emerald-50 text-emerald-700 border-emerald-200",
  STABLE: "bg-[#EEF1F3] text-[#2A6E8C] border-[#C9D8E2]",
  UNKNOWN: "bg-slate-100 text-slate-600 border-slate-200",
};

function fmt(v: number | null | undefined, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `$${v.toFixed(digits)}`;
}

export default function ForecastCard({
  result,
  loading,
  onGoScenario,
  compact = false,
  highlightHorizon,
}: {
  result: DecisionResponse | null;
  loading: boolean;
  onGoScenario: () => void;
  compact?: boolean;
  highlightHorizon?: number;
}) {
  if (loading) {
    return <Analyzing label="Analyzing scenario…" />;
  }

  if (!result?.forecast) {
    return (
      <EmptyState
        title="Configure a scenario to begin the analysis."
        actionLabel="Go to Scenario"
        onAction={onGoScenario}
      />
    );
  }

  const current = result.current_freight_usd_per_ton ?? null;
  const f = result.forecast;
  const trend = result.forecast_trend ?? "UNKNOWN";
  const models = f.models ?? {};
  const unc = result.forecast_uncertainty_proxy?.rolling_std_7_usd_per_ton;
  const ctx = result.market_context;
  const history = Array.isArray(ctx?.rate_history) ? ctx.rate_history : [];

  /* Unified chart rows: observed history (solid) then model forecast (dashed).
     The "Now" row carries both legs so the two segments join. Band = ±1σ
     short-term variability proxy around forecast points only — not a
     calibrated confidence interval. */
  interface Row {
    label: string;
    hist?: number | null;
    fc?: number | null;
    bandBase?: number | null;
    bandWidth?: number | null;
    isHorizon?: boolean;
  }
  const rows: Row[] = history.map((p) => ({
    label: p.date.slice(5).replace("-", "/"),
    hist: p.rate,
  }));
  if (rows.length > 0) {
    const lastHist = rows[rows.length - 1].hist ?? current;
    rows[rows.length - 1] = {
      ...rows[rows.length - 1],
      label: "Now",
      hist: lastHist,
      fc: current,
    };
  } else {
    rows.push({ label: "Now", hist: current, fc: current });
  }
  const horizons: { h: number; label: string; v?: number }[] = [
    { h: 7, label: "7D", v: f.h7_usd_per_ton },
    { h: 14, label: "14D", v: f.h14_usd_per_ton },
    { h: 30, label: "30D", v: f.h30_usd_per_ton },
  ];
  for (const { h, label, v } of horizons) {
    if (v === null || v === undefined) continue;
    const band = unc ?? null;
    const lo = band !== null ? Math.max(0, v - band) : null;
    const up = band !== null ? v + band : null;
    rows.push({
      label,
      fc: v,
      bandBase: lo,
      bandWidth: lo !== null && up !== null ? up - lo : null,
      isHorizon: highlightHorizon === h,
    });
  }
  const data = rows;
  const showBand = unc !== null && unc !== undefined;

  const metrics = [
    { k: "Current", h: 0, v: current, sub: result.current_freight_basis ? "route proxy" : "" },
    { k: "7-Day", h: 7, v: f.h7_usd_per_ton, sub: models["7"] ?? "" },
    { k: "14-Day", h: 14, v: f.h14_usd_per_ton, sub: models["14"] ?? "" },
    { k: "30-Day", h: 30, v: f.h30_usd_per_ton, sub: models["30"] ?? "" },
  ];

  return (
    <section className="panel rise" aria-labelledby="freight-forecast-heading">
      <div className="card-head">
        <div>
          <p className="card-kicker">Freight outlook · USD / tonne</p>
          <h2 id="freight-forecast-heading" className="card-title">Freight Forecast</h2>
        </div>
        <span className={`pill border ${TREND_STYLE[trend] ?? TREND_STYLE.UNKNOWN}`}>
          {trend === "RISING" ? "▲" : trend === "FALLING" ? "▼" : trend === "STABLE" ? "●" : "?"} {trend}
        </span>
      </div>
      <div className="px-5 sm:px-6 py-5">
        {/* Metric strip: dividers, not nested cards */}
        <dl className="grid grid-cols-2 gap-y-4 sm:grid-cols-4">
          {metrics.map((s, i) => {
            const active = highlightHorizon !== undefined && s.h === highlightHorizon;
            return (
              <div
                key={s.k}
                aria-current={active ? "true" : undefined}
                className={`${i > 0 ? "sm:border-l sm:border-slate-200 sm:pl-4" : ""}${active ? " rounded-[2px] bg-ocean-50/70 px-2 -mx-2 py-1" : ""}`}
              >
                <dt className="metric-label">{s.k}{active ? " · selected" : ""}</dt>
                <dd className="metric-value">{fmt(s.v ?? null)}</dd>
                {s.sub ? (
                  <dd className="truncate font-mono text-[10px] text-slate-400" title={s.sub}>{s.sub}</dd>
                ) : null}
              </div>
            );
          })}
        </dl>

        <hr className="rule my-4" />

        <div className={compact ? "h-[200px]" : "h-[260px]"}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="#E3DAC3" strokeDasharray="3 5" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#6E6A60", fontFamily: "IBM Plex Mono" }}
                axisLine={{ stroke: "#D8CFB8" }} tickLine={false}
                interval={Math.max(0, Math.ceil(data.length / 9) - 1)}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 11, fill: "#6E6A60", fontFamily: "IBM Plex Mono" }}
                axisLine={false} tickLine={false} width={56}
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              />
              <Tooltip
                formatter={(value, name) => {
                  if (value === null || value === undefined) return ["—", ""];
                  const tag =
                    name === "hist" ? "Observed" : name === "fc" ? "Forecast" : "Band edge";
                  return [`$${Number(value).toFixed(2)}/t`, tag];
                }}
                labelFormatter={(l) => (l === "Now" ? "Current rate" : `${l}`)}
                contentStyle={{ borderRadius: 2, border: "1px solid #E3DAC3", fontSize: 12 }}
              />
              {showBand && (
                <>
                  <Area type="monotone" dataKey="bandBase" stackId="band" stroke="none" fill="none" connectNulls />
                  <Area type="monotone" dataKey="bandWidth" stackId="band" stroke="none" fill="#8F5251" fillOpacity={0.13} connectNulls />
                </>
              )}
              <Line
                type="monotone" dataKey="hist" name="hist" connectNulls
                stroke="#145D7A" strokeWidth={2} dot={false} activeDot={{ r: 4 }}
              />
              <Line
                type="monotone" dataKey="fc" name="fc" connectNulls
                stroke="#8F5251" strokeWidth={2.5} strokeDasharray="7 4"
                dot={{ r: 4, fill: "#8F5251", stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {/* Legend: text + line style, never color-only */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11.5px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke="#145D7A" strokeWidth="2.5" /></svg>
            Observed · last 30 days
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke="#8F5251" strokeWidth="2.5" strokeDasharray="5 3" /></svg>
            Model forecast
          </span>
          {showBand && (
            <span className="inline-flex items-center gap-1.5">
              <svg width="14" height="10" aria-hidden><rect x="0" y="0" width="14" height="10" fill="#8F5251" opacity="0.18" /></svg>
              ± variability band (proxy)
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-slate-500">
          <span>Trend: <strong className="text-harbour-900">{trend}</strong></span>
          {unc !== null && unc !== undefined && (
            <span className="font-mono">± ${unc.toFixed(2)}/t short-term variability</span>
          )}
          {ctx?.rate_history_basis ? (
            <span className="text-slate-400">History: {ctx.rate_history_basis}.</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
