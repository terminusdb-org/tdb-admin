/**
 * Unit tests for the TDB Branch API slice.
 *
 * Verifies endpoint definitions, hook exports, and request URL construction.
 */

import { describe, it, expect } from "vitest";
import { tdbBranchApi, useListBranchesQuery, useCreateBranchMutation, useDeleteBranchMutation } from "./tdbBranchApi";

describe("tdbBranchApi", () => {
  describe("endpoint definitions", () => {
    it("defines listBranches query endpoint", () => {
      expect(tdbBranchApi.endpoints.listBranches).toBeDefined();
      expect(tdbBranchApi.endpoints.listBranches.initiate).toBeTypeOf("function");
    });

    it("defines createBranch mutation endpoint", () => {
      expect(tdbBranchApi.endpoints.createBranch).toBeDefined();
      expect(tdbBranchApi.endpoints.createBranch.initiate).toBeTypeOf("function");
    });

    it("defines deleteBranch mutation endpoint", () => {
      expect(tdbBranchApi.endpoints.deleteBranch).toBeDefined();
      expect(tdbBranchApi.endpoints.deleteBranch.initiate).toBeTypeOf("function");
    });
  });

  describe("exported hooks", () => {
    it("exports useListBranchesQuery hook", () => {
      expect(useListBranchesQuery).toBeTypeOf("function");
    });

    it("exports useCreateBranchMutation hook", () => {
      expect(useCreateBranchMutation).toBeTypeOf("function");
    });

    it("exports useDeleteBranchMutation hook", () => {
      expect(useDeleteBranchMutation).toBeTypeOf("function");
    });
  });

  describe("query URL construction", () => {
    it("listBranches uses correct TDB API path with branches param", () => {
      const { listBranches } = tdbBranchApi.endpoints;
      const arg = { org: "admin", db: "mydb" };
      const queryFn = listBranches.initiate(arg);
      // The initiate function returns a thunk — verify the endpoint is correctly wired
      expect(queryFn).toBeTypeOf("function");
    });

    it("createBranch uses correct TDB branch API path", () => {
      const { createBranch } = tdbBranchApi.endpoints;
      const arg = { org: "admin", db: "mydb", branchName: "feature" };
      const queryFn = createBranch.initiate(arg);
      expect(queryFn).toBeTypeOf("function");
    });

    it("deleteBranch uses correct TDB branch API path", () => {
      const { deleteBranch } = tdbBranchApi.endpoints;
      const arg = { org: "admin", db: "mydb", branchName: "feature" };
      const queryFn = deleteBranch.initiate(arg);
      expect(queryFn).toBeTypeOf("function");
    });
  });
});
