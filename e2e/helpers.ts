import { type Page, expect } from "@playwright/test";

/**
 * Shared E2E test helpers for tdb-admin.
 *
 * Re-exports auth and test-data fixtures and adds page-level utilities.
 */

// Re-export fixtures for convenient imports in spec files
export {
  ADMIN_USER,
  ADMIN_PASSWORD,
  login,
  loginAsAdmin,
  basicAuthHeader,
  getApiBaseUrl,
} from "./fixtures/auth";

export {
  TEST_ORG,
  TEST_USER_1,
  TEST_USER_2,
  TEST_PASSWORD,
  TEST_DB,
  CUSTOM_ROLE_NAME,
  CUSTOM_ROLE_ACTIONS,
} from "./fixtures/test-data";

// --- Page-level utilities ---

/**
 * Wait for a data table or empty state to appear (loading complete).
 *
 * Pages like Data Products show multiple tables (one per team) and may also
 * show "No data products yet" for empty teams. We just need to confirm that
 * at least ONE table or ONE empty-state indicator is visible.
 */
export async function waitForTableLoaded(page: Page): Promise<void> {
  // Wait for loading skeleton to disappear (if present)
  const skeleton = page.locator(".animate-pulse");
  await skeleton.first().waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {
    // Might not have appeared at all — that's fine
  });

  // Wait for either a table OR an empty/no-data message to be visible.
  // Use waitFor (not expect().toBeVisible) to avoid strict mode issues when
  // both a table and empty-state text exist simultaneously on the page.
  await page.getByRole("table").first()
    .or(page.getByText(/no .*(grants|teams|users|roles|data|products)/i).first())
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
}

/**
 * Wait for a HeadlessUI dialog to become visible.
 *
 * HeadlessUI v2 renders dialogs with `role="dialog"` and `data-open` attribute.
 * KNOWN ISSUE: Playwright considers the dialog root "hidden" even when
 * `data-open=""` is set — the root div is a positioning wrapper with no
 * intrinsic dimensions. The visible content lives in the DialogPanel child.
 *
 * Workaround: Wait for the dialog to be attached (DOM-present with open state),
 * then wait for interactive content inside to become visible, confirming the
 * panel has rendered.
 */
export async function waitForDialogOpen(page: Page): Promise<void> {
  // Wait for the dialog root to be in DOM with open state
  const openDialog = page.locator("[role=\"dialog\"][data-open]")
    .or(page.locator("[role=\"dialog\"][data-headlessui-state=\"open\"]"));
  await openDialog.waitFor({ state: "attached", timeout: 10_000 });

  // Wait for visible content inside the dialog (confirms panel transition done)
  const dialogContent = openDialog.locator("input, button, h2, h3, label, [role=\"heading\"]").first();
  await dialogContent.waitFor({ state: "visible", timeout: 5_000 });
}

/**
 * Wait for a dialog/modal to close.
 */
export async function waitForDialogClosed(page: Page): Promise<void> {
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
}

/**
 * Navigate to a page and wait for the main content to load.
 * @deprecated Use navigateViaSidebar() after login — page.goto() clears Redux auth state.
 */
export async function navigateAndWait(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/**
 * Navigate to a section using the sidebar link (SPA navigation).
 *
 * In M3 basic auth mode, auth state is stored in Redux memory only.
 * A full page navigation (page.goto) clears this state, causing redirect
 * to login. SPA sidebar navigation preserves the token.
 *
 * @param page - Playwright Page instance (must be logged in already)
 * @param section - Sidebar link name: "teams", "users", "roles", "grants", "data products", "invitations"
 */
export async function navigateViaSidebar(page: Page, section: string): Promise<void> {
  const link = page.getByRole("link", { name: new RegExp(`^${section}$`, "i") });
  await link.click();
  await page.waitForLoadState("networkidle");
}

/**
 * Navigate to a team detail page via the sidebar + row click.
 *
 * @param page - Playwright Page instance (must be logged in already)
 * @param teamName - Team name to click in the teams list
 */
export async function navigateToTeamDetail(page: Page, teamName: string): Promise<void> {
  await navigateViaSidebar(page, "teams");
  await waitForTableLoaded(page);
  await page.getByText(teamName).click();
  await page.waitForURL(new RegExp(`/teams/${teamName}`), { timeout: 5_000 });
}

/**
 * Navigate to the branches page for a data product via sidebar + button click.
 *
 * On the Data Products page, each DB name is a clickable button (link-styled)
 * inside the table row. Clicking the button navigates to the branches page.
 *
 * @param page - Playwright Page instance (must be logged in already)
 * @param org - Organisation name
 * @param db - Database name
 */
export async function navigateToBranches(page: Page, org: string, db: string): Promise<void> {
  await navigateViaSidebar(page, "data products");
  await waitForTableLoaded(page);
  // Click the DB name button (link-styled) to navigate
  const dbBtn = page.getByRole("button", { name: db, exact: true });
  await dbBtn.click();
  await page.waitForURL(new RegExp(`/data-products/${org}/${db}/branches`), { timeout: 10_000 });
}
