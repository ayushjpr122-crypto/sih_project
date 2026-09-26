import { useMemo, useState } from "react";
import { AlertItem, deriveAlerts } from "./components/Alerts";
import FinalDecision from "./components/FinalDecision";
import ForecastCard from "./components/ForecastCard";
import GlobeView from "./components/GlobeView";
import { IntelligencePanel, PortCard, portCapability } from "./components/Ports";
import type { ViewKey } from "./nav";
import { VIEWS } from "./nav";
import { RouteCard, OpsCard } from "./components/RouteOps";
import ScenarioCard from "./components/ScenarioCard";
import { RiskCard, TimingCard } from "./components/SideSignals";
import { EmptyState, MetricStrip, PageHeader, Pager, Section, SectionHeader, StatusIndicator } from "./components/ui";
import VesselSection from "./components/VesselSection";
import { api } from "./services/api";
import type { DecisionRequest, DecisionResponse, PortInfo, ScenarioForm, VesselClassInfo } from "./types";

export interface SharedProps {
  form: ScenarioForm;
  onPatchForm: (patch: Partial<ScenarioForm>) => void;
  onLoadDemo: () => void;
  onAnalyze: () => void;
  loading: boolean;
  demoLoading: boolean;
  result: DecisionResponse | null;
  ports: PortInfo[];
  vessels: VesselClassInfo[];
  onNavigate: (v: ViewKey) => void;
}

function fmtRate(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `$${v.toFixed(2)}/t`;
}

function payloadFor(form: ScenarioForm): DecisionRequest {
  return {
    cargo_type: form.cargo_type,
    cargo_quantity_t: Number(form.cargo_quantity_t),
    origin: form.origin,
    destination: form.destination,
    horizon_days: form.horizon_days as 7 | 14 | 30,
    contract_type: form.contract_type,
    vessel_preference: null,
    operational_params: {},
  };
}

/* ------------------------------- OVERVIEW ------------------------------- */

export function OverviewPage(p: SharedProps) {
  const { result, loading } = p;
  if (loading) {
    return (
      <div>
        <PageHeader
          kicker="01 · Overview"
          title="Operations overview"
          description="Scenario and results at a glance. Each section below links to its focused view."
        />
        <div className="panel px-5 py-4" role="status" aria-label="Analysis in progress">
          <div className="flex items-center gap-3 text-sm font-medium text-harbour-900">
            <svg className="animate-spin shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Analyzing scenario…
          </div>
          <div className="skeleton mt-4 h-24 rounded-[2px]" aria-hidden />
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div>
        <PageHeader
          kicker="01 · Overview"
          title="Freight outlook for every fixture"
          description="Describe a bulk cargo requirement, and get a rate forecast, a ranked set of feasible vessels, and a clear chartering recommendation — in one guided flow."
        />
        <EmptyState
          title="Configure a scenario to begin the analysis."
          actionLabel="Open Simulator"
          onAction={() => p.onNavigate("simulator")}
        />
        <WorkflowStrip onNavigate={p.onNavigate} active={false} />
      </div>
    );
  }

  const summary = [
    { k: "Route", v: `${String(result.normalized?.origin ?? "—").replace(/_/g, " ")} → ${result.normalized?.destination ?? "—"}` },
    { k: "Cargo", v: `${result.normalized?.cargo_type ?? "—"}` },
    { k: "Current rate", v: fmtRate(result.current_freight_usd_per_ton) },
    { k: "30-day outlook", v: fmtRate(result.forecast?.h30_usd_per_ton) },
    { k: "Recommended vessel", v: result.recommended_vessel ?? "No feasible vessel" },
    { k: "Timing", v: result.charter_timing === "BUY_NOW" ? "BUY NOW" : result.charter_timing ?? "—" },
    { k: "Risk", v: result.risk ?? "—" },
    { k: "Trend", v: result.forecast_trend ?? "—" },
  ];

  const goSimulator = () => p.onNavigate("simulator");

  return (
    <div>
      <PageHeader
        kicker="01 · Overview"
        title="Operations overview"
        description="Scenario and results at a glance. Each section below links to its focused view."
      />
      {result.scenario_summary && (
        <p className="mb-4 rounded-[2px] border border-line bg-white px-4 py-2.5 font-mono text-[11.5px] text-harbour-900">
          ◈ {result.scenario_summary}
        </p>
      )}
      <MetricStrip items={summary} />
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <TimingCard result={p.result} onGoScenario={goSimulator} />
        <RiskCard result={p.result} onGoScenario={goSimulator} />
      </div>
      <div className="mt-5 space-y-5">
        <OpsCard result={p.result} onGoScenario={goSimulator} />
        <FinalDecision result={p.result} onGoScenario={goSimulator} />
      </div>
      <WorkflowStrip onNavigate={p.onNavigate} active />
    </div>
  );
}

