"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { authApi } from "@/features/auth/api";
import { resetSchema } from "@/features/auth/schemas";
import { errorMessage } from "@/lib/api-client";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const form = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirm: "" } });
  const reset = useMutation({ mutationFn: (pw: string) => authApi.resetPassword(token, pw) });

  if (!token)
    return (
      <p className="text-sm text-ink-muted">
        This reset link is incomplete. <Link href="/forgot-password" className="text-sage underline">Request a new one</Link>.
      </p>
    );

  if (reset.isSuccess)
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-8 text-sage" aria-hidden />
        <h1 className="mt-4 font-display text-2xl font-semibold">Password updated</h1>
        <p className="mt-2 text-sm text-ink-muted">You&apos;ve been signed out of other devices.</p>
        <Button asChild className="mt-6">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );

  const { errors } = form.formState;
  return (
    <>
      <h1 className="font-display text-2xl font-semibold">Choose a new password</h1>
      <form onSubmit={form.handleSubmit((v) => reset.mutate(v.password))} className="mt-8 space-y-4" noValidate>
        <Field label="New password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters, with a letter and a number.">
          <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
        </Field>
        {reset.error && (
          <p role="alert" className="text-sm text-danger">
            {errorMessage(reset.error)}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={reset.isPending}>
          Update password
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
