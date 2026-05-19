import { describe, expect, it } from "vitest";
import {
  extractUniqueTeams,
  extractUniqueDataProducts,
  filterGrants,
} from "./GrantsPage";

/** Helper to build a minimal GrantRow for testing filter logic. */
function makeGrant(overrides: {
  user?: string;
  scopeType: "organization" | "database";
  displayScope: string;
}): {
  id: string;
  user: string;
  role: string;
  rawRole: string;
  scopeType: "organization" | "database";
  scope: string;
  displayScope: string;
  apiScope: string;
} {
  const id = `${overrides.user ?? "testuser"}:Role/viewer:${overrides.displayScope}`;
  return {
    id,
    user: overrides.user ?? "testuser",
    role: "Viewer",
    rawRole: "Role/viewer",
    scopeType: overrides.scopeType,
    scope: overrides.displayScope,
    displayScope: overrides.displayScope,
    apiScope: overrides.displayScope,
  };
}

describe("extractUniqueTeams", () => {
  it("extracts team names from organization-scoped grants", () => {
    const grants = [
      makeGrant({ scopeType: "organization", displayScope: "admin" }),
      makeGrant({ scopeType: "organization", displayScope: "dev-team" }),
      makeGrant({ scopeType: "organization", displayScope: "admin" }),
    ];
    const result = extractUniqueTeams(grants);
    expect(result).toEqual(["admin", "dev-team"]);
  });

  it("extracts team names from database-scoped grants using path prefix", () => {
    const grants = [
      makeGrant({ scopeType: "database", displayScope: "admin/mydb" }),
      makeGrant({ scopeType: "database", displayScope: "dev-team/otherdb" }),
      makeGrant({ scopeType: "database", displayScope: "admin/seconddb" }),
    ];
    const result = extractUniqueTeams(grants);
    expect(result).toEqual(["admin", "dev-team"]);
  });

  it("combines team names from mixed scope types", () => {
    const grants = [
      makeGrant({ scopeType: "organization", displayScope: "admin" }),
      makeGrant({ scopeType: "database", displayScope: "dev-team/mydb" }),
    ];
    const result = extractUniqueTeams(grants);
    expect(result).toEqual(["admin", "dev-team"]);
  });

  it("returns empty array for empty input", () => {
    expect(extractUniqueTeams([])).toEqual([]);
  });

  it("returns sorted results", () => {
    const grants = [
      makeGrant({ scopeType: "organization", displayScope: "zebra" }),
      makeGrant({ scopeType: "organization", displayScope: "alpha" }),
      makeGrant({ scopeType: "organization", displayScope: "middle" }),
    ];
    const result = extractUniqueTeams(grants);
    expect(result).toEqual(["alpha", "middle", "zebra"]);
  });
});

describe("extractUniqueDataProducts", () => {
  it("extracts data product paths from database-scoped grants", () => {
    const grants = [
      makeGrant({ scopeType: "database", displayScope: "admin/mydb" }),
      makeGrant({ scopeType: "database", displayScope: "admin/otherdb" }),
      makeGrant({ scopeType: "organization", displayScope: "admin" }),
    ];
    const result = extractUniqueDataProducts(grants);
    expect(result).toEqual(["admin/mydb", "admin/otherdb"]);
  });

  it("filters by team when teamFilter is provided", () => {
    const grants = [
      makeGrant({ scopeType: "database", displayScope: "admin/mydb" }),
      makeGrant({ scopeType: "database", displayScope: "dev/otherdb" }),
      makeGrant({ scopeType: "database", displayScope: "admin/seconddb" }),
    ];
    const result = extractUniqueDataProducts(grants, "admin");
    expect(result).toEqual(["admin/mydb", "admin/seconddb"]);
  });

  it("returns all data products when teamFilter is empty string", () => {
    const grants = [
      makeGrant({ scopeType: "database", displayScope: "admin/mydb" }),
      makeGrant({ scopeType: "database", displayScope: "dev/otherdb" }),
    ];
    const result = extractUniqueDataProducts(grants, "");
    expect(result).toEqual(["admin/mydb", "dev/otherdb"]);
  });

  it("deduplicates data products", () => {
    const grants = [
      makeGrant({ user: "alice", scopeType: "database", displayScope: "admin/mydb" }),
      makeGrant({ user: "bob", scopeType: "database", displayScope: "admin/mydb" }),
    ];
    const result = extractUniqueDataProducts(grants);
    expect(result).toEqual(["admin/mydb"]);
  });

  it("returns empty for no database-scoped grants", () => {
    const grants = [
      makeGrant({ scopeType: "organization", displayScope: "admin" }),
    ];
    expect(extractUniqueDataProducts(grants)).toEqual([]);
  });

  it("returns sorted results", () => {
    const grants = [
      makeGrant({ scopeType: "database", displayScope: "z-team/zdb" }),
      makeGrant({ scopeType: "database", displayScope: "a-team/adb" }),
    ];
    const result = extractUniqueDataProducts(grants);
    expect(result).toEqual(["a-team/adb", "z-team/zdb"]);
  });
});

describe("filterGrants", () => {
  const grants = [
    makeGrant({ user: "alice", scopeType: "organization", displayScope: "admin" }),
    makeGrant({ user: "bob", scopeType: "organization", displayScope: "dev-team" }),
    makeGrant({ user: "carol", scopeType: "database", displayScope: "admin/mydb" }),
    makeGrant({ user: "dave", scopeType: "database", displayScope: "dev-team/otherdb" }),
    makeGrant({ user: "eve", scopeType: "database", displayScope: "admin/seconddb" }),
  ];

  it("returns all grants when no filters are set", () => {
    const result = filterGrants(grants, "", "");
    expect(result).toHaveLength(5);
  });

  it("filters organization grants by team", () => {
    const result = filterGrants(grants, "admin", "");
    // admin org grant + admin/mydb + admin/seconddb
    expect(result).toHaveLength(3);
    expect(result.map((g) => g.user).sort()).toEqual(["alice", "carol", "eve"]);
  });

  it("filters database grants by team prefix", () => {
    const result = filterGrants(grants, "dev-team", "");
    // dev-team org grant + dev-team/otherdb
    expect(result).toHaveLength(2);
    expect(result.map((g) => g.user).sort()).toEqual(["bob", "dave"]);
  });

  it("filters database grants by exact data product path (org grants pass through)", () => {
    const result = filterGrants(grants, "", "admin/mydb");
    // Org grants pass through (alice, bob) + matching db grant (carol) = 3
    // dave (dev-team/otherdb) and eve (admin/seconddb) don't match
    expect(result).toHaveLength(3);
    expect(result.map((g) => g.user).sort()).toEqual(["alice", "bob", "carol"]);
  });

  it("combines team and data product filters (AND logic)", () => {
    const result = filterGrants(grants, "admin", "admin/mydb");
    // team filter: admin org + admin/* db grants
    // data product filter: only admin/mydb
    expect(result).toHaveLength(2);
    // alice (org grant for admin) + carol (db grant for admin/mydb)
    expect(result.map((g) => g.user).sort()).toEqual(["alice", "carol"]);
  });

  it("returns empty when no grants match", () => {
    const result = filterGrants(grants, "nonexistent", "");
    expect(result).toHaveLength(0);
  });

  it("handles empty input array", () => {
    const result = filterGrants([], "admin", "admin/mydb");
    expect(result).toHaveLength(0);
  });
});
