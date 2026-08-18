"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorMessage } from "@/components/shared/error-message";
import { getApiError } from "@/lib/api-error";
import { loginSchema, type LoginFormValues } from "@/schemas/auth.schema";
import { authService } from "@/services/auth.service";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setSubmitError(null);
    try {
      await authService.login(values);
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setSubmitError(getApiError(error).message);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      {submitError ? <ErrorMessage title="Sign in failed" message={submitError} /> : null}
      <div className="space-y-2">
        <Label htmlFor="identifier">Email or username</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="identifier" autoComplete="username" placeholder="you@hotel.com or username" className="h-11 pl-10" aria-invalid={Boolean(errors.identifier)} {...register("identifier")} />
        </div>
        {errors.identifier ? <p className="text-sm text-destructive">{errors.identifier.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" className="h-11 px-10" aria-invalid={Boolean(errors.password)} {...register("password")} />
          <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
      </div>
      <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
        {isSubmitting ? <><LoaderCircle className="animate-spin" />Signing in...</> : "Sign in"}
      </Button>
    </form>
  );
}
