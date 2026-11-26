import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-muted", className)} {...props} />;
}

type BadgeTone = "neutral" | "sage" | "amber" | "terracotta" | "forest" | "danger";
const toneClass: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-ink-muted",
  sage: "bg-sage-soft text-forest",
  amber: "bg-amber-soft text-[#8a5a2b] dark:text-amber",
  terracotta: "bg-terracotta-soft text-[#8f4b34] dark:text-terracotta",
  forest: "bg-forest text-on-forest",
  danger: "bg-terracotta-soft text-danger",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium leading-5 [&_svg]:size-3",
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg bg-surface shadow-[var(--shadow-soft)]", className)} {...props} />;
}

export function Progress({ value, className, tone = "sage", label }: { value: number; className?: string; tone?: "sage" | "amber" | "danger"; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-muted", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          tone === "sage" && "bg-sage",
          tone === "amber" && "bg-amber",
          tone === "danger" && "bg-danger",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-surface-muted px-1.5 py-0.5 font-sans text-[11px] text-ink-muted">
      {children}
    </kbd>
  );
}
