"use client";

import { useFavorites } from "@/features/destinations/hooks";
import { useAuthStore } from "@/lib/auth-store";
import type { FavoriteTarget } from "@/types/api";
import { SaveButton } from "./save-button";

/**
 * Save button for server-rendered (anonymous) pages: resolves the real saved state
 * from the signed-in user's favorites on the client.
 */
export function LiveSaveButton(props: {
  targetType: FavoriteTarget;
  targetId: string;
  name: string;
  variant?: "overlay" | "inline";
  className?: string;
}) {
  const authed = useAuthStore((s) => s.status === "authenticated");
  const favorites = useFavorites(authed);
  const saved = !!favorites.data?.some((f) => f.targetType === props.targetType && f.targetId === props.targetId);
  return <SaveButton {...props} saved={saved} />;
}
