/* TypeScript contracts mirroring backend/app/schemas + decision_engine response.
   Backend is the source of truth; these types track its Pydantic shapes. */

export interface DecisionRequest {
  cargo_type: string;
  cargo_quantity_t: number;
  origin: string;
  destination: string;
  horizon_days: 7 | 14 | 30;
  contract_type: string;
  vessel_preference?: string | null;
  operational_params?: Record<string, unknown>;
}

export interface DemoScenarioResponse {
  description: string;
  request_example: DecisionRequest;
}

export interface HealthResponse {
  status: "ok";
  app: string;
  data_disclosure: string;
}

export interface PortInfo {
  port_name: string;
  state?: string;
  country?: string;
  max_draft_m?: number;
  max_loa_m?: number;
  max_beam_m?: number;
  cargo_handling_capacity_mtpa?: number;
  port_type?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface PortsResponse {
  count: number;
  ports: PortInfo[];
  note?: string;
}

export interface VesselClassInfo {
  vessel_class: string;
  dwt_min_t?: number;
  dwt_max_t?: number;
  typical_dwt_t?: number;
  draft_m?: number;
  loa_m?: number;
  beam_m?: number;
  capacity_range_t?: string;
  typical_cargo_types?: string;
  [key: string]: unknown;
}

export interface VesselsResponse {
  count: number;
  vessels: VesselClassInfo[];
  note?: string;
}

export interface ModelsResponse {
  data_disclosure?: string;
  [key: string]: unknown;
}

export interface FeasibleVessel {
  vessel_class: string;
  feasible: boolean;
  composite_score?: number | null;
  total_cost_usd?: number | null;
  cost_per_ton_proxy?: number | null;
  utilization?: number | null;
  fuel_proxy_usd?: number | null;
  draft_slack_m?: number | null;
  explain?: string;
  reason?: string;
}

export interface InfeasibleVessel {
  vessel_class: string;
  feasible: boolean;
  reason?: string;
}

export interface RiskDriver {
  driver: string;
  level?: string;
  value?: unknown;
  explain?: string;
}

export interface DecisionResponse {
  scenario_summary?: string;
  normalized?: {
    cargo_type?: string;
    origin?: string;
    destination?: string;
    contract_type?: string;
    vessel_preference?: string | null;
  };
  current_freight_usd_per_ton?: number | null;
  current_freight_basis?: string | null;
  forecast?: {
    h7_usd_per_ton?: number;
    h14_usd_per_ton?: number;
    h30_usd_per_ton?: number;
    models?: Record<string, string>;
  };
  forecast_trend?: string;
  forecast_uncertainty_proxy?: {
    rolling_std_7_usd_per_ton?: number;
    basis?: string;
  } | null;
  market_context?: Record<string, unknown>;
  feasible_vessels?: FeasibleVessel[];
  infeasible_vessels?: InfeasibleVessel[];
  recommended_vessel?: string | null;
  recommended_detail?: FeasibleVessel | null;
  charter_timing?: string;
  charter_timing_return_pct?: number | null;
  charter_timing_reason?: string;
  risk?: string;
  risk_score?: number | null;
  risk_drivers?: RiskDriver[];
  idle_insight?: string;
  idle_utilization?: number | null;
  recommendation?: string;
  data_disclosure?: string;
  scenario_id?: number;
  decision_id?: number;
}

/** Scenario form state (UI-side; horizon stored as number, cast on submit). */
export interface ScenarioForm {
  cargo_type: string;
  cargo_quantity_t: number;
  origin: string;
  destination: string;
  horizon_days: number;
  contract_type: string;
}

export type BackendStatus = "checking" | "connected" | "down";
