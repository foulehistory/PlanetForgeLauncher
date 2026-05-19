/**
 * Central API configuration.
 * Override via VITE_API_URL in .env (set to public server IP for distribution).
 * WS_BASE is derived automatically (http → ws).
 */
const env = (import.meta as { env: Record<string, string> }).env;

export const API_BASE = env?.VITE_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";
export const WS_BASE  = API_BASE.replace(/^http/, "ws");
