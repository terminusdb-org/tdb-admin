/**
 * RTK Query API slice for role and capability management.
 *
 * Dual-mode endpoint routing:
 *   - Basic mode (M3): All operations go directly to TDB REST API
 *   - Proxy mode (M4): Reads → TDB (via proxy); capability mutations → mediation layer
 *
 * TDB's permission model:
 *   User → Capability (Role + Scope) → Actions
 *   Scope is either an Organization or a Database
 *
 * In proxy mode, capability grant/revoke operations use the mediation layer
 * (/admin/capabilities/grant, /admin/capabilities/revoke) which ensures
 * consistency between OpenBao policies and TDB capabilities.
 *
 * Role CRUD operations always go to TDB (roles are TDB-only constructs).
 *
 * @see projects/2026-05-customer-premise-deployment/specs/m3-enterprise-admin-architecture.md
 */

import { baseApi } from "../baseApi";
import { config } from "@/config";

// --- Response types (from TDB REST API) ---

/** Role as returned by TDB GET /api/roles */
export interface TdbRole {
  /** Role name (unique identifier) */
  readonly name: string;
  /** Actions (permissions) this role grants */
  readonly action: ReadonlyArray<string>;
}

/** Success response from TDB role mutation endpoints */
interface TdbRoleMutationResponse {
  readonly "@type": "api:RolesResponse";
  readonly "api:status": "api:success";
}

/** Success response from TDB capability mutation endpoints (basic mode) */
interface TdbCapabilityMutationResponse {
  readonly "@type": "api:CapabilityResponse";
  readonly "api:status": "api:success";
}

/** Success response from mediation layer (proxy mode) */
interface MediationCapabilityResponse {
  readonly status: "ok";
  readonly result?: Record<string, unknown>;
}

/** Unified capability mutation response */
type CapabilityMutationResponse = TdbCapabilityMutationResponse | MediationCapabilityResponse;

// --- Request types ---

export interface CreateRoleRequest {
  /** Role name — descriptive, unique */
  readonly name: string;
  /** Actions (permissions) to include in this role */
  readonly actions: ReadonlyArray<string>;
}

export interface UpdateRoleRequest {
  /** Existing role name */
  readonly name: string;
  /** Updated actions list (replaces existing) */
  readonly actions: ReadonlyArray<string>;
}

/** Scope type for capability grant/revoke operations */
export type CapabilityScopeType = "organization" | "database";

export interface GrantCapabilityRequest {
  /** Whether the scope is an organisation or a specific database */
  readonly scopeType: CapabilityScopeType;
  /** Scope identifier — org name or "orgName/dbName" when useNameBasedLookup is true,
   *  or full ID ("Organization/foo", "UserDatabase/hash") when false */
  readonly scope: string;
  /** Username when useNameBasedLookup is true, or full ID ("User/alice") when false */
  readonly user: string;
  /** Role names when useNameBasedLookup is true, or role IDs ("Role/admin") when false */
  readonly roles: ReadonlyArray<string>;
  /**
   * When true, send scope_type and use human-readable names for scope/user/roles.
   * Requires global admin (manage_capabilities on SystemDatabase).
   * When false (default), omit scope_type and use full document IDs.
   */
  readonly useNameBasedLookup?: boolean;
  /**
   * Org name hint for cache invalidation — required when scope is a rawId (UserDatabase/hash)
   * and the org cannot be derived from the scope string alone.
   * Not sent to the API.
   */
  readonly cacheOrgHint?: string;
}

export interface RevokeCapabilityRequest {
  /** Whether the scope is an organisation or a specific database */
  readonly scopeType: CapabilityScopeType;
  /** Scope identifier — org name or "orgName/dbName" when useNameBasedLookup is true,
   *  or full ID ("Organization/foo", "UserDatabase/hash") when false */
  readonly scope: string;
  /** Username when useNameBasedLookup is true, or full ID ("User/alice") when false */
  readonly user: string;
  /** Role names when useNameBasedLookup is true, or role IDs ("Role/admin") when false */
  readonly roles: ReadonlyArray<string>;
  /**
   * When true, send scope_type and use human-readable names for scope/user/roles.
   * Requires global admin (manage_capabilities on SystemDatabase).
   * When false (default), omit scope_type and use full document IDs.
   */
  readonly useNameBasedLookup?: boolean;
  /**
   * Org name hint for cache invalidation — required when scope is a rawId (UserDatabase/hash)
   * and the org cannot be derived from the scope string alone.
   * Not sent to the API.
   */
  readonly cacheOrgHint?: string;
}

