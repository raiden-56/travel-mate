"use client";

import * as React from "react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { ApiError, refreshSession } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return count < 2;
        },
      },
    },
    mutationCache: new MutationCache(),
  });
}

function AuthBootstrap() {
  const pathname = usePathname();
  React.useEffect(() => {
    if (useAuthStore.getState().status === "loading") void refreshSession();
  }, []);
  // A sign-out suppresses route guards only until its redirect lands; then guards apply again.
  React.useEffect(() => {
    if (useAuthStore.getState().signingOut) useAuthStore.setState({ signingOut: false });
  }, [pathname]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">
        <AuthBootstrap />
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            className: "!bg-surface !text-ink !border-line !shadow-[var(--shadow-lift)] !font-sans",
          }}
        />
      </MotionConfig>
    </QueryClientProvider>
  );
}
