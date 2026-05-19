/**
 * RTK Query API slice for TerminusDB branch management.
 *
 * Wraps TDB's REST API for branch CRUD operations:
 * - List branches of a data product
 * - Create branch (from any existing branch)
 * - Delete branch (any except main — UI enforces this, not API)
 *
 * TDB branch API paths:
 * - List: GET /api/db?branches=true (global — returns all dbs with branches)
 * - Create: POST /api/branch/:org/:db/local/branch/:branch
 * - Delete: DELETE /api/branch/:org/:db/local/branch/:branch
 *
 * NOTE: The per-database endpoint (GET /api/db/:org/:db?branches=true) has a
 * bug in TDB for non-admin orgs. We use the global /api/db?branches=true
 * endpoint and filter client-side by org/db path instead.
 *
 * All endpoints require authentication via the baseApi's prepareHeaders
 * (Basic Auth in M3 mode, Bearer JWT via oauth2-proxy in M4+ mode).
 *
 * @see twinfoxdb/terminusdb-docs-static/src/app/docs/branch-howto/page.md
 */

import { baseApi } from "../baseApi";

// --- Response types (from TDB REST API) ---

/** Branch info as returned by TDB list branches API */
export interface TdbBranch {
  /** Branch name (e.g., "main", "feature") */
  readonly name: string;
}

/**
 * Raw entry from TDB GET /api/db?branches=true response.
 * Each entry represents one database with its branch list.
 * Response is an array of these objects.
 */
interface TdbDatabaseWithBranchesRaw {
  readonly path?: string;
  readonly branches?: ReadonlyArray<string>;
}

/** Success response from TDB branch mutation endpoints */
interface TdbBranchMutationResponse {
  readonly "@type": "api:BranchResponse";
  readonly "api:status": "api:success";
}

// --- Request types ---

export interface ListBranchesRequest {
  /** Organisation (team) that owns the database */
  readonly org: string;
  /** Database (data product) name */
  readonly db: string;
}

export interface CreateBranchRequest {
  /** Organisation (team) that owns the database */
  readonly org: string;
  /** Database (data product) name */
  readonly db: string;
  /** New branch name to create */
  readonly branchName: string;
  /** Source branch to branch from (defaults to "main") */
  readonly originBranch?: string;
}

export interface DeleteBranchRequest {
  /** Organisation (team) that owns the database */
  readonly org: string;
  /** Database (data product) name */
  readonly db: string;
  /** Branch name to delete */
  readonly branchName: string;
}

// --- API Slice ---

export const tdbBranchApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * List all branches of a data product.
     * TDB API: GET /api/db?branches=true (global listing, filtered client-side)
     *
     * Uses the global database listing with branches=true because the per-database
     * endpoint (GET /api/db/:org/:db?branches=true) has a known bug for non-admin
     * organisations. The global endpoint returns all databases the user can access
     * with their branch lists; we filter to the target org/db client-side.
     *
     * Returns an array of TdbBranch objects (name only).
     * The "main" branch always exists and is included.
     */
    listBranches: builder.query<ReadonlyArray<TdbBranch>, ListBranchesRequest>({
      query: () => ({
        url: "/api/db",
        method: "GET",
        params: { branches: "true" },
      }),
      transformResponse: (
        raw: ReadonlyArray<TdbDatabaseWithBranchesRaw>,
        _meta,
        { org, db }: ListBranchesRequest
      ): ReadonlyArray<TdbBranch> => {
        const targetPath = `${org}/${db}`;
        const entry = raw.find((item) => item.path === targetPath);
        const branches = entry?.branches ?? ["main"];
        return branches.map((name) => ({ name }));
      },
      providesTags: (result, _error, { org, db }) =>
        result
          ? [
              ...result.map(
                (branch) => ({ type: "Branch" as const, id: `${org}/${db}/${branch.name}` })
              ),
              { type: "Branch", id: `${org}/${db}:LIST` },
            ]
          : [{ type: "Branch", id: `${org}/${db}:LIST` }],
    }),

    /**
     * Create a new branch from an existing branch.
     * TDB API: POST /api/branch/:org/:db/local/branch/:branchName
     * Body: { origin: ":org/:db/local/branch/:originBranch" }
     *
     * The origin specifies which branch to fork from.
     * Defaults to "main" if not specified.
     */
    createBranch: builder.mutation<TdbBranchMutationResponse, CreateBranchRequest>({
      query: ({ org, db, branchName, originBranch = "main" }) => ({
        url: `/api/branch/${encodeURIComponent(org)}/${encodeURIComponent(db)}/local/branch/${encodeURIComponent(branchName)}`,
        method: "POST",
        body: {
          origin: `${org}/${db}/local/branch/${originBranch}`,
        },
      }),
      invalidatesTags: (_result, _error, { org, db }) => [
        { type: "Branch", id: `${org}/${db}:LIST` },
      ],
    }),

    /**
     * Delete a branch.
     * TDB API: DELETE /api/branch/:org/:db/local/branch/:branchName
     *
     * WARNING: This removes the branch name. Commits remain in history
     * but are no longer reachable via this branch name.
     *
     * The UI should prevent deletion of "main" — this is enforced at the
     * component level, not here (TDB itself will reject it with a 400).
     */
    deleteBranch: builder.mutation<TdbBranchMutationResponse, DeleteBranchRequest>({
      query: ({ org, db, branchName }) => ({
        url: `/api/branch/${encodeURIComponent(org)}/${encodeURIComponent(db)}/local/branch/${encodeURIComponent(branchName)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { org, db, branchName }) => [
        { type: "Branch", id: `${org}/${db}/${branchName}` },
        { type: "Branch", id: `${org}/${db}:LIST` },
      ],
    }),
  }),
  overrideExisting: false,
});

// --- Exported hooks ---

export const {
  useListBranchesQuery,
  useCreateBranchMutation,
  useDeleteBranchMutation,
} = tdbBranchApi;
