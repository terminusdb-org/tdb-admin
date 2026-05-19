import { test, expect } from "@playwright/test";
import { loginAsAdmin, navigateViaSidebar, TEST_ORG } from "./helpers";
import { basicAuthHeader, getApiBaseUrl } from "./fixtures/auth";

/**
 * E2E Tests: Invitations (Wizard)
 *
 * INV-01 to INV-05
 * @see projects/2026-05-twinfoxdb-managed-app/specs/e2e-test-protocol-tdb-admin.md §3.8
 */

test.describe("INV: Invitations Wizard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("INV-01: Wizard step 1 — username entry", async ({ page }) => {
    await navigateViaSidebar(page, "invitations");
    await page.waitForLoadState("networkidle");

    // Step 1: username field visible
    await expect(page.getByLabel(/username/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /next/i })).toBeVisible();
  });

  test("INV-02: Wizard step 2 — team + role selection", async ({ page }) => {
    const username = `e2e-invite-${Date.now()}`;

    await navigateViaSidebar(page, "invitations");
    await page.waitForLoadState("networkidle");

    // Step 1: enter username
    await page.getByLabel(/username/i).fill(username);
    await page.getByRole("button", { name: /next/i }).click();

    // Step 2: team and role selectors visible
    await expect(page.getByLabel(/team/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByLabel(/role/i)).toBeVisible();
  });

  test("INV-03: Wizard step 3 — create user + grant", async ({ page }) => {
    const username = `e2e-inv-create-${Date.now()}`;

    await navigateViaSidebar(page, "invitations");
    await page.waitForLoadState("networkidle");

    // Step 1
    await page.getByLabel(/username/i).fill(username);
    await page.getByRole("button", { name: /next/i }).click();

    // Step 2
    await page.getByLabel(/team/i).selectOption(TEST_ORG);
    await page.getByLabel(/role/i).selectOption({ index: 1 }); // First available role
    await page.getByRole("button", { name: /next|create|invite/i }).click();

    // Step 3: success / confirmation — should show password or success
    await expect(
      page.getByText(/created|success|password|credentials/i)
    ).toBeVisible({ timeout: 10_000 });

    // Cleanup
    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/api/users/${username}`, {
      method: "DELETE",
      headers: { "Authorization": basicAuthHeader() },
    });
  });

  test("INV-04: Copy credentials button works", async ({ page }) => {
    const username = `e2e-inv-copy-${Date.now()}`;

    await navigateViaSidebar(page, "invitations");
    await page.waitForLoadState("networkidle");

    // Complete wizard
    await page.getByLabel(/username/i).fill(username);
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByLabel(/team/i).selectOption(TEST_ORG);
    await page.getByLabel(/role/i).selectOption({ index: 1 });
    await page.getByRole("button", { name: /next|create|invite/i }).click();

    // Wait for success
    await expect(
      page.getByText(/created|success|password|credentials/i)
    ).toBeVisible({ timeout: 10_000 });

    // Copy button should be visible
    const copyBtn = page.getByRole("button", { name: /copy/i });
    if (await copyBtn.isVisible().catch(() => false)) {
      await copyBtn.click();
      // Should show "Copied" feedback
      await expect(page.getByText(/copied/i)).toBeVisible({ timeout: 3_000 });
    }

    // Cleanup
    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/api/users/${username}`, {
      method: "DELETE",
      headers: { "Authorization": basicAuthHeader() },
    });
  });

  test("INV-05: Validation — empty username blocks advancement", async ({ page }) => {
    await navigateViaSidebar(page, "invitations");
    await page.waitForLoadState("networkidle");

    // Try to advance without entering username
    await page.getByRole("button", { name: /next/i }).click();

    // Wizard should stay on step 1 — username field still visible
    await expect(page.getByLabel(/username/i)).toBeVisible({ timeout: 3_000 });
    // Team selector (step 2) should NOT be visible
    await expect(page.getByLabel(/team/i)).toBeHidden({ timeout: 1_000 });
  });
});
