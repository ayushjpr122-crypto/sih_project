import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DecisionResponse } from "../types";

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

export default function ForecastCard({ result, loading }: { result: DecisionResponse | null; loading: boolean }) {
  if (loading) {
    return (
      <section className="card" aria-busy="true" aria-label="Loading forecast">
        <div className="card-head">
          <div><div className="card-kicker">02 · Freight Forecast</div><h2 className="card-title">Freight Forecast</h2></div>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-3 rounded-xl bg-ocean-50 border border-ocean-100 px-4 py-3 text-sm text-harbour-900">
            <svg className="animate-spin shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Running freight forecast and vessel feasibility analysis…
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[74px] rounded-xl" />)}
          </div>
          <div className="skeleton mt-3 h-[220px] rounded-xl" />
        </div>
      </section>
    );
  }

  if (!result?.forecast) {
    return (
      <section className="card">
        <div className="card-head">
          <div><div className="card-kicker">02 · Freight Forecast</div><h2 className="card-title">Freight Forecast</h2></div>
        </div>
        <div className="p-5">
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Load the demo scenario, then click <strong className="text-harbour-900">Analyze Scenario</strong> to generate
            the ML freight forecast from the live backend.
          </div>
        </div>
      </section>
    );
  }

  const current = result.current_freight_usd_per_ton ?? null;
  const f = result.forecast;
  const data = [
    { label: "Now", value: current, kind: "Current" },
    { label: "7D", value: f.h7_usd_per_ton ?? null, kind: "Forecast" },
    { label: "14D", value: f.h14_usd_per_ton ?? null, kind: "Forecast" },
    { label: "30D", value: f.h30_usd_per_ton ?? null, kind: "Forecast" },
  ].filter((d) => d.value !== null && d.value !== undefined);

  const trend = result.forecast_trend ?? "UNKNOWN";
  const models = f.models ?? {};
  const unc = result.forecast_uncertainty_proxy?.rolling_std_7_usd_per_ton;

  return (
    <section className="card rise">
      <div className="card-head">
        <div>
          <div className="card-kicker">02 · Freight Forecast · USD / tonne</div>
          <h2 className="card-title">Freight Forecast</h2>
        </div>
        <span className={`pill border ${TREND_STYLE[trend] ?? TREND_STYLE.UNKNOWN}`}>
          {trend === "RISING" ? "▲" : trend === "FALLING" ? "▼" : trend === "STABLE" ? "●" : "?"} {trend}
        </span>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: "Current", v: current, sub: result.current_freight_basis ? "route proxy" : "—" },
            { k: "7 Day", v: f.h7_usd_per_ton, sub: models["7"] ?? models[7 as unknown as string] ?? "" },
            { k: "14 Day", v: f.h14_usd_per_ton, sub: models["14"] ?? "" },
            { k: "30 Day", v: f.h30_usd_per_ton, sub: models["30"] ?? "" },
          ].map((s) => (
            <div key={s.k} className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
              <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-slate-500">{s.k}</div>
              <div className="font-display text-xl font-bold text-harbour-950">{fmt(s.v ?? null)}</div>
              <div className="truncate font-mono text-[10px] text-slate-400" title={s.sub}>{s.sub || " "}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
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
                labelFormatter={(l) => `${l} — ${data.find((d) => d.label === l)?.kind ?? ""}`}
                contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
              />
              <Line type="monotone" dataKey="value" stroke="#0B1F3A" strokeWidth={2.6} dot={{ r: 4, fill: "#1B6FA8", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 6 }} />
              {data.length > 0 && (
                <ReferenceDot x={data[data.length - 1].label} y={data[data.length - 1].value as number} r={7} fill="#0E7C8C" fillOpacity={0.18} stroke="none" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span>Trend: <strong className="text-harbour-900">{trend}</strong> (model output)</span>
          {unc !== null && unc !== undefined && (
            <span className="font-mono">± proxy σ ${unc.toFixed(2)}/t · not a calibrated interval</span>
          )}
        </div>
      </div>
    </section>
  );
}
