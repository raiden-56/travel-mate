"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Lock, RotateCw, SearchX, WifiOff } from "lucide-react";
import { ApiError, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-6 py-12 text-center", className)}>
      <div className="mb-3 text-ink-muted [&_svg]:size-6">{icon ?? <SearchX />}</div>
      <p className="font-display text-base font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Renders the right message for not-found / forbidden / offline / generic errors, with retry. */
export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const api = error instanceof ApiError ? error : null;
  let icon = <AlertTriangle />;
  let title = "Something went wrong";
  let body = errorMessage(error);
  let action: React.ReactNode = onRetry ? (
    <Button variant="secondary" size="sm" onClick={onRetry}>
      <RotateCw /> Try again
    </Button>
  ) : null;

  if (api?.isNotFound) {
    title = "Not found";
    body = "This page doesn't exist or you no longer have access to it.";
    action = (
      <Button variant="secondary" size="sm" asChild>
        <Link href="/home">Go home</Link>
      </Button>
    );
  } else if (api?.isForbidden) {
    icon = <Lock />;
    title = "You don't have access";
    body = "Ask the owner or an administrator for permission.";
    action = null;
  } else if (api?.isNetwork) {
    icon = <WifiOff />;
    title = "You're offline or the server is unreachable";
  }

  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center rounded-lg bg-surface px-6 py-12 text-center", className)}>
      <div className="mb-3 text-terracotta [&_svg]:size-6">{icon}</div>
      <p className="font-display text-base font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[13px] text-ink-muted">{eyebrow}</div>}
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
