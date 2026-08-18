import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ShellSkeleton } from "@/components/layout/shell-skeleton";
import { getCurrentUser } from "@/services/auth.server";
import { redirect } from "next/navigation";
import { AuthProvider } from "@/components/providers/auth-provider";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <AuthProvider user={user}><Suspense fallback={<ShellSkeleton />}><AppShell user={user}>{children}</AppShell></Suspense></AuthProvider>;
}
