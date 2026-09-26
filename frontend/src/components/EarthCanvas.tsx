import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ORIGIN_COORDS, PORT_COORDS } from "../data/portCoords";
import type { GlobeTone } from "./GlobeView";

/* Realistic Earth textures (Blue Marble day map + topology bump).
   Loaded at runtime from the three-globe example assets on unpkg. */
const EARTH_MAP_URL = "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
const EARTH_BUMP_URL = "https://unpkg.com/three-globe/example/img/earth-topology.png";

const TONE_DOT: Record<GlobeTone, string> = {
  ok: "#16A34A",
  warn: "#F59E0B",
  bad: "#DC2626",
  info: "#2A6E8C",
  muted: "#A8A29E",
};

/** Maritime marker colors — restrained, no glow. */
const MARKER_BASE = "#2A6E8C";
const MARKER_SELECTED = "#8F5251";

/** Initial camera: India / East Coast / Bay of Bengal / Indian Ocean. */
const INITIAL_LAT = 17;
const INITIAL_LON = 86;
const INITIAL_DIST = 2.7;
const MIN_DIST = 1.45; // close enough to inspect Paradip / Vizag / Gangavaram / Dhamra
const MAX_DIST = 4.2;

function latLonToVec3(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

function normOrigin(s: string | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

export default function EarthCanvas({
  selected,
  onSelect,
  scenarioOrigin,
  tones,
}: {
  selected: string | null;
  onSelect: (portName: string) => void;
  scenarioOrigin?: string;
  tones: Map<string, GlobeTone>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const stateRef = useRef<{
    selected: string | null;
    scenarioOrigin?: string;
    tones: Map<string, GlobeTone>;
  }>({ selected, scenarioOrigin, tones });
  stateRef.current = { selected, scenarioOrigin, tones };

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const W = () => wrap.clientWidth || 640;
    const H = () => Math.round((wrap.clientWidth || 640) * 0.62);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W(), H());
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "auto";
    wrap.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.1, 100);
    camera.position.copy(latLonToVec3(INITIAL_LAT, INITIAL_LON, INITIAL_DIST));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.8;
    controls.minDistance = MIN_DIST;
    controls.maxDistance = MAX_DIST;
    controls.autoRotate = !reduced;
    controls.autoRotateSpeed = 0.35;

    scene.add(new THREE.AmbientLight(0xffffff, 1.05));
    const sun = new THREE.DirectionalLight(0xfff6e8, 1.7);
    sun.position.set(4, 2.5, 3);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xdce5ea, 0.35);
    fill.position.set(-4, -1, -2);
    scene.add(fill);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Ocean + land: natural Blue Marble day map. Oceans render as restrained
    // deep blue; land as muted olive/green/brown/tan terrain — never neon.
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const earthMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      specular: new THREE.Color(MARKER_BASE),
      shininess: 14,
    });
    loader.load(
      EARTH_MAP_URL,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        earthMat.map = tex;
        earthMat.needsUpdate = true;
      },
      undefined,
      () => {
        // Offline / CDN fallback: restrained deep maritime ocean, no pale blue.
        earthMat.color = new THREE.Color("#274f63");
      }
    );
    loader.load(
      EARTH_BUMP_URL,
      (tex) => {
        earthMat.bumpMap = tex;
        earthMat.bumpScale = 0.02;
        earthMat.needsUpdate = true;
      },
      undefined,
      () => {}
    );
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 72), earthMat);
    globeGroup.add(earth);

    // Faint warm limb so the sphere reads crisply against the sand canvas.
    const limb = new THREE.Mesh(
      new THREE.SphereGeometry(1.004, 72, 72),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#8f5251"),
        transparent: true,
        opacity: 0.08,
        side: THREE.BackSide,
      })
    );
    globeGroup.add(limb);

    const markerGeo = new THREE.SphereGeometry(0.014, 20, 20);
    const markers = new Map<string, THREE.Mesh>();
    for (const c of PORT_COORDS) {
      const m = new THREE.Mesh(
        markerGeo,
        new THREE.MeshBasicMaterial({ color: new THREE.Color(MARKER_BASE) })
      );
      m.position.copy(latLonToVec3(c.lat, c.lon, 1.012));
      m.userData.port = c.port_name;
      globeGroup.add(m);
      markers.set(c.port_name, m);
    }

    // Selection ring — thin, restrained, terracotta.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.026, 0.031, 48),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(MARKER_SELECTED),
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
      })
    );
    ring.visible = false;
    globeGroup.add(ring);

    const arcs = new THREE.Group();
    globeGroup.add(arcs);

    function rebuildArcs() {
      while (arcs.children.length > 0) {
        const child = arcs.children.pop()!;
        const line = child as THREE.Line;
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
      const { selected: sel, scenarioOrigin: scen } = stateRef.current;
      if (!sel) return;
      const dest = PORT_COORDS.find((c) => c.port_name === sel);
      if (!dest) return;
      const to = latLonToVec3(dest.lat, dest.lon, 1.015);
      for (const o of ORIGIN_COORDS) {
        const from = latLonToVec3(o.lat, o.lon, 1.015);
        const isScenario =
          scen != null && normOrigin(scen) !== "" && normOrigin(o.key).includes(normOrigin(scen).slice(0, 5));
        const mid = from
          .clone()
          .add(to)
          .multiplyScalar(0.5)
          .normalize()
          .multiplyScalar(1 + from.distanceTo(to) * 0.28);
        const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
        const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(64));
        const mat = new THREE.LineBasicMaterial({
          color: new THREE.Color(isScenario ? MARKER_SELECTED : "#406993"),
          transparent: true,
          opacity: isScenario ? 0.95 : 0.45,
        });
        arcs.add(new THREE.Line(geo, mat));
      }
    }

    // HTML overlay labels — clickable, focusable, synced with the ledger.
    const overlay = document.createElement("div");
    overlay.style.position = "absolute";
    overlay.style.inset = "0";
    overlay.style.pointerEvents = "none";
    overlay.style.overflow = "hidden";
    wrap.appendChild(overlay);

    const labelBtns = new Map<string, HTMLButtonElement>();
    for (const c of PORT_COORDS) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = c.port_name;
      b.setAttribute("aria-label", `Select ${c.port_name} on globe`);
      b.style.pointerEvents = "auto";
      b.style.position = "absolute";
      b.style.left = "0";
      b.style.top = "0";
      b.style.transform = "translate(-50%,-140%)";
      b.style.whiteSpace = "nowrap";
      b.style.cursor = "pointer";
      b.style.fontFamily = "'Schibsted Grotesk', system-ui, sans-serif";
      b.style.fontSize = "11px";
      b.style.fontWeight = "600";
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current(c.port_name);
      });
      overlay.appendChild(b);
      labelBtns.set(c.port_name, b);
    }

    function paintLabels() {
      const { selected: sel, tones: tm } = stateRef.current;
      for (const c of PORT_COORDS) {
        const b = labelBtns.get(c.port_name);
        if (!b) continue;
        const isSel = sel === c.port_name;
        const dot = TONE_DOT[tm.get(c.port_name) ?? "muted"];
        b.setAttribute("aria-pressed", isSel ? "true" : "false");
        b.style.background = isSel ? "#1A1A1A" : "rgba(255,255,255,0.94)";
        b.style.color = isSel ? "#F3EDE0" : "#1A1A1A";
        b.style.border = isSel ? "1px solid #8F5251" : "1px solid #D8CFB8";
        b.style.borderLeft = `3px solid ${isSel ? "#8F5251" : dot}`;
        b.style.borderRadius = "2px";
        b.style.padding = "2px 7px 2px 5px";
        b.style.boxShadow = "0 1px 2px rgba(26,26,26,.18)";
      }
    }

    function applySelection(focus: boolean) {
      const { selected: sel } = stateRef.current;
      for (const [name, mesh] of markers) {
        const isSel = name === sel;
        (mesh.material as THREE.MeshBasicMaterial).color.set(isSel ? MARKER_SELECTED : MARKER_BASE);
        mesh.scale.setScalar(isSel ? 1.6 : 1);
      }
      const dest = PORT_COORDS.find((c) => c.port_name === sel);
      if (dest) {
        const p = latLonToVec3(dest.lat, dest.lon, 1.012);
        ring.visible = true;
        ring.position.copy(p.clone().multiplyScalar(1.004));
        ring.lookAt(p.clone().multiplyScalar(2));
        if (focus) {
          if (reduced) {
            const d = camera.position.length();
            camera.position.copy(p.clone().normalize().multiplyScalar(d));
          } else {
            focusTarget.copy(p.clone().normalize());
            hasFocusTarget = true;
          }
        }
      } else {
        ring.visible = false;
      }
      rebuildArcs();
      paintLabels();
    }

    const focusTarget = new THREE.Vector3(0, 0, 1);
    let hasFocusTarget = false;

    const stopAuto = () => {
      controls.autoRotate = false;
      hasFocusTarget = false;
    };
    controls.addEventListener("start", stopAuto);

    applySelection(false);
    // Initial camera already faces India; no focus jump on mount.
    hasFocusTarget = false;

    const v3 = new THREE.Vector3();
    let raf = 0;
    function tick() {
      raf = requestAnimationFrame(tick);
      if (hasFocusTarget && !reduced) {
        const dir = camera.position.clone().normalize();
        dir.lerp(focusTarget, 0.07).normalize();
        const dist = THREE.MathUtils.clamp(camera.position.length(), MIN_DIST, MAX_DIST);
        camera.position.copy(dir.multiplyScalar(dist));
        if (dir.angleTo(focusTarget) < 0.004) hasFocusTarget = false;
      }
      controls.update();
      // Keep HTML labels glued to their 3D anchors; hide back-face markers.
      const w = W();
      const h = H();
      const camDir = camera.position.clone().normalize();
      for (const c of PORT_COORDS) {
        const b = labelBtns.get(c.port_name);
        if (!b) continue;
        const pos = latLonToVec3(c.lat, c.lon, 1.012).applyMatrix4(globeGroup.matrixWorld);
        const facing = pos.clone().normalize().dot(camDir);
        v3.copy(pos).project(camera);
        const x = (v3.x * 0.5 + 0.5) * w;
        const y = (-v3.y * 0.5 + 0.5) * h;
        const nudgeX = c.dx ?? 0;
        const nudgeY = c.dy ?? 0;
        b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%,-150%) translate(${nudgeX}px, ${nudgeY}px)`;
        const visible = facing > 0.14 && v3.z < 1;
        b.style.opacity = visible ? "1" : "0";
        b.style.pointerEvents = visible ? "auto" : "none";
        b.tabIndex = visible ? 0 : -1;
      }
      renderer.render(scene, camera);
    }
    tick();

    const onResize = () => {
      const w = W();
      const h = H();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(wrap);

    // Re-apply selection/scenario/tones without rebuilding the scene.
    function onExternalUpdate() {
      applySelection(true);
    }
    wrap.addEventListener("globe:select", onExternalUpdate);

    // Explicit zoom buttons (keyboard accessible) dolly the camera
    // within the same sensible min/max limits as wheel/pinch zoom.
    function onZoom(e: Event) {
      const dir = (e as CustomEvent<1 | -1>).detail === -1 ? 0.8 : 1.25;
      const next = THREE.MathUtils.clamp(camera.position.length() * dir, MIN_DIST, MAX_DIST);
      camera.position.setLength(next);
      hasFocusTarget = false;
    }
    wrap.addEventListener("globe:zoom", onZoom);

    return () => {
      wrap.removeEventListener("globe:select", onExternalUpdate);
      wrap.removeEventListener("globe:zoom", onZoom);
      controls.removeEventListener("start", stopAuto);
      cancelAnimationFrame(raf);
      ro.disconnect();
      overlay.remove();
      renderer.domElement.remove();
      markerGeo.dispose();
      (ring.geometry as THREE.BufferGeometry).dispose();
      (ring.material as THREE.Material).dispose();
      (earth.geometry as THREE.BufferGeometry).dispose();
      (earthMat.map as THREE.Texture | null)?.dispose();
      (earthMat.bumpMap as THREE.Texture | null)?.dispose();
      earthMat.dispose();
      renderer.dispose();
    };
    // Mount once; selection updates flow through the dispatch below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notify the mounted scene of selection / scenario / tone changes.
  // The tones Map identity churns every render (inline toneFor), so depend on
  // a value signature — otherwise the camera would re-focus while dragging.
  const toneSignature = [...tones].map(([k, v]) => `${k}:${v}`).join("|");
  useEffect(() => {
    wrapRef.current?.dispatchEvent(new Event("globe:select"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, scenarioOrigin, toneSignature]);

  const zoom = (dir: 1 | -1) => {
    wrapRef.current?.dispatchEvent(
      new CustomEvent("globe:zoom", { detail: dir })
    );
  };

  return (
    <div className="relative">
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: "16 / 9.9",
          background:
            "radial-gradient(120% 90% at 50% 30%, #F7F2E6 0%, #EFE7D3 55%, #E4D8BC 100%)",
          touchAction: "none",
          cursor: "grab",
        }}
        role="application"
        aria-label="Interactive 3D Earth. Drag to rotate, scroll or pinch to zoom, Tab to reach port markers, Enter to select."
      />
      {/* Zoom controls — explicit, keyboard accessible */}
      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        <button
          type="button"
          aria-label="Zoom in on globe"
          onClick={() => zoom(-1)}
          className="grid h-8 w-8 place-items-center rounded-[2px] border border-[#D8CFB8] bg-white/95 font-display text-lg font-bold text-[#1A1A1A] shadow-sm transition hover:border-[#2A6E8C] hover:text-[#2A6E8C]"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out of globe"
          onClick={() => zoom(1)}
          className="grid h-8 w-8 place-items-center rounded-[2px] border border-[#D8CFB8] bg-white/95 font-display text-lg font-bold text-[#1A1A1A] shadow-sm transition hover:border-[#2A6E8C] hover:text-[#2A6E8C]"
        >
          −
        </button>
      </div>
      <p className="pointer-events-none absolute bottom-2 left-3 font-mono text-[10px] tracking-[0.14em] text-[#6E6A60]">
        BAY OF BENGAL · INDIAN OCEAN
      </p>
    </div>
  );
}
