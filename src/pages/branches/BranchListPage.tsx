import React, { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  useListBranchesQuery,
  useListDatabasesQuery,
  useUpdateDatabaseMutation,
  useCreateBranchMutation,
  useDeleteBranchMutation,
} from "@/store";
import type { TdbBranch } from "@/store";
import {
  DataTable,
  ConfirmModal,
  FormModal,
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/shared";

const BRANCH_NAME_PATTERN = /^[a-zA-Z0-9._-]{1,128}$/;

/** Default branch that always exists and cannot be deleted */
const DEFAULT_BRANCH = "main";

type ModalState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "delete"; branch: TdbBranch };

/**
 * BranchListPage — lists all branches for a data product.
 *
 * Route: /data-products/:org/:db/branches
 *
 * Features:
 * - Lists all branches with "main" badge on default branch
 * - Create Branch button opens form (name + source branch dropdown)
 * - Delete button on each non-main branch with confirmation
 * - Clicking a branch row navigates to schema editor for that branch
 */
export const BranchListPage: React.FC = () => {
  const { org, db } = useParams<{ org: string; db: string }>();

  const {
    data: branches,
    isLoading,
    isError,
    error,
    refetch,
  } = useListBranchesQuery(
    { org: org ?? "", db: db ?? "" },
    { skip: !org || !db }
  );

  // TDB v12 does not support GET /api/db/:org/:db (single database endpoint).
  // Use the list endpoint and find the matching entry by name.
  const { data: databases } = useListDatabasesQuery(org ?? "", { skip: !org });
  const dbInfo = useMemo(
    () => databases?.find((entry) => entry.name === db),
    [databases, db]
  );

  const [updateDatabase, { isLoading: isUpdating }] = useUpdateDatabaseMutation();
  const [createBranch, { isLoading: isCreating }] = useCreateBranchMutation();
  const [deleteBranch, { isLoading: isDeleting }] = useDeleteBranchMutation();

  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [formName, setFormName] = useState("");
  const [formOrigin, setFormOrigin] = useState(DEFAULT_BRANCH);
  const [createError, setCreateError] = useState<string | null>(null);

  // Inline edit state for label + description
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState("");
  const [editComment, setEditComment] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);

  const handleStartEdit = useCallback(() => {
    setEditLabel(dbInfo?.label ?? "");
    setEditComment(dbInfo?.comment ?? "");
    setEditError(null);
    setEditSuccess(false);
    setIsEditing(true);
  }, [dbInfo]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditError(null);
    setEditSuccess(false);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!org || !db) return;
    setEditError(null);
    setEditSuccess(false);

    try {
      await updateDatabase({
        org,
        name: db,
        label: editLabel.trim() || undefined,
        comment: editComment.trim() || undefined,
      }).unwrap();
      setIsEditing(false);
      setEditSuccess(true);
      // Clear success after 3 seconds
      setTimeout(() => setEditSuccess(false), 3000);
    } catch {
      setEditError("Failed to update data product. Check permissions.");
    }
  }, [org, db, editLabel, editComment, updateDatabase]);

  if (!org || !db) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm font-medium text-gray-700">Invalid route</p>
        <p className="mt-1 text-sm text-gray-500">
          Missing organisation or database in URL.
        </p>
      </div>
    );
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError(null);

    const trimmedName = formName.trim();
    if (!BRANCH_NAME_PATTERN.test(trimmedName)) {
      setCreateError(
        "Branch name must be 1-128 characters: letters, numbers, dots, underscores, hyphens."
      );
      return;
    }

    if (trimmedName === DEFAULT_BRANCH) {
      setCreateError("Cannot create a branch named \"main\" — it already exists.");
      return;
    }

    try {
      await createBranch({
        org,
        db,
        branchName: trimmedName,
        originBranch: formOrigin,
      }).unwrap();
      setModal({ kind: "closed" });
      setFormName("");
      setFormOrigin(DEFAULT_BRANCH);
    } catch {
      setCreateError("Failed to create branch. The name may already exist.");
    }
  };

  const handleDelete = async (branch: TdbBranch) => {
    try {
      await deleteBranch({
        org,
        db,
        branchName: branch.name,
      }).unwrap();
      setModal({ kind: "closed" });
    } catch {
      // Error handled by RTK Query state
    }
  };

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Branches</h1>
          <p className="mt-1 text-sm text-gray-600">
            {org}/{db}
          </p>
        </div>
        <LoadingState rows={3} />
      </div>
    );
  }

  if (isError) {
    const errorMsg =
      error && "status" in error
        ? `Server returned ${error.status}`
        : "Network error — cannot reach TerminusDB.";

    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Branches</h1>
          <p className="mt-1 text-sm text-gray-600">
            {org}/{db}
          </p>
        </div>
        <ErrorState title="Failed to load branches" message={errorMsg} onRetry={refetch} />
      </div>
    );
  }

  const columns = [
    {
      key: "name",
      header: "Branch",
      render: (branch: TdbBranch) => (
        <span className="flex items-center gap-2">
          <span className="font-medium text-gray-900">
            {branch.name}
          </span>
          {branch.name === DEFAULT_BRANCH && (
            <Badge label="default" variant="info" />
          )}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right" as const,
      render: (branch: TdbBranch) => {
        if (branch.name === DEFAULT_BRANCH) {
          return (
            <span className="text-xs text-gray-400">Protected</span>
          );
        }
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setModal({ kind: "delete", branch });
            }}
            className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
            aria-label={`Delete branch ${branch.name}`}
          >
            Delete
          </button>
        );
      },
    },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-1 text-sm text-gray-500">
          <li>
            <span>Data Products</span>
          </li>
          <li aria-hidden="true" className="mx-1">/</li>
          <li className="font-medium text-gray-900">
            {org}/{db}
          </li>
        </ol>
      </nav>

      {/* Data Product Metadata — Display or Edit Mode */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label
                htmlFor="dp-label"
                className="block text-sm font-medium text-gray-700"
              >
                Label
              </label>
              <input
                id="dp-label"
                type="text"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                disabled={isUpdating}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
                placeholder="Human-readable label for this data product"
              />
            </div>
            <div>
              <label
                htmlFor="dp-comment"
                className="block text-sm font-medium text-gray-700"
              >
                Description
              </label>
              <textarea
                id="dp-comment"
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                disabled={isUpdating}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
                placeholder="Describe the purpose of this data product"
              />
            </div>
            {editError && (
              <p className="text-sm text-red-600" role="alert">
                {editError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isUpdating}
                className="rounded-md bg-dfrntBlue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 focus:outline-none focus:ring-2 focus:ring-dfrntBlue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
              >
                {isUpdating ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isUpdating}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-dfrntBlue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold text-gray-900 truncate">
                {dbInfo?.label || db}
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                {dbInfo?.comment || "No description provided."}
              </p>
              {editSuccess && (
                <p className="mt-2 text-sm font-medium text-green-600" role="status">
                  Updated successfully.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleStartEdit}
              className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-dfrntBlue-500 focus:ring-offset-2 transition-colors"
              aria-label="Edit data product label and description"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Branches Header + Create Button */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Branches</h2>
        <button
          type="button"
          onClick={() => setModal({ kind: "create" })}
          className="rounded-md bg-dfrntBlue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 focus:outline-none focus:ring-2 focus:ring-dfrntBlue-500 focus:ring-offset-2 transition-colors"
        >
          Create Branch
        </button>
      </div>

      {!branches || branches.length === 0 ? (
        <EmptyState
          title="No branches"
          description="This data product has no branches. Create one to get started."
        />
      ) : (
        <DataTable
          columns={columns}
          data={branches}
          rowKey={(branch) => branch.name}
          ariaLabel={`Branches of ${org}/${db}`}
        />
      )}

      {/* Create Branch Modal */}
      {modal.kind === "create" && (
        <FormModal
          title="Create Branch"
          description={`Create a new branch in ${org}/${db}.`}
          submitLabel="Create"
          isLoading={isCreating}
          error={createError}
          onSubmit={handleCreate}
          onCancel={() => setModal({ kind: "closed" })}
        >
          <div>
            <label
              htmlFor="branch-name"
              className="block text-sm font-medium text-gray-700"
            >
              Branch Name
            </label>
            <input
              id="branch-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              disabled={isCreating}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
              required
              pattern="[a-zA-Z0-9._\-]{1,128}"
              placeholder="feature-branch"
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-500">
              Letters, numbers, dots, underscores, hyphens. Max 128 characters.
            </p>
          </div>
          <div>
            <label
              htmlFor="branch-origin"
              className="block text-sm font-medium text-gray-700"
            >
              Source Branch
            </label>
            <select
              id="branch-origin"
              value={formOrigin}
              onChange={(e) => setFormOrigin(e.target.value)}
              disabled={isCreating}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
            >
              {branches?.map((branch) => (
                <option key={branch.name} value={branch.name}>
                  {branch.name}
                  {branch.name === DEFAULT_BRANCH ? " (default)" : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              The new branch will be created from this source.
            </p>
          </div>
        </FormModal>
      )}

      {/* Delete Branch Confirmation */}
      {modal.kind === "delete" && (
        <ConfirmModal
          title="Delete Branch"
          description={`This will permanently delete the branch "${modal.branch.name}" from ${org}/${db}. Commits will remain in history but will no longer be reachable by this name.`}
          confirmLabel="Delete Branch"
          destructive
          isLoading={isDeleting}
          typeToConfirm={modal.branch.name}
          typeToConfirmHint={`Type "${modal.branch.name}" to confirm deletion`}
          onConfirm={() => handleDelete(modal.branch)}
          onCancel={() => setModal({ kind: "closed" })}
        />
      )}
    </div>
  );
};
