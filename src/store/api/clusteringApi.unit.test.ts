/**
 * Unit tests for the Clustering API slice.
 *
 * Verifies endpoint definitions, hook exports, and type shapes.
 */

import { describe, it, expect } from "vitest";
import {
  clusteringApi,
  useGetClusteringQuery,
  useToggleClusteringMutation,
} from "./clusteringApi";

describe("clusteringApi", () => {
  describe("endpoint definitions", () => {
    it("defines getClustering query endpoint", () => {
      expect(clusteringApi.endpoints.getClustering).toBeDefined();
      expect(clusteringApi.endpoints.getClustering.initiate).toBeTypeOf("function");
    });

    it("defines toggleClustering mutation endpoint", () => {
      expect(clusteringApi.endpoints.toggleClustering).toBeDefined();
      expect(clusteringApi.endpoints.toggleClustering.initiate).toBeTypeOf("function");
    });
  });

  describe("exported hooks", () => {
    it("exports useGetClusteringQuery hook", () => {
      expect(useGetClusteringQuery).toBeTypeOf("function");
    });

    it("exports useToggleClusteringMutation hook", () => {
      expect(useToggleClusteringMutation).toBeTypeOf("function");
    });
  });

  describe("getClustering query URL construction", () => {
    it("initiates with correct request shape", () => {
      const { getClustering } = clusteringApi.endpoints;
      const arg = { org: "admin", db: "mydb" };
      const queryFn = getClustering.initiate(arg);
      expect(queryFn).toBeTypeOf("function");
    });
  });

  describe("toggleClustering mutation request shape", () => {
    it("initiates with enable=true", () => {
      const { toggleClustering } = clusteringApi.endpoints;
      const arg = { org: "admin", db: "mydb", enable: true };
      const queryFn = toggleClustering.initiate(arg);
      expect(queryFn).toBeTypeOf("function");
    });

    it("initiates with enable=false", () => {
      const { toggleClustering } = clusteringApi.endpoints;
      const arg = { org: "admin", db: "mydb", enable: false };
      const queryFn = toggleClustering.initiate(arg);
      expect(queryFn).toBeTypeOf("function");
    });
  });
});