// --- Known TDB Actions (for reference in UI) ---

/**
 * All available actions in TDB's permission model.
 *
 * Sourced from TerminusDB system schema (Action enum type).
 * These are the @schema:Action/* values used in role definitions.
 *
 * Grouped by concern for UI display purposes:
 * - Data access: instance_read/write, schema_read/write
 * - Version control: branch, commit_read/write, fetch, push
 * - Metadata: meta_read/write
 * - Administration: manage_capabilities, create_database, delete_database
 *
 * @see twinfoxdb/terminusdb/src/core/api/api_access_control.pl
 */
export const TDB_ACTIONS = [
  // Data access
  "instance_read_access",
  "instance_write_access",
  "schema_read_access",
  "schema_write_access",
  "class_frame",
  // Version control
  "branch",
  "rebase",
  "clone",
  "commit_read_access",
  "commit_write_access",
  "fetch",
  "push",
  // Metadata
  "meta_read_access",
  "meta_write_access",
  // Administration
  "manage_capabilities",
  "create_database",
  "delete_database",
] as const;

export type TdbAction = typeof TDB_ACTIONS[number];

// --- Helpers ---

/**
 * Resolve the organisation name from a capability scope for cache invalidation.
 *
 * Handles all scope formats produced by grant/revoke calls:
 * - Bare org name: "testorg" → "testorg"
 * - Name-based path: "testorg/mydb" → "testorg"
 * - Full TDB ID (org): "Organization/testorg" → "testorg"
 * - Full TDB ID (db hash): "UserDatabase/01AEV..." → use cacheOrgHint
 */
function resolveOrgFromScope(
  scopeType: CapabilityScopeType,
  scope: string,
  cacheOrgHint: string | undefined
): string | undefined {
  if (scopeType === "organization") {
    if (scope.startsWith("Organization/")) return scope.slice("Organization/".length);
    // Bare org name (no slash), or "Organization/foo" already stripped above
    if (!scope.includes("/")) return scope;
    // Unexpected format — fall through to hint
  } else {
    // Database scope
    if (scope.startsWith("UserDatabase/")) {
      // Hash-based ID — org name cannot be derived; rely on hint
      return cacheOrgHint;
    }
    // Path format "org/db" — extract org from first segment
    const slashIdx = scope.indexOf("/");
    if (slashIdx > 0) return scope.slice(0, slashIdx);
  }
  return cacheOrgHint;
}

// --- API Slice ---

