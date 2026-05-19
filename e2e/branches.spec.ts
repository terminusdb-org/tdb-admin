import { test, expect } from "@playwright/test";
import { loginAsAdmin, waitForTableLoaded, waitForDialogOpen, navigateToBranches, TEST_ORG, TEST_DB } from "./helpers";
import { basicAuthHeader, getApiBaseUrl } from "./fixtures/auth";

/**
 * E2E Tests: Branches CRUD
 *
 * BR-01 to BR-05
 * @see projects/2026-05-twinfoxdb-managed-app/specs/e2e-test-protocol-tdb-admin.md §3.7
 */

test.describe("BR: Branches CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("BR-01: List branches shows main branch", async ({ page }) => {
    await navigateToBranches(page, TEST_ORG, TEST_DB);
    await waitForTableLoaded(page);

    // "main" branch always exists — use exact:true to avoid matching "Skip to main content"
    await expect(page.getByText("main", { exact: true })).toBeVisible();
  });

  test("BR-02: Create branch", async ({ page }) => {
    const branchName = `e2ebranch${Date.now()}`;

    await navigateToBranches(page, TEST_ORG, TEST_DB);
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /create branch/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));

    await dialog.getByLabel(/branch name/i).fill(branchName);
    // Source branch defaults to "main (default)"
    await dialog.getByRole("button", { name: /create/i }).click();

    await expect(page.locator("[role=\"dialog\"]")).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(branchName)).toBeVisible({ timeout: 5_000 });

    // Cleanup
    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/api/branch/${TEST_ORG}/${TEST_DB}/local/branch/${branchName}`, {
      method: "DELETE",
      headers: { "Authorization": basicAuthHeader() },
    });
  });

  test("BR-03: Create — invalid branch name blocks submission", async ({ page }) => {
    await navigateToBranches(page, TEST_ORG, TEST_DB);
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /create branch/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));

    await dialog.getByLabel(/branch name/i).fill("invalid branch name!");
    await dialog.getByRole("button", { name: /create/i }).click();

    // Client-side validation blocks submission — dialog stays open
    await expect(dialog.getByLabel(/branch name/i)).toBeVisible({ timeout: 3_000 });
  });

  test("BR-04: Delete non-main branch with confirmation", async ({ page }) => {
    // Create a branch via UI so it appears in SPA state
    const branchName = `e2edelbr${Date.now()}`;

    await navigateToBranches(page, TEST_ORG, TEST_DB);
    await waitForTableLoaded(page);

    // Create via dialog
    await page.getByRole("button", { name: /create branch/i }).click();
    await waitForDialogOpen(page);
    const createDialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));
    await createDialog.getByLabel(/branch name/i).fill(branchName);
    await createDialog.getByRole("button", { name: /create/i }).click();
    await expect(page.locator("[role=\"dialog\"]")).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(branchName)).toBeVisible({ timeout: 5_000 });

    // Now delete
    const row = page.getByRole("row").filter({ hasText: branchName });
    await row.getByRole("button", { name: /delete/i }).click();

    await waitForDialogOpen(page);
    const confirmDialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));

    // Type branch name to enable the Delete button
    const confirmInput = confirmDialog.getByRole("textbox");
    if (await confirmInput.isVisible().catch(() => false)) {
      await confirmInput.fill(branchName);
    }
    await confirmDialog.getByRole("button", { name: /delete branch/i }).click({ timeout: 10_000 });

    await expect(page.locator("[role=\"dialog\"]")).toBeHidden({ timeout: 10_000 });

    // Branch should no longer appear in the table
    await expect(
      page.getByRole("row").filter({ hasText: branchName })
    ).toBeHidden({ timeout: 10_000 });
  });

  test("BR-05: Cannot delete main branch", async ({ page }) => {
    await navigateToBranches(page, TEST_ORG, TEST_DB);
    await waitForTableLoaded(page);

    // "main" row should not have a delete button — it shows "Protected" instead
    const mainRow = page.getByRole("row").filter({ hasText: "main" });
    const deleteBtn = mainRow.getByRole("button", { name: /delete/i });
    await expect(deleteBtn).toBeHidden();
  });
});
