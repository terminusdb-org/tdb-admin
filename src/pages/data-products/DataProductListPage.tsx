import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useListOrganizationsQuery,
  useListOrganizationsForUserQuery,
  useListDatabasesQuery,
  useCreateDatabaseMutation,
  useDeleteDatabaseMutation,
  useAppSelector,
  selectIsGlobalAdmin,
} from "@/store";
import type { TdbOrganization, TdbDatabase } from "@/store";
import {
  DataTable,
  ConfirmModal,
  FormModal,
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/shared";
import { isConflictError, extractApiMessage } from "@/utils/extractErrorStatus";
import { config } from "@/config";

const DB_NAME_PATTERN = /^[a-zA-Z0-9._-]{1,128}$/;

type ModalState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "delete"; org: string; db: TdbDatabase };


/** Fetches databases for a single org — used as a sub-component to handle per-org query */
const OrgDatabaseSection: React.FC<{
  org: TdbOrganization;
  onDelete: (org: string, db: TdbDatabase) => void;
  onNavigate: (org: string, db: TdbDatabase) => void;
}> = ({ org, onDelete, onNavigate }) => {
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
          <button
            type="button"
            onClick={() => refetch()}
            className="font-medium underline"
          >
            Retry
          </button>
        </span>
      </div>
    );
  }

  if (!databases || databases.length === 0) {
    return (
      <EmptyState
        title="No data products yet"
        description={`Team "${org.name}" has no data products. Create your first data product to get started.`}
      />
    );
  }

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (db: TdbDatabase) => (
        <span className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onNavigate(org.name, db)}
            className="font-medium text-dfrntBlue-600 hover:text-dfrntBlue-800 hover:underline transition-colors"
          >
            {db.name}
          </button>
          {/* tdb-data mounts alongside this app (/app/admin → /app/data) */}
          <a
            href={`${config.basePath.replace(/\/[^/]*$/, "")}/data/${encodeURIComponent(org.name)}/${encodeURIComponent(db.name)}/local/branch/main`}
            className="text-gray-400 transition-colors hover:text-dfrntBlue-600"
            title="Open in Data Explorer"
            aria-label={`Open ${org.name}/${db.name} in Data Explorer`}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-4.5-7.5H21m0 0v7.5m0-7.5L10.5 13.5" />
            </svg>
          </a>
        </span>
      ),
    },
    {
      key: "label",
      header: "Label",
      render: (db: TdbDatabase) => (
        <span className="text-gray-600">{db.label || "—"}</span>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (db: TdbDatabase) => (
        <span className="text-xs text-gray-500 line-clamp-5 max-w-[200px] block">
          {db.comment || "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right" as const,
      render: (db: TdbDatabase) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(org.name, db);
          }}
          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
          aria-label={`Delete database ${org.name}/${db.name}`}
        >
          Delete
        </button>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={databases}
      rowKey={(db) => `${org.name}/${db.name}`}
      ariaLabel={`Databases in team ${org.name}`}
    />
  );
};

