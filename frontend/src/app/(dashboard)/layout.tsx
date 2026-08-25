import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ShellSkeleton } from "@/components/layout/shell-skeleton";
import { getCurrentUser } from "@/services/auth.server";
import { redirect } from "next/navigation";
import { AuthProvider } from "@/components/providers/auth-provider";
import { getHotelContext } from "@/services/system.server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const hotel = await getHotelContext();
  return <AuthProvider user={user}><Suspense fallback={<ShellSkeleton />}><AppShell user={user} hotel={hotel}>{children}</AppShell></Suspense></AuthProvider>;
}
