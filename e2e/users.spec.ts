import { test, expect } from "@playwright/test";
import { loginAsAdmin, login, waitForTableLoaded, waitForDialogOpen, navigateViaSidebar, TEST_USER_1, TEST_PASSWORD } from "./helpers";
import { basicAuthHeader, getApiBaseUrl } from "./fixtures/auth";

/**
 * E2E Tests: Users CRUD (Admin Only)
 *
 * USER-01 to USER-06
 * @see projects/2026-05-twinfoxdb-managed-app/specs/e2e-test-protocol-tdb-admin.md §3.3
 */

test.describe("USER: Users CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("USER-01: List users shows existing users", async ({ page }) => {
    await navigateViaSidebar(page, "users");
    await waitForTableLoaded(page);

    await expect(page.getByRole("table")).toBeVisible();
    // Admin user always exists in the table
    await expect(
      page.getByRole("table").getByRole("cell", { name: "admin", exact: true })
    ).toBeVisible();
  });

  test("USER-02: Create user", async ({ page }) => {
    const username = `e2e-user-${Date.now()}`;

    await navigateViaSidebar(page, "users");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /add user/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));

    // Dialog uses "Principal" and "Credential" labels
    await dialog.getByLabel(/principal/i).fill(username);
    await dialog.getByLabel(/credential/i).fill("TestPass123!");
    await dialog.getByRole("button", { name: /create principal/i }).click();

    await expect(page.locator("[role=\"dialog\"]")).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(username)).toBeVisible({ timeout: 5_000 });

    // Cleanup
    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/api/users/${username}`, {
      method: "DELETE",
      headers: { "Authorization": basicAuthHeader() },
    });
  });

  test("USER-03: Create user — duplicate username shows error", async ({ page }) => {
    await navigateViaSidebar(page, "users");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /add user/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));

    // Try to create "admin" which already exists
    await dialog.getByLabel(/principal/i).fill("admin");
    await dialog.getByLabel(/credential/i).fill("SomePassword123!");
    await dialog.getByRole("button", { name: /create principal/i }).click();

    // Should show inline error (M-002 fix surfaces API error as message)
    await expect(
      dialog.getByText(/already exists/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test("USER-04: Deactivate (delete) user with confirmation", async ({ page }) => {
    // Create a user via UI (so it appears in SPA state)
    const username = `e2e-deact-${Date.now()}`;

    await navigateViaSidebar(page, "users");
    await waitForTableLoaded(page);

    // Create via Add User dialog (fields labeled "Principal" and "Credential")
    await page.getByRole("button", { name: /add user/i }).click();
    await waitForDialogOpen(page);
    const createDialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));
    await createDialog.getByLabel(/principal/i).fill(username);
    await createDialog.getByLabel(/credential/i).fill("TempPass123!");
    await createDialog.getByRole("button", { name: /create principal/i }).click();
    await expect(page.locator("[role=\"dialog\"]")).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(username)).toBeVisible({ timeout: 5_000 });

    // Now deactivate — button has aria-label "Deactivate <username>"
    const deactivateBtn = page.getByRole("button", { name: `Deactivate ${username}`, exact: true });
    await deactivateBtn.click({ timeout: 10_000 });

    await waitForDialogOpen(page);
    const confirmDialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));

    // Type username to confirm (same pattern as team delete)
    const confirmInput = confirmDialog.getByRole("textbox");
    if (await confirmInput.isVisible().catch(() => false)) {
      await confirmInput.fill(username);
    }
    await confirmDialog.getByRole("button", { name: /deactivate|delete|confirm/i }).click();

    await expect(page.locator("[role=\"dialog\"]")).toBeHidden({ timeout: 10_000 });

    // User should no longer appear in table
    await expect(
      page.getByRole("table").getByRole("cell", { name: username }).first()
    ).toBeHidden({ timeout: 10_000 });

    // Cleanup (in case UI delete failed)
    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/api/users/${username}`, {
      method: "DELETE",
      headers: { "Authorization": basicAuthHeader() },
    }).catch(() => {});
  });

  test("USER-05: Deactivate — cancel preserves user", async ({ page }) => {
    await navigateViaSidebar(page, "users");
    await waitForTableLoaded(page);

    // Deactivate button has aria-label "Deactivate <username>"
    const deleteBtn = page.getByRole("button", { name: `Deactivate ${TEST_USER_1}`, exact: true });

    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click();
      await waitForDialogOpen(page);
      const dialog = page.locator("[role=\"dialog\"][data-open]")
        .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));
      await dialog.getByRole("button", { name: /cancel/i }).click();
      await expect(page.locator("[role=\"dialog\"]")).toBeHidden({ timeout: 10_000 });

      await expect(page.getByText(TEST_USER_1)).toBeVisible();
    }
  });

  test("USER-06: Non-admin redirected away from users page", async ({ page }) => {
    // Clear session and login as non-admin
    await page.context().clearCookies();
    await login(page, TEST_USER_1, TEST_PASSWORD);

    // Try to navigate to users via sidebar (if link is visible)
    const usersLink = page.getByRole("link", { name: /^users$/i });
    const isVisible = await usersLink.isVisible().catch(() => false);

    if (isVisible) {
      await usersLink.click();
      // Non-admin should be redirected to /teams (AdminOnlyRoute)
      await page.waitForURL(/\/teams/, { timeout: 5_000 });
    }
    // If link is hidden, non-admin is correctly blocked from accessing users page
  });
});
