"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useLogin } from "@/features/auth/hooks";
import { loginSchema, type LoginValues } from "@/features/auth/schemas";
import { ApiError, errorMessage } from "@/lib/api-client";

function safeNext(next: string | null): string {
  // Only allow same-site relative paths to avoid open redirects.
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    login.mutate(values, { onSuccess: () => router.replace(safeNext(params.get("next"))) }),
  );

  const serverError =
    login.error instanceof ApiError && login.error.code === "INVALID_CREDENTIALS"
      ? "That email and password don't match."
      : login.error
        ? errorMessage(login.error)
        : null;

  return (
    <>
      <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-muted">Sign in to pick up where you left off.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...form.register("password")} />
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-[13px] text-sage hover:underline">
            Forgot password?
          </Link>
        </div>
        {serverError && (
          <p role="alert" className="rounded-md bg-terracotta-soft px-3 py-2 text-sm text-danger">
            {serverError}
          </p>
        )}
        <Button type="submit" className="w-full" size="lg" loading={login.isPending}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-muted">
        New to TravelMate?{" "}
        <Link href="/register" className="font-medium text-sage hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
