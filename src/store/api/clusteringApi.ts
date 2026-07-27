/**
 * RTK Query API slice for TerminusDB clustering toggle operations.
 *
 * Implements the transactional workflow to add/remove the `store_clustering`
 * flag in the schema's @metadata terminusdb/options:
 *
 *   1. Create a temporary branch (tx-<random>)
 *   2. Read the schema context document (the @context with @metadata)
 *   3. Update @metadata.terminusdb:options.store_clustering
 *   4. Replace the schema context document on the temp branch
 *   5. Rebase (merge) the temp branch onto main
 *   6. Delete the temp branch
 *
 * Also provides a query to read the current store_clustering flag from
 * the schema context on main.
 *
 * TDB REST API endpoints used:
 *   POST   /api/branch/:org/:db/local/branch/:branch  — create branch
 *   DELETE /api/branch/:org/:db/local/branch/:branch  — delete branch
 *   GET    /api/document/:org/:db/local/branch/:branch?graph_type=schema&id=terminusdb:///schema#context
 *   PUT    /api/document/:org/:db/local/branch/:branch?graph_type=schema
 *   POST   /api/rebase/:org/:db/local/branch/main     — rebase (merge) onto main
 */

import { baseApi } from "../baseApi";
import { config } from "@/config";

// --- Types ---

/** Request to toggle clustering on/off for a data product. */
export interface ToggleClusteringRequest {
  readonly org: string;
  readonly db: string;
  /** true to enable store_clustering, false to disable/remove it. */
  readonly enable: boolean;
}

/** Response from the toggle clustering mutation. */
export interface ToggleClusteringResponse {
  readonly success: boolean;
  readonly storeClustering: boolean;
  readonly branchName: string;
  readonly message: string;
}

/** Request to read the clustering flag. */
export interface GetClusteringRequest {
  readonly org: string;
  readonly db: string;
}

/** Response from the get clustering query. */
export interface GetClusteringResponse {
  readonly storeClustering: boolean;
  readonly hasOptions: boolean;
}

// --- Helpers ---

/** Generate a random branch name like "tx-a1b2c3". */
function randomBranchName(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `tx-${suffix}`;
}

/**
 * The schema context document ID in TerminusDB.
 * This is the document that holds @metadata with terminusdb:options.
 */
const SCHEMA_CONTEXT_ID = "terminusdb:///schema#context";

// --- API Slice ---