export const DataProductListPage: React.FC = () => {
  const navigate = useNavigate();
  const isGlobalAdmin = useAppSelector(selectIsGlobalAdmin);

  // Global admins use /api/organizations (full list); team admins use /api/db to derive their orgs
  const adminQuery = useListOrganizationsQuery(undefined, { skip: !isGlobalAdmin });
  const userQuery = useListOrganizationsForUserQuery(undefined, { skip: isGlobalAdmin });
  const { data: orgs, isLoading, isError, error, refetch } = isGlobalAdmin ? adminQuery : userQuery;
  const [createDb, { isLoading: isCreating }] = useCreateDatabaseMutation();
  const [deleteDb, { isLoading: isDeleting }] = useDeleteDatabaseMutation();

  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [formOrg, setFormOrg] = useState("");
  const [formName, setFormName] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formComment, setFormComment] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError(null);

    const trimmedName = formName.trim();
    if (formOrg.length === 0) {
      setCreateError("Please select a team.");
      return;
    }
    if (!DB_NAME_PATTERN.test(trimmedName)) {
      setCreateError(
        "Database name must be 1-128 characters: letters, numbers, dots, underscores, hyphens."
      );
      return;
    }

    try {
      await createDb({
        org: formOrg,
        name: trimmedName,
        label: formLabel.trim() || undefined,
        comment: formComment.trim() || undefined,
      }).unwrap();
      setModal({ kind: "closed" });
      setFormOrg("");
      setFormName("");
      setFormLabel("");
      setFormComment("");
    } catch (err: unknown) {
      if (isConflictError(err)) {
        setCreateError(`A data product with the name "${trimmedName}" already exists in team "${formOrg}". Please choose a different name.`);
      } else {
        const apiMsg = extractApiMessage(err);
        setCreateError(apiMsg ?? "Failed to create data product. Please try again.");
      }
    }
  };

  const handleDelete = async (org: string, db: TdbDatabase) => {
    try {
      await deleteDb({ org, name: db.name }).unwrap();
      setModal({ kind: "closed" });
    } catch {
      // Error handled by RTK Query state
    }
  };

  const handleNavigate = (orgName: string, db: TdbDatabase) => {
    navigate(`/data-products/${encodeURIComponent(orgName)}/${encodeURIComponent(db.name)}/branches`);
  };

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Data Products</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage databases grouped by team.
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
          <h1 className="text-xl font-semibold text-gray-900">Data Products</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage databases grouped by team.
          </p>
        </div>
        <ErrorState title="Failed to load teams" message={errorMsg} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Data Products</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage databases grouped by team.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ kind: "create" })}
          className="self-start rounded-md bg-dfrntBlue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 focus:outline-none focus:ring-2 focus:ring-dfrntBlue-500 focus:ring-offset-2 transition-colors sm:self-auto"
        >
          New Data Product
        </button>
      </div>

      {!orgs || orgs.length === 0 ? (
        <EmptyState
          title="No teams found"
          description="Create a team first, then add data products to it."
        />
      ) : (
        <div className="space-y-6">
          {orgs.map((org) => (
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
              <OrgDatabaseSection
                org={org}
                onDelete={(orgName, db) => setModal({ kind: "delete", org: orgName, db })}
                onNavigate={handleNavigate}
              />
            </section>
          ))}
        </div>
      )}

      {modal.kind === "create" && (
        <FormModal
          title="New Data Product"
          description="Create a new database within a team."
          submitLabel="Create"
          isLoading={isCreating}
          error={createError}
          onSubmit={handleCreate}
          onCancel={() => setModal({ kind: "closed" })}
        >
          <div>
            <label
              htmlFor="db-org"
              className="block text-sm font-medium text-gray-700"
            >
              Team
            </label>
            <select
              id="db-org"
              value={formOrg}
              onChange={(e) => setFormOrg(e.target.value)}
              disabled={isCreating}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
              required
            >
              <option value="">Select a team…</option>
              {orgs?.map((org) => (
                <option key={org.name} value={org.name}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="db-name"
              className="block text-sm font-medium text-gray-700"
            >
              Database Name
            </label>
            <input
              id="db-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              disabled={isCreating}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
              required
              pattern="[a-zA-Z0-9._\-]{1,128}"
              placeholder="my-database"
            />
            <p className="mt-1 text-xs text-gray-500">
              Letters, numbers, dots, underscores, hyphens. Max 128 characters.
            </p>
          </div>
          <div>
            <label
              htmlFor="db-label"
              className="block text-sm font-medium text-gray-700"
            >
              Label <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="db-label"
              type="text"
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              disabled={isCreating}
              maxLength={256}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
              placeholder="Human-readable display name"
            />
          </div>
          <div>
            <label
              htmlFor="db-comment"
              className="block text-sm font-medium text-gray-700"
            >
              Description <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              id="db-comment"
              value={formComment}
              onChange={(e) => setFormComment(e.target.value)}
              disabled={isCreating}
              maxLength={1024}
              rows={2}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
              placeholder="Optional description"
            />
          </div>
        </FormModal>
      )}

      {modal.kind === "delete" && (
        <ConfirmModal
          title="Delete Data Product"
          description={`This will permanently delete "${modal.org}/${modal.db.name}" and ALL data within it. This action is irreversible.`}
          confirmLabel="Delete Database"
          destructive
          isLoading={isDeleting}
          typeToConfirm={`${modal.org}/${modal.db.name}`}
          typeToConfirmHint={`Type "${modal.org}/${modal.db.name}" to confirm deletion`}
          onConfirm={() => handleDelete(modal.org, modal.db)}
          onCancel={() => setModal({ kind: "closed" })}
        />
      )}
    </div>
  );
};
