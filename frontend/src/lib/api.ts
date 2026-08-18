import axios from "axios";

export const api = axios.create({
  baseURL: "/api/backend",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

let refreshPromise: Promise<void> | null = null;
api.interceptors.response.use((response) => response, async (error) => {
  const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
  if (error.response?.status === 401 && original && !original._retried) {
    original._retried = true;
    refreshPromise ??= fetch("/api/auth/refresh", { method: "POST" }).then((response) => { if (!response.ok) throw new Error("Session expired"); }).finally(() => { refreshPromise = null; });
    await refreshPromise;
    return api.request(original);
  }
  return Promise.reject(error);
});
