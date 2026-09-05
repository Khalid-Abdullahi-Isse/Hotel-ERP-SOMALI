import axios from "axios";

export const api = axios.create({
  baseURL: "/api/backend",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

let refreshPromise: Promise<boolean> | null = null;
api.interceptors.response.use((response) => response, async (error) => {
  const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
  if (error.response?.status === 401 && original && !original._retried) {
    original._retried = true;
    refreshPromise ??= fetch("/api/auth/refresh", { method: "POST" })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => { refreshPromise = null; });
    const refreshed = await refreshPromise;
    if (!refreshed) {
      if (typeof window !== "undefined") window.location.assign("/login");
      return Promise.reject(error);
    }
    return api.request(original);
  }
  return Promise.reject(error);
});
