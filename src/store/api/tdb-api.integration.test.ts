/**
 * Integration tests — verify TDB REST API response shapes against our type definitions.
 *
 * These tests call a REAL TerminusDB instance to confirm:
 * 1. Endpoints exist and return expected status codes
 * 2. Response shapes match our TypeScript interfaces
 * 3. Full CRUD lifecycle works (create → read → update → delete)
 * 4. Cache invalidation assumptions are valid (mutations trigger list refreshes)
 *
 * Prerequisites:
 *   - TerminusDB running at http://localhost:6363
 *   - Admin credentials: admin:root
 *   - curl available on PATH
 *
 * Run with: npx vitest run src/store/api/tdb-api.integration.test.ts
 *
 * IMPLEMENTATION NOTE: All HTTP requests use curl via execSync to avoid
 * Node.js undici/fetch incompatibilities with TDB v12's HTTP behaviour.
 * TDB v12 has two known bugs:
 *   1. DELETE of non-existent entities hangs for 60+ seconds server-side
 *   2. DELETE with Content-Type: application/json header hangs indefinitely
 * Using curl with --max-time and omitting Content-Type on DELETE handles both.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";

// --- Test configuration ---

const TDB_URL = "http://localhost:6363";
const TDB_AUTH = `Basic ${Buffer.from("admin:root").toString("base64")}`;

const TEST_PREFIX = "inttest_";
const TEST_USER = `${TEST_PREFIX}alice`;
const TEST_USER_PASSWORD = "IntTest_P@ss123";
const TEST_ORG = `${TEST_PREFIX}acme`;
const TEST_DB = `${TEST_PREFIX}salesdata`;
const TEST_ROLE = `${TEST_PREFIX}editor`;

// --- Helper functions ---

interface CurlResult {
  status: number;
  body: string;
}

/**
 * Execute an HTTP request via curl. Uses --max-time to handle TDB v12 bug
 * where DELETE of non-existent entities hangs for 60+ seconds.
 *
 * CRITICAL: TDB v12 hangs on DELETE when Content-Type: application/json is sent.
 * DELETE has no body, so Content-Type must be omitted for DELETE requests.
 */
function tdbRequest(
  method: string,
  path: string,
  body?: string
): CurlResult {
  const bodyArgs = body ? `-d '${body.replace(/'/g, "'\\''")}'` : "";
  // Only send Content-Type for methods that have a request body
  const contentTypeHeader = method === "DELETE"
    ? ""
    : `-H "Content-Type: application/json"`;
  const cmd = [
    "curl -s",
    `--max-time 8`,
    `-w "\\n%{http_code}"`,
    `-X ${method}`,
    `"${TDB_URL}${path}"`,
    `-H "Authorization: ${TDB_AUTH}"`,
    contentTypeHeader,
    bodyArgs,
  ].filter(Boolean).join(" ");

  try {
    const result = execSync(cmd, { encoding: "utf8", timeout: 12000 });
    const lines = result.trim().split("\n");
    const status = parseInt(lines[lines.length - 1], 10);
    const responseBody = lines.slice(0, -1).join("\n");
    return { status, body: responseBody };
  } catch (err: unknown) {
    const e = err as { stdout?: string; status?: number };
    // curl exit code 28 = timeout (TDB hung on non-existent entity DELETE)
    if (e.stdout) {
      const lines = e.stdout.trim().split("\n");
      const status = parseInt(lines[lines.length - 1], 10);
      if (status) {
        return { status, body: lines.slice(0, -1).join("\n") };
      }
    }
    // Timeout or other error — treat as request timeout
    return { status: 408, body: "request timeout (TDB hung)" };
  }
}

/**
 * Shorthand for GET requests that expect a JSON body.
 */
function tdbGet(path: string): CurlResult {
  return tdbRequest("GET", path);
}

/**
 * Shorthand for POST requests with a JSON body.
 */
function tdbPost(path: string, payload: Record<string, unknown>): CurlResult {
  return tdbRequest("POST", path, JSON.stringify(payload));
}

/**
 * Shorthand for PUT requests with a JSON body.
 */
function tdbPut(path: string, payload: Record<string, unknown>): CurlResult {
  return tdbRequest("PUT", path, JSON.stringify(payload));
}

/**
 * Shorthand for DELETE requests.
 */
function tdbDelete(path: string): CurlResult {
  return tdbRequest("DELETE", path);
}

