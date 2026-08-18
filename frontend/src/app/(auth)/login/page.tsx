import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { BrandMark } from "@/components/shared/brand-mark";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden overflow-hidden bg-[#0c2c26] px-12 py-10 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_20%_20%,rgba(46,182,139,.45),transparent_32%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,.09),transparent_30%)]" />
        <BrandMark className="relative [&_p]:text-white [&_p:last-child]:text-emerald-100/70" />
        <div className="relative my-auto max-w-xl">
          <p className="mb-5 text-sm font-medium uppercase tracking-[0.18em] text-emerald-200">Built for daily hotel work</p>
          <h1 className="text-balance text-5xl font-semibold leading-[1.08] tracking-[-0.045em]">Run your hotel with clarity.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-emerald-50/70">Fast room operations, clear accountability, and fewer mistakes at the front desk—even on a slow connection.</p>
          <ul className="mt-10 grid gap-4 text-sm text-emerald-50/85">
            {["Secure role-based access", "Real-time room status", "Simple enough for every shift"].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-emerald-300" aria-hidden="true" />{item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-emerald-100/50">Hotel operations, without the enterprise price tag.</p>
      </section>

      <section className="flex min-h-dvh items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[410px]">
          <BrandMark className="mb-12 lg:hidden" />
          <div className="mb-8">
            <p className="text-sm font-medium text-primary">Welcome back</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">Sign in to your hotel</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Use the account provided by your hotel administrator.</p>
          </div>
          <LoginForm nextPath={safeNext} />
          <p className="mt-8 text-center text-xs leading-5 text-muted-foreground">Having trouble signing in? Contact your hotel administrator.</p>
        </div>
      </section>
    </main>
  );
}
