import { basicAuthHeader, getApiBaseUrl } from "./auth";

/**
 * Test data fixtures for tdb-admin E2E tests.
 *
 * Creates the required test entities via TDB REST API (faster than UI).
 * All operations are idempotent — safe to run multiple times.
 *
 * Required fixture data (per test protocol §7):
 *   1. Team "testorg"
 *   2. User "testuser1" (will be made org-admin on testorg)
 *   3. User "testuser2" (regular user)
 *   4. Data product "testorg/testdb"
 *   5. Custom role "CustomViewer" with [instance_read_access, schema_read_access]
 *   6. Grant "Admin Role" to testuser1 on testorg (makes org-admin)
 */

// --- Constants ---

export const TEST_ORG = "testorg";
export const TEST_USER_1 = "testuser1";
export const TEST_USER_2 = "testuser2";
export const TEST_PASSWORD = "TestPass123!";
export const TEST_DB = "testdb";
export const CUSTOM_ROLE_NAME = "CustomViewer";
export const CUSTOM_ROLE_ACTIONS: ReadonlyArray<string> = [
  "instance_read_access",
  "schema_read_access",
];

// --- API Helpers ---

async function apiRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Response> {
  const baseUrl = getApiBaseUrl();
  const headers: Record<string, string> = {
    "Authorization": basicAuthHeader(),
  };
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// --- Create Operations (idempotent) ---

export async function createTestOrg(): Promise<void> {
  const res = await apiRequest("POST", `/api/organizations/${TEST_ORG}`);
  // 200 = created, 409 = already exists — both fine
  if (!res.ok && res.status !== 409) {
    console.warn(`[fixture] createTestOrg failed: ${res.status} ${await res.text()}`);
  }
}

export async function createTestUser(username: string, password: string): Promise<void> {
  const res = await apiRequest("POST", "/api/users", { name: username, password });
  if (!res.ok && res.status !== 409) {
    console.warn(`[fixture] createTestUser(${username}) failed: ${res.status} ${await res.text()}`);
  }
}

export async function createTestDatabase(): Promise<void> {
  const res = await apiRequest("POST", `/api/db/${TEST_ORG}/${TEST_DB}`, {
    label: TEST_DB,
    comment: "E2E test database",
  });
  if (!res.ok && res.status !== 409) {
    console.warn(`[fixture] createTestDatabase failed: ${res.status} ${await res.text()}`);
  }
}

export async function createCustomRole(): Promise<void> {
  const res = await apiRequest("POST", "/api/roles", {
    name: CUSTOM_ROLE_NAME,
    action: CUSTOM_ROLE_ACTIONS,
  });
  if (!res.ok && res.status !== 409) {
    console.warn(`[fixture] createCustomRole failed: ${res.status} ${await res.text()}`);
  }
}

export async function grantOrgAdmin(): Promise<void> {
  const res = await apiRequest("POST", "/api/capabilities", {
    operation: "grant",
    user: TEST_USER_1,
    roles: ["Admin Role"],
    scope: TEST_ORG,
    scope_type: "organization",
  });
  if (!res.ok && res.status !== 409) {
    console.warn(`[fixture] grantOrgAdmin failed: ${res.status} ${await res.text()}`);
  }
}

// --- Delete Operations (for teardown) ---

export async function deleteTestDatabase(): Promise<void> {
  await apiRequest("DELETE", `/api/db/${TEST_ORG}/${TEST_DB}`).catch(() => {});
}

export async function deleteCustomRole(): Promise<void> {
  await apiRequest("DELETE", `/api/roles/${CUSTOM_ROLE_NAME}`).catch(() => {});
}

export async function deleteTestOrg(): Promise<void> {
  await apiRequest("DELETE", `/api/organizations/${TEST_ORG}`).catch(() => {});
}

export async function deleteTestUser(username: string): Promise<void> {
  await apiRequest("DELETE", `/api/users/${username}`).catch(() => {});
}

export async function revokeTestGrants(): Promise<void> {
  // Revoke all known test grants (ignore errors)
  const revokeCalls = [
    { user: TEST_USER_1, roles: ["Admin Role"], scope: TEST_ORG, scope_type: "organization" },
    { user: TEST_USER_1, roles: ["Consumer Role"], scope: TEST_ORG, scope_type: "organization" },
    { user: TEST_USER_2, roles: ["Admin Role"], scope: TEST_ORG, scope_type: "organization" },
    { user: TEST_USER_2, roles: ["Consumer Role"], scope: TEST_ORG, scope_type: "organization" },
    { user: TEST_USER_1, roles: ["Admin Role"], scope: `${TEST_ORG}/${TEST_DB}`, scope_type: "database" },
    { user: TEST_USER_1, roles: ["Consumer Role"], scope: `${TEST_ORG}/${TEST_DB}`, scope_type: "database" },
    { user: TEST_USER_2, roles: ["Consumer Role"], scope: `${TEST_ORG}/${TEST_DB}`, scope_type: "database" },
    { user: TEST_USER_1, roles: [CUSTOM_ROLE_NAME], scope: TEST_ORG, scope_type: "organization" },
    { user: TEST_USER_1, roles: [CUSTOM_ROLE_NAME], scope: `${TEST_ORG}/${TEST_DB}`, scope_type: "database" },
  ];

  for (const grant of revokeCalls) {
    await apiRequest("DELETE", "/api/capabilities", {
      operation: "revoke",
      ...grant,
    }).catch(() => {});
  }
}

// --- Aggregate Setup/Teardown ---

/**
 * Create all test fixtures. Idempotent — safe to call multiple times.
 */
export async function setupAllFixtures(): Promise<void> {
  await createTestOrg();
  await createTestUser(TEST_USER_1, TEST_PASSWORD);
  await createTestUser(TEST_USER_2, TEST_PASSWORD);
  await createTestDatabase();
  await createCustomRole();
  await grantOrgAdmin();
}

/**
 * Remove all test fixtures. Order matters:
 * 1. Revoke grants
 * 2. Delete database
 * 3. Delete role
 * 4. Delete org
 * 5. Delete users
 */
export async function teardownAllFixtures(): Promise<void> {
  await revokeTestGrants();
  await deleteTestDatabase();
  await deleteCustomRole();
  await deleteTestOrg();
  await deleteTestUser(TEST_USER_1);
  await deleteTestUser(TEST_USER_2);
}