export const tdbRoleApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * List all roles in the TDB instance.
     * Always reads from TDB (directly or via proxy).
     * TDB API: GET /api/roles
     */
    listRoles: builder.query<ReadonlyArray<TdbRole>, void>({
      query: () => ({
        url: "/api/roles",
        method: "GET",
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(
                (role) => ({ type: "Role" as const, id: role.name })
              ),
              { type: "Role", id: "LIST" },
            ]
          : [{ type: "Role", id: "LIST" }],
    }),

    /**
     * Get a single role by name.
     * Always reads from TDB (directly or via proxy).
     * TDB API: GET /api/roles/:name
     */
    getRole: builder.query<TdbRole, string>({
      query: (name) => ({
        url: `/api/roles/${encodeURIComponent(name)}`,
        method: "GET",
      }),
      providesTags: (_result, _error, name) => [
        { type: "Role", id: name },
      ],
    }),

    /**
     * Create a new role.
     * Roles are TDB-only constructs — always goes to TDB (directly or via proxy).
     * TDB API: POST /api/roles
     */
    createRole: builder.mutation<TdbRoleMutationResponse, CreateRoleRequest>({
      query: ({ name, actions }) => ({
        url: "/api/roles",
        method: "POST",
        body: { name, action: actions },
      }),
      invalidatesTags: [{ type: "Role", id: "LIST" }],
    }),

    /**
     * Update an existing role's actions.
     * Roles are TDB-only constructs — always goes to TDB (directly or via proxy).
     * TDB API: PUT /api/roles
     */
    updateRole: builder.mutation<TdbRoleMutationResponse, UpdateRoleRequest>({
      query: ({ name, actions }) => ({
        url: "/api/roles",
        method: "PUT",
        body: { name, action: actions },
      }),
      invalidatesTags: (_result, _error, { name }) => [
        { type: "Role", id: name },
        { type: "Role", id: "LIST" },
      ],
    }),

    /**
     * Delete a role.
     * Roles are TDB-only constructs — always goes to TDB (directly or via proxy).
     * TDB API: DELETE /api/roles/:name
     */
    deleteRole: builder.mutation<TdbRoleMutationResponse, string>({
      query: (name) => ({
        url: `/api/roles/${encodeURIComponent(name)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, name) => [
        { type: "Role", id: name },
        { type: "Role", id: "LIST" },
      ],
    }),

    /**
     * Grant a capability (assign role(s) to a user on a scope).
     *
     * Basic mode: POST /api/capabilities (direct TDB)
     * Proxy mode: POST /admin/capabilities/grant (mediation layer)
     */
    grantCapability: builder.mutation<CapabilityMutationResponse, GrantCapabilityRequest>({
      query: ({ scopeType, scope, user, roles, useNameBasedLookup = false }) => {
        if (config.authMode === "proxy") {
          // Mediation layer: syncs capability in both OpenBao policy + TDB
          // Note: mediation accepts single role per request
          return {
            url: "/admin/capabilities/grant",
            method: "POST",
            body: {
              username: user,
              role: roles[0] ?? "",
              scope,
            },
          };
        }
        // Basic mode: direct TDB API.
        // scope_type enables name-based lookups but requires global admin (manage_capabilities
        // on SystemDatabase). Non-admin users must omit scope_type and use full document IDs.
        const body: Record<string, unknown> = { operation: "grant", scope, user, roles };
        if (useNameBasedLookup) {
          body["scope_type"] = scopeType;
        }
        return { url: "/api/capabilities", method: "POST", body };
      },
      invalidatesTags: (_result, _error, { scopeType, scope, cacheOrgHint }) => {
        const tags: Array<{ type: "Capability" | "Organization"; id: string }> = [
          { type: "Capability", id: scope },
        ];
        // Resolve org name for members cache invalidation.
        // scope may be bare "orgName", full "Organization/orgName", or "UserDatabase/hash".
        // cacheOrgHint is provided when scope is a hash and org is known separately.
        const orgName = resolveOrgFromScope(scopeType, scope, cacheOrgHint);
        if (orgName) {
          tags.push({ type: "Organization", id: `${orgName}:members` });
        }
        return tags;
      },
    }),

    /**
     * Revoke a capability (remove role(s) from a user on a scope).
     *
     * Basic mode: POST /api/capabilities (direct TDB)
     * Proxy mode: POST /admin/capabilities/revoke (mediation layer)
     */
    revokeCapability: builder.mutation<CapabilityMutationResponse, RevokeCapabilityRequest>({
      query: ({ scopeType, scope, user, roles, useNameBasedLookup = false }) => {
        if (config.authMode === "proxy") {
          // Mediation layer: syncs capability removal in both OpenBao policy + TDB
          return {
            url: "/admin/capabilities/revoke",
            method: "POST",
            body: {
              username: user,
              role: roles[0] ?? "",
              scope,
            },
          };
        }
        // Basic mode: direct TDB API.
        // scope_type requires global admin; omit it when using full document IDs.
        const body: Record<string, unknown> = { operation: "revoke", scope, user, roles };
        if (useNameBasedLookup) {
          body["scope_type"] = scopeType;
        }
        return { url: "/api/capabilities", method: "POST", body };
      },
      invalidatesTags: (_result, _error, { scopeType, scope, cacheOrgHint }) => {
        const tags: Array<{ type: "Capability" | "Organization"; id: string }> = [
          { type: "Capability", id: scope },
        ];
        const orgName = resolveOrgFromScope(scopeType, scope, cacheOrgHint);
        if (orgName) {
          tags.push({ type: "Organization", id: `${orgName}:members` });
        }
        return tags;
      },
    }),
  }),
  overrideExisting: false,
});

// --- Exported hooks ---

export const {
  useListRolesQuery,
  useGetRoleQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useGrantCapabilityMutation,
  useRevokeCapabilityMutation,
} = tdbRoleApi;
