import "server-only";
import { serverApi } from "@/lib/server-api";
import type { ApiHotel, ApiRole, ApiSystemUser } from "@/types/api-contracts";
import type { SystemUser } from "@/types/management";

export async function getCurrentHotel() { return serverApi<ApiHotel>("/hotels/current"); }
export async function getSystemUsers(): Promise<SystemUser[]> { const users = await serverApi<ApiSystemUser[]>("/users"); return users.map((user) => ({ id: user.id, name: user.fullName, email: user.email, role: user.roles.map((role) => role.name).join(", ") || "No role", status: user.status === "ACTIVE" ? "active" : "disabled", lastActive: user.lastLoginAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(user.lastLoginAt)) : "Never" })); }
export async function getRoles(): Promise<ApiRole[]> { return serverApi<ApiRole[]>("/roles"); }
