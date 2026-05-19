import React, { useCallback, useMemo, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import {
  useListOrganizationsQuery,
  useListOrganizationsForUserQuery,
  useListOrgMembersQuery,
  useGetOrgMemberQuery,
  useListDatabasesQuery,
  useListUsersQuery,
  useListRolesQuery,
  useGrantCapabilityMutation,
  useRevokeCapabilityMutation,
  useAppSelector,
  selectIsGlobalAdmin,
  selectAuthUsername,
} from "@/store";
import type {
  TdbOrganization,
  TdbOrgMember,
  TdbMemberCapability,
  CapabilityScopeType,
} from "@/store";
import {
  DataTable,
  ConfirmModal,
  GrantAccessDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Badge,
} from "@/components/shared";
import { extractRoleName } from "@/utils/extractRoleName";

// --- Types ---

/** Flattened grant row for display in the table */
interface GrantRow {
  /** Unique row key */
  readonly id: string;
  /** Username */
  readonly user: string;
  /** Role name (display-friendly, cleaned) */
  readonly role: string;
  /** Raw role identifier from TDB (used for revoke API call) */
  readonly rawRole: string;
  /** Scope type: "organization" or "database" */
  readonly scopeType: CapabilityScopeType;
  /** Raw scope @id from TDB (e.g. "Organization/admin" or "UserDatabase/ToXPdPHsyvwxFqbE") */
  readonly scope: string;
  /** Human-readable resource display (e.g. "admin" for team, "admin/mydb" for data product) */
  readonly displayScope: string;
  /** API scope — for TDB capabilities API revoke calls (e.g. "admin" or "admin/mydb") */
  readonly apiScope: string;
}

/**
 * Strip TDB internal type prefix from a scope @id to get the API-compatible scope.
 * "Organization/admin" → "admin"
 * "UserDatabase/admin/mydb" → "admin/mydb"
 * Already-clean scope (no known prefix) → pass through
 */
function stripScopePrefix(scope: string): string {
  if (scope.startsWith("Organization/")) {
    return scope.slice("Organization/".length);
  }
  if (scope.startsWith("UserDatabase/")) {
    return scope.slice("UserDatabase/".length);
  }
  // Fallback: if it has a type-like prefix (CapitalWord/) strip the first segment
  const slashIdx = scope.indexOf("/");
  if (slashIdx > 0 && /^[A-Z]/.test(scope)) {
    return scope.slice(slashIdx + 1);
  }
  return scope;
}

/** Tab state: which section is active */
type ActiveTab = "team" | "database";

/** Modal state for the revoke confirmation */
type ModalState =
  | { readonly kind: "closed" }
  | { readonly kind: "grant"; readonly scopeType: CapabilityScopeType }
  | { readonly kind: "revoke"; readonly grant: GrantRow };

// --- Sub-components ---

/**
 * Aggregator: fetches members + databases for one org and returns GrantRows.
 *
 * Strategy: always attempt to fetch ALL members via /api/organizations/:org/users/.
 * This succeeds when the user has manage_capabilities on the org (org admin or global admin).
 * If it fails (403 — user lacks org-level manage_capabilities), falls back to fetching
 * only the current user's capabilities via /api/organizations/:org/users/:username.
 *
 * This handles three cases:
 *   1. Global admin (username "admin"): listOrgMembers succeeds for all orgs
 *   2. Org admin (has manage_capabilities on specific org): listOrgMembers succeeds for that org
 *   3. Regular member (no manage_capabilities): listOrgMembers returns 403, fallback to self-only
 */
const useOrgGrants = (org: TdbOrganization): {
  grants: ReadonlyArray<GrantRow>;
  isLoading: boolean;
  isError: boolean;
} => {
  const currentUsername = useAppSelector(selectAuthUsername);

  // Primary path: attempt to fetch ALL members for this org.
  // Succeeds for global admin AND org admins (anyone with manage_capabilities on this org).
  const {
    data: allMembers,
    isLoading: isLoadingAllMembers,
    isError: isAllMembersError,
    error: allMembersError,
  } = useListOrgMembersQuery(org.name);

  // Determine if the listOrgMembers failure was a permission denial (403).
  // Only treat 403 as "fall back to self" — other errors (network, 500) are real errors.
  const isForbidden = isAllMembersError &&
    allMembersError !== undefined &&
    "status" in allMembersError &&
    allMembersError.status === 403;

  // Fallback path: fetch only current user's entry when listOrgMembers is forbidden.
  // Skip this query unless we confirmed the full list is inaccessible for this org.
  const {
    data: selfMember,
    isLoading: isLoadingSelf,
    isError: isSelfError,
  } = useGetOrgMemberQuery(
    { org: org.name, username: currentUsername ?? "" },
    { skip: !isForbidden || !currentUsername }
  );

  // Unified members array:
  // - If listOrgMembers succeeded → use full member list (includes all org members)
  // - If listOrgMembers returned 403 → use self-only fallback
  // - If listOrgMembers returned another error → surface as error state
  const members: ReadonlyArray<TdbOrgMember> | undefined = useMemo(() => {
    if (allMembers) return allMembers;
    if (isForbidden && selfMember) return [selfMember];
    return undefined;
  }, [allMembers, isForbidden, selfMember]);

  // Loading: either the primary query is loading, or it failed with 403 and fallback is loading
  const isLoadingMembers = isLoadingAllMembers || (isForbidden && isLoadingSelf);
  // Error: non-403 failure on primary query, or 403 primary + failure on fallback
  const isMembersError = (isAllMembersError && !isForbidden) || (isForbidden && isSelfError);

  const { data: databases, isLoading: isLoadingDbs } = useListDatabasesQuery(org.name);

  const grants = useMemo((): ReadonlyArray<GrantRow> => {
    if (!members || !Array.isArray(members)) return [];

    // Build lookups for resolving database scopes to human-readable paths.
    // TDB scope @ids use internal hashes (e.g. "UserDatabase/01AEVhV4o2weLi0i")
    // so we key by both the hash portion of rawId AND by name for fallback.
    const dbPathByKey = new Map<string, string>();
    if (databases) {
      for (const db of databases) {
        const displayPath = db.path ?? `${org.name}/${db.name}`;
        // Key by database name (for path-based scopes like "org/dbname")
        dbPathByKey.set(db.name, displayPath);
        // Key by internal hash from rawId (for hash-based scopes like "UserDatabase/01AEV...")
        if (db.rawId) {
          const hashPortion = db.rawId.startsWith("UserDatabase/")
            ? db.rawId.slice("UserDatabase/".length)
            : db.rawId;
          dbPathByKey.set(hashPortion, displayPath);
        }
      }
    }

    return members.flatMap((member: TdbOrgMember) => {
      if (!member.capability || !Array.isArray(member.capability)) return [];
      return member.capability.map((cap: TdbMemberCapability) => {
        // cap.role = display-friendly name (e.g. "Admin Role")
        // cap.roleId = @id for API calls (e.g. "Role/admin")
        // cap.scope = display scope (e.g. "Organization/admin")
        // cap.scopeId = scope @id for API calls
        const role = extractRoleName(cap.role);
        const scope = cap.scope;
        // Scope classification: "Organization/" prefix → team grant; all others → database grant.
        const isOrgScope = scope.startsWith("Organization/") || scope.startsWith("Organization:");

        // Resolve human-readable display scope (also used as API scope for database grants)
        let displayScope: string;
        if (isOrgScope) {
          // Team grant: show the org name stripped of prefix
          displayScope = stripScopePrefix(scope);
        } else {
          // Data Product grant: resolve from database list using hash or name lookup.
          // scopeId is full @id like "UserDatabase/01AEVhV4o2weLi0i" — extract the hash portion.
          const strippedScope = stripScopePrefix(cap.scopeId);
          const lookupKey = strippedScope.includes("/") ? strippedScope.split("/").pop() ?? strippedScope : strippedScope;
          const resolvedPath = dbPathByKey.get(lookupKey);
          displayScope = resolvedPath ?? `${org.name}/${lookupKey}`;
        }

        // API scope for revoke calls (with scope_type set, TDB expects):
        // - Organization: bare org name (e.g. "testorg")
        // - Database: path format (e.g. "testorg/mydb")
        const apiScope = isOrgScope ? stripScopePrefix(cap.scopeId) : displayScope;

        return {
          id: `${member.name}:${cap.roleId}:${cap.scopeId}`,
          user: member.name,
          role,
          rawRole: cap.roleId,
          scopeType: isOrgScope ? "organization" as const : "database" as const,
          scope,
          displayScope,
          apiScope,
        };
      });
    });
  }, [members, databases, org.name]);

  return { grants, isLoading: isLoadingMembers || isLoadingDbs, isError: isMembersError };
};

/** Wrapper to aggregate grants across all orgs */
const OrgGrantsAggregator: React.FC<{
  readonly orgs: ReadonlyArray<TdbOrganization>;
  readonly children: (data: {
    allGrants: ReadonlyArray<GrantRow>;
    isLoading: boolean;
    isError: boolean;
  }) => React.ReactElement;
}> = ({ orgs, children }) => {
  // We need to call hooks in a stable order — use individual hook calls
  // Since we can't call hooks in a loop, we render sub-aggregators
  // For simplicity with the constraint of hooks rules, we handle up to a reasonable count
  // by rendering a component per org
  return (
    <OrgGrantsCollector orgs={orgs}>
      {children}
    </OrgGrantsCollector>
  );
};

/**
 * Collects grants from all orgs. Uses a recursive component pattern
 * to satisfy React's rules of hooks (can't call hooks in loops).
 */
const OrgGrantsCollector: React.FC<{
  readonly orgs: ReadonlyArray<TdbOrganization>;
  readonly children: (data: {
    allGrants: ReadonlyArray<GrantRow>;
    isLoading: boolean;
    isError: boolean;
  }) => React.ReactElement;
}> = ({ orgs, children }) => {
  // Render a sub-component for each org that fetches its grants
  // Then collect them up. We'll use a single-org approach.
  if (orgs.length === 0) {
    return children({ allGrants: [], isLoading: false, isError: false });
  }

  return (
    <SingleOrgGrants org={orgs[0]} remainingOrgs={orgs.slice(1)}>
      {children}
    </SingleOrgGrants>
  );
};

const SingleOrgGrants: React.FC<{
  readonly org: TdbOrganization;
  readonly remainingOrgs: ReadonlyArray<TdbOrganization>;
  readonly children: (data: {
    allGrants: ReadonlyArray<GrantRow>;
    isLoading: boolean;
    isError: boolean;
  }) => React.ReactElement;
}> = ({ org, remainingOrgs, children }) => {
  const { grants, isLoading, isError } = useOrgGrants(org);

  if (remainingOrgs.length === 0) {
    return children({ allGrants: grants, isLoading, isError });
  }

  return (
    <SingleOrgGrants org={remainingOrgs[0]} remainingOrgs={remainingOrgs.slice(1)}>
      {(rest) =>
        children({
          allGrants: [...grants, ...rest.allGrants],
          isLoading: isLoading || rest.isLoading,
          isError: isError || rest.isError,
        })
      }
    </SingleOrgGrants>
  );
};

// --- Filter logic (pure functions for testability) ---

/** Extract unique team/org names from grants. */
export function extractUniqueTeams(grants: ReadonlyArray<GrantRow>): ReadonlyArray<string> {
  const teams = new Set<string>();
  for (const grant of grants) {
    // For org-scoped grants, displayScope IS the team name
    // For db-scoped grants, team is the first segment of displayScope (e.g. "org/db" → "org")
    if (grant.scopeType === "organization") {
      teams.add(grant.displayScope);
    } else {
      const slashIdx = grant.displayScope.indexOf("/");
      if (slashIdx > 0) {
        teams.add(grant.displayScope.slice(0, slashIdx));
      }
    }
  }
  return [...teams].sort();
}

/** A role preset derived from existing grants: label is the display name, value is the rawRole ID. */
export interface GrantDerivedRole {
  readonly label: string;
  readonly value: string;
}

/**
 * Extract distinct roles from grants as {label, value} pairs.
 * label = display-friendly name (e.g. "Viewer")
 * value = rawRole @id (e.g. "Role/Viewer") — what gets sent to the API
 * Deduped by rawRole ID to avoid duplicate presets.
 */
export function extractUniqueRolePairs(grants: ReadonlyArray<GrantRow>): ReadonlyArray<GrantDerivedRole> {
  const seen = new Set<string>();
  const pairs: Array<GrantDerivedRole> = [];
  for (const grant of grants) {
    if (grant.rawRole.length > 0 && !seen.has(grant.rawRole)) {
      seen.add(grant.rawRole);
      pairs.push({ label: grant.role, value: grant.rawRole });
    }
  }
  return pairs.sort((a, b) => a.label.localeCompare(b.label));
}

/** Extract unique data product paths from database-scoped grants. */
export function extractUniqueDataProducts(
  grants: ReadonlyArray<GrantRow>,
  teamFilter?: string
): ReadonlyArray<string> {
  const products = new Set<string>();
  for (const grant of grants) {
    if (grant.scopeType !== "database") continue;
    // Optionally filter by team prefix
    if (teamFilter && teamFilter.length > 0) {
      if (!grant.displayScope.startsWith(`${teamFilter}/`)) continue;
    }
    products.add(grant.displayScope);
  }
  return [...products].sort();
}

/** Apply filters to a list of grants. */
export function filterGrants(
  grants: ReadonlyArray<GrantRow>,
  teamFilter: string,
  dataProductFilter: string
): ReadonlyArray<GrantRow> {
  return grants.filter((grant) => {
    // Team filter
    if (teamFilter.length > 0) {
      if (grant.scopeType === "organization") {
        if (grant.displayScope !== teamFilter) return false;
      } else {
        if (!grant.displayScope.startsWith(`${teamFilter}/`)) return false;
      }
    }
    // Data product filter (only applies to database-scoped grants)
    if (dataProductFilter.length > 0 && grant.scopeType === "database") {
      if (grant.displayScope !== dataProductFilter) return false;
    }
    return true;
  });
}

// --- Main page component ---

export const GrantsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("team");
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  // Filter state
  const [teamFilter, setTeamFilter] = useState("");
  const [dataProductFilter, setDataProductFilter] = useState("");

  const isGlobalAdmin = useAppSelector(selectIsGlobalAdmin);
  const adminOrgQuery = useListOrganizationsQuery(undefined, { skip: !isGlobalAdmin });
  const userOrgQuery = useListOrganizationsForUserQuery(undefined, { skip: isGlobalAdmin });
  const { data: orgs, isLoading: isLoadingOrgs, isError: isOrgsError, refetch: refetchOrgs } = isGlobalAdmin ? adminOrgQuery : userOrgQuery;
  const { data: users } = useListUsersQuery(undefined, { skip: !isGlobalAdmin });
  const { data: roles } = useListRolesQuery(undefined, { skip: !isGlobalAdmin });
  const [grantCapability, { isLoading: isGranting }] = useGrantCapabilityMutation();
  const [revokeCapability, { isLoading: isRevoking }] = useRevokeCapabilityMutation();

  const availableUsers = useMemo(
    () => (users ?? []).map((u) => u.name).filter((name) => name !== "anonymous"),
    [users]
  );

  const availableRoles = useMemo(
    () => (roles ?? []).map((r) => r.name),
    [roles]
  );

  // Collect available scopes for the grant dialog
  const availableOrgScopes = useMemo(
    () => (orgs ?? []).map((o) => o.name),
    [orgs]
  );

  const handleGrant = useCallback(
    async (user: string, selectedRoles: ReadonlyArray<string>, scope: string, scopeType: CapabilityScopeType, orgHint?: string) => {
      try {
        if (isGlobalAdmin) {
          // Global admin: scope_type mode — TDB resolves names to IDs
          await grantCapability({ user, roles: selectedRoles, scope, scopeType, useNameBasedLookup: true }).unwrap();
        } else {
          // Non-admin: full document ID mode — scope_type omitted, raw IDs required.
          // For org scope: scope is a bare org name → wrap with "Organization/" prefix.
          // For DB scope: scope is already a full rawId ("UserDatabase/hash") from DatabaseSelector.
          const fullScope = scopeType === "organization"
            ? `Organization/${scope}`
            : scope;
          // user is a bare username entered in the dialog; wrap with User/ prefix.
          const fullUser = user.startsWith("User/") ? user : `User/${user}`;
          await grantCapability({
            user: fullUser,
            roles: selectedRoles,
            scope: fullScope,
            scopeType,
            useNameBasedLookup: false,
            cacheOrgHint: orgHint,
          }).unwrap();
        }
        setModal({ kind: "closed" });
      } catch {
        // Error handled by RTK Query state — GrantAccessDialog shows error
      }
    },
    [grantCapability, isGlobalAdmin]
  );

  const handleRevoke = useCallback(
    async (grant: GrantRow) => {
      try {
        if (isGlobalAdmin) {
          // Global admin: send scope_type + human-readable names.
          // TDB expects the role's display name (e.g. "Admin Role", "Consumer Role")
          // for name-based lookup — NOT the @id slug ("admin", "consumer").
          // grant.role is already the cleaned display name from normalisation.
          await revokeCapability({
            user: grant.user,
            roles: [grant.role],
            scope: grant.apiScope,
            scopeType: grant.scopeType,
            useNameBasedLookup: true,
          }).unwrap();
        } else {
          // Non-admin: omit scope_type, use full document IDs.
          // grant.scope = "Organization/test" (full ID) or "UserDatabase/hash" for DB scope.
          // grant.rawRole = "Role/admin"
          // For DB scope, extract org from displayScope ("org/dbname") for cache invalidation.
          const dbOrgHint = grant.scopeType === "database"
            ? grant.displayScope.split("/")[0]
            : undefined;
          await revokeCapability({
            user: `User/${grant.user}`,
            roles: [grant.rawRole],
            scope: grant.scope,
            scopeType: grant.scopeType,
            useNameBasedLookup: false,
            cacheOrgHint: dbOrgHint,
          }).unwrap();
        }
        setModal({ kind: "closed" });
      } catch {
        // Error handled by RTK Query
      }
    },
    [revokeCapability, isGlobalAdmin]
  );

  if (isLoadingOrgs) {
    return (
      <div>
        <PageHeader />
        <LoadingState rows={4} />
      </div>
    );
  }

  if (isOrgsError) {
    return (
      <div>
        <PageHeader />
        <ErrorState
          title="Failed to load grants"
          message="Cannot retrieve teams. Check your connection to TerminusDB."
          onRetry={refetchOrgs}
        />
      </div>
    );
  }

  const safeOrgs = orgs ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader />
        <button
          type="button"
          onClick={() => setModal({ kind: "grant", scopeType: activeTab === "team" ? "organization" : "database" })}
          className="self-start rounded-md bg-dfrntBlue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 focus:outline-none focus:ring-2 focus:ring-dfrntBlue-500 focus:ring-offset-2 transition-colors sm:self-auto"
        >
          Grant Access
        </button>
      </div>

      {/* Tab bar */}
      <div className="mb-4 border-b border-gray-200" role="tablist" aria-label="Grant type">
        <TabButton
          label="Team Grants"
          active={activeTab === "team"}
          onClick={() => {
            setActiveTab("team");
            setTeamFilter("");
            setDataProductFilter("");
          }}
        />
        <TabButton
          label="Data Product Grants"
          active={activeTab === "database"}
          onClick={() => {
            setActiveTab("database");
            setTeamFilter("");
            setDataProductFilter("");
          }}
        />
      </div>

      {/* Grant tables + grant dialog (inside aggregator to access allGrants for role presets) */}
      <OrgGrantsAggregator orgs={safeOrgs}>
        {({ allGrants, isLoading, isError }) => {
          if (isLoading) {
            return <LoadingState rows={3} />;
          }

          if (isError) {
            return (
              <ErrorState
                title="Failed to load members"
                message="Could not retrieve team member capabilities."
                onRetry={refetchOrgs}
              />
            );
          }

          // Role presets derived from existing grants: {label: "Viewer", value: "Role/Viewer"}
          // Used in GrantAccessDialog to build quick-pick buttons with correct API IDs.
          const rolePairsFromGrants = extractUniqueRolePairs(allGrants);

          // Split grants by scope type
          const tabGrants = allGrants.filter((g) =>
            activeTab === "team" ? g.scopeType === "organization" : g.scopeType === "database"
          );

          const tableSection = (() => {
            if (tabGrants.length === 0) {
              return (
                <EmptyState
                  title={activeTab === "team" ? "No team grants" : "No data product grants"}
                  description={
                    activeTab === "team"
                      ? "No role assignments on teams yet. Click 'Grant Access' to assign roles."
                      : "No role assignments on data products yet. Click 'Grant Access' to assign roles."
                  }
                />
              );
            }

            // Derive filter options from the current tab's grants
            const teamOptions = extractUniqueTeams(tabGrants);
            const dataProductOptions = activeTab === "database"
              ? extractUniqueDataProducts(tabGrants, teamFilter)
              : [];

            // Apply active filters
            const displayGrants = filterGrants(tabGrants, teamFilter, activeTab === "database" ? dataProductFilter : "");

            return (
              <div className="space-y-4">
                <GrantFilterBar
                  activeTab={activeTab}
                  teamOptions={teamOptions}
                  teamFilter={teamFilter}
                  onTeamFilterChange={(value) => {
                    setTeamFilter(value);
                    setDataProductFilter("");
                  }}
                  dataProductOptions={dataProductOptions}
                  dataProductFilter={dataProductFilter}
                  onDataProductFilterChange={setDataProductFilter}
                />
                {displayGrants.length === 0 ? (
                  <EmptyState
                    title="No matching grants"
                    description="No grants match the selected filters. Try adjusting the filters above."
                  />
                ) : (
                  <GrantTable
                    grants={displayGrants}
                    onRevoke={(grant) => setModal({ kind: "revoke", grant })}
                  />
                )}
              </div>
            );
          })();

          return (
            <>
              {tableSection}
              {/* Grant dialog rendered here to access allGrants-derived role presets */}
              {modal.kind === "grant" && (
                <GrantAccessDialogWithScope
                  scopeType={modal.scopeType}
                  availableUsers={availableUsers}
                  availableRoles={availableRoles}
                  rolePairsFromGrants={rolePairsFromGrants}
                  availableScopes={modal.scopeType === "organization" ? availableOrgScopes : []}
                  orgs={safeOrgs}
                  isGlobalAdmin={isGlobalAdmin}
                  isLoading={isGranting}
                  onGrant={handleGrant}
                  onCancel={() => setModal({ kind: "closed" })}
                />
              )}
            </>
          );
        }}
      </OrgGrantsAggregator>

      {/* Revoke confirmation */}
      {modal.kind === "revoke" && (
        <ConfirmModal
          title="Revoke Access"
          description={`Remove role "${modal.grant.role}" from user "${modal.grant.user}" on ${modal.grant.scopeType === "organization" ? "team" : "data product"} "${modal.grant.displayScope}"?`}
          confirmLabel="Revoke"
          destructive
          isLoading={isRevoking}
          onConfirm={() => handleRevoke(modal.grant)}
          onCancel={() => setModal({ kind: "closed" })}
        />
      )}
    </div>
  );
};

