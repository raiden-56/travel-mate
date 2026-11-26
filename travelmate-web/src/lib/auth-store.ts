import { create } from "zustand";
import type { UserDto } from "@/types/api";

type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthState = {
  status: AuthStatus;
  accessToken: string | null;
  user: UserDto | null;
  /** True while a deliberate sign-out navigates away, so route guards don't bounce to /login. */
  signingOut: boolean;
  setSession: (token: string, user: UserDto) => void;
  setUser: (user: UserDto) => void;
  clear: (opts?: { signingOut?: boolean }) => void;
};

/**
 * Access token lives in memory only. The refresh token is an HttpOnly cookie the browser
 * sends to /api/v1/auth/refresh; JavaScript never sees it.
 */
export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  accessToken: null,
  user: null,
  signingOut: false,
  setSession: (accessToken, user) => set({ accessToken, user, status: "authenticated", signingOut: false }),
  setUser: (user) => set({ user }),
  clear: (opts) => set({ accessToken: null, user: null, status: "anonymous", signingOut: !!opts?.signingOut }),
}));

export function hasPermission(user: UserDto | null, permission: string): boolean {
  return !!user?.permissions.includes(permission);
}
