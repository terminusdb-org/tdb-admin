/**
 * RTK Query API slice for organisation (team) management.
 *
 * Dual-mode endpoint routing:
 *   - Basic mode (M3): All operations go directly to TDB REST API (/api/organizations)
 *   - Proxy mode (M4): Reads go to TDB (via proxy); writes go to mediation layer (/admin/teams)
 *
 * The mediation layer ensures dual-system consistency (OpenBao group + TDB organisation)
 * for all mutations. Read operations always target TDB directly (or its proxy).
 *
 * Terminology mapping:
 *   - TDB calls them "organisations"
 *   - OpenBao calls them "groups"
 *   - The UI calls them "teams"
 *   - The mediation layer uses "teams" in its API paths
 *
 * @see projects/2026-05-customer-premise-deployment/specs/m3-enterprise-admin-architecture.md
 */

import { baseApi } from "../baseApi";
import { config } from "@/config";

// --- Response types (from TDB REST API) ---

/** Organisation (team) as returned by TDB GET /api/organizations */
export interface TdbOrganization {
  /** Organisation name (unique identifier) */
  readonly name: string;
}

/** Organisation member as returned by TDB GET /api/organizations/:org/users/ */
export interface TdbOrgMember {
  /** Username */
  readonly name: string;
  /** Capabilities the user has on this organisation (if exposed) */
  readonly capability?: ReadonlyArray<TdbMemberCapability>;
}

/**
 * Capability attached to a member (nested in org member detail).
 *
 * TDB returns role/scope as either:
 * - A plain string: "Admin Role"
 * - A JSON-LD object: { "@id": "Role/admin", "@type": "Role", name: "Admin Role", action: [...] }
 *
 * We normalise to carry both:
 * - `role` / `scope`: display-friendly name (for UI badges)
 * - `roleId` / `scopeId`: the @id or raw identifier (for API calls like revoke)
 */
export interface TdbMemberCapability {
  /** Display-friendly role name (e.g. "Admin Role", "Viewer") */
  readonly role: string;
  /** Role @id for API calls (e.g. "Role/admin", "Role/Viewer") — used in revoke */
  readonly roleId: string;
  /** Display-friendly scope (e.g. "Organization/admin") */
  readonly scope: string;
  /** Scope @id for API calls — same as scope in most cases */
  readonly scopeId: string;
}

/** A single JSON-LD object with optional name and @id */
type JsonLdObject = { readonly name?: string; readonly "@id"?: string; readonly [key: string]: unknown };

/**
 * Raw capability shape from TDB — role/scope can be string, object, OR array.
 * When TDB returns multiple roles on one capability, role may be an array.
 * This is normalised to TdbMemberCapability (strings only) in transformResponse.
 */
interface TdbMemberCapabilityRaw {
  readonly role: unknown;
  readonly scope: unknown;
}

/** Raw member shape from TDB before normalisation */
interface TdbOrgMemberRaw {
  readonly name?: string;
  readonly capability?: ReadonlyArray<TdbMemberCapabilityRaw>;
}

/** Pair of display name + @id for a JSON-LD value */
interface DisplayIdPair {
  readonly display: string;
  readonly id: string;
}

/**
 * Extract display name and @id from a single JSON-LD value.
 * - String: both display and id are the same string
 * - Object: display = name ?? @id, id = @id ?? name ?? stringify
 */
function extractDisplayAndId(value: unknown): DisplayIdPair {
  if (typeof value === "string") return { display: value, id: value };
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const obj = value as JsonLdObject;
    const name = typeof obj.name === "string" ? obj.name : undefined;
    const atId = typeof obj["@id"] === "string" ? obj["@id"] : undefined;
    const display = name ?? atId ?? JSON.stringify(value);
    const id = atId ?? name ?? JSON.stringify(value);
    return { display, id };
  }
  return { display: String(value), id: String(value) };
}

/**
 * Extract display+id pairs from a JSON-LD value that may be string, object, or array.
 * Returns an array — one pair per item if the value is an array.
 */