// --- Sub-components ---

const PageHeader: React.FC = () => (
  <div>
    <h1 className="text-xl font-semibold text-gray-900">Grants</h1>
    <p className="mt-1 text-sm text-gray-600">
      Permission assignments — users with roles on teams and data products.
    </p>
  </div>
);

interface TabButtonProps {
  readonly label: string;
  readonly active: boolean;
  readonly onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, active, onClick }) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    onClick={onClick}
    className={`inline-block border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
      active
        ? "border-dfrntBlue-600 text-dfrntBlue-600"
        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
    }`}
  >
    {label}
  </button>
);

interface GrantTableProps {
  readonly grants: ReadonlyArray<GrantRow>;
  readonly onRevoke: (grant: GrantRow) => void;
}

const GrantTable: React.FC<GrantTableProps> = ({ grants, onRevoke }) => {
  const columns = [
    {
      key: "user",
      header: "User",
      render: (row: GrantRow) => (
        <span className="font-medium text-gray-900">{row.user}</span>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (row: GrantRow) => (
        <Badge label={row.role} variant="info" />
      ),
    },
    {
      key: "scope",
      header: "Resource",
      render: (row: GrantRow) => (
        <span className="font-data text-xs text-gray-600">{row.displayScope}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right" as const,
      render: (row: GrantRow) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRevoke(row);
          }}
          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
          aria-label={`Revoke ${row.role} from ${row.user} on ${row.displayScope}`}
        >
          Revoke
        </button>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={grants}
      rowKey={(row) => row.id}
      ariaLabel="Permission grants"
    />
  );
};

// --- Filter bar ---

interface GrantFilterBarProps {
  readonly activeTab: ActiveTab;
  readonly teamOptions: ReadonlyArray<string>;
  readonly teamFilter: string;
  readonly onTeamFilterChange: (value: string) => void;
  readonly dataProductOptions: ReadonlyArray<string>;
  readonly dataProductFilter: string;
  readonly onDataProductFilterChange: (value: string) => void;
}

const GrantFilterBar: React.FC<GrantFilterBarProps> = ({
  activeTab,
  teamOptions,
  teamFilter,
  onTeamFilterChange,
  dataProductOptions,
  dataProductFilter,
  onDataProductFilterChange,
}) => {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      {/* Team filter — shown in both tabs */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="filter-team"
          className="text-xs font-medium text-gray-500"
        >
          Team
        </label>
        <select
          id="filter-team"
          value={teamFilter}
          onChange={(e) => onTeamFilterChange(e.target.value)}
          className="rounded-md border-gray-300 py-1.5 pl-2 pr-7 text-sm shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500"
          aria-label="Filter by team"
        >
          <option value="">All teams</option>
          {teamOptions.map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </select>
      </div>

      {/* Data Product filter — only shown in database tab */}
      {activeTab === "database" && (
        <div className="flex items-center gap-2">
          <label
            htmlFor="filter-data-product"
            className="text-xs font-medium text-gray-500"
          >
            Data Product
          </label>
          <select
            id="filter-data-product"
            value={dataProductFilter}
            onChange={(e) => onDataProductFilterChange(e.target.value)}
            className="rounded-md border-gray-300 py-1.5 pl-2 pr-7 text-sm shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500"
            aria-label="Filter by data product"
          >
            <option value="">All data products</option>
            {dataProductOptions.map((dp) => (
              <option key={dp} value={dp}>
                {dp}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

// --- Grant dialog with scope selection ---

/**
 * Two-step grant wizard: step 1 picks the scope (team or db),
 * step 2 picks user + role via GrantAccessDialog.
 *
 * The scope is passed directly to onGrant from local state — avoiding
 * stale closure issues with parent-level effectiveScope.
 */
type GrantWizardStep =
  | { readonly step: "pick-scope" }
  | { readonly step: "pick-user-role"; readonly scope: string; readonly displayScope?: string; readonly orgHint?: string };

interface GrantAccessDialogWithScopeProps {
  readonly scopeType: CapabilityScopeType;
  readonly availableUsers: ReadonlyArray<string>;
  /** Role names from /api/roles — only populated for global admin */
  readonly availableRoles: ReadonlyArray<string>;
  /** Role label+ID pairs derived from existing grants — available to all users */
  readonly rolePairsFromGrants: ReadonlyArray<GrantDerivedRole>;
  readonly availableScopes: ReadonlyArray<string>;
  readonly orgs: ReadonlyArray<TdbOrganization>;
  readonly isGlobalAdmin: boolean;
  readonly isLoading: boolean;
  readonly onGrant: (user: string, roles: ReadonlyArray<string>, scope: string, scopeType: CapabilityScopeType, orgHint?: string) => void;
  readonly onCancel: () => void;
}

const GrantAccessDialogWithScope: React.FC<GrantAccessDialogWithScopeProps> = ({
  scopeType,
  availableUsers,
  availableRoles,
  rolePairsFromGrants,
  availableScopes,
  orgs,
  isGlobalAdmin,
  isLoading,
  onGrant,
  onCancel,
}) => {
  const [wizardStep, setWizardStep] = useState<GrantWizardStep>({ step: "pick-scope" });

  const isDatabaseScope = scopeType === "database";

  // When user+role are selected, fire the grant with the scope captured in wizard state
  const handleFinalGrant = useCallback(
    (user: string, roles: ReadonlyArray<string>) => {
      if (wizardStep.step !== "pick-user-role") return;
      onGrant(user, roles, wizardStep.scope, scopeType, wizardStep.orgHint);
    },
    [wizardStep, scopeType, onGrant]
  );

  // Step 2: user has picked a scope — show GrantAccessDialog
  if (wizardStep.step === "pick-user-role") {
    return (
      <GrantAccessDialog
        scopeType={scopeType}
        scope={wizardStep.displayScope ?? wizardStep.scope}
        availableRoles={[...availableRoles]}
        rolePairsFromGrants={rolePairsFromGrants}
        availableUsers={[...availableUsers]}
        isLoading={isLoading}
        onGrant={handleFinalGrant}
        onCancel={onCancel}
      />
    );
  }

  // Step 1: pick scope
  if (isDatabaseScope) {
    return (
      <DatabaseScopePicker
        orgs={orgs}
        useRawId={!isGlobalAdmin}
        onSelectScope={(scope, orgHint) => setWizardStep({ step: "pick-user-role", scope, orgHint })}
        onCancel={onCancel}
      />
    );
  }

  return (
    <TeamScopePicker
      scopes={availableScopes}
      onSelectScope={(scope) => setWizardStep({ step: "pick-user-role", scope })}
      onCancel={onCancel}
    />
  );
};

// --- Team scope picker ---

interface TeamScopePickerProps {
  readonly scopes: ReadonlyArray<string>;
  readonly onSelectScope: (scope: string) => void;
  readonly onCancel: () => void;
}

const TeamScopePicker: React.FC<TeamScopePickerProps> = ({
  scopes,
  onSelectScope,
  onCancel,
}) => {
  const [localScope, setLocalScope] = useState("");

  return (
    <Dialog open={true} onClose={onCancel} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-lg font-semibold text-gray-900">Select Team</DialogTitle>
          <p className="mt-1 text-sm text-gray-600">
            Choose the team to grant access on.
          </p>
          <div className="mt-4">
            <select
              value={localScope}
              onChange={(e) => setLocalScope(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 sm:text-sm"
              aria-label="Select team scope"
            >
              <option value="">Select a team…</option>
              {scopes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (localScope.length > 0) {
                  onSelectScope(localScope);
                }
              }}
              disabled={localScope.length === 0}
              className="rounded-md bg-dfrntBlue-600 px-3 py-2 text-sm font-medium text-white hover:bg-dfrntBlue-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

// --- Database scope picker ---

interface DatabaseScopePickerProps {
  readonly orgs: ReadonlyArray<TdbOrganization>;
  /**
   * When true, DatabaseSelector emits the rawId ("UserDatabase/hash") as the scope value.
   * Non-admins must use rawId because they cannot send scope_type.
   * Global admins use the "org/dbName" path format with scope_type.
   */
  readonly useRawId: boolean;
  readonly onSelectScope: (scope: string, orgHint?: string, displayScope?: string) => void;
  readonly onCancel: () => void;
}

const DatabaseScopePicker: React.FC<DatabaseScopePickerProps> = ({
  orgs,
  useRawId,
  onSelectScope,
  onCancel,
}) => {
  const [localOrg, setLocalOrg] = useState("");
  // When useRawId=true, localDb holds the rawId; otherwise holds the db name
  const [localDb, setLocalDb] = useState("");

  return (
    <Dialog open={true} onClose={onCancel} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-lg font-semibold text-gray-900">Select Data Product</DialogTitle>
          <p className="mt-1 text-sm text-gray-600">
            Choose the team and data product to grant access on.
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="grant-db-org" className="block text-sm font-medium text-gray-700">
                Team
              </label>
              <select
                id="grant-db-org"
                value={localOrg}
                onChange={(e) => {
                  setLocalOrg(e.target.value);
                  setLocalDb("");
                }}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 sm:text-sm"
              >
                <option value="">Select a team…</option>
                {orgs.map((o) => (
                  <option key={o.name} value={o.name}>{o.name}</option>
                ))}
              </select>
            </div>
            {localOrg.length > 0 && (
              <DatabaseSelector
                org={localOrg}
                selectedValue={localDb}
                useRawId={useRawId}
                onSelectDb={setLocalDb}
              />
            )}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (localOrg.length > 0 && localDb.length > 0) {
                  // For non-admin (useRawId): scope = full rawId, orgHint = localOrg for cache invalidation
                  // For admin: scope = "org/dbName" path format
                  const scope = useRawId ? localDb : `${localOrg}/${localDb}`;
                  // displayScope is always the friendly "org/dbName" path for the UI
                  // When useRawId=true, localDb is a rawId ("UserDatabase/hash") — not a friendly name.
                  // displayScope is passed to the grant dialog as a label. Without a name lookup,
                  // pass undefined so the dialog falls back to showing the scope directly.
                  const displayScope: string | undefined = undefined;
                  onSelectScope(scope, useRawId ? localOrg : undefined, displayScope);
                }
              }}
              disabled={localOrg.length === 0 || localDb.length === 0}
              className="rounded-md bg-dfrntBlue-600 px-3 py-2 text-sm font-medium text-white hover:bg-dfrntBlue-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

/** Database dropdown — fetches databases for the selected org */
const DatabaseSelector: React.FC<{
  readonly org: string;
  /** Current selection: rawId when useRawId=true, db name otherwise */
  readonly selectedValue: string;
  /** When true, option values are rawId ("UserDatabase/hash"); otherwise db name */
  readonly useRawId: boolean;
  readonly onSelectDb: (value: string) => void;
}> = ({ org, selectedValue, useRawId, onSelectDb }) => {
  const { data: databases, isLoading } = useListDatabasesQuery(org);

  return (
    <div>
      <label htmlFor="grant-db-name" className="block text-sm font-medium text-gray-700">
        Data Product
      </label>
      <select
        id="grant-db-name"
        value={selectedValue}
        onChange={(e) => onSelectDb(e.target.value)}
        disabled={isLoading}
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
      >
        <option value="">
          {isLoading ? "Loading…" : "Select a data product…"}
        </option>
        {(databases ?? []).map((db) => {
          // Non-admins must use rawId (e.g. "UserDatabase/01AEV...") in capability calls.
          // If rawId is unavailable, fall back to db name (admin path, or TDB version without rawId).
          const optionValue = useRawId ? (db.rawId ?? db.name) : db.name;
          return (
            <option key={db.name} value={optionValue}>{db.name}</option>
          );
        })}
      </select>
    </div>
  );
};
