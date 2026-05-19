import { type Page, type BrowserContext } from "@playwright/test";

/**
 * Authentication fixtures for tdb-admin E2E tests.
 *
 * Targets basic auth mode (Community edition) where the login form
 * validates credentials directly against TDB's REST API.
 */

/** Default admin credentials — override via environment variables */
export const ADMIN_USER = process.env.TDB_ADMIN_USER ?? "admin";
export const ADMIN_PASSWORD = process.env.TDB_ADMIN_PASSWORD ?? "admin_password";

/**
 * Login via the tdb-admin login form.
 * Waits for redirect away from /login to confirm success.
 */
export async function login(page: Page, username: string, password: string): Promise<void> {
  await page.goto("login");
  await page.waitForLoadState("networkidle");

  // Fill credentials
  await page.getByRole("textbox", { name: /username/i }).fill(username);
  await page.getByRole("textbox", { name: /password/i }).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for successful redirect (away from login page)
  await page.waitForURL(/(?!.*\/login)/, { timeout: 10_000 });
}

/**
 * Login as the global admin user.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await login(page, ADMIN_USER, ADMIN_PASSWORD);
}

/**
 * Create a Basic auth header value for direct TDB API calls.
 */
export function basicAuthHeader(username?: string, password?: string): string {
  const user = username ?? ADMIN_USER;
  const pass = password ?? ADMIN_PASSWORD;
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

/**
 * Get the TDB API base URL (root, without /dashboard).
 * Derives from the Playwright baseURL or env var.
 */
export function getApiBaseUrl(): string {
  const baseUrl = process.env.BASE_URL ?? "http://localhost:6363/dashboard/";
  return baseUrl.replace(/\/dashboard\/?$/, "");
}

/**
 * Set up authenticated storage state for reuse across tests.
 * Logs in once and saves cookies/localStorage to a file.
 */
export async function setupAuthState(
  context: BrowserContext,
  storageStatePath: string
): Promise<void> {
  const page = await context.newPage();
  await loginAsAdmin(page);
  await page.context().storageState({ path: storageStatePath });
  await page.close();
}
