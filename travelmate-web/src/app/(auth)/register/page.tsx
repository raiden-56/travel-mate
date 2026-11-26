"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useRegister } from "@/features/auth/hooks";
import { registerSchema, type RegisterValues } from "@/features/auth/schemas";
import { ApiError, errorMessage } from "@/lib/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const register = useRegister();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    register.mutate(values, {
      onSuccess: () => router.replace("/home"),
      onError: (err) => {
        if (err instanceof ApiError) {
          if (err.code === "EMAIL_TAKEN") form.setError("email", { message: "An account with this email already exists" });
          err.fieldErrors.forEach((fe) => {
            if (fe.field in values) form.setError(fe.field as keyof RegisterValues, { message: fe.message });
          });
        }
      },
    }),
  );

  const serverError =
    register.error && !(register.error instanceof ApiError && (register.error.code === "EMAIL_TAKEN" || register.error.fieldErrors.length))
      ? errorMessage(register.error)
      : null;

  return (
    <>
      <h1 className="font-display text-2xl font-semibold">Create your account</h1>
      <p className="mt-1 text-sm text-ink-muted">Plan trips, save places and keep everything in one place.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <Field label="Your name" htmlFor="displayName" error={errors.displayName?.message}>
          <Input id="displayName" autoComplete="name" aria-invalid={!!errors.displayName} {...form.register("displayName")} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          hint="At least 8 characters, with a letter and a number."
        >
          <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register("password")} />
        </Field>
        {serverError && (
          <p role="alert" className="rounded-md bg-terracotta-soft px-3 py-2 text-sm text-danger">
            {serverError}
          </p>
        )}
        <Button type="submit" className="w-full" size="lg" loading={register.isPending}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-sage hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
