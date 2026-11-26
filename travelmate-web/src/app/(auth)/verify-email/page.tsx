"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { authApi } from "@/features/auth/api";
import { errorMessage } from "@/lib/api-client";

function Verify() {
  const token = useSearchParams().get("token") ?? "";
  const verify = useMutation({ mutationFn: () => authApi.verifyEmail(token) });
  const { mutate } = verify;

  const fired = useRef(false);
  useEffect(() => {
    // Tokens are single-use; guard against React strict-mode double effects.
    if (token && !fired.current) {
      fired.current = true;
      mutate();
    }
  }, [token, mutate]);

  return (
    <div className="text-center">
      {verify.isPending || verify.isIdle ? (
        <Loader2 className="mx-auto size-8 animate-spin text-sage" aria-label="Verifying" />
      ) : verify.isSuccess ? (
        <>
          <CheckCircle2 className="mx-auto size-8 text-sage" aria-hidden />
          <h1 className="mt-4 font-display text-2xl font-semibold">Email verified</h1>
        </>
      ) : (
        <>
          <XCircle className="mx-auto size-8 text-danger" aria-hidden />
          <h1 className="mt-4 font-display text-2xl font-semibold">We couldn&apos;t verify that link</h1>
          <p className="mt-2 text-sm text-ink-muted">{token ? errorMessage(verify.error) : "The link is incomplete."}</p>
        </>
      )}
      <Link href="/home" className="mt-6 inline-block text-sm font-medium text-sage hover:underline">
        Continue to TravelMate
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
