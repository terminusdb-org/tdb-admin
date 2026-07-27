/**
 * RTK Query API slice for TerminusDB indexing status and control.
 *
 * Wraps TDB's tdb-search plugin endpoints:
 * - GET    /api/index/:org/:db/local/branch/:branch  → index status
 * - POST   /api/index/:org/:db/local/branch/:branch  → trigger reindex
 * - DELETE /api/index/:org/:db/local/branch/:branch  → delete index
 */

import { baseApi } from "../baseApi";

// --- Response types ---

/** Branch processing progress from the indexer. */
export interface BranchProcessing {
  readonly commits_processed?: number;
  readonly current_commit?: string | null;
  readonly total_commits?: number;
  readonly upcoming_commit?: string | null;
}

/** Engine statistics from tdb-search. */
export interface IndexEngine {
  readonly commits_received?: number;
  readonly pending_indexing?: number;
  readonly processed_documents?: number;
  readonly documents_sent?: number;
  readonly searchable_documents?: number;
  readonly text_segments_indexed?: number;
  readonly total_documents?: number;
  readonly store_clustering?: boolean | null;
}

/** Index status returned by GET /api/index/:org/:db/local/branch/:branch */
export interface IndexStatus {
  readonly status?: string;
  readonly branch?: string;
  readonly error?: string | null;
  readonly last_indexed_commit?: string | null;
  readonly branch_processing?: BranchProcessing;
  readonly engine?: IndexEngine;
  readonly [key: string]: unknown;
}

/** Response from POST /api/index/:org/:db/local/branch/:branch */
export interface IndexTriggerResponse {
  readonly status?: string;
  readonly message?: string;
}

// --- Request types ---

export interface GetIndexStatusRequest {
  readonly org: string;
  readonly db: string;
  readonly branch?: string;
}

export interface TriggerIndexRequest {
  readonly org: string;
  readonly db: string;
  readonly branch?: string;
}

export interface DeleteIndexRequest {
  readonly org: string;
  readonly db: string;
  readonly branch?: string;
}

// --- API slice ---

export const indexerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get index status for a data product branch.
     * TDB API: GET /api/index/:org/:db/local/branch/:branch
     */
    getIndexStatus: builder.query<IndexStatus, GetIndexStatusRequest>({
      query: ({ org, db, branch = "main" }) => ({
        url: `/api/index/${encodeURIComponent(org)}/${encodeURIComponent(db)}/local/branch/${encodeURIComponent(branch)}`,
        method: "GET",
      }),
      keepUnusedDataFor: 3,
    }),

    /**
     * Trigger a reindex of a data product branch.
     * TDB API: POST /api/index/:org/:db/local/branch/:branch
     */
    triggerIndex: builder.mutation<IndexTriggerResponse, TriggerIndexRequest>({
      query: ({ org, db, branch = "main" }) => ({
        url: `/api/index/${encodeURIComponent(org)}/${encodeURIComponent(db)}/local/branch/${encodeURIComponent(branch)}`,
        method: "POST",
      }),
    }),

    /**
     * Delete the index for a data product branch.
     * TDB API: DELETE /api/index/:org/:db/local/branch/:branch
     */
    deleteIndex: builder.mutation<IndexTriggerResponse, DeleteIndexRequest>({
      query: ({ org, db, branch = "main" }) => ({
        url: `/api/index/${encodeURIComponent(org)}/${encodeURIComponent(db)}/local/branch/${encodeURIComponent(branch)}`,
        method: "DELETE",
      }),
    }),
  }),
  overrideExisting: false,
});

// --- Exported hooks ---

export const {
  useGetIndexStatusQuery,
  useTriggerIndexMutation,
  useDeleteIndexMutation,
} = indexerApi;
