/**
 * RTK Query API slice for user management.
 *
 * Dual-mode endpoint routing:
 *   - Basic mode (M3): All operations go directly to TDB REST API (/api/users)
 *   - Proxy mode (M4): Reads go to TDB (via proxy); writes go to mediation layer (/admin/users)
 *
 * The mediation layer ensures dual-system consistency (OpenBao + TDB) for all mutations.
 * Read operations always target TDB directly (or its proxy) since they're read-only.
 *
 * @see projects/2026-05-customer-premise-deployment/specs/tdb-password-change-api.md
 * @see projects/2026-05-customer-premise-deployment/specs/m3-enterprise-admin-architecture.md
 */

import { baseApi } from "../baseApi";
import { config } from "@/config";

// --- Response types (from TDB REST API — used for reads and basic mode writes) ---

/** User object as returned by TDB GET /api/users */
export interface TdbUser {
  /** Username (unique identifier) */
  readonly name: string;
}

/** Success response from TDB user mutation endpoints (basic mode) */
interface TdbUserMutationResponse {
  readonly "@type": "api:UsersResponse";
  readonly "api:status": "api:success";
}

/** Error response from TDB (non-2xx) — shape varies but always has this structure */
interface TdbErrorResponse {
  readonly "@type": "api:ErrorResponse";
  readonly "api:status": "api:failure";
  readonly "api:message": string;
  readonly "api:error": Record<string, unknown>;
}

/** Success response from mediation layer (proxy mode writes) */
interface MediationUserResponse {
  readonly status: "ok";
  readonly result?: {
    readonly username?: string;
    readonly entityId?: string;
  };
}

/** Unified mutation response type that covers both modes */
type UserMutationResponse = TdbUserMutationResponse | MediationUserResponse;

// --- Request types ---

export interface ChangePasswordRequest {
  readonly username: string;
  readonly password: string;
}

export interface CreateUserRequest {
  readonly username: string;
  readonly password: string;
  /** Email address (required for mediation layer in proxy mode) */
  readonly email?: string;
}

// --- API Slice ---

export const tdbUserApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * List all users in the TDB instance.
     * Always reads from TDB (directly or via proxy).
     * TDB API: GET /api/users
     */
    listUsers: builder.query<ReadonlyArray<TdbUser>, void>({
      query: () => ({
        url: "/api/users",
        method: "GET",
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(
                (user) => ({ type: "User" as const, id: user.name })
              ),
              { type: "User", id: "LIST" },
            ]
          : [{ type: "User", id: "LIST" }],
    }),

    /**
     * Get a single user by name.
     * Always reads from TDB (directly or via proxy).
     * TDB API: GET /api/users/:name
     */
    getUser: builder.query<TdbUser, string>({
      query: (username) => ({
        url: `/api/users/${encodeURIComponent(username)}`,
        method: "GET",
      }),
      providesTags: (_result, _error, username) => [
        { type: "User", id: username },
      ],
    }),

    /**
     * Create a new user.
     *
     * Basic mode: POST /api/users (direct TDB)
     * Proxy mode: POST /admin/users (mediation layer — dual-system)
     */
    createUser: builder.mutation<UserMutationResponse, CreateUserRequest>({
      query: ({ username, password, email }) => {
        if (config.authMode === "proxy") {
          // Mediation layer: creates user in both OpenBao + TDB atomically
          return {
            url: "/admin/users",
            method: "POST",
            body: {
              username,
              email: email ?? `${username}@localhost`,
              initialPassword: password,
              teams: [],
              capabilities: [],
            },
          };
        }
        // Basic mode: direct TDB API
        return {
          url: "/api/users",
          method: "POST",
          body: { name: username, password },
        };
      },
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),

    /**
     * Change a user's password.
     *
     * Basic mode: PUT /api/users (direct TDB)
     * Proxy mode: PUT /api/users (TDB via proxy — password is TDB-only)
     *
     * Note: In proxy mode, password changes still go to TDB directly (via proxy)
     * because OpenBao userpass password is managed separately by the auth system.
     */
    changePassword: builder.mutation<TdbUserMutationResponse, ChangePasswordRequest>({
      query: ({ username, password }) => ({
        url: "/api/users",
        method: "PUT",
        body: { name: username, password },
      }),
      invalidatesTags: (_result, _error, { username }) => [
        { type: "User", id: username },
      ],
    }),

    /**
     * Delete a user.
     *
     * Basic mode: DELETE /api/users/:name (direct TDB)
     * Proxy mode: DELETE /admin/users/:name (mediation layer — dual-system)
     */
    deleteUser: builder.mutation<UserMutationResponse, string>({
      query: (username) => {
        if (config.authMode === "proxy") {
          // Mediation layer: deletes user from both OpenBao + TDB
          return {
            url: `/admin/users/${encodeURIComponent(username)}`,
            method: "DELETE",
          };
        }
        // Basic mode: direct TDB API
        return {
          url: `/api/users/${encodeURIComponent(username)}`,
          method: "DELETE",
        };
      },
      invalidatesTags: (_result, _error, username) => [
        { type: "User", id: username },
        { type: "User", id: "LIST" },
      ],
    }),
  }),
  overrideExisting: false,
});

// --- Exported hooks (consumed by frontend-engineer in page components) ---

export const {
  useListUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useChangePasswordMutation,
  useDeleteUserMutation,
} = tdbUserApi;

// --- Type exports for consuming components ---

export type { TdbErrorResponse };
