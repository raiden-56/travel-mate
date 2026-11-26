import { api } from "@/lib/api-client";
import type { AuthResponse, UserDto } from "@/types/api";

export const authApi = {
  login: (body: { email: string; password: string }) =>
    api<AuthResponse>("/auth/login", { method: "POST", body, noRetry: true }),
  register: (body: { email: string; password: string; displayName: string }) =>
    api<AuthResponse>("/auth/register", { method: "POST", body, noRetry: true }),
  logout: () => api<void>("/auth/logout", { method: "POST", noRetry: true }),
  me: () => api<UserDto>("/auth/me"),
  forgotPassword: (email: string) =>
    api<void>("/auth/password/forgot", { method: "POST", body: { email }, noRetry: true }),
  resetPassword: (token: string, newPassword: string) =>
    api<void>("/auth/password/reset", { method: "POST", body: { token, newPassword }, noRetry: true }),
  verifyEmail: (token: string) => api<void>("/auth/email/verify", { method: "POST", body: { token }, noRetry: true }),
};
