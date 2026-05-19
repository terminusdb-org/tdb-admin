import { test, expect } from "@playwright/test";
import { loginAsAdmin, waitForTableLoaded, waitForDialogOpen, waitForDialogClosed, navigateViaSidebar, TEST_ORG, TEST_DB } from "./helpers";
import { basicAuthHeader, getApiBaseUrl } from "./fixtures/auth";

/**
 * E2E Tests: Data Products (Databases) CRUD
 *
 * DP-01 to DP-05
 * @see projects/2026-05-twinfoxdb-managed-app/specs/e2e-test-protocol-tdb-admin.md §3.6
 */

test.describe("DP: Data Products CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("DP-01: List data products shows existing databases", async ({ page }) => {
    await navigateViaSidebar(page, "data products");
    await waitForTableLoaded(page);

    // testdb appears as a clickable button (link-styled) in the table
    await expect(page.getByRole("button", { name: TEST_DB, exact: true })).toBeVisible();
  });

  test("DP-02: Create data product", async ({ page }) => {
    const dbName = `e2e-dp-${Date.now()}`;

    await navigateViaSidebar(page, "data products");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /new data product/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));

    // Dialog fields: "Team" (select), "Database Name" (input), "Label", "Description"
    // Note: "Label" is marked optional in UI but required by TDB API
    await dialog.getByLabel(/team/i).selectOption(TEST_ORG);
    await dialog.getByLabel(/database name/i).fill(dbName);
    await dialog.getByLabel(/label/i).fill(dbName);
    await dialog.getByRole("button", { name: /create/i }).click();

    await expect(page.locator("[role=\"dialog\"]")).toBeHidden({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: dbName, exact: true })).toBeVisible({ timeout: 10_000 });

    // Cleanup
    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/api/db/${TEST_ORG}/${dbName}`, {
      method: "DELETE",
      headers: { "Authorization": basicAuthHeader() },
    });
  });

  test("DP-03: Create — invalid name blocks submission", async ({ page }) => {
    await navigateViaSidebar(page, "data products");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /new data product/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));

    await dialog.getByLabel(/team/i).selectOption(TEST_ORG);
    await dialog.getByLabel(/database name/i).fill("invalid db name!");
    await dialog.getByRole("button", { name: /create/i }).click();

    // Client-side validation blocks submission — dialog stays open
    await expect(dialog.getByLabel(/database name/i)).toBeVisible({ timeout: 3_000 });
  });

  test("DP-04: Delete data product with confirmation", async ({ page }) => {
    // Create a DB via UI so it appears in SPA state
    const dbName = `e2edel${Date.now()}`;

    await navigateViaSidebar(page, "data products");
    await waitForTableLoaded(page);

    // Create via "New Data Product" dialog
    await page.getByRole("button", { name: /new data product/i }).click();
    await waitForDialogOpen(page);
    const createDialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));
    await createDialog.getByLabel(/team/i).selectOption(TEST_ORG);
    await createDialog.getByLabel(/database name/i).fill(dbName);
    await createDialog.getByLabel(/label/i).fill(dbName);
    await createDialog.getByRole("button", { name: /create/i }).click();
    await expect(page.locator("[role=\"dialog\"]")).toBeHidden({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: dbName, exact: true })).toBeVisible({ timeout: 10_000 });

    // Now delete — button aria-label is "Delete database testorg/<dbName>"
    const deleteBtn = page.getByRole("button", { name: `Delete database ${TEST_ORG}/${dbName}`, exact: true });
    await deleteBtn.click({ timeout: 10_000 });

    await waitForDialogOpen(page);
    const confirmDialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));

    // Type full path "org/dbName" to enable the Delete button
    const confirmInput = confirmDialog.getByRole("textbox");
    if (await confirmInput.isVisible().catch(() => false)) {
      await confirmInput.fill(`${TEST_ORG}/${dbName}`);
    }
    await confirmDialog.getByRole("button", { name: /delete database/i }).click({ timeout: 10_000 });

    await expect(page.locator("[role=\"dialog\"]")).toBeHidden({ timeout: 10_000 });

    // DB should no longer appear in table
    await expect(page.getByRole("button", { name: dbName, exact: true })).toBeHidden({ timeout: 10_000 });

    // Cleanup in case UI delete failed
    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/api/db/${TEST_ORG}/${dbName}`, {
      method: "DELETE",
      headers: { "Authorization": basicAuthHeader() },
    }).catch(() => {});
  });

  test("DP-05: Navigate to branches", async ({ page }) => {
    await navigateViaSidebar(page, "data products");
    await waitForTableLoaded(page);

    // Click the database name button to navigate to branches
    const dbBtn = page.getByRole("button", { name: TEST_DB, exact: true });
    await dbBtn.click();

    // Should navigate to branches page
    await page.waitForURL(new RegExp(`/data-products/${TEST_ORG}/${TEST_DB}/branches`), { timeout: 10_000 });
  });
});
