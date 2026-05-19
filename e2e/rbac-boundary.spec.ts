import { test, expect } from "@playwright/test";
import { loginAsAdmin, login } from "./helpers";
import { basicAuthHeader, getApiBaseUrl } from "./fixtures/auth";

/**
 * E2E Tests: RBAC Boundary Testing
 *
 * RBAC-01 to RBAC-07: Verify admin-only pages are properly restricted for non-admin users.
 *
 * Tests create a temporary non-admin user (with no roles), log in as that user,
 * and verify they cannot see or access admin-only functionality.
 *
 * @see projects/2026-05-twinfoxdb-managed-app/ — Exploratory Testing Report 2026-05-15
 */

const RBAC_TEST_USER = "e2e-rbac-user";
const RBAC_TEST_PASSWORD = "RbacTestPass123!";

test.describe("RBAC: Non-admin user access boundaries", () => {
  test.beforeAll(async () => {
    // Create a non-admin user via API (no roles granted)
    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: {
        "Authorization": basicAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: RBAC_TEST_USER, password: RBAC_TEST_PASSWORD }),
    });
  });

  test.afterAll(async () => {
    // Clean up the test user
    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/api/users/${RBAC_TEST_USER}`, {
      method: "DELETE",
      headers: { "Authorization": basicAuthHeader() },
    });
  });

  test("RBAC-01: Non-admin user can log in", async ({ page }) => {
    await login(page, RBAC_TEST_USER, RBAC_TEST_PASSWORD);

    // Should be redirected to a landing page (teams or similar)
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("RBAC-02: Non-admin sidebar hides Users link", async ({ page }) => {
    await login(page, RBAC_TEST_USER, RBAC_TEST_PASSWORD);
    await page.waitForLoadState("networkidle");

    const nav = page.getByLabel("Main navigation");
    const usersLink = nav.getByRole("link", { name: /^users$/i });
    await expect(usersLink).toBeHidden();
  });

  test("RBAC-03: Non-admin sidebar hides Roles link", async ({ page }) => {
    await login(page, RBAC_TEST_USER, RBAC_TEST_PASSWORD);
    await page.waitForLoadState("networkidle");

    const nav = page.getByLabel("Main navigation");
    const rolesLink = nav.getByRole("link", { name: /^roles$/i });
    await expect(rolesLink).toBeHidden();
  });

  test("RBAC-04: Non-admin sidebar hides Invitations link", async ({ page }) => {
    await login(page, RBAC_TEST_USER, RBAC_TEST_PASSWORD);
    await page.waitForLoadState("networkidle");

    const nav = page.getByLabel("Main navigation");
    const invitationsLink = nav.getByRole("link", { name: /invitations/i });
    await expect(invitationsLink).toBeHidden();
  });

  test("RBAC-05: Non-admin sidebar hides Password Reset link", async ({ page }) => {
    await login(page, RBAC_TEST_USER, RBAC_TEST_PASSWORD);
    await page.waitForLoadState("networkidle");

    const nav = page.getByLabel("Main navigation");
    const passwordLink = nav.getByRole("link", { name: /password/i });
    await expect(passwordLink).toBeHidden();
  });

  test("RBAC-06: Non-admin sees empty teams (no access)", async ({ page }) => {
    await login(page, RBAC_TEST_USER, RBAC_TEST_PASSWORD);
    await page.waitForLoadState("networkidle");

    // Navigate to teams (should be accessible for all logged-in users)
    const nav = page.getByLabel("Main navigation");
    await nav.getByRole("link", { name: /teams/i }).click();
    await page.waitForLoadState("networkidle");

    // Should show "no teams" or empty state (user has no team memberships)
    await expect(
      page.getByText(/no teams|no access|not .* member/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("RBAC-07: Admin user sees all navigation items", async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForLoadState("networkidle");

    const nav = page.getByLabel("Main navigation");
    await expect(nav.getByRole("link", { name: /^users$/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /^teams$/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /^roles$/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /grants/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /invitations/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /data products/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /password/i })).toBeVisible();
  });
});
