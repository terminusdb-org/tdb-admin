import React, { useEffect, useState } from "react";
import {
  useListOrganizationsQuery,
  useListOrganizationsForUserQuery,
  useListDatabasesQuery,
  useGetIndexStatusQuery,
  useTriggerIndexMutation,
  useDeleteIndexMutation,
  useGetClusteringQuery,
  useToggleClusteringMutation,
  useAppSelector,
  selectIsGlobalAdmin,
} from "@/store";
import type { TdbOrganization, TdbDatabase, IndexStatus } from "@/store";
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/shared";

/** Status badge color mapping for indexer status */
function statusBadgeVariant(status: string): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "completed":
      return "success";
    case "indexing":
      return "warning";
    case "error":
      return "danger";
    default:
      return "neutral";
  }
}

/** Human-readable status label */
function statusLabel(status: string): string {
  switch (status) {
    case "indexing":
      return "Indexing";
    case "completed":
      return "Completed";
    case "error":
      return "Error";
    case "not_found":
      return "Not indexed";
    case "indexer_unavailable":
      return "Indexer unavailable";
    default:
      return status;
  }
}

/** Individual data product row with indexing status */
const IndexRow: React.FC<{
  org: string;
  db: string;
}> = ({ org, db }) => {
  const [polling, setPolling] = useState(false);
  const { data, isLoading, isError, refetch } = useGetIndexStatusQuery(
    { org, db },
    {
      pollingInterval: polling ? 3000 : 0,
    }
  );
  const [triggerIndex, { isLoading: isTriggering }] = useTriggerIndexMutation();
  const [deleteIndex, { isLoading: isDeleting }] = useDeleteIndexMutation();
  const { data: clusteringData, isError: clusteringIsError, refetch: refetchClustering } = useGetClusteringQuery(
    { org, db },
    { skip: false }
  );
  const [toggleClustering, { isLoading: isTogglingClustering }] = useToggleClusteringMutation();
  const [clusteringError, setClusteringError] = useState<string | null>(null);

  const idx = data as IndexStatus | undefined;
  const status = idx?.status ?? "unknown";
  const isIndexing = status === "indexing";
  const bp = idx?.branch_processing;
  const eng = idx?.engine;

  useEffect(() => {
    setPolling(isIndexing);
  }, [isIndexing]);

  const handleTrigger = async () => {
    try {
      await triggerIndex({ org, db }).unwrap();
      refetch();
    } catch {
      // RTK Query handles error state
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete the index for ${org}/${db}? This will remove all indexed data from the search engine. The data product itself is not affected.`)) {
      return;
    }
    try {
      await deleteIndex({ org, db }).unwrap();
      refetch();
    } catch {
      // RTK Query handles error state
    }
  };

  const handleToggleClustering = async () => {
    setClusteringError(null);
    const current = clusteringData?.storeClustering ?? false;
    const action = current ? "disable" : "enable";
    if (!window.confirm(`${action === "enable" ? "Enable" : "Disable"} clustering for ${org}/${db}? This will modify the schema metadata on main.`)) {
      return;
    }
    try {
      await toggleClustering({ org, db, enable: !current }).unwrap();
      refetchClustering();
    } catch (err) {
      const msg = err && typeof err === "object" && "data" in err
        ? String((err as { data: unknown }).data)
        : `Failed to ${action} clustering`;
      setClusteringError(msg);
    }
  };

  const completed = bp?.commits_processed ?? 0;
  const total = bp?.total_commits ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const storeClustering = clusteringData?.storeClustering ?? false;
  const searchableDocs = eng?.searchable_documents ?? null;
  const pendingIndexing = eng?.pending_indexing ?? 0;

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="px-4 py-3 text-sm font-medium text-gray-900">
        {org}/{db}
      </td>
      <td className="px-4 py-3">
        {isLoading && <span className="text-xs text-gray-400">Loading…</span>}
        {!isLoading && isError && <span className="text-xs text-red-600">Failed to fetch</span>}
        {!isLoading && !isError && (
          <Badge label={statusLabel(status)} variant={statusBadgeVariant(status)} />
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {isIndexing && total > 0 ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-dfrntBlue-600 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{completed}/{total} commits</span>
          </div>
        ) : !isIndexing && searchableDocs !== null ? (
          <span className="text-xs text-gray-500" title="Searchable documents in the index">
            {searchableDocs.toLocaleString()} docs
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
        {pendingIndexing > 0 && !isIndexing && (
          <span className="ml-1 text-xs text-amber-600" title="Documents pending indexing">
            ({pendingIndexing} pending)
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {clusteringIsError ? (
          <span className="text-xs text-gray-400" title="Schema context not readable">N/A</span>
        ) : clusteringData ? (
          <div className="flex items-center gap-2">
            <Badge
              label={storeClustering ? "Clustering" : "No clustering"}
              variant={storeClustering ? "success" : "neutral"}
            />
            <button
              type="button"
              onClick={handleToggleClustering}
              disabled={isTogglingClustering}
              className="rounded px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
              title={storeClustering ? "Disable clustering embeddings" : "Enable clustering embeddings"}
            >
              {isTogglingClustering ? "…" : storeClustering ? "Disable" : "Enable"}
            </button>
          </div>
        ) : (
          <span className="text-xs text-gray-400">Loading…</span>
        )}
        {clusteringError && (
          <div className="mt-1 text-xs text-red-600">{clusteringError}</div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleTrigger}
            disabled={isTriggering || isIndexing}
            className="rounded px-2.5 py-1 text-xs font-medium text-dfrntBlue-600 hover:bg-dfrntBlue-50 disabled:opacity-50 transition-colors"
          >
            {isTriggering ? "Starting…" : "Reindex"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || status === "not_found"}
            className="rounded px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
            title="Delete the search index — the data product itself is not affected"
          >
            {isDeleting ? "Deleting…" : "Delete index"}
          </button>
        </div>
      </td>
    </tr>
  );
};

/** Fetches databases for a single org and renders indexing rows */
const OrgIndexSection: React.FC<{ org: TdbOrganization }> = ({ org }) => {
  const { data: databases, isLoading, isError, refetch } = useListDatabasesQuery(org.name);

  if (isLoading) {
    return (
      <div className="animate-pulse px-6 py-3">
        <div className="h-4 w-32 rounded bg-gray-200" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-6 py-3">
        <span className="text-sm text-red-600">
          Failed to load databases.{" "}
          <button type="button" onClick={() => refetch()} className="font-medium underline">
            Retry
          </button>
        </span>
      </div>
    );
  }

  if (!databases || databases.length === 0) {
    return (
      <EmptyState
        title="No data products"
        description={`Team "${org.name}" has no data products.`}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Data Product
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Index Status
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Progress
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Clustering
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {databases.map((db: TdbDatabase) => (
            <IndexRow key={`${org.name}/${db.name}`} org={org.name} db={db.name} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const IndexingStatusPage: React.FC = () => {
  const isGlobalAdmin = useAppSelector(selectIsGlobalAdmin);
  const adminQuery = useListOrganizationsQuery(undefined, { skip: !isGlobalAdmin });
  const userQuery = useListOrganizationsForUserQuery(undefined, { skip: isGlobalAdmin });
  const { data: orgs, isLoading, isError, error, refetch } = isGlobalAdmin ? adminQuery : userQuery;

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Indexing Status</h1>
          <p className="mt-1 text-sm text-gray-600">
            Monitor and manage tdb-search indexing for your data products.
          </p>
        </div>
        <LoadingState rows={4} />
      </div>
    );
  }

  if (isError) {
    const errorMsg = error && "status" in error
      ? `Server returned ${error.status}`
      : "Network error — cannot reach TerminusDB.";
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Indexing Status</h1>
          <p className="mt-1 text-sm text-gray-600">
            Monitor and manage tdb-search indexing for your data products.
          </p>
        </div>
        <ErrorState title="Failed to load teams" message={errorMsg} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Indexing Status</h1>
        <p className="mt-1 text-sm text-gray-600">
          Monitor and manage tdb-search indexing for your data products.
        </p>
      </div>

      {!orgs || orgs.length === 0 ? (
        <EmptyState
          title="No teams found"
          description="Create a team and add data products to start indexing."
        />
      ) : (
        <div className="space-y-6">
          {orgs.map((org: TdbOrganization) => (
            <section key={org.name} aria-labelledby={`org-${org.name}-heading`}>
              <div className="mb-2 flex items-center gap-2">
                <h2
                  id={`org-${org.name}-heading`}
                  className="text-sm font-medium uppercase tracking-wider text-gray-500"
                >
                  {org.name}
                </h2>
                <Badge label="Team" variant="neutral" />
              </div>
              <OrgIndexSection org={org} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
