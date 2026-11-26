"use client";

import * as React from "react";
import { FlaskConical, RotateCcw } from "lucide-react";
import { IS_DEMO } from "@/demo/config";
import { ConfirmDialog } from "@/components/ui/dialog";

/** Always-visible label on the static demo build so nobody mistakes it for the live service. */
export function DemoBanner() {
  const [confirm, setConfirm] = React.useState(false);
  if (!IS_DEMO) return null;
  return (
    <div className="relative z-50 bg-amber-soft text-[12.5px] text-ink">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 sm:px-6">
        <FlaskConical className="size-3.5 shrink-0 text-amber" aria-hidden />
        <p className="min-w-0 flex-1">
          <strong className="font-semibold">Demo.</strong> Everything runs in your browser and is saved on this device only.
          Weather and routes are live; places and prices are curated samples.
        </p>
        <button onClick={() => setConfirm(true)} className="flex items-center gap-1 font-medium text-ink-muted hover:text-ink">
          <RotateCcw className="size-3.5" aria-hidden /> Reset demo
        </button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Reset the demo?"
        description="This clears every account, trip, expense and checklist created in this browser and restores the original sample data."
        confirmLabel="Reset demo data"
        destructive
        onConfirm={async () => {
          const { resetDb } = await import("@/demo/db");
          resetDb();
          window.location.reload();
        }}
      />
    </div>
  );
}

/** Sign-in helper shown only in the demo build: the demo admin exists only in this browser. */
export function DemoLoginHint({ onUse }: { onUse: (email: string, password: string) => void }) {
  const [creds, setCreds] = React.useState<{ email: string; password: string } | null>(null);
  React.useEffect(() => {
    if (IS_DEMO) void import("@/demo/config").then((m) => setCreds({ email: m.DEMO_ADMIN.email, password: m.DEMO_ADMIN.password }));
  }, []);
  if (!IS_DEMO || !creds) return null;
  return (
    <div className="mt-6 rounded-lg border border-dashed border-amber/60 bg-amber-soft/50 p-4 text-[13px]">
      <p className="font-medium">Exploring the demo?</p>
      <p className="mt-1 text-ink-muted">
        Create your own account, or try the admin portal with the demo administrator (it exists only in your browser):
      </p>
      <p className="mt-2 font-mono text-xs">{creds.email} · {creds.password}</p>
      <button type="button" onClick={() => onUse(creds.email, creds.password)} className="mt-2 font-medium text-sage hover:underline">
        Fill in demo admin
      </button>
    </div>
  );
}