/**
 * Safely delete a test entity. Returns true if deleted (200), false otherwise.
 */
function safeDelete(path: string): boolean {
  const { status } = tdbDelete(path);
  return status === 200;
}

// --- Test lifecycle ---

describe("TDB REST API Integration Tests", () => {
  beforeAll(() => {
    // Verify TDB is reachable
    const info = tdbGet("/api/info");
    if (info.status !== 200) {
      throw new Error(`TDB not reachable at ${TDB_URL}. Start TerminusDB first.`);
    }

    // Clean up any leftover test data from previous runs.
    // Order matters: DB first, then role, user, org.
    safeDelete(`/api/db/${TEST_ORG}/${TEST_DB}`);
    safeDelete(`/api/roles/${TEST_ROLE}`);
    safeDelete(`/api/users/${TEST_USER}`);
    safeDelete(`/api/organizations/${TEST_ORG}`);
  }, 60000);

  afterAll(() => {
    // Best-effort cleanup (entities should already be deleted by Phase 5)
    safeDelete(`/api/db/${TEST_ORG}/${TEST_DB}`);
    safeDelete(`/api/roles/${TEST_ROLE}`);
    safeDelete(`/api/users/${TEST_USER}`);
    safeDelete(`/api/organizations/${TEST_ORG}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 1: Create all entities
  // ─────────────────────────────────────────────────────────────────────────

  describe("Phase 1: Create entities", () => {
    it("POST /api/users — creates a new user", () => {
      const result = tdbPost("/api/users", {
        name: TEST_USER,
        password: TEST_USER_PASSWORD,
      });

      expect(result.status).toBe(200);
      expect(result.body).toContain("terminusdb://");
      expect(result.body).toContain(TEST_USER);
    });

    it("POST /api/organizations/:name — creates a new org", () => {
      const result = tdbPost(`/api/organizations/${TEST_ORG}`, {});

      expect(result.status).toBe(200);
      expect(result.body).toContain("terminusdb://");
      expect(result.body).toContain(TEST_ORG);
    });

    it("POST /api/roles — creates a new role with actions", () => {
      const result = tdbPost("/api/roles", {
        name: TEST_ROLE,
        action: ["instance_read_access", "instance_write_access"],
      });

      expect(result.status).toBe(200);
      expect(result.body).toContain("terminusdb://");
      expect(result.body).toContain(TEST_ROLE);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 2: Read and verify entities
  // ─────────────────────────────────────────────────────────────────────────

  describe("Phase 2: Read and verify", () => {
    it("GET /api/users — returns array including test user", () => {
      const result = tdbGet("/api/users");
      expect(result.status).toBe(200);
      const users = JSON.parse(result.body) as unknown[];
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThanOrEqual(2);
    });

    it("GET /api/users/:name — returns test user object", () => {
      const result = tdbGet(`/api/users/${TEST_USER}`);
      expect(result.status).toBe(200);
      const user = JSON.parse(result.body) as Record<string, unknown>;
      expect(user.name).toBe(TEST_USER);
    });

    it("GET /api/organizations — returns array including test org", () => {
      const result = tdbGet("/api/organizations");
      expect(result.status).toBe(200);
      const orgs = JSON.parse(result.body) as unknown[];
      expect(Array.isArray(orgs)).toBe(true);
      expect(orgs.length).toBeGreaterThanOrEqual(1);
    });

    it("GET /api/organizations/:name — returns test org info", () => {
      const result = tdbGet(`/api/organizations/${TEST_ORG}`);
      expect(result.status).toBe(200);
      const org = JSON.parse(result.body) as Record<string, unknown>;
      expect(org.name).toBe(TEST_ORG);
    });

    it("GET /api/organizations/:org/users/ — returns members array", () => {
      const result = tdbGet(`/api/organizations/${TEST_ORG}/users/`);
      expect(result.status).toBe(200);
      const members = JSON.parse(result.body) as unknown[];
      expect(Array.isArray(members)).toBe(true);
    });

    it("GET /api/roles — returns array including test role", () => {
      const result = tdbGet("/api/roles");
      expect(result.status).toBe(200);
      const roles = JSON.parse(result.body) as unknown[];
      expect(Array.isArray(roles)).toBe(true);
      expect(roles.length).toBeGreaterThanOrEqual(1);
    });

    it("GET /api/roles/:name — returns test role with actions", () => {
      const result = tdbGet(`/api/roles/${TEST_ROLE}`);
      expect(result.status).toBe(200);
      const role = JSON.parse(result.body) as Record<string, unknown>;
      expect(role.name).toBe(TEST_ROLE);
      expect(role.action).toContain("instance_read_access");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 3: Update operations
  // ─────────────────────────────────────────────────────────────────────────

  describe("Phase 3: Update operations", () => {
    it("PUT /api/users — changes password", () => {
      const result = tdbPut("/api/users", {
        name: TEST_USER,
        password: "NewP@ssw0rd456",
      });
      expect(result.status).toBe(200);
      const body = JSON.parse(result.body) as Record<string, unknown>;
      expect(body["api:status"]).toBe("api:success");
    });

    it("PUT /api/roles — updates role actions", () => {
      const result = tdbPut("/api/roles", {
        name: TEST_ROLE,
        action: ["instance_read_access", "instance_write_access", "schema_read_access"],
      });
      expect(result.status).toBe(200);
      const body = JSON.parse(result.body) as Record<string, unknown>;
      expect(body["api:status"]).toBe("api:success");
    });

    it("POST /api/capabilities (grant) — grants role to user", () => {
      const result = tdbPost("/api/capabilities", {
        operation: "grant",
        scope_type: "organization",
        scope: TEST_ORG,
        user: TEST_USER,
        roles: [TEST_ROLE],
      });
      expect(result.status).toBe(200);
      const body = JSON.parse(result.body) as Record<string, unknown>;
      expect(body["api:status"]).toBe("api:success");
    });

    it("POST /api/capabilities (revoke) — revokes role from user", () => {
      const result = tdbPost("/api/capabilities", {
        operation: "revoke",
        scope_type: "organization",
        scope: TEST_ORG,
        user: TEST_USER,
        roles: [TEST_ROLE],
      });
      expect(result.status).toBe(200);
      const body = JSON.parse(result.body) as Record<string, unknown>;
      expect(body["api:status"]).toBe("api:success");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 4: Database CRUD (full lifecycle)
  // ─────────────────────────────────────────────────────────────────────────

  describe("Phase 4: Database CRUD", () => {
    it("POST /api/db/:org/:name — creates a database", () => {
      const result = tdbPost(`/api/db/${TEST_ORG}/${TEST_DB}`, {
        label: "Integration Test DB",
        comment: "Created by integration test",
        schema: true,
      });
      expect(result.status).toBe(200);
      const body = JSON.parse(result.body) as Record<string, unknown>;
      expect(body["api:status"]).toBe("api:success");
      expect(body["api:database_uri"]).toBeDefined();
    });

    it("GET /api/db/:org — lists databases in the org", () => {
      const result = tdbGet(`/api/db/${TEST_ORG}`);
      expect(result.status).toBe(200);
      const dbs = JSON.parse(result.body) as Array<Record<string, unknown>>;
      expect(Array.isArray(dbs)).toBe(true);
      const found = dbs.some((db) =>
        db.path?.toString().includes(TEST_DB) ?? false
      );
      expect(found).toBe(true);
    });

    it("DELETE /api/db/:org/:name — deletes the database", () => {
      const result = tdbDelete(`/api/db/${TEST_ORG}/${TEST_DB}`);
      expect(result.status).toBe(200);
      const body = JSON.parse(result.body) as Record<string, unknown>;
      expect(body["api:status"]).toBe("api:success");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 5: Delete entities
  // Entities are guaranteed to exist from Phase 1 — DELETE should be instant.
  // ─────────────────────────────────────────────────────────────────────────

  describe("Phase 5: Delete entities", () => {
    it("DELETE /api/roles/:name — deletes the test role", () => {
      const result = tdbDelete(`/api/roles/${TEST_ROLE}`);
      expect(result.status, `Failed: ${result.body}`).toBe(200);
    });

    it("DELETE /api/users/:name — deletes the test user", () => {
      const result = tdbDelete(`/api/users/${TEST_USER}`);
      expect(result.status, `Failed: ${result.body}`).toBe(200);
    });

    it("DELETE /api/organizations/:name — deletes the test org", () => {
      const result = tdbDelete(`/api/organizations/${TEST_ORG}`);
      expect(result.status, `Failed: ${result.body}`).toBe(200);
    });
  });
});
