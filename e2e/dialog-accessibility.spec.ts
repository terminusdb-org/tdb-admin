import { test, expect } from "@playwright/test";
import { loginAsAdmin, waitForTableLoaded, waitForDialogOpen, navigateViaSidebar } from "./helpers";

/**
 * E2E Tests: Dialog Accessibility & Keyboard Interaction
 *
 * DIALOG-ESC-01 to ESC-05: Verify all dialogs close on Escape key
 * DIALOG-FOCUS-01 to FOCUS-05: Verify focus trap in modal dialogs
 *
 * These tests were written based on exploratory testing findings:
 * - H-001: Grant Access dialog does NOT close on Escape key
 * - M-004: Focus trap not complete in dialogs
 *
 * @see projects/2026-05-twinfoxdb-managed-app/ — Exploratory Testing Report 2026-05-15
 */

test.describe("DIALOG-ESC: All dialogs close on Escape key", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("DIALOG-ESC-01: Create Team dialog closes on Escape", async ({ page }) => {
    await navigateViaSidebar(page, "teams");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /create team/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.getByRole("dialog");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 2_000 });
  });

  test("DIALOG-ESC-02: Add User dialog closes on Escape", async ({ page }) => {
    await navigateViaSidebar(page, "users");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /add user/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.getByRole("dialog");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 2_000 });
  });

  test("DIALOG-ESC-03: Grant Access dialog closes on Escape", async ({ page }) => {
    await navigateViaSidebar(page, "grants");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /grant access/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.getByRole("dialog");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 2_000 });
  });

  test("DIALOG-ESC-04: Create Role dialog closes on Escape", async ({ page }) => {
    await navigateViaSidebar(page, "roles");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /create role/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.getByRole("dialog");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 2_000 });
  });

  test("DIALOG-ESC-05: New Data Product dialog closes on Escape", async ({ page }) => {
    await navigateViaSidebar(page, "data products");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /new data product/i }).click();
    await waitForDialogOpen(page);
    const dialog = page.getByRole("dialog");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 2_000 });
  });
});

test.describe("DIALOG-FOCUS: Focus trap within modal dialogs", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("DIALOG-FOCUS-01: Create Team dialog traps focus", async ({ page }) => {
    await navigateViaSidebar(page, "teams");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /create team/i }).click();
    await waitForDialogOpen(page);

    // Focus should start inside the dialog
    const initialFocus = await page.evaluate(() =>
      !!document.activeElement?.closest("[role=\"dialog\"]")
    );
    expect(initialFocus).toBe(true);

    // Tab through all focusable elements — focus should stay in dialog
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
    }

    const afterTabbing = await page.evaluate(() =>
      !!document.activeElement?.closest("[role=\"dialog\"]")
    );
    expect(afterTabbing).toBe(true);
  });

  test("DIALOG-FOCUS-02: Add User dialog traps focus", async ({ page }) => {
    await navigateViaSidebar(page, "users");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /add user/i }).click();
    await waitForDialogOpen(page);

    // Focus should start inside the dialog
    const initialFocus = await page.evaluate(() =>
      !!document.activeElement?.closest("[role=\"dialog\"]")
    );
    expect(initialFocus).toBe(true);

    // Tab through — focus should stay trapped
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
    }

    const afterTabbing = await page.evaluate(() =>
      !!document.activeElement?.closest("[role=\"dialog\"]")
    );
    expect(afterTabbing).toBe(true);
  });

  test("DIALOG-FOCUS-03: Grant Access dialog traps focus", async ({ page }) => {
    await navigateViaSidebar(page, "grants");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /grant access/i }).click();
    await waitForDialogOpen(page);

    const initialFocus = await page.evaluate(() =>
      !!document.activeElement?.closest("[role=\"dialog\"]")
    );
    expect(initialFocus).toBe(true);

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
    }

    const afterTabbing = await page.evaluate(() =>
      !!document.activeElement?.closest("[role=\"dialog\"]")
    );
    expect(afterTabbing).toBe(true);
  });

  test("DIALOG-FOCUS-04: Create Role dialog traps focus", async ({ page }) => {
    await navigateViaSidebar(page, "roles");
    await waitForTableLoaded(page);

    await page.getByRole("button", { name: /create role/i }).click();
    await waitForDialogOpen(page);

    const initialFocus = await page.evaluate(() =>
      !!document.activeElement?.closest("[role=\"dialog\"]")
    );
    expect(initialFocus).toBe(true);

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
    }

    const afterTabbing = await page.evaluate(() =>
      !!document.activeElement?.closest("[role=\"dialog\"]")
    );
    expect(afterTabbing).toBe(true);
  });

  test("DIALOG-FOCUS-05: New Data Product dialog traps focus", async ({ page }) => {
    await navigateViaSidebar(page, "data products");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /new data product/i }).click();
    await waitForDialogOpen(page);

    const initialFocus = await page.evaluate(() =>
      !!document.activeElement?.closest("[role=\"dialog\"]")
    );
    expect(initialFocus).toBe(true);

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
    }

    const afterTabbing = await page.evaluate(() =>
      !!document.activeElement?.closest("[role=\"dialog\"]")
    );
    expect(afterTabbing).toBe(true);
  });
});
