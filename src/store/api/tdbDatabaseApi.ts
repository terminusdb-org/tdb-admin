/**
 * RTK Query API slice for TerminusDB database (data product) management.
 *
 * Wraps TDB's REST API for database CRUD operations:
 * - List databases within an organisation
 * - Get database info
 * - Create database
 * - Delete database
 *
 * Databases are always scoped to an organisation (team).
 * Path format: /api/db/:org/:dbName
 *
 * All endpoints require super-user authentication via Basic Auth,
 * injected automatically by the baseApi's prepareHeaders.
 *
 * @see projects/2026-05-customer-premise-deployment/specs/m3-enterprise-admin-architecture.md
 */

import { baseApi } from "../baseApi";

// --- Response types (from TDB REST API) ---

/** Database (data product) as presented to UI components */
export interface TdbDatabase {
  /** Database name (unique within org) — derived from path if not present */
  readonly name: string;
  /** Human-readable label (may not be available from all TDB versions) */
  readonly label?: string;
  /** Description/comment */
  readonly comment?: string;
  /** Path identifier (org/name format) */
  readonly path?: string;
  /** Raw TDB @id (e.g. "UserDatabase/01AEVhV4o2weLi0i") — used for scope matching in grants */
  readonly rawId?: string;
}

/**
 * Raw response shape from TDB GET /api/db/:org?verbose=true.
 *
 * Without verbose=true: only { path: "org/name" } per entry.
 * With verbose=true: full UserDatabase document from system DB:
 *   { "@type": "UserDatabase", "@id": "UserDatabase/...",
 *     name: "dbname", label: "...", comment: "...",
 *     creation_date: "...", state: "finalized", path: "org/dbname" }
 *
 * We normalise all variants into TdbDatabase.
 */
interface TdbDatabaseRaw {
  readonly "@type"?: string;
  readonly "@id"?: string;
  readonly name?: string;
  readonly label?: string;
  readonly comment?: string;
  readonly path?: string;
  readonly creation_date?: string;
  readonly state?: string;
  /** JSON-LD style label (legacy TDB versions) */
  readonly "@label"?: string;
  /** JSON-LD style comment (legacy TDB versions) */
  readonly "@comment"?: string;
  /** Alternative: description field */
  readonly description?: string;
}

/** Derive a clean short name from the raw TDB response */
function normaliseDatabaseEntry(raw: TdbDatabaseRaw): TdbDatabase {
  let name = raw.name ?? (raw.path ? raw.path.split("/").pop() ?? raw.path : "unknown");
  // Strip JSON-LD type prefix if TDB returns full @id (e.g. "UserDatabase/admin/mydb" → "mydb")
  if (name.startsWith("UserDatabase/")) {
    name = name.slice("UserDatabase/".length).split("/").pop() ?? name;
  }
  const label = raw.label ?? raw["@label"];
  const comment = raw.comment ?? raw["@comment"] ?? raw.description;
  return {
    name,
    label,
    comment,
    path: raw.path,
    rawId: raw["@id"],
  };
}

/** Success response from TDB database mutation endpoints */
interface TdbDatabaseMutationResponse {
  readonly "@type": "api:DbCreateResponse" | "api:DbDeleteResponse" | "api:DbUpdatedResponse";
  readonly "api:status": "api:success";
}

// --- Request types ---

export interface CreateDatabaseRequest {
  /** Organisation (team) the database belongs to */
  readonly org: string;
  /** Database name — must match ^[a-zA-Z0-9._-]{1,128}$ */
  readonly name: string;
  /** Human-readable display label */
  readonly label?: string;
  /** Optional description */
  readonly comment?: string;
}

export interface DeleteDatabaseRequest {
  /** Organisation (team) the database belongs to */
  readonly org: string;
  /** Database name to delete */
  readonly name: string;
}

export interface UpdateDatabaseRequest {
  /** Organisation (team) the database belongs to */
  readonly org: string;
  /** Database name to update */
  readonly name: string;
  /** New human-readable label (omit to leave unchanged) */
  readonly label?: string;
  /** New description/comment (omit to leave unchanged) */
  readonly comment?: string;
}

export interface GetDatabaseRequest {
  /** Organisation (team) */
  readonly org: string;
  /** Database name */
  readonly name: string;
}

// --- API Slice ---

