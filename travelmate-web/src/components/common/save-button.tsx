"use client";

import { Heart } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { useToggleFavorite } from "@/features/destinations/hooks";
import { useAuthStore } from "@/lib/auth-store";
import { errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { FavoriteTarget } from "@/types/api";

type Props = {
  targetType: FavoriteTarget;
  targetId: string;
  saved: boolean;
  name: string;
  variant?: "overlay" | "inline";
  className?: string;
};

export function SaveButton({ targetType, targetId, saved, name, variant = "inline", className }: Props) {
  const status = useAuthStore((s) => s.status);
  const toggle = useToggleFavorite();
  const router = useRouter();
  const pathname = usePathname();

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (status !== "authenticated") {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    toggle.mutate(
      { targetType, targetId, saved },
      {
        onSuccess: (nowSaved) => toast.success(nowSaved ? `Saved ${name}` : `Removed ${name} from saved`),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={toggle.isPending}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from saved` : `Save ${name}`}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full transition-colors disabled:opacity-60",
        variant === "overlay" && "size-9 bg-white/90 text-ink shadow-sm backdrop-blur hover:bg-white",
        variant === "inline" && "h-9 border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-muted",
        className,
      )}
    >
      <Heart className={cn("size-4", saved && "fill-terracotta text-terracotta")} aria-hidden />
      {variant === "inline" && (saved ? "Saved" : "Save")}
    </button>
  );
}
