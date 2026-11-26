import { expect, test, type Page } from "@playwright/test";

// One traveler walks the Phase 1 journey end to end against the real API.
const stamp = Date.now();
const traveler = { name: "E2E Traveler", email: `e2e-${stamp}@travelmate.test`, password: `Journey${stamp % 10000}x` };

async function register(page: Page) {
  await page.goto("/register");
  await page.getByLabel("Your name").fill(traveler.name);
  await page.getByLabel("Email").fill(traveler.email);
  await page.getByLabel("Password").fill(traveler.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test.describe.serial("traveler journey", () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });
  test.afterAll(async () => page.close());

  test("register lands on the dashboard", async () => {
    await register(page);
    await expect(page.getByRole("heading", { name: "E2E" })).toBeVisible();
  });

  test("discover and save a destination", async () => {
    await page.goto("/explore");
    await page.getByLabel("Search destinations").fill("Gokarna");
    await page.getByRole("link", { name: /Gokarna/ }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Gokarna" })).toBeVisible();
    await page.getByRole("button", { name: "Save Gokarna", exact: true }).click();
    await expect(page.getByRole("button", { name: "Remove Gokarna from saved", exact: true })).toBeVisible();
    await page.goto("/saved");
    await expect(page.getByRole("link", { name: /Gokarna/ }).first()).toBeVisible();
  });

  test("generate a plan and save it as a trip", async () => {
    await page.goto("/planner?destination=gokarna");
    await page.getByLabel("Days").fill("3");
    await page.getByLabel("Travelers").fill("4");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Adventure", exact: true }).click();
    await page.getByRole("button", { name: "Beaches", exact: true }).click();
    await page.getByLabel("Total budget (₹)").fill("20000");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: /Generate plan/ }).click();
    await expect(page.getByRole("heading", { name: /Day 1/ })).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: "Save as trip" }).click();
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+\/itinerary$/);
    await expect(page.getByRole("region", { name: "Day 1" })).toBeVisible();
  });

  test("add an activity to the itinerary", async () => {
    await page.getByRole("button", { name: "Add", exact: true }).first().click();
    await page.getByLabel("Title").fill("Sunset at the cliff");
    await page.getByRole("button", { name: "Add activity" }).click();
    await expect(page.getByText("Sunset at the cliff")).toBeVisible();
  });

  test("track an expense against the budget", async () => {
    await page.getByRole("link", { name: "Budget" }).click();
    await page.getByRole("button", { name: "Add expense" }).first().click();
    await page.getByLabel("Title").fill("Fuel");
    await page.getByLabel("Amount").fill("1250.50");
    await page.getByLabel("Category").selectOption("FUEL");
    await page.getByRole("button", { name: "Add expense" }).last().click();
    await expect(page.getByText("₹1,250.50").first()).toBeVisible();
  });

  test("start a checklist from a template and tick an item", async () => {
    await page.getByRole("link", { name: "Checklist" }).click();
    await page.getByRole("button", { name: "Start a checklist" }).click();
    await page.getByLabel("Start from a template").selectOption({ index: 2 });
    await page.getByRole("button", { name: "Create" }).click();
    const first = page.getByRole("checkbox").first();
    await first.click();
    await expect(first).toBeChecked();
  });

  test("sign out", async () => {
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/trips");
    await expect(page).toHaveURL(/\/login/);
  });
});

test("admin can create a destination draft", async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run the admin journey");
  await page.goto("/login?next=/admin/destinations/new");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "New destination" })).toBeVisible();
  const slug = `e2e-${stamp}`;
  await page.getByLabel("Name").fill(`E2E Place ${stamp}`);
  await page.getByLabel("URL slug").fill(slug);
  await page.getByLabel("Region").fill("Test region");
  await page.getByLabel("Latitude").fill("14.5");
  await page.getByLabel("Longitude").fill("74.3");
  await page.getByRole("button", { name: "Beaches", exact: true }).click();
  await page.getByLabel("Summary").fill("A test destination created by the end-to-end suite.");
  await page.getByLabel("Description", { exact: true }).fill("This destination exists only to prove the admin flow works from form to database and back.");
  await page.getByLabel("Budget/day min (₹, est.)").fill("1500");
  await page.getByLabel("Budget/day max (₹, est.)").fill("3000");
  await page.getByLabel("Best time to visit").fill("October to March");
  await page.getByLabel("How to reach").fill("Drive from Bengaluru via NH48.");
  await page.getByLabel("Getting around").fill("Rent a scooter locally.");
  await page.getByLabel("Safety").fill("Swim only where lifeguards are present.");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
});

test("public destination page is indexable without signing in @mobile", async ({ page }) => {
  await page.goto("/destinations/hampi");
  await expect(page.getByRole("heading", { level: 1, name: "Hampi" })).toBeVisible();
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(ld).toContain("TouristDestination");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/destinations\/hampi$/);
});
