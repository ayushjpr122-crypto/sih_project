import type { ScenarioForm } from "../types";

interface Props {
  form: ScenarioForm;
  onChange: (patch: Partial<ScenarioForm>) => void;
  onLoadDemo: () => void;
  onAnalyze: () => void;
  loading: boolean;
  demoLoading: boolean;
}

const ORIGINS = ["Australia", "Indonesia", "South Africa", "Brazil"];
const DESTINATIONS = ["Paradip", "Visakhapatnam", "Gangavaram", "Dhamra", "Gopalpur", "Haldia", "Kakinada", "Chennai"];
const CARGOS = ["Coking Coal", "Iron Ore", "Grains"];
const CONTRACTS = ["Spot", "Medium-term", "Long-term"];
const HORIZONS = [7, 14, 30];

export default function ScenarioCard({ form, onChange, onLoadDemo, onAnalyze, loading, demoLoading }: Props) {
  return (
    <section className="card overflow-hidden">
      <div className="card-head">
        <div>
          <div className="card-kicker">01 · Charter Scenario</div>
          <h2 className="card-title">Scenario Input</h2>
        </div>
        <span className="pill bg-ocean-50 text-ocean-700 border border-ocean-100">POST /decision</span>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <label className="field-label" htmlFor="cargo">Cargo Type</label>
          <select id="cargo" className="field-input" value={form.cargo_type}
            onChange={(e) => onChange({ cargo_type: e.target.value })}>
            {CARGOS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="qty">Cargo Quantity (tonnes)</label>
          <input id="qty" type="number" min={1000} max={500000} step={1000} className="field-input font-mono"
            value={form.cargo_quantity_t}
            onChange={(e) => onChange({ cargo_quantity_t: Number(e.target.value) })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="origin">Origin</label>
            <select id="origin" className="field-input" value={form.origin}
              onChange={(e) => onChange({ origin: e.target.value })}>
              {ORIGINS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="dest">Destination</label>
            <select id="dest" className="field-input" value={form.destination}
              onChange={(e) => onChange({ destination: e.target.value })}>
              {DESTINATIONS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="contract">Contract Type</label>
            <select id="contract" className="field-input" value={form.contract_type}
              onChange={(e) => onChange({ contract_type: e.target.value })}>
              {CONTRACTS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <span className="field-label">Forecast Horizon</span>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Forecast horizon">
              {HORIZONS.map((h) => (
                <button key={h} type="button"
                  onClick={() => onChange({ horizon_days: h })}
                  className={`rounded-md py-1.5 font-mono text-xs font-semibold transition ${
                    form.horizon_days === h
                      ? "bg-harbour-900 text-white shadow"
                      : "text-slate-500 hover:text-harbour-900"
                  }`}>
                  {h}d
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onLoadDemo} disabled={demoLoading || loading}>
            {demoLoading ? "Loading demo…" : "⤓  Load Demo Scenario"}
          </button>
          <button type="button" className="btn-primary" onClick={onAnalyze} disabled={loading}>
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Analyzing…
              </span>
            ) : "Analyze Scenario →"}
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Demo loads the live backend scenario (<span className="font-mono">GET /demo-scenario</span>).
          Analysis runs the real decision engine (<span className="font-mono">POST /decision</span>) — no hardcoded results.
        </p>
      </div>
    </section>
  );
}
