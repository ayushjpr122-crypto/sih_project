/* Centralized API service — the ONLY place that talks to FastAPI.
   Env-var resolution (first match wins):
     1. VITE_API_BASE_URL — already includes /api/v1  (local .env, legacy)
     2. VITE_API_URL      — bare origin (Vercel); we append /api/v1 here
     3. fallback          — relative /api/v1 (Vite proxy, local dev)         */
import type {
  DecisionRequest,
  DecisionResponse,
  DemoScenarioResponse,
  HealthResponse,
  ModelsResponse,
  PortsResponse,
  VesselsResponse,
} from "../types";

const _baseUrl = (() => {
  // 1. Explicit base URL (local dev .env — already includes /api/v1)
  const explicit = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");
  if (explicit) return explicit;
  // 2. Bare origin set in Vercel (VITE_API_URL=https://...onrender.com)
  const origin = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");
  if (origin) return `${origin}/api/v1`;
  // 3. Relative fallback — Vite proxy forwards /api/* → localhost:8001
  return "/api/v1";
})();

const BASE_URL = _baseUrl;


async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error(
      "Unable to complete the analysis. Please check your connection and try again."
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail =
      body && typeof body.detail === "string"
        ? body.detail
        : Array.isArray(body?.detail)
          ? body.detail.map((e: { msg?: string }) => e.msg ?? "Invalid input").join("; ")
          : `Request failed (${res.status})`;
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export const api = {
  baseUrl: BASE_URL,
  getHealth: () => request<HealthResponse>("/health"),
  getPorts: () => request<PortsResponse>("/ports"),
  getVessels: () => request<VesselsResponse>("/vessels"),
  getModels: () => request<ModelsResponse>("/models"),
  getDemoScenario: () => request<DemoScenarioResponse>("/demo-scenario"),
  analyzeDecision: (payload: DecisionRequest) =>
    request<DecisionResponse>("/decision", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
