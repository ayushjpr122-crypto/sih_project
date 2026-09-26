import { useCallback, useEffect, useState } from "react";
import Header from "./components/Header";
import Nav from "./components/Nav";
import type { ViewKey } from "./nav";
import { VIEW_KEYS, resolveView } from "./nav";
import {
  AlertsPage,
  ForecastPage,
  OptimizerPage,
  OverviewPage,
  PortsPage,
  RoutePage,
  SimulatorPage,
  VesselsPage,
  type SharedProps,
} from "./pages";
import { api } from "./services/api";
import type {
  DecisionRequest,
  DecisionResponse,
  PortInfo,
  ScenarioForm,
  VesselClassInfo,
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

function viewFromLocation(): ViewKey {
  const h = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  if (h) return resolveView(h);
  const p = window.location.pathname.replace(/^\/+/, "").split("/")[0].split("?")[0];
  if (p) return resolveView(p);
  return "overview";
}

export default function App() {
  const [view, setView] = useState<ViewKey>(() => viewFromLocation());
  const [form, setForm] = useState<ScenarioForm>(DEFAULT_FORM);
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [vessels, setVessels] = useState<VesselClassInfo[]>([]);
  const [result, setResult] = useState<DecisionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  // Keep view in sync with URL hash or pathname (back/forward + deep links).
  useEffect(() => {
    const onLocationChange = () => setView(viewFromLocation());
    window.addEventListener("hashchange", onLocationChange);
    window.addEventListener("popstate", onLocationChange);
    return () => {
      window.removeEventListener("hashchange", onLocationChange);
      window.removeEventListener("popstate", onLocationChange);
    };
  }, []);

  const navigate = useCallback((v: ViewKey) => {
    window.location.hash = `/${v}`;
    setView(v);
    window.scrollTo({ top: 0 });
  }, []);

  const patchForm = useCallback(
    (patch: Partial<ScenarioForm>) => setForm((f) => ({ ...f, ...patch })),
    []
  );

  // Reference data for Route / Ports / Vessels views (non-blocking).
  useEffect(() => {
    let alive = true;
    api.getPorts()
      .then((p) => { if (alive) setPorts(p.ports ?? []); })
      .catch(() => {});
    api.getVessels()
      .then((v) => { if (alive) setVessels(v.vessels ?? []); })
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to complete the analysis. Please try again.");
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
      navigate("overview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to complete the analysis. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [form, navigate]);

  const shared: SharedProps = {
    form,
    onPatchForm: patchForm,
    onLoadDemo: loadDemo,
    onAnalyze: analyze,
    loading,
    demoLoading,
    result,
    ports,
    vessels,
    onNavigate: navigate,
  };

  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Header />
      <Nav view={view} onNavigate={navigate} hasResult={result !== null} />

      <main id="main-content" className="mx-auto max-w-ops px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-4 rounded-[2px] border border-red-200 bg-red-50 px-5 py-4 rise" role="alert">
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-100 text-red-700 font-bold" aria-hidden>!</span>
              <div>
                <p className="font-display text-sm font-bold text-red-900">
                  Unable to complete the analysis. Please try again.
                </p>
                <p className="mt-0.5 text-[13px] text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {view === "overview" && <OverviewPage {...shared} />}
        {view === "forecast" && <ForecastPage {...shared} />}
        {view === "optimizer" && <OptimizerPage {...shared} />}
        {view === "route" && <RoutePage {...shared} />}
        {view === "vessels" && <VesselsPage {...shared} />}
        {view === "ports" && <PortsPage {...shared} />}
        {view === "simulator" && <SimulatorPage {...shared} />}
        {view === "alerts" && <AlertsPage {...shared} />}

        <footer className="mt-10 border-t border-line pt-4 pb-8 text-[11.5px] text-slate-500">
          <p className="font-display font-semibold text-harbour-900">MARINEAI · Freight Intelligence</p>
          <p className="mt-0.5">Bulk cargo forecasting, vessel optimization and port intelligence for East Coast India.</p>
        </footer>
      </main>
    </div>
  );
}

export { VIEW_KEYS };
