// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthResponse, ItineraryDto, PlanProposal, TripDto } from "@/types/api";
import { ApiError } from "@/lib/api-error";
import { DEMO_ADMIN } from "./config";
import { resetDb } from "./db";
import { demoRequest as call, demoServerGet } from "./router";

async function signUp(email: string): Promise<AuthResponse> {
  return call<AuthResponse>("POST", "/auth/register", {}, { email, password: "Travel2026", displayName: "Demo User" });
}

const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);

describe("demo backend", () => {
  beforeEach(() => resetDb());

  it("registers, rejects duplicates and checks passwords", async () => {
    const res = await signUp("a@demo.test");
    expect(res.user.permissions).toContain("trip:own");
    expect((await fails(signUp("a@demo.test")))?.code).toBe("EMAIL_TAKEN");
    await call("POST", "/auth/logout");
    expect((await fails(call("POST", "/auth/login", {}, { email: "a@demo.test", password: "wrong1234" })))?.code).toBe("INVALID_CREDENTIALS");
    const again = await call<AuthResponse>("POST", "/auth/login", {}, { email: "a@demo.test", password: "Travel2026" });
    expect(again.user.email).toBe("a@demo.test");
  });

  it("hides other users' trips", async () => {
    await signUp("owner@demo.test");
    const trip = await call<TripDto>("POST", "/trips", {}, { name: "Goa", destinationName: "Goa", dayCount: 2, travelers: 2 });
    await call("POST", "/auth/logout");
    await signUp("other@demo.test");
    expect((await fails(call("GET", `/trips/${trip.id}`)))?.status).toBe(404);
  });

  it("rejects stale versions and invalid status changes", async () => {
    await signUp("v@demo.test");
    const trip = await call<TripDto>("POST", "/trips", {}, { name: "Hampi", destinationName: "Hampi", dayCount: 2, travelers: 1 });
    await call("PUT", `/trips/${trip.id}`, {}, { ...trip, name: "Hampi 2", version: trip.version });
    expect((await fails(call("PUT", `/trips/${trip.id}`, {}, { ...trip, version: trip.version })))?.code).toBe("CONFLICT");
    expect((await fails(call("POST", `/trips/${trip.id}/status`, {}, { status: "COMPLETED" })))?.code).toBe("INVALID_TRANSITION");
  });

  it("plans only with catalogue places and keeps locked items when modifying", async () => {
    await signUp("p@demo.test");
    const proposal = await call<PlanProposal>("POST", "/ai/trip-planner/generate", {}, {
      destinationSlug: "gokarna", days: 3, travelers: 4, budget: "20000", styles: ["ADVENTURE"], interests: ["beaches"], pace: "BALANCED",
    });
    expect(proposal.engine.simulated).toBe(true);
    const gokarna = (await demoServerGet<{ attractions: { id: string }[] }>("/destinations/gokarna")).attractions.map((a) => a.id);
    const placeIds = proposal.days.flatMap((d) => d.items).map((i) => i.attractionId).filter(Boolean);
    expect(placeIds.length).toBeGreaterThan(0);
    expect(placeIds.every((id) => gokarna.includes(id!))).toBe(true);

    const trip = await call<TripDto>("POST", `/ai/trip-planner/proposals/${proposal.id}/apply`, {}, {
      trip: { name: "Gokarna", destinationSlug: "gokarna", destinationName: "Gokarna", dayCount: 3, travelers: 4 },
    });
    const itin = await call<ItineraryDto>("GET", `/trips/${trip.id}/itinerary`);
    const keep = itin.days[0].items.find((i) => i.attractionId)!;
    await call("PUT", `/itinerary/${keep.id}`, {}, { ...keep, locked: true });

    const cheaper = await call<PlanProposal>("POST", "/ai/trip-planner/modify", {}, { tripId: trip.id, instruction: `remove ${keep.title}` });
    expect(cheaper.days.flatMap((d) => d.items).some((i) => i.sourceItemId === keep.id)).toBe(true);
    await call("POST", `/ai/trip-planner/proposals/${cheaper.id}/apply`, {}, { tripId: trip.id });
    const after = await call<ItineraryDto>("GET", `/trips/${trip.id}/itinerary`);
    expect(after.days.flatMap((d) => d.items).some((i) => i.id === keep.id)).toBe(true);
  });

  it("adds money exactly and de-duplicates retried expenses", async () => {
    await signUp("m@demo.test");
    const trip = await call<TripDto>("POST", "/trips", {}, { name: "Coorg", destinationName: "Coorg", dayCount: 2, travelers: 3, budgetAmount: "1000" });
    for (let i = 0; i < 10; i++)
      await call("POST", `/trips/${trip.id}/expenses`, {}, { title: "Chai", amount: "0.10", category: "FOOD", date: "2026-12-01" });
    await call("POST", `/trips/${trip.id}/expenses`, {}, { title: "Fuel", amount: "50.00", category: "FUEL", date: "2026-12-01", clientRequestId: "r1" });
    await call("POST", `/trips/${trip.id}/expenses`, {}, { title: "Fuel", amount: "50.00", category: "FUEL", date: "2026-12-01", clientRequestId: "r1" });
    const budget = await call<{ spent: string; remaining: string; perPersonBudget: string }>("GET", `/trips/${trip.id}/budget`);
    expect(budget.spent).toBe("51.00");
    expect(budget.remaining).toBe("949.00");
    expect(budget.perPersonBudget).toBe("333.33");
  });

  it("enforces admin permissions and the publish rule", async () => {
    await signUp("t@demo.test");
    expect((await fails(call("GET", "/admin/stats")))?.status).toBe(403);
    await call("POST", "/auth/logout");
    await call("POST", "/auth/login", {}, { email: DEMO_ADMIN.email, password: DEMO_ADMIN.password });
    const d = await call<{ id: string }>("POST", "/admin/destinations", {}, {
      slug: "test-place", name: "Test Place", region: "R", state: "Karnataka", country: "India", summary: "s", description: "d",
      latitude: 14, longitude: 75, categorySlugs: ["beaches"], budgetPerDayMin: "1000", budgetPerDayMax: "2000",
    });
    expect((await fails(call("POST", `/admin/destinations/${d.id}/publish`)))?.code).toBe("NO_ATTRACTIONS");
  });

  it("serves seed destinations at build time without a session", async () => {
    const page = await demoServerGet<{ totalItems: number }>("/destinations?featured=true&size=7");
    expect(page.totalItems).toBeGreaterThan(0);
  });
});
