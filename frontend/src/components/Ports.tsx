import type { PortInfo } from "../types";
import type { GlobeTone } from "./GlobeView";
import { StatusIndicator } from "./ui";

export function portCapability(port: PortInfo): { tone: GlobeTone; label: string } {
  const d = typeof port.max_draft_m === "number" ? port.max_draft_m : null;
  if (d === null) return { tone: "muted", label: "Draft unverified" };
  if (d >= 17) return { tone: "ok", label: "Capesize ready" };
  if (d >= 13.5) return { tone: "ok", label: "Panamax ready" };
  if (d >= 11) return { tone: "warn", label: "Supramax limit" };
  return { tone: "bad", label: "Draft constrained" };
}

export function ConstraintRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="ops-row">
      <dt className="metric-label">{k}</dt>
      <dd className="font-display text-[14px] font-bold tabular-nums text-harbour-950">{v}</dd>
    </div>
  );
}

export function PortCard({
  port,
  selected,
  onSelect,
}: {
  port: PortInfo;
  selected: boolean;
  onSelect: (name: string) => void;
}) {
  const cap = portCapability(port);
  return (
    <button
      type="button"
      onClick={() => onSelect(port.port_name)}
      aria-current={selected}
      className="port-card"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-display text-[15px] font-bold text-harbour-950">{port.port_name}</span>
        <StatusIndicator tone={cap.tone} label={cap.label} />
      </span>
      <span className="mt-1 flex flex-wrap gap-x-3 font-mono text-[11px] text-slate-500">
        {port.max_draft_m !== undefined && <span>DRAFT {port.max_draft_m} M</span>}
        {port.cargo_handling_capacity_mtpa !== undefined && (
          <span>{port.cargo_handling_capacity_mtpa} MTPA</span>
        )}
        {port.state && <span className="uppercase">{port.state}</span>}
      </span>
    </button>
  );
}

export function IntelligencePanel({ port }: { port: PortInfo | undefined }) {
  if (!port) {
    return (
      <section className="panel px-5 py-5" aria-label="Port detail">
        <p className="font-display text-[15px] font-bold text-harbour-950">No port selected</p>
        <p className="mt-1 text-[13px] text-slate-600">
          Select a port marker on the plot or a card in the ledger to inspect its constraints and
          operating picture.
        </p>
      </section>
    );
  }
  const cap = portCapability(port);
  const rows: { k: string; v: string }[] = [
    { k: "Max draft", v: port.max_draft_m !== undefined ? `${port.max_draft_m} m` : "—" },
    { k: "Max LOA", v: port.max_loa_m !== undefined ? `${port.max_loa_m} m` : "—" },
    { k: "Max beam", v: port.max_beam_m !== undefined ? `${port.max_beam_m} m` : "—" },
    {
      k: "Handling capacity",
      v: port.cargo_handling_capacity_mtpa !== undefined ? `${port.cargo_handling_capacity_mtpa} MTPA` : "—",
    },
    { k: "Port type", v: port.port_type ? String(port.port_type) : "—" },
  ];
  return (
    <section className="panel" aria-label={`Intelligence for ${port.port_name}`}>
      <div className="card-head">
        <div>
          <p className="card-kicker">Port intelligence</p>
          <h3 className="font-display text-lg font-bold tracking-tight text-harbour-950">
            {port.port_name}
            {port.state ? (
              <span className="ml-2 font-body text-[12px] font-normal text-slate-500">{port.state}</span>
            ) : null}
          </h3>
        </div>
        <StatusIndicator tone={cap.tone} label={cap.label} />
      </div>
      <div className="px-5 sm:px-6 py-4">
        <dl>
          {rows.map((r) => (
            <ConstraintRow key={r.k} k={r.k} v={r.v} />
          ))}
        </dl>
        {port.notes ? (
          <p className="mt-3 text-[12.5px] leading-relaxed text-slate-600">{port.notes}</p>
        ) : null}
      </div>
    </section>
  );
}
