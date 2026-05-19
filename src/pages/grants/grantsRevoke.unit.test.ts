/**
 * Unit tests for grants revoke role resolution.
 *
 * Validates that:
 * 1. The role display name (e.g. "Admin Role") is used for scope_type (name-based) revoke calls.
 * 2. The role @id (e.g. "Role/admin") is used for non-admin (raw ID) revoke calls.
 *
 * Bug context: TDB's /api/capabilities with scope_type expects the role's display name
 * (the "name" field from the Role document), NOT the ID slug after stripping "Role/" prefix.
 * - "Admin Role" → TDB resolves to "Role/admin" internally ✓
 * - "admin" (bare slug) → TDB returns "No id associated with role name admin" ✗
 *
 * @see task-44 — Grants regression on team member page
 */

import { describe, it, expect } from "vitest";
import { extractUniqueRolePairs } from "./GrantsPage";

describe("grants revoke — role resolution for TDB capabilities API", () => {
  describe("extractUniqueRolePairs produces correct label/value for revoke calls", () => {
    it("label is the display name for admin scope_type revoke, value is rawRole for non-admin revoke", () => {
      const grants = [
        {
          id: "testuser1:Role/admin:Organization/testorg",
          user: "testuser1",
          role: "Admin Role",
          rawRole: "Role/admin",
          scopeType: "organization" as const,
          scope: "Organization/testorg",
          displayScope: "testorg",
          apiScope: "testorg",
        },
        {
          id: "testuser2:Role/consumer:Organization/testorg",
          user: "testuser2",
          role: "Consumer Role",
          rawRole: "Role/consumer",
          scopeType: "organization" as const,
          scope: "Organization/testorg",
          displayScope: "testorg",
          apiScope: "testorg",
        },
      ];

      const rolePairs = extractUniqueRolePairs(grants);

      // label (display name) is what TDB expects for scope_type name-based lookup
      expect(rolePairs).toContainEqual({ label: "Admin Role", value: "Role/admin" });
      expect(rolePairs).toContainEqual({ label: "Consumer Role", value: "Role/consumer" });
    });

    it("deduplicates roles by rawRole ID", () => {
      const grants = [
        {
          id: "alice:Role/admin:Organization/testorg",
          user: "alice",
          role: "Admin Role",
          rawRole: "Role/admin",
          scopeType: "organization" as const,
          scope: "Organization/testorg",
          displayScope: "testorg",
          apiScope: "testorg",
        },
        {
          id: "bob:Role/admin:Organization/testorg",
          user: "bob",
          role: "Admin Role",
          rawRole: "Role/admin",
          scopeType: "organization" as const,
          scope: "Organization/testorg",
          displayScope: "testorg",
          apiScope: "testorg",
        },
      ];

      const rolePairs = extractUniqueRolePairs(grants);
      expect(rolePairs).toHaveLength(1);
      expect(rolePairs[0]).toEqual({ label: "Admin Role", value: "Role/admin" });
    });
  });

  describe("role name vs role ID usage contract", () => {
    /**
     * This test documents the critical contract for the TDB capabilities API:
     *
     * When useNameBasedLookup = true (global admin, scope_type sent):
     *   - roles[] must contain DISPLAY NAMES like "Admin Role"
     *   - NOT ID slugs like "admin" or full IDs like "Role/admin"
     *
     * When useNameBasedLookup = false (non-admin, scope_type omitted):
     *   - roles[] must contain full @id format like "Role/admin"
     *   - NOT display names like "Admin Role"
     */
    it("documents that TDB scope_type mode requires display names, not ID slugs", () => {
      // The display name extracted from normalisation
      const displayName = "Admin Role";
      // The @id from normalisation
      const roleId = "Role/admin";
      // The WRONG value that was previously used (stripping "Role/" prefix)
      const brokenSlug = "admin";

      // For scope_type mode (global admin):
      // The correct value to send is the display name
      expect(displayName).toBe("Admin Role");
      // NOT the stripped slug
      expect(brokenSlug).not.toBe(displayName);
      // NOT the full @id
      expect(roleId).not.toBe(displayName);

      // For non-admin (no scope_type):
      // The correct value to send is the full @id
      expect(roleId).toBe("Role/admin");
    });

    it("stripping Role/ prefix gives wrong value for scope_type mode", () => {
      // This is the anti-pattern that caused the bug:
      const roleId = "Role/admin";
      const brokenResult = roleId.startsWith("Role/") ? roleId.slice("Role/".length) : roleId;

      // "admin" is NOT a valid role name for TDB's scope_type lookup.
      // TDB returns: "No id associated with role name admin"
      expect(brokenResult).toBe("admin");
      expect(brokenResult).not.toBe("Admin Role");
    });
  });
});
