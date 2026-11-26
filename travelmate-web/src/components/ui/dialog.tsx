"use client";

import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

type ContentProps = React.ComponentProps<typeof D.Content> & {
  title: string;
  description?: string;
  /** "center" = modal, "sheet" = slides from the right on desktop, bottom on mobile. */
  variant?: "center" | "sheet";
  wide?: boolean;
};

export function DialogContent({ title, description, variant = "center", wide, className, children, ...props }: ContentProps) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-forest/30 backdrop-blur-[2px] data-[state=open]:animate-[tm-fade_150ms_ease-out]" />
      <D.Content
        {...props}
        className={cn(
          "fixed z-50 flex max-h-[92dvh] flex-col bg-surface shadow-[var(--shadow-lift)] focus:outline-none",
          variant === "center" &&
            "left-1/2 top-1/2 w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 rounded-xl data-[state=open]:animate-[tm-pop_180ms_ease-out]",
          variant === "center" && (wide ? "max-w-3xl" : "max-w-lg"),
          variant === "sheet" &&
            "inset-x-0 bottom-0 rounded-t-xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:max-w-md sm:rounded-none sm:rounded-l-xl data-[state=open]:animate-[tm-slide_220ms_ease-out]",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <D.Title className="font-display text-lg font-semibold text-ink">{title}</D.Title>
            {description ? (
              <D.Description className="mt-0.5 text-sm text-ink-muted">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close className="rounded-md p-1.5 text-ink-muted hover:bg-surface-muted hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </D.Close>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </D.Content>
    </D.Portal>
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}

type ConfirmProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
};

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, destructive, loading, onConfirm }: ConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title}>
        <p className="text-sm leading-relaxed text-ink-muted">{description}</p>
        <DialogFooter>
          <DialogClose asChild>
            <button className="h-10 rounded-md border border-line px-4 text-sm font-medium hover:bg-surface-muted">
              Keep it
            </button>
          </DialogClose>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "h-10 rounded-md px-4 text-sm font-medium text-white disabled:opacity-60",
              destructive ? "bg-danger hover:bg-danger/90" : "bg-forest hover:bg-forest/90",
            )}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
