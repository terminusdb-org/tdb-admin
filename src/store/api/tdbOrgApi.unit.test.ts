/**
 * Unit tests for the TDB Organisation (Team) API slice.
 *
 * Verifies endpoint definitions, hook exports, and correct typing.
 */

import { describe, it, expect } from "vitest";
import { tdbOrgApi } from "./tdbOrgApi";

describe("tdbOrgApi", () => {
  describe("endpoint definitions", () => {
    it("defines listOrganizations query endpoint", () => {
      expect(tdbOrgApi.endpoints.listOrganizations).toBeDefined();
      expect(tdbOrgApi.endpoints.listOrganizations.initiate).toBeTypeOf("function");
    });

    it("defines getOrganization query endpoint", () => {
      expect(tdbOrgApi.endpoints.getOrganization).toBeDefined();
      expect(tdbOrgApi.endpoints.getOrganization.initiate).toBeTypeOf("function");
    });

    it("defines createOrganization mutation endpoint", () => {
      expect(tdbOrgApi.endpoints.createOrganization).toBeDefined();
      expect(tdbOrgApi.endpoints.createOrganization.initiate).toBeTypeOf("function");
    });

    it("defines deleteOrganization mutation endpoint", () => {
      expect(tdbOrgApi.endpoints.deleteOrganization).toBeDefined();
      expect(tdbOrgApi.endpoints.deleteOrganization.initiate).toBeTypeOf("function");
    });

    it("defines listOrgMembers query endpoint", () => {
      expect(tdbOrgApi.endpoints.listOrgMembers).toBeDefined();
      expect(tdbOrgApi.endpoints.listOrgMembers.initiate).toBeTypeOf("function");
    });

    it("defines getOrgMemberDatabases query endpoint", () => {
      expect(tdbOrgApi.endpoints.getOrgMemberDatabases).toBeDefined();
      expect(tdbOrgApi.endpoints.getOrgMemberDatabases.initiate).toBeTypeOf("function");
    });
  });

  describe("exported hooks", () => {
    it("exports useListOrganizationsQuery hook", async () => {
      const { useListOrganizationsQuery } = await import("./tdbOrgApi");
      expect(useListOrganizationsQuery).toBeTypeOf("function");
    });

    it("exports useGetOrganizationQuery hook", async () => {
      const { useGetOrganizationQuery } = await import("./tdbOrgApi");
      expect(useGetOrganizationQuery).toBeTypeOf("function");
    });

    it("exports useCreateOrganizationMutation hook", async () => {
      const { useCreateOrganizationMutation } = await import("./tdbOrgApi");
      expect(useCreateOrganizationMutation).toBeTypeOf("function");
    });

    it("exports useDeleteOrganizationMutation hook", async () => {
      const { useDeleteOrganizationMutation } = await import("./tdbOrgApi");
      expect(useDeleteOrganizationMutation).toBeTypeOf("function");
    });

    it("exports useListOrgMembersQuery hook", async () => {
      const { useListOrgMembersQuery } = await import("./tdbOrgApi");
      expect(useListOrgMembersQuery).toBeTypeOf("function");
    });

    it("exports useGetOrgMemberDatabasesQuery hook", async () => {
      const { useGetOrgMemberDatabasesQuery } = await import("./tdbOrgApi");
      expect(useGetOrgMemberDatabasesQuery).toBeTypeOf("function");
    });
  });
});
