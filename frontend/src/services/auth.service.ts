import axios from "axios";
import type { AuthUser, LoginCredentials } from "@/types/auth";

export const authService = {
  async login(credentials: LoginCredentials) {
    const { data } = await axios.post<AuthUser>("/api/auth/login", credentials, { withCredentials: true });
    return data;
  },
  async logout() { await axios.post("/api/auth/logout", undefined, { withCredentials: true }); },
  async logoutAll() { await axios.post("/api/auth/logout-all", undefined, { withCredentials: true }); },
};
