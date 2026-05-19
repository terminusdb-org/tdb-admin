/**
 * RTK Query API slice for the admin mediation sync-status endpoint.
 *
 * Wraps dfrnt-api's GET /admin/sync-status which returns a comparison of
 * TDB organisations vs OpenBao groups, highlighting discrepancies.
 *
 * @see projects/2026-05-customer-premise-deployment/issues/pending/task-86-team-sync-dashboard.md
 */

import { baseApi } from "../baseApi";

// --- Response types (from admin-mediation-openapi.yml) ---

/** A single team's sync status comparing TDB org and OpenBao group state. */
export interface TeamSyncEntry {
  /** Team/organisation name */
  readonly name: string;
  /** Whether a matching TDB organisation exists */
  readonly tdbOrgExists: boolean;
  /** Whether a matching OpenBao group exists */
  readonly openBaoGroupExists: boolean;
  /** Number of members in the team */
  readonly memberCount: number;
  /** List of discrepancy descriptions for this team */
  readonly discrepancies: ReadonlyArray<string>;
}

/** Summary counts for the entire sync status. */
export interface SyncSummary {
  /** Number of teams fully synced (no discrepancies) */
  readonly synced: number;
  /** Number of teams with at least one discrepancy */
  readonly discrepancies: number;
}

/** Full response from GET /admin/sync-status */
export interface SyncStatusResponse {
  readonly teams: ReadonlyArray<TeamSyncEntry>;
  readonly summary: SyncSummary;
}

// --- Mutation request types ---

export interface CreateMissingGroupRequest {
  /** Team name for which to create the OpenBao group */
  readonly teamName: string;
}

export interface CreateMissingOrgRequest {
  /** Team name for which to create the TDB organisation */
  readonly teamName: string;
}

// --- API Slice ---

export const syncApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Fetch the current sync status between TDB organisations and OpenBao groups.
     * dfrnt-api: GET /admin/sync-status
     */
    getSyncStatus: builder.query<SyncStatusResponse, void>({
      query: () => ({
        url: "/admin/sync-status",
        method: "GET",
      }),
      providesTags: ["Organization"],
    }),

    /**
     * Create a missing OpenBao group for a team that exists in TDB but not OpenBao.
     * dfrnt-api: POST /admin/sync/create-group
     */
    createMissingGroup: builder.mutation<void, CreateMissingGroupRequest>({
      query: ({ teamName }) => ({
        url: "/admin/sync/create-group",
        method: "POST",
        body: { teamName },
      }),
      invalidatesTags: ["Organization"],
    }),

    /**
     * Create a missing TDB organisation for a team that exists in OpenBao but not TDB.
     * dfrnt-api: POST /admin/sync/create-org
     */
    createMissingOrg: builder.mutation<void, CreateMissingOrgRequest>({
      query: ({ teamName }) => ({
        url: "/admin/sync/create-org",
        method: "POST",
        body: { teamName },
      }),
      invalidatesTags: ["Organization"],
    }),
  }),
  overrideExisting: false,
});

// --- Exported hooks ---

export const {
  useGetSyncStatusQuery,
  useCreateMissingGroupMutation,
  useCreateMissingOrgMutation,
} = syncApi;
