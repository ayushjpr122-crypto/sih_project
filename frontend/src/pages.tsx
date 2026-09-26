import FinalDecision from "./components/FinalDecision";
import ForecastCard from "./components/ForecastCard";
import type { ViewKey } from "./nav";
import { VIEWS } from "./nav";
import { RouteCard, OpsCard } from "./components/RouteOps";
import ScenarioCard from "./components/ScenarioCard";
import { RiskCard, TimingCard } from "./components/SideSignals";
import { EmptyState, PageHeader, Pager } from "./components/ui";
import VesselSection from "./components/VesselSection";
import type { DecisionResponse, PortInfo, ScenarioForm } from "./types";

export interface SharedProps {
  form: ScenarioForm;
  onPatchForm: (patch: Partial<ScenarioForm>) => void;
  onLoadDemo: () => void;
  onAnalyze: () => void;
  loading: boolean;
  demoLoading: boolean;
  result: DecisionResponse | null;
  ports: PortInfo[];
  onNavigate: (v: ViewKey) => void;
}

function fmtRate(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `$${v.toFixed(2)}/t`;
}

/* ------------------------------- OVERVIEW ------------------------------- */

export function OverviewPage(p: SharedProps) {
  const { result, loading } = p;
  if (loading) {
    return (
      <div>
        <PageHeader
          kicker="Overview"
          title="Analysis overview"
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
          <div className="skeleton mt-4 h-24 rounded-lg" aria-hidden />
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div>
        <PageHeader
          kicker="Overview"
          title="Freight outlook for every fixture"
          description="Describe a bulk cargo requirement, and get a rate forecast, a ranked set of feasible vessels, and a clear chartering recommendation — in one guided flow."
        />
        <EmptyState
          title="Configure a scenario to begin the analysis."
          actionLabel="Start with Scenario"
          onAction={() => p.onNavigate("scenario")}
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

  return (
    <div>
      <PageHeader
        kicker="Overview"
        title="Analysis overview"
        description="Scenario and results at a glance. Each section below links to its focused view."
      />
      {result.scenario_summary && (
        <p className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-2.5 font-mono text-[11.5px] text-harbour-900">
          ◈ {result.scenario_summary}
        </p>
      )}
      <section className="panel" aria-label="Analysis summary">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 sm:px-6 py-5 sm:grid-cols-4">
          {summary.map((s) => (
            <div key={s.k}>
              <dt className="metric-label">{s.k}</dt>
              <dd className="mt-0.5 font-display text-[15px] font-bold text-harbour-950">{s.v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <WorkflowStrip onNavigate={p.onNavigate} active />
    </div>
  );
}

function WorkflowStrip({ onNavigate, active }: { onNavigate: (v: ViewKey) => void; active: boolean }) {
  const steps: ViewKey[] = ["scenario", "forecast", "vessels", "route", "decision"];
  return (
    <nav aria-label="Analysis workflow" className="mt-5">
      <ol className="grid gap-2 sm:grid-cols-5">
        {steps.map((k, i) => {
          const meta = VIEWS.find((v) => v.key === k)!;
          return (
            <li key={k}>
              <button
                type="button"
                onClick={() => onNavigate(k)}
                disabled={!active && k !== "scenario"}
                className="panel w-full px-4 py-3 text-left transition hover:border-ocean-500/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="font-mono text-[10px] tracking-[0.16em] text-ocean-600">STEP {i + 1}</span>
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

/* ------------------------------- SCENARIO ------------------------------- */

export function ScenarioPage(p: SharedProps) {
  return (
    <div>
      <PageHeader
        kicker="Step 1 · Inputs"
        title="Describe the requirement"
        description="Enter the cargo, route and contract terms. The forecast and vessel ranking update when you run the analysis."
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
      <Pager view="scenario" onNavigate={p.onNavigate} hasResult={p.result !== null} />
    </div>
  );
}

/* ------------------------------- FORECAST ------------------------------- */

export function ForecastPage(p: SharedProps) {
  return (
    <div>
      <PageHeader
        kicker="Step 2 · Rates"
        title="Rate outlook"
        description="Modelled freight rates for this lane, with the current rate and 7, 14 and 30-day projections."
      />
      <ForecastCard result={p.result} loading={p.loading} onGoScenario={() => p.onNavigate("scenario")} />
      <Pager view="forecast" onNavigate={p.onNavigate} hasResult={p.result !== null} />
    </div>
  );
}

/* --------------------------- VESSEL OPTIMIZATION ------------------------ */

export function VesselsPage(p: SharedProps) {
  return (
    <div>
      <PageHeader
        kicker="Step 3 · Fleet"
        title="Feasible vessels, ranked"
        description="Which vessel classes can carry this parcel under port and draft limits — and why the others cannot."
      />
      <VesselSection result={p.result} loading={p.loading} onGoScenario={() => p.onNavigate("scenario")} />
      <Pager view="vessels" onNavigate={p.onNavigate} hasResult={p.result !== null} />
    </div>
  );
}

/* ------------------------------ ROUTE & PORTS --------------------------- */

export function RoutePage(p: SharedProps) {
  return (
    <div>
      <PageHeader
        kicker="Step 4 · Lane"
        title="Trade lane and port limits"
        description="The route under review and the destination port constraints applied to the vessel ranking."
      />
      <div className="max-w-3xl">
        <RouteCard result={p.result} ports={p.ports} onGoScenario={() => p.onNavigate("scenario")} />
      </div>
      <Pager view="route" onNavigate={p.onNavigate} hasResult={p.result !== null} />
    </div>
  );
}

/* -------------------------------- DECISION ------------------------------ */

export function DecisionPage(p: SharedProps) {
  const goScenario = () => p.onNavigate("scenario");
  return (
    <div>
      <PageHeader
        kicker="Step 5 · Recommendation"
        title="Chartering decision"
        description="Timing, risk and the final recommendation for this scenario."
      />
      {!p.result && !p.loading ? (
        <EmptyState
          title="Configure a scenario to begin the analysis."
          actionLabel="Go to Scenario"
          onAction={goScenario}
        />
      ) : p.loading ? (
        <div className="panel px-5 py-4" role="status" aria-label="Analysis in progress">
          <div className="flex items-center gap-3 text-sm font-medium text-harbour-900">
            <svg className="animate-spin shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Analyzing scenario…
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-16 rounded-lg" />)}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <TimingCard result={p.result} onGoScenario={goScenario} />
            <RiskCard result={p.result} onGoScenario={goScenario} />
          </div>
          <OpsCard result={p.result} onGoScenario={goScenario} />
          <FinalDecision result={p.result} onGoScenario={goScenario} />
        </div>
      )}
      <Pager view="decision" onNavigate={p.onNavigate} hasResult={p.result !== null} />
    </div>
  );
}
