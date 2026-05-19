import { test, expect } from "@playwright/test";
import { loginAsAdmin, waitForTableLoaded, waitForDialogOpen, navigateViaSidebar, navigateToTeamDetail, TEST_USER_1, TEST_ORG } from "./helpers";
import { basicAuthHeader, getApiBaseUrl } from "./fixtures/auth";

/**
 * E2E Tests: Teams (Organisations) CRUD
 *
 * TEAM-01 to TEAM-08
 * @see projects/2026-05-twinfoxdb-managed-app/specs/e2e-test-protocol-tdb-admin.md §3.2
 */

test.describe("TEAM: Teams CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("TEAM-01: List teams shows existing teams", async ({ page }) => {
    await navigateViaSidebar(page, "teams");
    await waitForTableLoaded(page);

    // At minimum, "admin" org always exists in the table
    await expect(page.getByRole("table")).toBeVisible();
    await expect(
      page.getByRole("table").getByRole("cell", { name: "admin", exact: true })
    ).toBeVisible();
  });

  test("TEAM-02: Create team with valid name", async ({ page }) => {
    const teamName = `e2e-team-${Date.now()}`;

    await navigateViaSidebar(page, "teams");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /create team/i }).click();

    await waitForDialogOpen(page);
    const dialog = page.getByRole("dialog");

    await dialog.getByRole("textbox").fill(teamName);
    await dialog.getByRole("button", { name: /create/i }).click();

    // Dialog should close
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // New team should appear in the list
    await expect(page.getByText(teamName)).toBeVisible({ timeout: 5_000 });

    // Cleanup
    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/api/organizations/${teamName}`, {
      method: "DELETE",
      headers: { "Authorization": basicAuthHeader() },
    });
  });

  test("TEAM-03: Create team — invalid name blocks submission", async ({ page }) => {
    await navigateViaSidebar(page, "teams");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /create team/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));

    // Enter invalid name (slashes/special chars)
    await dialog.getByRole("textbox").fill("invalid/team!");
    await dialog.getByRole("button", { name: /create/i }).click();

    // Client-side validation blocks submission — dialog stays open
    await expect(dialog.getByRole("textbox")).toBeVisible({ timeout: 3_000 });
  });

  test("TEAM-04: Create team — duplicate name shows error", async ({ page }) => {
    await navigateViaSidebar(page, "teams");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /create team/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));

    // Try to create "admin" which already exists
    await dialog.getByRole("textbox").fill("admin");
    await dialog.getByRole("button", { name: /create/i }).click();

    // Should show inline error (M-002 fix surfaces API 400 as message)
    await expect(
      dialog.getByText(/already exists/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test("TEAM-05: Navigate to team detail", async ({ page }) => {
    await navigateToTeamDetail(page, TEST_ORG);

    // Should be on team detail page
    await expect(page.getByText(TEST_ORG)).toBeVisible();
  });

  test("TEAM-06: Delete team with confirmation", async ({ page }) => {
    // Create a team via UI so it appears in the current SPA state
    const teamName = `e2e-del-${Date.now()}`;

    await navigateViaSidebar(page, "teams");
    await waitForTableLoaded(page);

    // Create via dialog
    await page.getByRole("button", { name: /create team/i }).click();
    await waitForDialogOpen(page);
    const createDialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));
    await createDialog.getByRole("textbox").fill(teamName);
    await createDialog.getByRole("button", { name: /create/i }).click();
    await expect(createDialog).toBeHidden({ timeout: 10_000 });

    // Verify team appears in list
    await expect(page.getByText(teamName)).toBeVisible({ timeout: 5_000 });

    // Now delete it — use exact:true to avoid matching the row (which also has role=button)
    const deleteBtn = page.getByRole("button", { name: `Delete team ${teamName}`, exact: true });
    await deleteBtn.click({ timeout: 10_000 });

    // Confirmation modal — requires typing team name to enable Delete button
    await waitForDialogOpen(page);
    const confirmDialog = page.locator("[role=\"dialog\"][data-open]")
      .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));
    await confirmDialog.getByRole("textbox").fill(teamName);
    await confirmDialog.getByRole("button", { name: /delete team/i }).click();

    // Wait for dialog to close first (confirms deletion completed)
    await expect(page.locator("[role=\"dialog\"]")).toBeHidden({ timeout: 10_000 });

    // Team should no longer appear in the table — use first cell to avoid strict mode
    await expect(
      page.getByRole("table").getByRole("cell", { name: teamName }).first()
    ).toBeHidden({ timeout: 10_000 });

    // Cleanup (in case UI delete failed)
    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/api/organizations/${teamName}`, {
      method: "DELETE",
      headers: { "Authorization": basicAuthHeader() },
    }).catch(() => {});
  });

  test("TEAM-07: Delete team — cancel preserves team", async ({ page }) => {
    await navigateViaSidebar(page, "teams");
    await waitForTableLoaded(page);

    // Delete button has accessible name "Delete team <name>" — exact to avoid row match
    const deleteBtn = page.getByRole("button", { name: `Delete team ${TEST_ORG}`, exact: true });

    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click();
      const dialog = page.locator("[role=\"dialog\"][data-open]")
        .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));
      await dialog.locator("input, button, h2, h3, label").first().waitFor({ state: "visible", timeout: 5_000 });
      await dialog.getByRole("button", { name: /cancel/i }).click();
      await expect(page.locator("[role=\"dialog\"]")).toBeHidden({ timeout: 10_000 });

      // Team should still be visible
      await expect(page.getByText(TEST_ORG)).toBeVisible();
    }
  });

  test("TEAM-08: Team detail shows member list", async ({ page }) => {
    await navigateToTeamDetail(page, TEST_ORG);
    await waitForTableLoaded(page);

    // Should show members table (testuser1 was granted Admin Role on testorg)
    await expect(page.getByRole("table")).toBeVisible();
    await expect(
      page.getByRole("table").getByText(TEST_USER_1)
    ).toBeVisible();
  });
});
