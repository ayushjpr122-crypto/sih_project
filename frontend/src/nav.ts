export type ViewKey =
  | "overview"
  | "forecast"
  | "optimizer"
  | "route"
  | "vessels"
  | "ports"
  | "simulator"
  | "alerts";

/** Legacy view keys redirect to their successor (deep-link safety). */
const LEGACY_REDIRECTS: Record<string, ViewKey> = {
  scenario: "simulator",
  decision: "overview",
};

export function resolveView(raw: string): ViewKey {
  if ((VIEW_KEYS as string[]).includes(raw)) return raw as ViewKey;
  if (raw in LEGACY_REDIRECTS) return LEGACY_REDIRECTS[raw];
  return "overview";
}

export const VIEWS: { key: ViewKey; index: string; label: string; hint: string }[] = [
  { key: "overview", index: "01", label: "Overview", hint: "Scenario and analysis at a glance" },
  { key: "forecast", index: "02", label: "Forecast", hint: "Freight rate outlook" },
  { key: "optimizer", index: "03", label: "Optimizer", hint: "Feasible fleet and ranking" },
  { key: "route", index: "04", label: "Route Intelligence", hint: "Trade lane and port limits" },
  { key: "vessels", index: "05", label: "Vessels", hint: "Fleet reference and scenario fit" },
  { key: "ports", index: "06", label: "Ports", hint: "Port intelligence and geography" },
  { key: "simulator", index: "07", label: "Simulator", hint: "What-if scenario workbench" },
  { key: "alerts", index: "08", label: "Alerts", hint: "Thresholds and operational signals" },
];

export const VIEW_KEYS = VIEWS.map((v) => v.key);

/** Views that need a completed analysis to be meaningful. */
export const LOCKED_WITHOUT_RESULT: ViewKey[] = ["forecast", "optimizer", "route"];