export const clusteringApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Read the current store_clustering flag from the schema context
     * on the main branch.
     *
     * GET /api/document/:org/:db/local/branch/main?graph_type=schema&id=<context_id>
     */
    getClustering: builder.query<GetClusteringResponse, GetClusteringRequest>({
      query: ({ org, db }) => ({
        url: `/api/document/${encodeURIComponent(org)}/${encodeURIComponent(db)}/local/branch/main`,
        method: "GET",
        params: {
          graph_type: "schema",
          id: SCHEMA_CONTEXT_ID,
        },
      }),
      transformResponse: (raw: unknown): GetClusteringResponse => {
        const doc = raw as Record<string, unknown>;
        const metadata = doc["@metadata"] as Record<string, unknown> | undefined;
        const options = metadata?.["terminusdb:options"] as Record<string, unknown> | undefined;
        const storeClustering = options?.store_clustering;
        return {
          storeClustering: storeClustering === true,
          hasOptions: options !== undefined,
        };
      },
      providesTags: (_result, _error, { org, db }) => [
        { type: "Clustering" as const, id: `${org}/${db}` },
      ],
    }),

    /**
     * Toggle the store_clustering flag in the schema's @metadata.
     *
     * This is a multi-step transactional operation:
     *   1. Create a temp branch (tx-<random>)
     *   2. Read the schema context document from the temp branch
     *   3. Update @metadata.terminusdb:options.store_clustering
     *   4. PUT the updated context back to the temp branch
     *   5. Rebase the temp branch onto main
     *   6. Delete the temp branch
     *
     * Uses queryFn to chain multiple API calls in a single mutation.
     */
    toggleClustering: builder.mutation<ToggleClusteringResponse, ToggleClusteringRequest>({
      queryFn: async ({ org, db, enable }, api) => {
        const branchName = randomBranchName();
        const basePath = `${encodeURIComponent(org)}/${encodeURIComponent(db)}`;
        const branchPath = `${basePath}/local/branch/${encodeURIComponent(branchName)}`;
        const mainPath = `${basePath}/local/branch/main`;

        // Get auth headers from the baseQuery's prepareHeaders
        const state = api.getState() as { auth: { credentials: string | null } };
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (state.auth?.credentials) {
          headers["Authorization"] = `Basic ${state.auth.credentials}`;
        }

        const baseUrl = config.apiUrl;
        const makeUrl = (path: string) =>
          baseUrl ? `${baseUrl}${path}` : path;

        try {
          // Step 1: Create a temporary branch from main
          const createRes = await fetch(
            makeUrl(`/api/branch/${branchPath}`),
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                origin: `${org}/${db}/local/branch/main`,
              }),
            }
          );
          if (!createRes.ok) {
            const text = await createRes.text();
            return {
              error: {
                status: createRes.status,
                data: `Failed to create branch: ${text}`,
              },
            };
          }

          // Step 2: Read the schema context document from the temp branch
          const getRes = await fetch(
            makeUrl(
              `/api/document/${branchPath}?graph_type=schema&id=${encodeURIComponent(SCHEMA_CONTEXT_ID)}`
            ),
            { headers }
          );
          if (!getRes.ok) {
            const text = await getRes.text();
            // Clean up: delete the temp branch
            await fetch(makeUrl(`/api/branch/${branchPath}`), {
              method: "DELETE",
              headers,
            });
            return {
              error: {
                status: getRes.status,
                data: `Failed to read schema context: ${text}`,
              },
            };
          }

          const schemaDoc = (await getRes.json()) as Record<string, unknown>;

          // Step 3: Update @metadata.terminusdb:options.store_clustering
          const metadata = (schemaDoc["@metadata"] as Record<string, unknown>) ?? {};
          const options = (metadata["terminusdb:options"] as Record<string, unknown>) ?? {};

          if (enable) {
            options.store_clustering = true;
          } else {
            delete options.store_clustering;
          }

          metadata["terminusdb:options"] = options;
          schemaDoc["@metadata"] = metadata;

          // Step 4: PUT the updated context back to the temp branch
          const putRes = await fetch(
            makeUrl(`/api/document/${branchPath}?graph_type=schema&full_replace=false`),
            {
              method: "PUT",
              headers,
              body: JSON.stringify(schemaDoc),
            }
          );
          if (!putRes.ok) {
            const text = await putRes.text();
            // Clean up: delete the temp branch
            await fetch(makeUrl(`/api/branch/${branchPath}`), {
              method: "DELETE",
              headers,
            });
            return {
              error: {
                status: putRes.status,
                data: `Failed to update schema context: ${text}`,
              },
            };
          }

          // Step 5: Rebase (merge) the temp branch onto main
          const rebaseRes = await fetch(
            makeUrl(`/api/rebase/${mainPath}`),
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                author: "tdb-admin",
                rebase_from: `${org}/${db}/local/branch/${branchName}`,
              }),
            }
          );
          if (!rebaseRes.ok) {
            const text = await rebaseRes.text();
            // Clean up: delete the temp branch
            await fetch(makeUrl(`/api/branch/${branchPath}`), {
              method: "DELETE",
              headers,
            });
            return {
              error: {
                status: rebaseRes.status,
                data: `Failed to merge branch to main: ${text}`,
              },
            };
          }

          // Step 6: Delete the temporary branch
          await fetch(makeUrl(`/api/branch/${branchPath}`), {
            method: "DELETE",
            headers,
          });

          return {
            data: {
              success: true,
              storeClustering: enable,
              branchName,
              message: enable
                ? "Clustering enabled successfully"
                : "Clustering disabled successfully",
            },
          };
        } catch (err) {
          // Best-effort cleanup
          try {
            await fetch(makeUrl(`/api/branch/${branchPath}`), {
              method: "DELETE",
              headers,
            });
          } catch {
            // ignore cleanup errors
          }
          return {
            error: {
              status: "FETCH_ERROR" as const,
              error: `Network error: ${String(err)}`,
            },
          };
        }
      },
      invalidatesTags: (_result, _error, { org, db }) => [
        { type: "Clustering" as const, id: `${org}/${db}` },
      ],
    }),
  }),
  overrideExisting: false,
});

// --- Exported hooks ---

export const {
  useGetClusteringQuery,
  useToggleClusteringMutation,
} = clusteringApi;