export const tdbDatabaseApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * List all databases within an organisation.
     * TDB API: GET /api/db/:org?verbose=true
     *
     * The verbose=true param is required to get label/comment fields.
     * Without it, TDB only returns { path: "org/name" } per entry.
     * With verbose=true, TDB returns the full UserDatabase document
     * including label, comment, creation_date, and state fields.
     *
     * transformResponse normalises the response into TdbDatabase.
     */
    listDatabases: builder.query<ReadonlyArray<TdbDatabase>, string>({
      query: (org) => ({
        url: `/api/db/${encodeURIComponent(org)}`,
        method: "GET",
        params: { verbose: "true" },
      }),
      transformResponse: (raw: ReadonlyArray<TdbDatabaseRaw>) =>
        raw.map(normaliseDatabaseEntry),
      providesTags: (result, _error, org) =>
        result
          ? [
              ...result.map(
                (db) => ({ type: "Database" as const, id: `${org}/${db.name}` })
              ),
              { type: "Database", id: `${org}:LIST` },
            ]
          : [{ type: "Database", id: `${org}:LIST` }],
    }),

    /**
     * Get info for a specific database.
     * TDB API: GET /api/db/:org/:name?verbose=true
     *
     * verbose=true required for label/comment fields in the response.
     * May return 404 for non-admin orgs — use listDatabases as fallback.
     */
    getDatabase: builder.query<TdbDatabase, GetDatabaseRequest>({
      query: ({ org, name }) => ({
        url: `/api/db/${encodeURIComponent(org)}/${encodeURIComponent(name)}`,
        method: "GET",
        params: { verbose: "true" },
      }),
      transformResponse: (raw: TdbDatabaseRaw) => normaliseDatabaseEntry(raw),
      providesTags: (_result, _error, { org, name }) => [
        { type: "Database", id: `${org}/${name}` },
      ],
    }),

    /**
     * Create a new database within an organisation.
     * TDB API: POST /api/db/:org/:name
     * Body: { label?: string, comment?: string, schema: true }
     */
    createDatabase: builder.mutation<TdbDatabaseMutationResponse, CreateDatabaseRequest>({
      query: ({ org, name, label, comment }) => ({
        url: `/api/db/${encodeURIComponent(org)}/${encodeURIComponent(name)}`,
        method: "POST",
        body: {
          schema: true,
          ...(label !== undefined && { label }),
          ...(comment !== undefined && { comment }),
        },
      }),
      invalidatesTags: (_result, _error, { org }) => [
        { type: "Database", id: `${org}:LIST` },
      ],
    }),

    /**
     * Update a database's metadata (label, comment).
     * TDB API: PUT /api/db/:org/:name
     * Body: { label?: string, comment?: string }
     *
     * Only provided fields are updated — omitted fields remain unchanged.
     * Requires manage_capabilities action scope on the database.
     */
    updateDatabase: builder.mutation<TdbDatabaseMutationResponse, UpdateDatabaseRequest>({
      query: ({ org, name, label, comment }) => ({
        url: `/api/db/${encodeURIComponent(org)}/${encodeURIComponent(name)}`,
        method: "PUT",
        body: {
          ...(label !== undefined && { label }),
          ...(comment !== undefined && { comment }),
        },
      }),
      // Broad invalidation: TDB does not reliably return updated metadata on the
      // individual database endpoint after a PUT, so we invalidate all database
      // cache entries to force a full refetch. Intentional until TDB fixes this.
      invalidatesTags: ["Database"],
    }),

    /**
     * Delete a database.
     * TDB API: DELETE /api/db/:org/:name
     *
     * WARNING: This is irreversible. All data in the database is permanently lost.
     */
    deleteDatabase: builder.mutation<TdbDatabaseMutationResponse, DeleteDatabaseRequest>({
      query: ({ org, name }) => ({
        url: `/api/db/${encodeURIComponent(org)}/${encodeURIComponent(name)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { org, name }) => [
        { type: "Database", id: `${org}/${name}` },
        { type: "Database", id: `${org}:LIST` },
      ],
    }),
  }),
  overrideExisting: false,
});

// --- Exported hooks ---

export const {
  useListDatabasesQuery,
  useGetDatabaseQuery,
  useCreateDatabaseMutation,
  useUpdateDatabaseMutation,
  useDeleteDatabaseMutation,
} = tdbDatabaseApi;
