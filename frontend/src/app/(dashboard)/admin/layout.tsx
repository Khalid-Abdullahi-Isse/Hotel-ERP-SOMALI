import { redirect } from "next/navigation";
import { getCurrentUser } from "@/services/auth.server";
import { isAdmin } from "@/lib/permissions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/403");
  return children;
}
