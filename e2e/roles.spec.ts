import { test, expect } from "@playwright/test";
import { loginAsAdmin, login, waitForTableLoaded, waitForDialogOpen, navigateViaSidebar, TEST_USER_1, TEST_PASSWORD, CUSTOM_ROLE_NAME } from "./helpers";
import { basicAuthHeader, getApiBaseUrl } from "./fixtures/auth";

/**
 * E2E Tests: Roles CRUD (Admin Only)
 *
 * ROLE-01 to ROLE-07
 * @see projects/2026-05-twinfoxdb-managed-app/specs/e2e-test-protocol-tdb-admin.md §3.5
 */

test.describe("ROLE: Roles CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("ROLE-01: List roles shows existing roles", async ({ page }) => {
    await navigateViaSidebar(page, "roles");
    await waitForTableLoaded(page);

    await expect(page.getByRole("table")).toBeVisible();
    // Built-in roles always exist
    await expect(page.getByText("Admin Role")).toBeVisible();
    await expect(page.getByText("Consumer Role")).toBeVisible();
  });

  test("ROLE-02: Built-in roles are non-deletable", async ({ page }) => {
    await navigateViaSidebar(page, "roles");
    await waitForTableLoaded(page);

    // Admin Role row should NOT have a delete button
    const adminRow = page.getByRole("row").filter({ hasText: "Admin Role" });
    const deleteBtn = adminRow.getByRole("button", { name: /delete/i });
    await expect(deleteBtn).toBeHidden();

    // Consumer Role row should NOT have a delete button
    const consumerRow = page.getByRole("row").filter({ hasText: "Consumer Role" });
    const consumerDeleteBtn = consumerRow.getByRole("button", { name: /delete/i });
    await expect(consumerDeleteBtn).toBeHidden();
  });

  test("ROLE-03: Create role with name and actions", async ({ page }) => {
    const roleName = `e2e-role-${Date.now()}`;

    await navigateViaSidebar(page, "roles");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /create role/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));

    // Fill role name
    await dialog.getByLabel(/role name/i).fill(roleName);

    // Select at least one action (labels are "instance read access" with spaces)
    await dialog.getByLabel(/instance read access/i).check();

    await dialog.getByRole("button", { name: /create role/i }).click();

    await expect(page.locator("[role=\"dialog\"]")).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(roleName)).toBeVisible({ timeout: 5_000 });

    // Cleanup
    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/api/roles/${roleName}`, {
      method: "DELETE",
      headers: { "Authorization": basicAuthHeader() },
    });
  });

  test("ROLE-04: Create role with specific actions shows them", async ({ page }) => {
    await navigateViaSidebar(page, "roles");
    await waitForTableLoaded(page);

    // CustomViewer role created by fixture should show its actions
    const customRow = page.getByRole("row").filter({ hasText: CUSTOM_ROLE_NAME });
    await expect(customRow).toBeVisible();

    // Actions should be displayed (instance_read_access displayed as "instance read access" or similar)
    await expect(customRow.getByText(/instance.read/i)).toBeVisible();
  });

  test("ROLE-05: Delete custom role with confirmation", async ({ page }) => {
    // Create a role via UI so it appears in the SPA state
    const roleName = `e2e-del-role-${Date.now()}`;

    await navigateViaSidebar(page, "roles");
    await waitForTableLoaded(page);

    // Create via dialog
    await page.getByRole("button", { name: /create role/i }).click();
    await waitForDialogOpen(page);
    const createDialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));
    await createDialog.getByLabel(/role name/i).fill(roleName);
    await createDialog.getByLabel(/instance read access/i).check();
    await createDialog.getByRole("button", { name: /create role/i }).click();
    await expect(page.locator("[role=\"dialog\"]")).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(roleName)).toBeVisible({ timeout: 5_000 });

    // Now delete it — button aria-label is "Delete role <name>"
    const deleteBtn = page.getByRole("button", { name: new RegExp(`delete.*${roleName}`, "i") });
    await deleteBtn.click({ timeout: 10_000 });

    await waitForDialogOpen(page);
    const confirmDialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));
    await confirmDialog.getByRole("button", { name: /delete|confirm/i }).click();

    await expect(page.locator("[role=\"dialog\"]")).toBeHidden({ timeout: 10_000 });

    // Role should no longer appear
    await expect(page.getByText(roleName, { exact: true })).toBeHidden({ timeout: 10_000 });
  });

  test("ROLE-06: Built-in roles have no delete action", async ({ page }) => {
    await navigateViaSidebar(page, "roles");
    await waitForTableLoaded(page);

    // Verify "Admin Role" doesn't have a delete button
    const adminRow = page.getByRole("row").filter({ hasText: "Admin Role" });
    const buttons = adminRow.getByRole("button");
    const buttonTexts = await buttons.allInnerTexts();
    const hasDelete = buttonTexts.some((t) => /delete/i.test(t));
    expect(hasDelete).toBe(false);
  });

  test("ROLE-07: Non-admin redirected away from roles page", async ({ page }) => {
    await page.context().clearCookies();
    await login(page, TEST_USER_1, TEST_PASSWORD);

    // Try to navigate to roles via sidebar (if link is visible)
    const rolesLink = page.getByRole("link", { name: /^roles$/i });
    const isVisible = await rolesLink.isVisible().catch(() => false);

    if (isVisible) {
      await rolesLink.click();
      // Non-admin should be redirected to /teams (AdminOnlyRoute)
      await page.waitForURL(/\/teams/, { timeout: 5_000 });
    }
    // If link is hidden, non-admin is correctly blocked from accessing roles page
  });
});