function WorkflowStrip({ onNavigate, active }: { onNavigate: (v: ViewKey) => void; active: boolean }) {
  const steps: ViewKey[] = ["simulator", "forecast", "optimizer", "route", "ports", "vessels", "alerts"];
  return (
    <nav aria-label="Analysis workflow" className="mt-5">
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((k) => {
          const meta = VIEWS.find((v) => v.key === k)!;
          return (
            <li key={k}>
              <button
                type="button"
                onClick={() => onNavigate(k)}
                disabled={!active && (["forecast", "optimizer", "route"] as string[]).includes(k)}
                className="panel w-full px-4 py-3 text-left transition hover:border-ocean-700/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="font-mono text-[10px] tracking-[0.16em] text-ocean-700">{meta.index}</span>
                <span className="block font-display text-sm font-bold text-harbour-950">{meta.label}</span>
                <span className="block text-[11.5px] text-slate-500">{meta.hint}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ------------------------------- FORECAST ------------------------------- */

export function ForecastPage(p: SharedProps) {
  return (
    <div>
      <PageHeader
        kicker="02 · Rates"
        title="Rate outlook"
        description="Modelled freight rates for this lane, with the current rate and 7, 14 and 30-day projections."
      />
      <ForecastCard result={p.result} loading={p.loading} onGoScenario={() => p.onNavigate("simulator")} />
      <Pager view="forecast" onNavigate={p.onNavigate} hasResult={p.result !== null} />
    </div>
  );
}

/* ------------------------------- OPTIMIZER ------------------------------ */

export function OptimizerPage(p: SharedProps) {
  return (
    <div>
      <PageHeader
        kicker="03 · Fleet"
        title="Feasible vessels, ranked"
        description="Which vessel classes can carry this parcel under port and draft limits — and why the others cannot."
      />
      <VesselSection result={p.result} loading={p.loading} onGoScenario={() => p.onNavigate("simulator")} />
      <Pager view="optimizer" onNavigate={p.onNavigate} hasResult={p.result !== null} />
    </div>
  );
}

/* --------------------------- ROUTE INTELLIGENCE ------------------------- */

export function RoutePage(p: SharedProps) {
  return (
    <div>
      <PageHeader
        kicker="04 · Lane"
        title="Trade lane and port limits"
        description="The route under review and the destination port constraints applied to the vessel ranking."
      />
      <div className="max-w-3xl">
        <RouteCard result={p.result} ports={p.ports} onGoScenario={() => p.onNavigate("simulator")} />
      </div>
      <Pager view="route" onNavigate={p.onNavigate} hasResult={p.result !== null} />
    </div>
  );
}

/* -------------------------------- VESSELS -------------------------------- */

export function VesselsPage(p: SharedProps) {
  const { vessels, result } = p;
  const feasible = useMemo(
    () => new Map((result?.feasible_vessels ?? []).map((v) => [v.vessel_class, v])),
    [result]
  );
  const infeasible = useMemo(
    () => new Map((result?.infeasible_vessels ?? []).map((v) => [v.vessel_class, v])),
    [result]
  );

  return (
    <div>
      <PageHeader
        kicker="05 · Fleet reference"
        title="Vessel classes"
        description="Reference dimensions for the four bulk classes, with live scenario fit once an analysis has run."
      />
      <section className="panel overflow-hidden" aria-label="Vessel class reference">
        <div className="card-head">
          <div>
            <p className="card-kicker">Fleet · reference dimensions</p>
            <h2 className="card-title">Bulk Carrier Classes</h2>
          </div>
          {result?.recommended_vessel ? (
            <span className="pill bg-ocean-50 text-ocean-700 border border-ocean-100">
              ★ {result.recommended_vessel}
            </span>
          ) : null}
        </div>
        {vessels.length === 0 ? (
          <p className="px-5 sm:px-6 py-5 text-[13px] text-slate-500">
            Fleet reference is unavailable while the API is unreachable. Start the backend and reload.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[720px]">
              <thead>
                <tr>
                  <th scope="col">Class</th>
                  <th scope="col" className="text-right">DWT range</th>
                  <th scope="col" className="text-right">Draft</th>
                  <th scope="col" className="text-right">LOA</th>
                  <th scope="col">Typical cargoes</th>
                  {result && <th scope="col">Scenario fit</th>}
                </tr>
              </thead>
              <tbody>
                {vessels.map((v) => {
                  const f = feasible.get(v.vessel_class);
                  const inf = infeasible.get(v.vessel_class);
                  return (
                    <tr key={v.vessel_class} className={v.vessel_class === result?.recommended_vessel ? "bg-ocean-50/60" : undefined}>
                      <td>
                        <span className="font-display font-bold text-harbour-950">{v.vessel_class}</span>
                      </td>
                      <td className="text-right font-mono text-[13px]">
                        {v.dwt_min_t?.toLocaleString("en-US")}–{v.dwt_max_t?.toLocaleString("en-US")} t
                      </td>
                      <td className="text-right font-mono text-[13px]">{v.draft_m ?? "—"} m</td>
                      <td className="text-right font-mono text-[13px]">{v.loa_m ?? "—"} m</td>
                      <td className="max-w-[260px] text-[12.5px] text-slate-600">{v.typical_cargo_types ?? "—"}</td>
                      {result && (
                        <td>
                          {f ? (
                            <StatusIndicator tone="ok" label={`Feasible · ${(f.utilization !== null && f.utilization !== undefined ? (f.utilization * 100).toFixed(1) : "—")}%`} />
                          ) : inf ? (
                            <StatusIndicator tone="bad" label="Infeasible" />
                          ) : (
                            <StatusIndicator tone="muted" label="—" />
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {result && infeasible.size > 0 && (
        <ul className="mt-4 space-y-2">
          {[...infeasible.values()].map((v) => (
            <li key={v.vessel_class} className="text-[12.5px] leading-relaxed text-slate-600">
              <strong className="text-harbour-900">{v.vessel_class}:</strong> {v.reason ?? "Failed hard-constraint check."}
            </li>
          ))}
        </ul>
      )}
      <Pager view="vessels" onNavigate={p.onNavigate} hasResult={p.result !== null} />
    </div>
  );
}

/* --------------------------------- PORTS --------------------------------- */

export function PortsPage(p: SharedProps) {
  const { ports, result } = p;
  const dest = result?.normalized?.destination ?? p.form.destination ?? "Paradip";
  const [selected, setSelected] = useState<string>(dest);
  const active: PortInfo | undefined =
    ports.find((x) => x.port_name === selected) ??
    ports.find((x) => x.port_name === dest) ??
    ports[0];

  const ordered = useMemo(() => {
    const names = ["Paradip", "Dhamra", "Visakhapatnam", "Gangavaram", "Gopalpur", "Kakinada", "Haldia", "Chennai"];
    return [...ports].sort((a, b) => names.indexOf(a.port_name) - names.indexOf(b.port_name));
  }, [ports]);

  if (ports.length === 0) {
    return (
      <div>
        <PageHeader
          kicker="06 · Port intelligence"
          title="East Coast port operations"
          description="Congestion posture, vessel fit and constraint intelligence across the eastern seaboard."
        />
        <EmptyState
          title="Port reference is unavailable while the API is unreachable."
          actionLabel="Open Simulator"
          onAction={() => p.onNavigate("simulator")}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        kicker="06 · Port intelligence"
        title="East Coast port operations"
        description="Select a port on the plot or in the ledger. Status, constraints and geography stay in sync."
      />
      <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Ledger */}
        <div className="order-2 lg:order-1">
          <SectionHeader title="Port ledger" description={`${ports.length} ports · draft-led capability`} />
          <ul className="space-y-2" aria-label="Port list">
            {ordered.map((port) => (
              <li key={port.port_name}>
                <PortCard
                  port={port}
                  selected={active?.port_name === port.port_name}
                  onSelect={setSelected}
                />
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <IntelligencePanel port={active} />
          </div>
        </div>
        {/* Globe */}
        <div className="order-1 lg:order-2">
          <GlobeView
            selected={active?.port_name ?? null}
            onSelect={setSelected}
            scenarioOrigin={result?.normalized?.origin ?? p.form.origin}
            toneFor={(name) => {
              const hit = ports.find((x) => x.port_name === name);
              return hit ? portCapability(hit).tone : "muted";
            }}
          />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              { k: "Capesize-ready ports", v: String(ports.filter((x) => (x.max_draft_m ?? 0) >= 17).length) },
              { k: "Deepest draft", v: `${Math.max(...ports.map((x) => x.max_draft_m ?? 0))} m · Gangavaram` },
              { k: "Under review", v: active?.port_name ?? "—" },
            ].map((s) => (
              <div key={s.k} className="panel px-4 py-3">
                <p className="metric-label">{s.k}</p>
                <p className="mt-0.5 font-display text-[15px] font-bold text-harbour-950">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Pager view="ports" onNavigate={p.onNavigate} hasResult={p.result !== null} />
    </div>
  );
}

/* ------------------------------- SIMULATOR ------------------------------ */

interface SimRun {
  id: number;
  label: string;
  form: ScenarioForm;
  status: "idle" | "running" | "done" | "error";
  result?: DecisionResponse;
  error?: string;
}

const DESTINATIONS = ["Paradip", "Visakhapatnam", "Gangavaram", "Dhamra", "Gopalpur", "Haldia", "Kakinada", "Chennai"];

export function SimulatorPage(p: SharedProps) {
  const [runs, setRuns] = useState<SimRun[]>(() => [
    { id: 1, label: "Base case", form: { ...p.form }, status: "idle" },
    {
      id: 2,
      label: "Variant · Gangavaram",
      form: { ...p.form, destination: "Gangavaram" },
      status: "idle",
    },
  ]);

  const setRunForm = (id: number, patch: Partial<ScenarioForm>) =>
    setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, form: { ...r.form, ...patch }, status: "idle" as const } : r)));

  const runAll = async () => {
    setRuns((rs) => rs.map((r) => ({ ...r, status: "running" as const, error: undefined })));
    const settled = await Promise.all(
      runs.map(async (r) => {
        try {
          const res = await api.analyzeDecision(payloadFor(r.form));
          return { ...r, status: "done" as const, result: res };
        } catch (e) {
          return { ...r, status: "error" as const, error: e instanceof Error ? e.message : "Request failed" };
        }
      })
    );
    setRuns(settled);
  };

  const done = runs.filter((r) => r.status === "done" && r.result);

  return (
    <div>
      <PageHeader
        kicker="07 · What-if workbench"
        title="Simulate fixtures"
        description="Edit the charter requirement, run the full analysis, or compare variants side by side. Every figure below is computed live by the forecasting service."
      />
      <div className="max-w-2xl">
        <ScenarioCard
          form={p.form}
          onChange={p.onPatchForm}
          onLoadDemo={p.onLoadDemo}
          onAnalyze={p.onAnalyze}
          loading={p.loading}
          demoLoading={p.demoLoading}
        />
      </div>

      <div className="mt-8">
        <SectionHeader
          title="Variant comparison"
          description="Tune destination, quantity, horizon or contract per variant, then run all against the live model."
          action={
            <button type="button" className="btn-inline" onClick={runAll}>
              Run comparison →
            </button>
          }
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {runs.map((r) => (
            <section key={r.id} className="panel px-5 py-4" aria-label={r.label}>
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-display text-[15px] font-bold text-harbour-950">{r.label}</h4>
                {r.status === "running" ? (
                  <span className="font-mono text-[11px] text-ocean-700">RUNNING…</span>
                ) : r.status === "done" ? (
                  <StatusIndicator tone="ok" label="Computed" />
                ) : r.status === "error" ? (
                  <StatusIndicator tone="bad" label="Failed" />
                ) : (
                  <StatusIndicator tone="muted" label="Not run" />
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label" htmlFor={`dest-${r.id}`}>Destination</label>
                  <select
                    id={`dest-${r.id}`}
                    className="field-input"
                    value={r.form.destination}
                    onChange={(e) => setRunForm(r.id, { destination: e.target.value })}
                  >
                    {DESTINATIONS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor={`qty-${r.id}`}>Quantity (t)</label>
                  <input
                    id={`qty-${r.id}`}
                    type="number"
                    min={1000}
                    max={500000}
                    step={1000}
                    className="field-input font-mono"
                    value={r.form.cargo_quantity_t}
                    onChange={(e) => setRunForm(r.id, { cargo_quantity_t: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor={`hor-${r.id}`}>Horizon</label>
                  <select
                    id={`hor-${r.id}`}
                    className="field-input font-mono"
                    value={r.form.horizon_days}
                    onChange={(e) => setRunForm(r.id, { horizon_days: Number(e.target.value) })}
                  >
                    {[7, 14, 30].map((h) => (
                      <option key={h} value={h}>{h} days</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor={`con-${r.id}`}>Contract</label>
                  <select
                    id={`con-${r.id}`}
                    className="field-input"
                    value={r.form.contract_type}
                    onChange={(e) => setRunForm(r.id, { contract_type: e.target.value })}
                  >
                    {["Spot", "Medium-term", "Long-term"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              {r.status === "error" && (
                <p className="mt-2 text-[12px] text-red-700" role="alert">{r.error}</p>
              )}
              {r.result && (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
                  {[
                    { k: "30-day", v: fmtRate(r.result.forecast?.h30_usd_per_ton) },
                    { k: "Vessel", v: r.result.recommended_vessel ?? "—" },
                    { k: "Timing", v: r.result.charter_timing ?? "—" },
                    { k: "Risk", v: r.result.risk ?? "—" },
                  ].map((s) => (
                    <div key={s.k}>
                      <dt className="metric-label">{s.k}</dt>
                      <dd className="font-display text-[14px] font-bold text-harbour-950">{s.v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          ))}
        </div>

        {done.length >= 2 && (
          <Section kicker="Comparison · live model output" title="Variant delta">
            <div className="overflow-x-auto">
              <table className="data-table min-w-[560px]">
                <thead>
                  <tr>
                    <th scope="col">Measure</th>
                    {done.map((r) => (
                      <th key={r.id} scope="col">{r.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { k: "Current rate", f: (r: DecisionResponse) => fmtRate(r.current_freight_usd_per_ton) },
                    { k: "7-day", f: (r: DecisionResponse) => fmtRate(r.forecast?.h7_usd_per_ton) },
                    { k: "14-day", f: (r: DecisionResponse) => fmtRate(r.forecast?.h14_usd_per_ton) },
                    { k: "30-day", f: (r: DecisionResponse) => fmtRate(r.forecast?.h30_usd_per_ton) },
                    { k: "Vessel", f: (r: DecisionResponse) => r.recommended_vessel ?? "—" },
                    { k: "Timing", f: (r: DecisionResponse) => r.charter_timing ?? "—" },
                    { k: "Risk", f: (r: DecisionResponse) => r.risk ?? "—" },
                  ].map((row) => (
                    <tr key={row.k}>
                      <td className="font-medium text-slate-500">{row.k}</td>
                      {done.map((r) => (
                        <td key={r.id} className="font-display font-bold text-harbour-950">
                          {row.f(r.result!)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}
      </div>
      <Pager view="simulator" onNavigate={p.onNavigate} hasResult={p.result !== null} />
    </div>
  );
}

/* --------------------------------- ALERTS -------------------------------- */

export function AlertsPage(p: SharedProps) {
  const alerts = useMemo(() => deriveAlerts(p.result), [p.result]);

  return (
    <div>
      <PageHeader
        kicker="08 · Ops watch"
        title="Alerts"
        description="Thresholds and operational signals derived from the latest analysis. Run a scenario to refresh."
      />
      {!p.result ? (
        <EmptyState
          title="No analysis yet — alerts appear after the first run."
          actionLabel="Open Simulator"
          onAction={() => p.onNavigate("simulator")}
        />
      ) : alerts.length === 0 ? (
        <div className="panel px-6 py-10 text-center">
          <StatusIndicator tone="ok" label="All clear" />
          <p className="mt-2 font-display text-base font-bold text-harbour-950">
            No thresholds breached for this scenario.
          </p>
          <p className="mt-1 text-[13px] text-slate-600">
            Risk is contained, all vessel classes of interest are feasible, and the 30-day rate sits
            within ±5% of current.
          </p>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Operational alerts">
          {alerts.map((a) => (
            <AlertItem
              key={a.id}
              alert={a}
              actionLabel={a.id === "infeasible" ? "Review Optimizer" : a.id.startsWith("timing") || a.id.startsWith("rate") ? "Review Forecast" : undefined}
              onAction={
                a.id === "infeasible"
                  ? () => p.onNavigate("optimizer")
                  : a.id.startsWith("timing") || a.id.startsWith("rate")
                    ? () => p.onNavigate("forecast")
                    : undefined
              }
            />
          ))}
        </ul>
      )}
      <Pager view="alerts" onNavigate={p.onNavigate} hasResult={p.result !== null} />
    </div>
  );
}
