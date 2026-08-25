import type { Metadata } from "next";
import { BrandMark } from "@/components/shared/brand-mark";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-[440px]">
        <BrandMark className="mb-8 justify-center" />
        <Card className="shadow-card">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-7 text-center">
              <h1 className="text-2xl font-semibold tracking-[-0.025em]">Welcome back</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in to manage hotel operations.</p>
            </div>
            <LoginForm nextPath={safeNext} />
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">Having trouble signing in? Contact your hotel administrator.</p>
      </div>
    </main>
  );
}
