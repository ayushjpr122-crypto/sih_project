import type { DecisionResponse } from "../types";

export type AlertSeverity = "critical" | "warning" | "info";

export interface OpsAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
}

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Signal",
};

/** Derive operational alerts from the latest decision (no backend change). */
export function deriveAlerts(result: DecisionResponse | null): OpsAlert[] {
  if (!result) return [];
  const alerts: OpsAlert[] = [];

  if (result.risk === "HIGH") {
    alerts.push({
      id: "risk-high",
      severity: "critical",
      title: "High voyage risk on this lane",
      detail:
        result.risk_drivers?.map((d) => d.driver).join(", ") ||
        "Risk model flags elevated exposure for this scenario.",
    });
  }

  if (result.charter_timing === "BUY_NOW") {
    alerts.push({
      id: "timing-buy",
      severity: "info",
      title: "Charter now — upward rate pressure",
      detail:
        result.charter_timing_return_pct !== null &&
        result.charter_timing_return_pct !== undefined
          ? `Waiting costs an estimated ${result.charter_timing_return_pct > 0 ? "+" : ""}${result.charter_timing_return_pct.toFixed(1)}% versus current rates.`
          : (result.charter_timing_reason ?? "Model expects rates to rise over the horizon."),
    });
  } else if (result.charter_timing === "WAIT") {
    alerts.push({
      id: "timing-wait",
      severity: "warning",
      title: "Defer charter — rates easing",
      detail: result.charter_timing_reason ?? "Model expects rates to soften; monitor before fixing.",
    });
  }

  const h30 = result.forecast?.h30_usd_per_ton;
  const cur = result.current_freight_usd_per_ton;
  if (h30 !== undefined && cur !== null && cur !== undefined && cur > 0) {
    const pct = ((h30 - cur) / cur) * 100;
    if (pct >= 5) {
      alerts.push({
        id: "rate-spike",
        severity: "warning",
        title: `30-day rate +${pct.toFixed(1)}% over current`,
        detail: `Current $${cur.toFixed(2)}/t against a 30-day projection of $${h30.toFixed(2)}/t. Review contract cover.`,
      });
    } else if (pct <= -5) {
      alerts.push({
        id: "rate-relief",
        severity: "info",
        title: `30-day rate ${pct.toFixed(1)}% under current`,
        detail: `Current $${cur.toFixed(2)}/t against a 30-day projection of $${h30.toFixed(2)}/t. Window for negotiation.`,
      });
    }
  }

  const infeasible = result.infeasible_vessels ?? [];
  if (infeasible.length > 0) {
    alerts.push({
      id: "infeasible",
      severity: "warning",
      title: `${infeasible.length} vessel class${infeasible.length > 1 ? "es" : ""} infeasible at ${result.normalized?.destination ?? "destination"}`,
      detail: infeasible
        .map((v) => `${v.vessel_class}: ${v.reason ?? "failed constraint check"}`)
        .join(" · "),
    });
  }

  const rec = result.recommended_detail;
  if (rec?.utilization !== null && rec?.utilization !== undefined && rec.utilization > 0.98) {
    alerts.push({
      id: "tight-util",
      severity: "warning",
      title: `${result.recommended_vessel} utilization at ${(rec.utilization * 100).toFixed(1)}%`,
      detail: "Parcel nearly fills the class. Any quantity growth forces a class change — confirm stem size.",
    });
  }
  if (rec?.draft_slack_m !== null && rec?.draft_slack_m !== undefined && rec.draft_slack_m < 1) {
    alerts.push({
      id: "draft-slack",
      severity: "critical",
      title: `Draft slack only ${rec.draft_slack_m.toFixed(2)} m at destination`,
      detail: "Minimal under-keel margin under the port limit. Verify tide window and berth notice before fixing.",
    });
  }

  return alerts;
}

export function AlertItem({
  alert,
  actionLabel,
  onAction,
}: {
  alert: OpsAlert;
  actionLabel?: string;
  onAction?: () => void;
}) {
  // Full literal class names so the stylesheet keeps the matching rail rule.
  const rail =
    alert.severity === "critical"
      ? "alert-rail-critical"
      : alert.severity === "warning"
        ? "alert-rail-warning"
        : "alert-rail-info";
  return (
    <li className="panel flex overflow-hidden">
      <span className={`w-1.5 shrink-0 ${rail}`} aria-hidden />
      <div className="flex-1 px-5 py-4">
        <p className="flex flex-wrap items-center gap-2">
          <span
            className={`pill border ${
              alert.severity === "critical"
                ? "bg-red-50 text-red-700 border-red-200"
                : alert.severity === "warning"
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-[#EEF1F3] text-[#2A6E8C] border-[#C9D8E2]"
            }`}
          >
            {SEVERITY_LABEL[alert.severity]}
          </span>
          <strong className="font-display text-[14px] font-bold text-harbour-950">{alert.title}</strong>
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{alert.detail}</p>
        {actionLabel && onAction ? (
          <button type="button" className="btn-outline mt-3" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
    </li>
  );
}
