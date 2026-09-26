import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { ORIGIN_COORDS, PORT_COORDS } from "../data/portCoords";

export type GlobeTone = "ok" | "warn" | "bad" | "info" | "muted";

const TONE_DOT: Record<GlobeTone, string> = {
  ok: "#16A34A",
  warn: "#F59E0B",
  bad: "#DC2626",
  info: "#2A6E8C",
  muted: "#A8A29E",
};

/* Lazy-load the heavy WebGL globe so the rest of the app stays fast. */
const EarthCanvas = lazy(() => import("./EarthCanvas"));

export default function GlobeView({
  selected,
  onSelect,
  scenarioOrigin,
  toneFor,
}: {
  selected: string | null;
  onSelect: (portName: string) => void;
  scenarioOrigin?: string;
  toneFor?: (portName: string) => GlobeTone;
}) {
  const tones = useMemo(() => {
    const m = new Map<string, GlobeTone>();
    for (const c of PORT_COORDS) m.set(c.port_name, toneFor ? toneFor(c.port_name) : "muted");
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toneFor]);

  const [failed, setFailed] = useState(false);
  const activePort = PORT_COORDS.find((c) => selected && c.port_name === selected);

  useEffect(() => {
    const onErr = () => setFailed(true);
    window.addEventListener("error", onErr);
    return () => window.removeEventListener("error", onErr);
  }, []);

  if (failed) {
    return (
      <figure className="globe-frame" aria-label="Port geography (globe unavailable)">
        <div className="px-5 py-8 text-center">
          <p className="font-display text-[15px] font-bold text-[#1A1A1A]">
            3D globe unavailable in this browser
          </p>
          <p className="mt-1 text-[13px] text-[#6E6A60]">
            WebGL could not be initialised. Use the port ledger to inspect each port.
          </p>
          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            {PORT_COORDS.map((c) => (
              <li key={c.port_name}>
                <button
                  type="button"
                  onClick={() => onSelect(c.port_name)}
                  aria-pressed={selected === c.port_name}
                  className={`rounded-[2px] border px-3 py-1.5 font-display text-[13px] font-bold transition ${
                    selected === c.port_name
                      ? "border-[#2A6E8C] bg-[#2A6E8C] text-white"
                      : "border-[#D8CFB8] bg-white text-[#1A1A1A] hover:border-[#2A6E8C]"
                  }`}
                >
                  {c.port_name}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-[rgba(0,0,0,0.06)] bg-[#F5F1E8] px-4 py-2.5">
          <span className="font-mono text-[10px] tracking-[0.14em] text-[#6E6A60]">
            EAST COAST PLOT · WEBGL UNAVAILABLE
          </span>
          <span className="font-mono text-[10px] tracking-[0.14em] text-[#6E6A60]">
            {selected ? `SELECTED · ${selected.toUpperCase()}` : "SELECT A PORT"}
          </span>
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className="globe-frame" aria-label="Interactive 3D Earth globe of East Coast India">
      <Suspense
        fallback={
          <div className="px-5 py-10 text-center" role="status" aria-label="Loading 3D globe">
            <div className="skeleton mx-auto h-56 rounded-[2px]" aria-hidden />
            <p className="mt-3 font-mono text-[11px] tracking-[0.14em] text-[#6E6A60]">
              LOADING 3D EARTH…
            </p>
          </div>
        }
      >
        <EarthCanvas
          selected={selected}
          onSelect={onSelect}
          scenarioOrigin={scenarioOrigin}
          tones={tones}
        />
      </Suspense>
      {/* Origin legend — warm, restrained */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[rgba(0,0,0,0.06)] bg-[#F5F1E8] px-4 py-2">
        {ORIGIN_COORDS.slice(0, 4).map((o) => (
          <span key={o.key} className="font-mono text-[10px] tracking-[0.1em] text-[#6E6A60]">
            <span className="mr-1 inline-block h-1.5 w-1.5 rotate-45 border border-[#2A6E8C]" aria-hidden />
            {o.label.toUpperCase()}
          </span>
        ))}
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-[rgba(0,0,0,0.06)] bg-[#EFE7D3] px-4 py-2.5">
        <span className="font-mono text-[10px] tracking-[0.14em] text-[#6E6A60]">
          3D EARTH · DRAG TO ROTATE · SCROLL/PINCH TO ZOOM
        </span>
        <span className="font-mono text-[10px] tracking-[0.14em] text-[#1A1A1A]">
          {activePort ? `SELECTED · ${activePort.port_name.toUpperCase()}` : "SELECT A PORT MARKER"}
        </span>
      </figcaption>
      {/* Screen-reader / keyboard port list mirroring the markers */}
      <ul className="sr-only">
        {PORT_COORDS.map((c) => (
          <li key={c.port_name}>
            <button type="button" onClick={() => onSelect(c.port_name)}>
              Select {c.port_name}
            </button>
          </li>
        ))}
      </ul>
      <span className="sr-only" aria-live="polite">
        {selected ? `${selected} selected.` : "No port selected."}
      </span>
    </figure>
  );
}

export { TONE_DOT };
