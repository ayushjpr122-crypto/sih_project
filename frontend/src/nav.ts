export type ViewKey =
  | "overview"
  | "scenario"
  | "forecast"
  | "vessels"
  | "route"
  | "decision";

export const VIEWS: { key: ViewKey; label: string; hint: string }[] = [
  { key: "overview", label: "Overview", hint: "Scenario and analysis at a glance" },
  { key: "scenario", label: "Scenario", hint: "Describe the chartering requirement" },
  { key: "forecast", label: "Forecast", hint: "Freight rate outlook" },
  { key: "vessels", label: "Vessel Optimization", hint: "Feasible fleet and ranking" },
  { key: "route", label: "Route & Ports", hint: "Trade lane and port limits" },
  { key: "decision", label: "Decision", hint: "Timing, risk and recommendation" },
];
