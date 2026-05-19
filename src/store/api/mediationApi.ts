/**
 * RTK Query API slice for the admin mediation layer.
 *
 * This slice provides a dedicated, proxy-mode-only interface to the dfrnt-api
 * mediation endpoints. It covers operations that are ONLY available through
 * the mediation layer (not dual-mode with TDB fallback):
 *
 * - Ownership transfer (no TDB equivalent)
 * - Health check (mediation-specific)
 * - Dedicated mediation-layer user/team/capability mutations
 *   (identical to those in tdbUserApi/tdbOrgApi but exposed as standalone
 *    hooks for components that know they're in proxy mode)
 *
 * For dual-mode endpoints (where basic mode falls back to direct TDB API),
 * use the existing tdbUserApi, tdbOrgApi, and tdbRoleApi slices instead.
 *
 * @see zebra/backend/dfrnt-api/public/admin-mediation-openapi.yml
 */

import { baseApi } from "../baseApi";

// ─── Request Types (from admin-mediation-openapi.yml) ──────────────────────

export interface MediationCreateUserRequest {
  /** Username (3-255 chars, alphanumeric + hyphen + underscore + dot) */
  readonly username: string;
  /** User email address */
  readonly email: string;
  /** Initial password (min 12 chars, complexity requirements) */
  readonly initialPassword: string;
  /** Team names to add user to (must already exist) */
  readonly teams?: ReadonlyArray<string>;
  /** Capability names to grant */
  readonly capabilities?: ReadonlyArray<string>;
}

export interface MediationCreateTeamRequest {
  /** Unique team name (3-100 chars, alphanumeric + hyphen + underscore) */
  readonly teamName: string;
  /** Username of the team owner (must exist in both systems) */
  readonly ownerUsername: string;
  /** Optional team description */
  readonly description?: string;
}

export interface MediationAddTeamMemberRequest {
  /** Team name */
  readonly teamName: string;
  /** Username to add to the team */
  readonly username: string;
}

export interface MediationRemoveTeamMemberRequest {
  /** Team name */
  readonly teamName: string;
  /** Username to remove from the team */
  readonly username: string;
}

export interface MediationGrantCapabilityRequest {
  /** Username to grant capability to */
  readonly username: string;
  /** TDB role name (e.g., "admin", "writer", "reader", "member") */
  readonly role: string;
  /** TDB resource scope (e.g., "Organization/engineering") */
  readonly scope: string;
}

export interface MediationRevokeCapabilityRequest {
  /** Username to revoke capability from */
  readonly username: string;
  /** TDB role name to revoke */
  readonly role: string;
  /** TDB resource scope to revoke from */
  readonly scope: string;
}

export interface MediationTransferOwnershipRequest {
  /** Team whose ownership to transfer */
  readonly teamName: string;
  /** Username of the new owner (must be existing team member) */
  readonly newOwnerUsername: string;
}

// ─── Response Types (from admin-mediation-openapi.yml) ─────────────────────

export interface MediationSuccessResponse {
  readonly status: "ok";
  readonly result: Record<string, unknown>;
}

export interface MediationCreateUserResponse {
  readonly status: "ok";
  readonly result: {
    readonly username: string;
    readonly email: string;
    readonly openBaoEntityId: string;
    readonly tdbUserId: string;
    readonly teams: ReadonlyArray<string>;
    readonly capabilities: ReadonlyArray<string>;
    readonly totpEnrolled: boolean;
  };
}

export interface MediationCreateTeamResponse {
  readonly status: "ok";
  readonly result: {
    readonly teamName: string;
    readonly openBaoGroupId: string;
    readonly tdbOrganisationId: string;
    readonly owner: string;
    readonly members: ReadonlyArray<string>;
  };
}

export interface MediationErrorResponse {
  readonly status: "error";
  readonly code: MediationErrorCode;
  readonly message: string;
  readonly field?: string;
}

export type MediationErrorCode =
  | "VALIDATION_ERROR"
  | "USER_EXISTS"
  | "USER_NOT_FOUND"
  | "TEAM_EXISTS"
  | "TEAM_NOT_FOUND"
  | "CAPABILITY_EXISTS"
  | "CAPABILITY_NOT_FOUND"
  | "ALREADY_MEMBER"
  | "NOT_A_MEMBER"
  | "CANNOT_REMOVE_OWNER"
  | "LAST_ADMIN"
  | "ALREADY_OWNER"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface DependencyHealth {
  readonly status: "healthy" | "unhealthy";
  readonly latencyMs: number | null;
  readonly error?: string;
}

export interface MediationHealthResponse {
  readonly status: "ok" | "degraded";
  readonly version: string;
  readonly uptime: number;
  readonly dependencies: {
    readonly openbao: DependencyHealth;
    readonly tdb: DependencyHealth;
  };
}

// ─── API Slice ─────────────────────────────────────────────────────────────

