"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { useAuthStore, hasPermission } from "@/lib/auth-store";
import { Skeleton } from "@/components/ui/misc";
import { EmptyState } from "@/components/common/states";

function FullPageLoader() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}

/** Client-side gate for UX only. Every protected endpoint is enforced by the API. */
export function RequireAuth({ children, permission }: { children: React.ReactNode; permission?: string }) {
  const { status, user, signingOut } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (status === "anonymous" && !signingOut) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, signingOut, router, pathname]);

  if (status !== "authenticated") return <FullPageLoader />;
  if (permission && !hasPermission(user, permission)) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Lock />}
          title="You don't have access to this area"
          description="This section is available to administrators only."
        />
      </div>
    );
  }
  return <>{children}</>;
}

/** Sends signed-in users away from login/register. */
export function RedirectIfAuthed({ children, to = "/home" }: { children: React.ReactNode; to?: string }) {
  const status = useAuthStore((s) => s.status);
  const router = useRouter();
  React.useEffect(() => {
    if (status === "authenticated") router.replace(to);
  }, [status, router, to]);
  return <>{children}</>;
}
