import { useCallback, useEffect, useState } from "react";
import FinalDecision from "./components/FinalDecision";
import ForecastCard from "./components/ForecastCard";
import Header from "./components/Header";
import { OpsCard, RouteCard } from "./components/RouteOps";
import ScenarioCard from "./components/ScenarioCard";
import { RiskCard, TimingCard } from "./components/SideSignals";
import VesselSection from "./components/VesselSection";
import { api } from "./services/api";
import type {
  BackendStatus,
  DecisionRequest,
  DecisionResponse,
  PortInfo,
  ScenarioForm,
} from "./types";

const DEFAULT_FORM: ScenarioForm = {
  cargo_type: "Coking Coal",
  cargo_quantity_t: 75000,
  origin: "Australia",
  destination: "Paradip",
  horizon_days: 30,
  contract_type: "Medium-term",
};

function prettifyContract(raw: string): string {
  const k = raw.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (k === "spot") return "Spot";
  if (k === "medium-term") return "Medium-term";
  if (k === "long-term") return "Long-term";
  return raw;
}

export default function App() {
  const [form, setForm] = useState<ScenarioForm>(DEFAULT_FORM);
  const [status, setStatus] = useState<BackendStatus>("checking");
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [portsNote, setPortsNote] = useState<string>("");
  const [result, setResult] = useState<DecisionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const patchForm = useCallback(
    (patch: Partial<ScenarioForm>) => setForm((f) => ({ ...f, ...patch })),
    []
  );

  // Backend health + reference ports (non-blocking for the demo flow).
  useEffect(() => {
    let alive = true;
    api.getHealth()
      .then(() => { if (alive) setStatus("connected"); })
      .catch(() => { if (alive) setStatus("down"); });
    api.getPorts()
      .then((p) => { if (alive) { setPorts(p.ports ?? []); setPortsNote(p.note ?? ""); } })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const loadDemo = useCallback(async () => {
    setDemoLoading(true);
    setError(null);
    try {
      const demo = await api.getDemoScenario();
      const ex = demo.request_example;
      setForm({
        cargo_type: ex.cargo_type,
        cargo_quantity_t: ex.cargo_quantity_t,
        origin: ex.origin,
        destination: ex.destination,
        horizon_days: ex.horizon_days,
        contract_type: prettifyContract(ex.contract_type),
      });
      setStatus("connected");
    } catch (e) {
      setStatus("down");
      setError(e instanceof Error ? e.message : "Unable to load the demo scenario.");
    } finally {
      setDemoLoading(false);
    }
  }, []);

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    const payload: DecisionRequest = {
      cargo_type: form.cargo_type,
      cargo_quantity_t: Number(form.cargo_quantity_t),
      origin: form.origin,
      destination: form.destination,
      horizon_days: form.horizon_days as 7 | 14 | 30,
      contract_type: form.contract_type,
      vessel_preference: null,
      operational_params: {},
    };
    try {
      const res = await api.analyzeDecision(payload);
      setResult(res);
      setStatus("connected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to connect to the decision engine. Please check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }, [form]);

  return (
    <div className="min-h-screen">
      <Header status={status} />

      <main className="mx-auto max-w-[1440px] px-4 sm:px-6 py-5 space-y-4">
        {error && (
          <div className="card border-red-200 bg-red-50/70 px-5 py-4 rise" role="alert">
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-100 text-red-700 font-bold">!</span>
              <div>
                <p className="font-display text-sm font-bold text-red-900">Analysis unavailable</p>
                <p className="text-[13px] text-red-800">{error}</p>
                <p className="mt-1 text-[12px] text-red-700/80">
                  Unable to connect to the decision engine. Please check that the backend is running.
                </p>
              </div>
            </div>
          </div>
        )}

        {result?.scenario_summary && !loading && (
          <p className="rise rounded-xl border border-harbour-900/15 bg-white px-4 py-2.5 font-mono text-[11.5px] text-harbour-900">
            ◈ {result.scenario_summary}
          </p>
        )}

        {/* Row 1: scenario → forecast */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-4 xl:col-span-3">
            <ScenarioCard
              form={form}
              onChange={patchForm}
              onLoadDemo={loadDemo}
              onAnalyze={analyze}
              loading={loading}
              demoLoading={demoLoading}
            />
          </div>
          <div className="col-span-12 lg:col-span-8 xl:col-span-9">
            <ForecastCard result={result} loading={loading} />
          </div>
        </div>

        {/* Row 2: vessels → timing/risk rail */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-7">
            <VesselSection result={result} loading={loading} />
          </div>
          <div className="col-span-12 lg:col-span-5 space-y-4">
            <TimingCard result={result} loading={loading} />
            <RiskCard result={result} loading={loading} />
          </div>
        </div>

        {/* Row 3: route + operations */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-5">
            <RouteCard result={result} ports={ports} portsNote={portsNote} loading={loading} />
          </div>
          <div className="col-span-12 lg:col-span-7">
            <OpsCard result={result} loading={loading} />
          </div>
        </div>

        {/* Row 4: final decision */}
        <FinalDecision result={result} loading={loading} />

        <footer className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1 pb-6 text-[11px] text-slate-500">
          <span>
            SIH26006 · Prototype · Synthetic/Domain-Informed Data — never present prototype numbers as actual SAIL operational data.
          </span>
          <span className="font-mono">API: {api.baseUrl}</span>
        </footer>
      </main>
    </div>
  );
}
