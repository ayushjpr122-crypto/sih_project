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
  STABLE: "bg-sky-50 text-sky-800 border-sky-200",
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
}: {
  result: DecisionResponse | null;
  loading: boolean;
  onGoScenario: () => void;
  compact?: boolean;
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
  const data = [
    { label: "Now", value: current },
    { label: "7D", value: f.h7_usd_per_ton ?? null },
    { label: "14D", value: f.h14_usd_per_ton ?? null },
    { label: "30D", value: f.h30_usd_per_ton ?? null },
  ].filter((d): d is { label: string; value: number } => d.value !== null && d.value !== undefined);

  const trend = result.forecast_trend ?? "UNKNOWN";
  const models = f.models ?? {};
  const unc = result.forecast_uncertainty_proxy?.rolling_std_7_usd_per_ton;

  const metrics = [
    { k: "Current", v: current, sub: result.current_freight_basis ? "route proxy" : "" },
    { k: "7-Day", v: f.h7_usd_per_ton, sub: models["7"] ?? "" },
    { k: "14-Day", v: f.h14_usd_per_ton, sub: models["14"] ?? "" },
    { k: "30-Day", v: f.h30_usd_per_ton, sub: models["30"] ?? "" },
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
          {metrics.map((s, i) => (
            <div
              key={s.k}
              className={i > 0 ? "sm:border-l sm:border-slate-200 sm:pl-4" : ""}
            >
              <dt className="metric-label">{s.k}</dt>
              <dd className="metric-value">{fmt(s.v ?? null)}</dd>
              {s.sub ? (
                <dd className="truncate font-mono text-[10px] text-slate-400" title={s.sub}>{s.sub}</dd>
              ) : null}
            </div>
          ))}
        </dl>

        <hr className="rule my-4" />

        <div className={compact ? "h-[200px]" : "h-[260px]"}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="freightFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0E7C8C" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#0E7C8C" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B", fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: "#CBD5E1" }} tickLine={false} />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 11, fill: "#64748B", fontFamily: "IBM Plex Mono" }}
                axisLine={false} tickLine={false} width={56}
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              />
              <Tooltip
                formatter={(value) => [`$${Number(value).toFixed(2)}/t`, "Freight"]}
                labelFormatter={(l) => (l === "Now" ? "Current rate" : `${l} forecast`)}
                contentStyle={{ borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 12 }}
              />
              <Area type="monotone" dataKey="value" stroke="none" fill="url(#freightFill)" />
              <Line type="monotone" dataKey="value" stroke="#0B1F3A" strokeWidth={2.5} dot={{ r: 4, fill: "#0E7C8C", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-slate-500">
          <span>Trend: <strong className="text-harbour-900">{trend}</strong></span>
          {unc !== null && unc !== undefined && (
            <span className="font-mono">± ${unc.toFixed(2)}/t short-term variability</span>
          )}
        </div>
      </div>
    </section>
  );
}