export const mediationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Create user via mediation layer (dual-system: OpenBao + TDB).
     * POST /admin/users
     */
    mediationCreateUser: builder.mutation<MediationCreateUserResponse, MediationCreateUserRequest>({
      query: (body) => ({
        url: "/admin/users",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "User", id: "LIST" },
        { type: "Organization", id: "LIST" },
      ],
    }),

    /**
     * Delete user via mediation layer (dual-system: OpenBao + TDB).
     * DELETE /admin/users/:username
     */
    mediationDeleteUser: builder.mutation<MediationSuccessResponse, string>({
      query: (username) => ({
        url: `/admin/users/${encodeURIComponent(username)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, username) => [
        { type: "User", id: username },
        { type: "User", id: "LIST" },
        { type: "Organization", id: "LIST" },
      ],
    }),

    /**
     * Create team via mediation layer (dual-system: OpenBao group + TDB org).
     * POST /admin/teams
     */
    mediationCreateTeam: builder.mutation<MediationCreateTeamResponse, MediationCreateTeamRequest>({
      query: (body) => ({
        url: "/admin/teams",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "Organization", id: "LIST" },
      ],
    }),

    /**
     * Delete team via mediation layer (dual-system: OpenBao group + TDB org).
     * DELETE /admin/teams/:teamName
     */
    mediationDeleteTeam: builder.mutation<MediationSuccessResponse, string>({
      query: (teamName) => ({
        url: `/admin/teams/${encodeURIComponent(teamName)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, teamName) => [
        { type: "Organization", id: teamName },
        { type: "Organization", id: "LIST" },
      ],
    }),

    /**
     * Add user to team via mediation layer (dual-system).
     * POST /admin/teams/:teamName/members
     */
    mediationAddTeamMember: builder.mutation<MediationSuccessResponse, MediationAddTeamMemberRequest>({
      query: ({ teamName, username }) => ({
        url: `/admin/teams/${encodeURIComponent(teamName)}/members`,
        method: "POST",
        body: { username },
      }),
      invalidatesTags: (_result, _error, { teamName }) => [
        { type: "Organization", id: `${teamName}:members` },
        { type: "Organization", id: "LIST" },
      ],
    }),

    /**
     * Remove user from team via mediation layer (dual-system).
     * DELETE /admin/teams/:teamName/members/:username
     */
    mediationRemoveTeamMember: builder.mutation<MediationSuccessResponse, MediationRemoveTeamMemberRequest>({
      query: ({ teamName, username }) => ({
        url: `/admin/teams/${encodeURIComponent(teamName)}/members/${encodeURIComponent(username)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { teamName }) => [
        { type: "Organization", id: `${teamName}:members` },
        { type: "Organization", id: "LIST" },
      ],
    }),

    /**
     * Grant capability via mediation layer.
     * POST /admin/capabilities/grant
     */
    mediationGrantCapability: builder.mutation<MediationSuccessResponse, MediationGrantCapabilityRequest>({
      query: (body) => ({
        url: "/admin/capabilities/grant",
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { scope }) => [
        { type: "Capability", id: scope },
      ],
    }),

    /**
     * Revoke capability via mediation layer.
     * POST /admin/capabilities/revoke
     */
    mediationRevokeCapability: builder.mutation<MediationSuccessResponse, MediationRevokeCapabilityRequest>({
      query: (body) => ({
        url: "/admin/capabilities/revoke",
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { scope }) => [
        { type: "Capability", id: scope },
      ],
    }),

    /**
     * Transfer team ownership.
     * POST /admin/ownership/transfer
     *
     * This endpoint has no TDB equivalent — it only exists in the mediation layer.
     */
    transferOwnership: builder.mutation<MediationSuccessResponse, MediationTransferOwnershipRequest>({
      query: (body) => ({
        url: "/admin/ownership/transfer",
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { teamName }) => [
        { type: "Organization", id: teamName },
        { type: "Organization", id: `${teamName}:members` },
      ],
    }),

    /**
     * Health check for the mediation layer.
     * GET /admin/health
     *
     * No authentication required.
     */
    getMediationHealth: builder.query<MediationHealthResponse, void>({
      query: () => ({
        url: "/admin/health",
        method: "GET",
      }),
    }),
  }),
  overrideExisting: false,
});

// ─── Exported Hooks ────────────────────────────────────────────────────────

export const {
  useMediationCreateUserMutation,
  useMediationDeleteUserMutation,
  useMediationCreateTeamMutation,
  useMediationDeleteTeamMutation,
  useMediationAddTeamMemberMutation,
  useMediationRemoveTeamMemberMutation,
  useMediationGrantCapabilityMutation,
  useMediationRevokeCapabilityMutation,
  useTransferOwnershipMutation,
  useGetMediationHealthQuery,
} = mediationApi;
