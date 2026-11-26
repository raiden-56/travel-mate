import { expect, test, type Page } from "@playwright/test";

/**
 * Journey against the static GitHub Pages demo build (in-browser backend).
 * Run with E2E_DEMO=1 and E2E_BASE_URL pointing at the served export, e.g.
 * http://localhost:4321/travel-mate/ — note the trailing slash; paths below are relative.
 */
test.skip(!process.env.E2E_DEMO, "Set E2E_DEMO=1 to run against the static demo build");

const stamp = Date.now();

test.describe.serial("static demo journey", () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });
  test.afterAll(async () => page.close());

  test("landing and a pre-rendered destination page load without signing in", async () => {
    await page.goto("./");
    await expect(page.getByText("Demo.", { exact: false }).first()).toBeVisible();
    await page.goto("destinations/hampi/");
    await expect(page.getByRole("heading", { level: 1, name: "Hampi" })).toBeVisible();
  });

  test("register, plan with the demo planner and save the trip", async () => {
    await page.goto("register/");
    await page.getByLabel("Your name").fill("Demo Visitor");
    await page.getByLabel("Email").fill(`visitor-${stamp}@demo.test`);
    await page.getByLabel("Password").fill("Visitor2026");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/home\/$/);

    await page.goto("planner/?destination=gokarna");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Beaches", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: /Generate plan/ }).click();
    await expect(page.getByText("Demo planner — runs in your browser").first()).toBeVisible();
    await page.getByRole("button", { name: "Save as trip" }).click();
    await expect(page).toHaveURL(/\/trip\/itinerary\/\?id=/);
    await expect(page.getByRole("region", { name: "Day 1" })).toBeVisible();
  });

  test("trip survives a reload and the workspace tabs work", async () => {
    await page.reload();
    await expect(page.getByRole("region", { name: "Day 1" })).toBeVisible();
    await page.getByRole("link", { name: "Budget" }).click();
    await expect(page).toHaveURL(/\/trip\/budget\/\?id=/);
    await expect(page.getByRole("heading", { name: "Budget & expenses" })).toBeVisible();
    await page.getByRole("link", { name: "Map", exact: true }).click();
    await expect(page.getByText("Layers")).toBeVisible();
  });

  test("demo admin can open the admin portal", async () => {
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.goto("login/");
    await page.getByRole("button", { name: "Fill in demo admin" }).click();
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.goto("admin/destinations/");
    await expect(page.getByRole("link", { name: "Gokarna", exact: true })).toBeVisible();
  });
});
