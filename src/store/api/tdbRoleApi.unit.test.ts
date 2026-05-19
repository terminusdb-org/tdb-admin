/**
 * Unit tests for the TDB Role + Capability API slice.
 *
 * Verifies endpoint definitions, hook exports, and constants.
 */

import { describe, it, expect } from "vitest";
import { tdbRoleApi, TDB_ACTIONS } from "./tdbRoleApi";

describe("tdbRoleApi", () => {
  describe("endpoint definitions", () => {
    it("defines listRoles query endpoint", () => {
      expect(tdbRoleApi.endpoints.listRoles).toBeDefined();
      expect(tdbRoleApi.endpoints.listRoles.initiate).toBeTypeOf("function");
    });

    it("defines getRole query endpoint", () => {
      expect(tdbRoleApi.endpoints.getRole).toBeDefined();
      expect(tdbRoleApi.endpoints.getRole.initiate).toBeTypeOf("function");
    });

    it("defines createRole mutation endpoint", () => {
      expect(tdbRoleApi.endpoints.createRole).toBeDefined();
      expect(tdbRoleApi.endpoints.createRole.initiate).toBeTypeOf("function");
    });

    it("defines updateRole mutation endpoint", () => {
      expect(tdbRoleApi.endpoints.updateRole).toBeDefined();
      expect(tdbRoleApi.endpoints.updateRole.initiate).toBeTypeOf("function");
    });

    it("defines deleteRole mutation endpoint", () => {
      expect(tdbRoleApi.endpoints.deleteRole).toBeDefined();
      expect(tdbRoleApi.endpoints.deleteRole.initiate).toBeTypeOf("function");
    });

    it("defines grantCapability mutation endpoint", () => {
      expect(tdbRoleApi.endpoints.grantCapability).toBeDefined();
      expect(tdbRoleApi.endpoints.grantCapability.initiate).toBeTypeOf("function");
    });

    it("defines revokeCapability mutation endpoint", () => {
      expect(tdbRoleApi.endpoints.revokeCapability).toBeDefined();
      expect(tdbRoleApi.endpoints.revokeCapability.initiate).toBeTypeOf("function");
    });
  });

  describe("exported hooks", () => {
    it("exports useListRolesQuery hook", async () => {
      const { useListRolesQuery } = await import("./tdbRoleApi");
      expect(useListRolesQuery).toBeTypeOf("function");
    });

    it("exports useGetRoleQuery hook", async () => {
      const { useGetRoleQuery } = await import("./tdbRoleApi");
      expect(useGetRoleQuery).toBeTypeOf("function");
    });

    it("exports useCreateRoleMutation hook", async () => {
      const { useCreateRoleMutation } = await import("./tdbRoleApi");
      expect(useCreateRoleMutation).toBeTypeOf("function");
    });

    it("exports useUpdateRoleMutation hook", async () => {
      const { useUpdateRoleMutation } = await import("./tdbRoleApi");
      expect(useUpdateRoleMutation).toBeTypeOf("function");
    });

    it("exports useDeleteRoleMutation hook", async () => {
      const { useDeleteRoleMutation } = await import("./tdbRoleApi");
      expect(useDeleteRoleMutation).toBeTypeOf("function");
    });

    it("exports useGrantCapabilityMutation hook", async () => {
      const { useGrantCapabilityMutation } = await import("./tdbRoleApi");
      expect(useGrantCapabilityMutation).toBeTypeOf("function");
    });

    it("exports useRevokeCapabilityMutation hook", async () => {
      const { useRevokeCapabilityMutation } = await import("./tdbRoleApi");
      expect(useRevokeCapabilityMutation).toBeTypeOf("function");
    });
  });

  describe("TDB_ACTIONS constant", () => {
    it("exports a non-empty array of known TDB actions", () => {
      expect(TDB_ACTIONS).toBeInstanceOf(Array);
      expect(TDB_ACTIONS.length).toBeGreaterThan(0);
    });

    it("includes core TDB actions", () => {
      expect(TDB_ACTIONS).toContain("instance_read_access");
      expect(TDB_ACTIONS).toContain("instance_write_access");
      expect(TDB_ACTIONS).toContain("schema_read_access");
      expect(TDB_ACTIONS).toContain("manage_capabilities");
      expect(TDB_ACTIONS).toContain("create_database");
      expect(TDB_ACTIONS).toContain("delete_database");
    });
  });
});
