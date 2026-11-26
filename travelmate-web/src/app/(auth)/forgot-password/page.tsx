"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { authApi } from "@/features/auth/api";
import { forgotSchema } from "@/features/auth/schemas";
import { errorMessage } from "@/lib/api-client";
import { IS_DEMO } from "@/demo/config";

export default function ForgotPasswordPage() {
  const form = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });
  const forgot = useMutation({ mutationFn: (email: string) => authApi.forgotPassword(email) });

  if (forgot.isSuccess) {
    return (
      <div className="text-center">
        <MailCheck className="mx-auto size-8 text-sage" aria-hidden />
        <h1 className="mt-4 font-display text-2xl font-semibold">Check your email</h1>
        <p className="mt-2 text-sm text-ink-muted">
          If an account exists for {form.getValues("email")}, we&apos;ve sent a link to reset the password. The link
          expires in 30 minutes.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-sage hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold">Reset your password</h1>
      <p className="mt-1 text-sm text-ink-muted">We&apos;ll email you a link to choose a new one.</p>
      {IS_DEMO && (
        <p className="mt-3 rounded-md bg-amber-soft px-3 py-2 text-[13px]">
          The demo doesn&apos;t send emails. Use “Reset demo” in the banner to start over instead.
        </p>
      )}
      <form onSubmit={form.handleSubmit((v) => forgot.mutate(v.email))} className="mt-8 space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        </Field>
        {forgot.error && (
          <p role="alert" className="text-sm text-danger">
            {errorMessage(forgot.error)}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={forgot.isPending}>
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-sage hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
