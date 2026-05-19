import { test, expect } from "@playwright/test";
import { loginAsAdmin, waitForTableLoaded, navigateViaSidebar, navigateToTeamDetail, navigateToBranches } from "../helpers";

/**
 * Marketplace Screenshots — 1280×720 viewport
 *
 * Utility script to capture 5 product screenshots for Azure Marketplace listing.
 * Output: zebra/infra/azure/twinfoxdb-community/marketplace-assets/screenshots/
 *
 * Usage:
 *   BASE_URL=http://localhost:6363/dashboard/ TDB_ADMIN_PASSWORD=root \
 *     npx playwright test --config e2e/playwright.config.ts e2e/scripts/take-marketplace-screenshots.ts
 *
 * Prerequisites:
 *   - Target instance must have demo data:
 *     - "Engineering" team with 2+ members (alice, bob, carol)
 *     - "content-management" data product with branches (main, staging, feature-taxonomy)
 *     - Grants assigned to the Engineering team
 */

const SCREENSHOTS_DIR = "../../../infra/azure/twinfoxdb-community/marketplace-assets/screenshots";

test.describe("Marketplace Screenshots", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("Screenshot 1: Login page", async ({ page }) => {
    const baseUrl = process.env.BASE_URL || "http://localhost:6363/dashboard/";
    await page.goto(baseUrl);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /sign in|log in/i })).toBeVisible({ timeout: 10_000 });

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/01-login.png`,
      fullPage: false,
    });
  });

  test("Screenshot 2: Team membership", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateToTeamDetail(page, "Engineering");
    await waitForTableLoaded(page);

    await expect(page.getByRole("table")).toBeVisible({ timeout: 5_000 });

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/02-team-membership.png`,
      fullPage: false,
    });
  });

  test("Screenshot 3: Branches", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateToBranches(page, "Engineering", "content-management");
    await waitForTableLoaded(page);

    await expect(page.getByText("main", { exact: true })).toBeVisible({ timeout: 5_000 });

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/03-branches.png`,
      fullPage: false,
    });
  });

  test("Screenshot 4: Grants", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateViaSidebar(page, "grants");
    await waitForTableLoaded(page);

    await expect(page.getByRole("table")).toBeVisible({ timeout: 5_000 });

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/04-grants.png`,
      fullPage: false,
    });
  });

  test("Screenshot 5: Data Products dashboard", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateViaSidebar(page, "data products");
    await waitForTableLoaded(page);

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/05-data-products.png`,
      fullPage: false,
    });
  });
});