function extractAllDisplayAndId(value: unknown): ReadonlyArray<DisplayIdPair> {
  if (typeof value === "string") return [{ display: value, id: value }];
  if (Array.isArray(value)) {
    return value.map((item: unknown) => extractDisplayAndId(item));
  }
  return [extractDisplayAndId(value)];
}

/**
 * Normalise a raw TDB member response into clean typed members.
 *
 * Handles the case where TDB bundles multiple roles into a single capability entry
 * (role field is an array). These are flattened into separate TdbMemberCapability entries
 * so the UI can display each role as a distinct badge.
 *
 * Each capability carries both display-friendly names (for badges) and raw @id values
 * (for API calls like revoke, which require the Role/@id format).
 */
function normaliseOrgMembers(raw: ReadonlyArray<TdbOrgMemberRaw>): ReadonlyArray<TdbOrgMember> {
  return raw.map((member) => ({
    name: member.name ?? "unknown",
    capability: member.capability?.flatMap((cap) => {
      const roles = extractAllDisplayAndId(cap.role);
      const scopes = extractAllDisplayAndId(cap.scope);
      // Flatten: create one capability entry per role
      // Normally there's one scope per capability, but handle arrays defensively
      const scopePair = scopes[0] ?? { display: "unknown", id: "unknown" };
      return roles.map((rolePair) => ({
        role: rolePair.display,
        roleId: rolePair.id,
        scope: scopePair.display,
        scopeId: scopePair.id,
      }));
    }),
  }));
}

/** Database reference within an organisation */
export interface TdbOrgDatabase {
  readonly name: string;
  readonly label?: string;
}

/** Success response from TDB organisation mutation endpoints (basic mode) */
interface TdbOrgMutationResponse {
  readonly "@type": "api:OrganizationResponse";
  readonly "api:status": "api:success";
}

/** Success response from mediation layer (proxy mode writes) */
interface MediationTeamResponse {
  readonly status: "ok";
  readonly result?: {
    readonly teamName?: string;
    readonly groupId?: string;
    readonly tdbOrganisationId?: string;
  };
}

/** Unified mutation response covering both modes */
type OrgMutationResponse = TdbOrgMutationResponse | MediationTeamResponse;

// --- Request types ---

export interface CreateOrganizationRequest {
  /** Organisation name — must match ^[a-zA-Z0-9._-]{1,128}$ */
  readonly name: string;
  /** Owner username (required for mediation layer in proxy mode) */
  readonly ownerUsername?: string;
  /** Description (optional, used by mediation layer) */
  readonly description?: string;
}

export interface GetOrgMemberDatabasesRequest {
  readonly org: string;
  readonly user: string;
}

export interface AddOrgMemberRequest {
  readonly org: string;
  readonly username: string;
}

export interface RemoveOrgMemberRequest {
  readonly org: string;
  readonly username: string;
}

// --- API Slice ---

