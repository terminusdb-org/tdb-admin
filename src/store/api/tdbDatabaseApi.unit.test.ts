/**
 * Unit tests for the TDB Database (Data Product) API slice.
 *
 * Verifies endpoint definitions and hook exports.
 */

import { describe, it, expect } from "vitest";
import { tdbDatabaseApi } from "./tdbDatabaseApi";

describe("tdbDatabaseApi", () => {
  describe("endpoint definitions", () => {
    it("defines listDatabases query endpoint", () => {
      expect(tdbDatabaseApi.endpoints.listDatabases).toBeDefined();
      expect(tdbDatabaseApi.endpoints.listDatabases.initiate).toBeTypeOf("function");
    });

    it("defines getDatabase query endpoint", () => {
      expect(tdbDatabaseApi.endpoints.getDatabase).toBeDefined();
      expect(tdbDatabaseApi.endpoints.getDatabase.initiate).toBeTypeOf("function");
    });

    it("defines createDatabase mutation endpoint", () => {
      expect(tdbDatabaseApi.endpoints.createDatabase).toBeDefined();
      expect(tdbDatabaseApi.endpoints.createDatabase.initiate).toBeTypeOf("function");
    });

    it("defines updateDatabase mutation endpoint", () => {
      expect(tdbDatabaseApi.endpoints.updateDatabase).toBeDefined();
      expect(tdbDatabaseApi.endpoints.updateDatabase.initiate).toBeTypeOf("function");
    });

    it("defines deleteDatabase mutation endpoint", () => {
      expect(tdbDatabaseApi.endpoints.deleteDatabase).toBeDefined();
      expect(tdbDatabaseApi.endpoints.deleteDatabase.initiate).toBeTypeOf("function");
    });
  });

  describe("exported hooks", () => {
    it("exports useListDatabasesQuery hook", async () => {
      const { useListDatabasesQuery } = await import("./tdbDatabaseApi");
      expect(useListDatabasesQuery).toBeTypeOf("function");
    });

    it("exports useGetDatabaseQuery hook", async () => {
      const { useGetDatabaseQuery } = await import("./tdbDatabaseApi");
      expect(useGetDatabaseQuery).toBeTypeOf("function");
    });

    it("exports useCreateDatabaseMutation hook", async () => {
      const { useCreateDatabaseMutation } = await import("./tdbDatabaseApi");
      expect(useCreateDatabaseMutation).toBeTypeOf("function");
    });

    it("exports useUpdateDatabaseMutation hook", async () => {
      const { useUpdateDatabaseMutation } = await import("./tdbDatabaseApi");
      expect(useUpdateDatabaseMutation).toBeTypeOf("function");
    });

    it("exports useDeleteDatabaseMutation hook", async () => {
      const { useDeleteDatabaseMutation } = await import("./tdbDatabaseApi");
      expect(useDeleteDatabaseMutation).toBeTypeOf("function");
    });
  });
});
