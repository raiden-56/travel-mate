import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, errorMessage } from "./api-client";
import { useAuthStore } from "./auth-store";

const user = {
  id: "u1",
  email: "a@example.com",
  displayName: "A",
  avatarUrl: null,
  emailVerified: true,
  status: "ACTIVE" as const,
  roles: ["TRAVELER"],
  permissions: ["trip:own"],
  createdAt: "2026-01-01T00:00:00Z",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("api client", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    useAuthStore.setState({ status: "authenticated", accessToken: "old", user });
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("sends the bearer token and CSRF header", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    await api("/trips");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/trips");
    expect(init.headers.Authorization).toBe("Bearer old");
    expect(init.headers["X-Requested-With"]).toBe("travelmate");
  });

  it("refreshes once on 401 and retries with the new token", async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { status: 401, code: "UNAUTHORIZED" }))
      .mockResolvedValueOnce(json(200, { accessToken: "new", expiresIn: 900, user }))
      .mockResolvedValueOnce(json(200, [{ id: "t1" }]));
    const result = await api<{ id: string }[]>("/trips");
    expect(result).toEqual([{ id: "t1" }]);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/auth/refresh");
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer new");
  });

  it("clears the session when refresh fails", async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { status: 401 }))
      .mockResolvedValueOnce(json(401, { status: 401 }));
    await expect(api("/trips")).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().status).toBe("anonymous");
  });

  it("maps problem details to ApiError with field errors", async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, { status: 400, code: "VALIDATION_FAILED", detail: "Invalid", errors: [{ field: "name", message: "required" }] }),
    );
    const err = (await api("/trips", { method: "POST", body: {} }).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("VALIDATION_FAILED");
    expect(err.fieldErrors).toEqual([{ field: "name", message: "required" }]);
  });

  it("turns network failures into a friendly message", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const err = (await api("/trips").catch((e: unknown) => e)) as ApiError;
    expect(err.isNetwork).toBe(true);
    expect(errorMessage(err)).toMatch(/couldn't reach/i);
  });

  it("hides server internals on 5xx", () => {
    expect(errorMessage(new ApiError({ status: 500, detail: "NullPointerException at …" }))).toBe(
      "Something went wrong on our side. Please try again.",
    );
  });
});
