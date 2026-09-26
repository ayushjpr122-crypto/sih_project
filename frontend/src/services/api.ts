/* Centralized API service — the ONLY place that talks to FastAPI.
   Base URL from VITE_API_BASE_URL, dev default http://127.0.0.1:8000/api/v1 */
import type {
  DecisionRequest,
  DecisionResponse,
  DemoScenarioResponse,
  HealthResponse,
  ModelsResponse,
  PortsResponse,
  VesselsResponse,
} from "../types";

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000/api/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error(
      "Unable to connect to the decision engine. Please check that the backend is running."
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
