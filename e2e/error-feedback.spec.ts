import { test, expect } from "@playwright/test";
import { loginAsAdmin, waitForTableLoaded, waitForDialogOpen, navigateViaSidebar, navigateToBranches, TEST_ORG, TEST_DB } from "./helpers";

/**
 * E2E Tests: Error Feedback on Duplicate/Invalid Operations
 *
 * ERR-01 to ERR-06: Verify that API errors (409 Conflict, 400 Bad Request)
 * are surfaced as inline error messages in form dialogs, and that client-side
 * validation prevents submission of invalid/empty data.
 *
 * M-002 fix (v12-dash4): Server-side errors now show inline messages.
 * Client-side validation blocks submission silently (dialog stays open).
 *
 * @see projects/2026-05-twinfoxdb-managed-app/ — Exploratory Testing Report 2026-05-15
 */

test.describe("ERR: Error feedback for duplicate/invalid entities", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("ERR-01: Duplicate team name shows inline error", async ({ page }) => {
    await navigateViaSidebar(page, "teams");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /create team/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));

    // "admin" team always exists
    await dialog.getByRole("textbox").fill("admin");
    await dialog.getByRole("button", { name: /create/i }).click();

    // Should show inline error — dialog stays open with error message
    await expect(
      dialog.getByText(/already exists/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test("ERR-02: Duplicate username shows inline error", async ({ page }) => {
    await navigateViaSidebar(page, "users");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /add user/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));

    // Fill with existing username "admin" using labeled fields
    await dialog.getByLabel(/principal/i).fill("admin");
    await dialog.getByLabel(/credential/i).fill("SomePassword123!");

    await dialog.getByRole("button", { name: /create principal/i }).click();

    // Should show inline error — dialog stays open with error message
    await expect(
      dialog.getByText(/already exists/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test("ERR-03: Duplicate data product name shows inline error", async ({ page }) => {
    await navigateViaSidebar(page, "data products");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /new data product/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));

    // Select team (testorg) and use existing db name (testdb)
    await dialog.getByLabel(/team/i).selectOption(TEST_ORG);
    await dialog.getByLabel(/database name/i).fill("testdb"); // Already exists
    await dialog.getByLabel(/label/i).fill("testdb"); // Required by API

    await dialog.getByRole("button", { name: /create/i }).click();

    // Should show inline error — "already exists" message
    await expect(
      dialog.getByText(/already exists/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test("ERR-04: Invalid team name blocks submission", async ({ page }) => {
    await navigateViaSidebar(page, "teams");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /create team/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));

    // Names with slashes should be rejected by client-side validation
    await dialog.getByRole("textbox").fill("team/with/slashes");
    await dialog.getByRole("button", { name: /create/i }).click();

    // Client-side validation blocks submission — dialog stays open
    // Verify the textbox is still visible (dialog didn't close)
    await expect(dialog.getByRole("textbox")).toBeVisible({ timeout: 3_000 });
  });

  test("ERR-05: Empty team name submission blocked", async ({ page }) => {
    await navigateViaSidebar(page, "teams");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /create team/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));

    // Leave name empty, click create
    await dialog.getByRole("button", { name: /create/i }).click();

    // Dialog should remain open (validation prevents submission)
    await expect(dialog.getByRole("textbox")).toBeVisible({ timeout: 3_000 });
  });

  test("ERR-06: Empty user form submission blocked", async ({ page }) => {
    await navigateViaSidebar(page, "users");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /add user/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));

    // Leave all fields empty, click create
    await dialog.getByRole("button", { name: /create principal/i }).click();

    // Dialog should remain open (validation prevents submission)
    await expect(dialog.getByLabel(/principal/i)).toBeVisible({ timeout: 3_000 });
  });
});