export const tdbOrgApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * List all organisations (teams) in the TDB instance.
     * Always reads from TDB (directly or via proxy).
     * TDB API: GET /api/organizations
     *
     * TDB may return org names with JSON-LD type prefixes (e.g. "Organization/admin").
     * transformResponse strips these to show clean short names.
     */
    listOrganizations: builder.query<ReadonlyArray<TdbOrganization>, void>({
      query: () => ({
        url: "/api/organizations",
        method: "GET",
      }),
      transformResponse: (raw: ReadonlyArray<TdbOrganization>) =>
        raw.map((org) => ({
          ...org,
          name: org.name.startsWith("Organization/")
            ? org.name.slice("Organization/".length)
            : org.name,
        })),
      providesTags: (result) =>
        result
          ? [
              ...result.map(
                (org) => ({ type: "Organization" as const, id: org.name })
              ),
              { type: "Organization", id: "LIST" },
            ]
          : [{ type: "Organization", id: "LIST" }],
    }),

    /**
     * Get a single organisation by name.
     * Always reads from TDB (directly or via proxy).
     * TDB API: GET /api/organizations/:name
     */
    getOrganization: builder.query<TdbOrganization, string>({
      query: (name) => ({
        url: `/api/organizations/${encodeURIComponent(name)}`,
        method: "GET",
      }),
      providesTags: (_result, _error, name) => [
        { type: "Organization", id: name },
      ],
    }),

    /**
     * Create a new organisation (team).
     *
     * Basic mode: POST /api/organizations/:name (direct TDB)
     * Proxy mode: POST /admin/teams (mediation layer — dual-system)
     */
    createOrganization: builder.mutation<OrgMutationResponse, CreateOrganizationRequest>({
      query: ({ name, ownerUsername, description }) => {
        if (config.authMode === "proxy") {
          // Mediation layer: creates group in OpenBao + org in TDB atomically
          return {
            url: "/admin/teams",
            method: "POST",
            body: {
              teamName: name,
              ownerUsername: ownerUsername ?? "admin",
              description: description ?? "",
            },
          };
        }
        // Basic mode: direct TDB API (name in path, empty body)
        return {
          url: `/api/organizations/${encodeURIComponent(name)}`,
          method: "POST",
          body: {},
        };
      },
      invalidatesTags: [{ type: "Organization", id: "LIST" }],
    }),

    /**
     * Delete an organisation.
     *
     * Basic mode: DELETE /api/organizations/:name (direct TDB)
     * Proxy mode: DELETE /admin/teams/:teamName (mediation layer — dual-system)
     */
    deleteOrganization: builder.mutation<OrgMutationResponse, string>({
      query: (name) => {
        if (config.authMode === "proxy") {
          // Mediation layer: deletes group from OpenBao + org from TDB
          return {
            url: `/admin/teams/${encodeURIComponent(name)}`,
            method: "DELETE",
          };
        }
        // Basic mode: direct TDB API
        return {
          url: `/api/organizations/${encodeURIComponent(name)}`,
          method: "DELETE",
        };
      },
      invalidatesTags: (_result, _error, name) => [
        { type: "Organization", id: name },
        { type: "Organization", id: "LIST" },
      ],
    }),

    /**
     * List members of an organisation.
     * Always reads from TDB (directly or via proxy).
     * TDB API: GET /api/organizations/:org/users/
     *
     * transformResponse normalises capability role/scope fields which may
     * come as JSON-LD objects ({@id, @type, name, action}) into plain strings.
     */
    listOrgMembers: builder.query<ReadonlyArray<TdbOrgMember>, string>({
      query: (org) => ({
        url: `/api/organizations/${encodeURIComponent(org)}/users/`,
        method: "GET",
      }),
      transformResponse: (raw: ReadonlyArray<TdbOrgMemberRaw>) =>
        normaliseOrgMembers(raw),
      providesTags: (_result, _error, org) => [
        { type: "Organization", id: `${org}:members` },
      ],
    }),

    /**
     * Add a member to an organisation.
     *
     * Proxy mode: POST /admin/teams/:teamName/members (mediation layer)
     * Basic mode: Not directly supported by TDB REST API — uses capabilities instead.
     */
    addOrgMember: builder.mutation<OrgMutationResponse, AddOrgMemberRequest>({
      query: ({ org, username }) => {
        if (config.authMode === "proxy") {
          return {
            url: `/admin/teams/${encodeURIComponent(org)}/members`,
            method: "POST",
            body: { username },
          };
        }
        // Basic mode: TDB doesn't have a direct "add member" API —
        // membership is managed via capabilities. This is a best-effort
        // equivalent using the capabilities endpoint.
        return {
          url: "/api/capabilities",
          method: "POST",
          body: {
            operation: "grant",
            scope_type: "organization",
            scope: org,
            user: username,
            roles: ["instance_read_access"],
          },
        };
      },
      invalidatesTags: (_result, _error, { org }) => [
        { type: "Organization", id: `${org}:members` },
      ],
    }),

    /**
     * Remove a member from an organisation.
     *
     * Proxy mode: DELETE /admin/teams/:teamName/members/:username (mediation layer)
     * Basic mode: Revokes all capabilities on the organisation.
     */
    removeOrgMember: builder.mutation<OrgMutationResponse, RemoveOrgMemberRequest>({
      query: ({ org, username }) => {
        if (config.authMode === "proxy") {
          return {
            url: `/admin/teams/${encodeURIComponent(org)}/members/${encodeURIComponent(username)}`,
            method: "DELETE",
          };
        }
        // Basic mode: revoke all roles on the org scope
        return {
          url: "/api/capabilities",
          method: "POST",
          body: {
            operation: "revoke",
            scope_type: "organization",
            scope: org,
            user: username,
            roles: [],
          },
        };
      },
      invalidatesTags: (_result, _error, { org }) => [
        { type: "Organization", id: `${org}:members` },
      ],
    }),

    /**
     * Get a single member's capabilities within an organisation.
     * Always reads from TDB (directly or via proxy).
     * TDB API: GET /api/organizations/:org/users/:username
     *
     * This endpoint returns 200 for the current user regardless of whether
     * their grants are org-level or database-level. Unlike listOrgMembers which
     * only returns users with org-level capabilities, this returns the specific
     * user's full capability set including database-scoped grants.
     *
     * Used by non-admin users on the Grants page to see their own permissions.
     */
    getOrgMember: builder.query<TdbOrgMember, { org: string; username: string }>({
      query: ({ org, username }) => ({
        url: `/api/organizations/${encodeURIComponent(org)}/users/${encodeURIComponent(username)}`,
        method: "GET",
      }),
      transformResponse: (raw: TdbOrgMemberRaw) =>
        normaliseOrgMembers([raw])[0],
      providesTags: (_result, _error, { org }) => [
        { type: "Organization", id: `${org}:members` },
      ],
    }),

    /**
     * Get databases accessible to a specific member within an organisation.
     * Always reads from TDB (directly or via proxy).
     * TDB API: GET /api/organizations/:org/users/:user/databases
     */
    getOrgMemberDatabases: builder.query<ReadonlyArray<TdbOrgDatabase>, GetOrgMemberDatabasesRequest>({
      query: ({ org, user }) => ({
        url: `/api/organizations/${encodeURIComponent(org)}/users/${encodeURIComponent(user)}/databases`,
        method: "GET",
      }),
      providesTags: (_result, _error, { org, user }) => [
        { type: "Database", id: `${org}:${user}:dbs` },
      ],
    }),

    /**
     * List organisations visible to the current (non-admin) user.
     *
     * Non-admin users cannot call /api/organizations (requires manage_capabilities).
     * Instead, /api/db returns all databases the user has access to as {path: "org/db"}
     * objects. We extract unique org name prefixes to produce the org list.
     *
     * TDB API: GET /api/db  (returns [{path: "org/db"}, ...])
     */
    listOrganizationsForUser: builder.query<ReadonlyArray<TdbOrganization>, void>({
      query: () => ({
        url: "/api/db",
        method: "GET",
      }),
      transformResponse: (raw: ReadonlyArray<{ path: string }>) => {
        const seen = new Set<string>();
        const orgs: Array<TdbOrganization> = [];
        for (const db of raw) {
          const slash = db.path.indexOf("/");
          if (slash > 0) {
            const orgName = db.path.slice(0, slash);
            if (!seen.has(orgName)) {
              seen.add(orgName);
              orgs.push({ name: orgName });
            }
          }
        }
        return orgs;
      },
      providesTags: [{ type: "Organization", id: "LIST" }],
    }),
  }),
  overrideExisting: false,
});

// --- Exported hooks ---

export const {
  useListOrganizationsQuery,
  useListOrganizationsForUserQuery,
  useGetOrganizationQuery,
  useCreateOrganizationMutation,
  useDeleteOrganizationMutation,
  useListOrgMembersQuery,
  useGetOrgMemberQuery,
  useAddOrgMemberMutation,
  useRemoveOrgMemberMutation,
  useGetOrgMemberDatabasesQuery,
} = tdbOrgApi;
