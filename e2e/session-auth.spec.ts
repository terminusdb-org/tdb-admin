import { test, expect } from "@playwright/test";
import { loginAsAdmin, waitForTableLoaded } from "./helpers";

/**
 * E2E Tests: Session Authentication State Persistence
 *
 * SESSION-01 to SESSION-05: Verify that after login, SPA sidebar navigation
 * preserves auth state and API calls include credentials.
 *
 * NOTE: In basic auth mode (M3 Community), credentials are stored only in
 * Redux memory state. Browser refresh WILL lose the session (by design).
 * These tests verify that SPA-internal navigation works correctly.
 *
 * @see projects/2026-05-twinfoxdb-managed-app/ — Exploratory Testing Report 2026-05-15
 */

test.describe("SESSION: Auth state preservation via SPA navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("SESSION-01: Navigate to all pages via sidebar without losing session", async ({ page }) => {
    const nav = page.getByLabel("Main navigation");

    // Teams (default landing after login)
    await expect(page).toHaveURL(/\/teams/);
    await waitForTableLoaded(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/teams/i);

    // Users
    await nav.getByRole("link", { name: /^users$/i }).click();
    await waitForTableLoaded(page);
    await expect(page).toHaveURL(/\/users/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/users/i);

    // Roles
    await nav.getByRole("link", { name: /^roles$/i }).click();
    await waitForTableLoaded(page);
    await expect(page).toHaveURL(/\/roles/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/roles/i);

    // Grants
    await nav.getByRole("link", { name: /grants/i }).click();
    await waitForTableLoaded(page);
    await expect(page).toHaveURL(/\/grants/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/grants/i);

    // Data Products
    await nav.getByRole("link", { name: /data products/i }).click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/data-products/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/data products/i);

    // Invitations
    await nav.getByRole("link", { name: /invitations/i }).click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/invitations/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/invitations/i);
  });

  test("SESSION-02: API calls include Authorization header after login", async ({ page }) => {
    // Intercept API calls to verify auth header is present
    const apiRequests: Array<{ url: string; auth: string | null }> = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/")) {
        apiRequests.push({
          url: req.url(),
          auth: req.headers()["authorization"] ?? null,
        });
      }
    });

    const nav = page.getByLabel("Main navigation");

    // Navigate to teams — triggers API call
    await nav.getByRole("link", { name: /^teams$/i }).click();
    await waitForTableLoaded(page);

    // Navigate to users — triggers another API call
    await nav.getByRole("link", { name: /^users$/i }).click();
    await waitForTableLoaded(page);

    // Verify all API requests included auth header
    expect(apiRequests.length).toBeGreaterThan(0);
    for (const req of apiRequests) {
      expect(req.auth).not.toBeNull();
      expect(req.auth).toMatch(/^Basic /);
    }
  });

  test("SESSION-03: Sign out clears session and redirects to login", async ({ page }) => {
    await waitForTableLoaded(page);

    // Find and click sign out
    const signOutBtn = page.getByRole("button", { name: /sign out/i })
      .or(page.locator("a", { hasText: /sign out/i }));
    await signOutBtn.first().click();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    // Login form should be visible
    await expect(page.getByRole("textbox", { name: /username/i })).toBeVisible();
  });

  test("SESSION-04: After sign out, navigating back shows login", async ({ page }) => {
    await waitForTableLoaded(page);

    // Sign out
    const signOutBtn = page.getByRole("button", { name: /sign out/i })
      .or(page.locator("a", { hasText: /sign out/i }));
    await signOutBtn.first().click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    // Try navigating to a protected page via URL
    await page.goto("teams");
    await page.waitForLoadState("networkidle");

    // Should be back on login (auth state cleared)
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("SESSION-05: Data loads on each page (not just navigation)", async ({ page }) => {
    const nav = page.getByLabel("Main navigation");

    // Teams — should show table data
    await waitForTableLoaded(page);
    await expect(page.getByRole("table")).toBeVisible();

    // Users — should show user table with admin user
    await nav.getByRole("link", { name: /^users$/i }).click();
    await waitForTableLoaded(page);
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByLabel("Users list").getByText("admin", { exact: true })).toBeVisible();

    // Roles — should show role list
    await nav.getByRole("link", { name: /^roles$/i }).click();
    await waitForTableLoaded(page);
    await expect(page.getByText("Admin Role")).toBeVisible();

    // Grants — should show grants table
    await nav.getByRole("link", { name: /grants/i }).click();
    await waitForTableLoaded(page);
    await expect(page.getByRole("table")).toBeVisible();
  });
});
