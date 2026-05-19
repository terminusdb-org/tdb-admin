import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useListOrganizationsQuery,
  useListOrganizationsForUserQuery,
  useCreateOrganizationMutation,
  useDeleteOrganizationMutation,
  useMediationCreateTeamMutation,
  useMediationDeleteTeamMutation,
  useAppSelector,
  selectIsGlobalAdmin,
} from "@/store";
import type { TdbOrganization } from "@/store";
import { config } from "@/config";
import {
  DataTable,
  ConfirmModal,
  FormModal,
  EmptyState,
  ErrorState,
  LoadingState,
  Badge,
} from "@/components/shared";
import { isConflictError, extractApiMessage } from "@/utils/extractErrorStatus";

const ORG_NAME_PATTERN = /^[a-zA-Z0-9._-]{1,128}$/;

type ModalState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "delete"; org: TdbOrganization };

export const TeamListPage: React.FC = () => {
  const navigate = useNavigate();
  const isGlobalAdmin = useAppSelector(selectIsGlobalAdmin);

  // Global admins use /api/organizations (full list); team admins use /api/db to derive their orgs
  const adminQuery = useListOrganizationsQuery(undefined, { skip: !isGlobalAdmin });
  const userQuery = useListOrganizationsForUserQuery(undefined, { skip: isGlobalAdmin });
  const { data: orgs, isLoading, isError, error, refetch } = isGlobalAdmin ? adminQuery : userQuery;

  // Write operations: mediation layer in proxy mode, direct TDB in basic mode
  const [mediationCreate, { isLoading: isMediationCreating }] = useMediationCreateTeamMutation();
  const [mediationDelete, { isLoading: isMediationDeleting }] = useMediationDeleteTeamMutation();
  const [directCreate, { isLoading: isDirectCreating }] = useCreateOrganizationMutation();
  const [directDelete, { isLoading: isDirectDeleting }] = useDeleteOrganizationMutation();

  const isCreating = config.authMode === "proxy" ? isMediationCreating : isDirectCreating;
  const isDeleting = config.authMode === "proxy" ? isMediationDeleting : isDirectDeleting;

  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError(null);

    const trimmedName = newName.trim();
    if (!ORG_NAME_PATTERN.test(trimmedName)) {
      setCreateError(
        "Team name must be 1-128 characters: letters, numbers, dots, underscores, hyphens."
      );
      return;
    }

    try {
      if (config.authMode === "proxy") {
        // Mediation layer: dual-system provisioning (OpenBao group + TDB org)
        await mediationCreate({
          teamName: trimmedName,
          ownerUsername: "admin",
        }).unwrap();
      } else {
        // Basic mode: direct TDB API
        await directCreate({ name: trimmedName }).unwrap();
      }
      setModal({ kind: "closed" });
      setNewName("");
    } catch (err: unknown) {
      if (isConflictError(err)) {
        setCreateError(`A team with the name "${trimmedName}" already exists. Please choose a different name.`);
      } else {
        const apiMsg = extractApiMessage(err);
        setCreateError(apiMsg ?? "Failed to create team. Please try again.");
      }
    }
  };

  const handleDelete = async (org: TdbOrganization) => {
    try {
      if (config.authMode === "proxy") {
        await mediationDelete(org.name).unwrap();
      } else {
        await directDelete(org.name).unwrap();
      }
      setModal({ kind: "closed" });
    } catch {
      // Error state handled by RTK Query
    }
  };

  const columns = [
    {
      key: "name",
      header: "Team Name",
      render: (org: TdbOrganization) => (
        <span className="font-medium text-gray-900">{org.name}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: () => <Badge label="Active" variant="success" />,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right" as const,
      render: (org: TdbOrganization) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/teams/${encodeURIComponent(org.name)}`);
            }}
            className="rounded px-2 py-1 text-xs font-medium text-dfrntBlue-600 hover:bg-dfrntBlue-50 transition-colors"
          >
            View
          </button>
          {isGlobalAdmin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setModal({ kind: "delete", org });
              }}
              className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
              aria-label={`Delete team ${org.name}`}
            >
              Delete
            </button>
          )}
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Teams</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage TerminusDB organisations and team membership.
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
          <h1 className="text-xl font-semibold text-gray-900">Teams</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage TerminusDB organisations and team membership.
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
          <h1 className="text-xl font-semibold text-gray-900">Teams</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage TerminusDB organisations and team membership.
          </p>
        </div>
        {isGlobalAdmin && (
          <button
            type="button"
            onClick={() => setModal({ kind: "create" })}
            className="self-start rounded-md bg-dfrntBlue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 focus:outline-none focus:ring-2 focus:ring-dfrntBlue-500 focus:ring-offset-2 transition-colors sm:self-auto"
          >
            Create Team
          </button>
        )}
      </div>

      {!orgs || orgs.length === 0 ? (
        <EmptyState
          title="No teams found"
          description={isGlobalAdmin
            ? "Create your first team to organise users and data products."
            : "You do not have access to any teams yet. Contact your administrator."
          }
          action={isGlobalAdmin ? (
            <button
              type="button"
              onClick={() => setModal({ kind: "create" })}
              className="rounded-md bg-dfrntBlue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 transition-colors"
            >
              Create Team
            </button>
          ) : undefined}
        />
      ) : (
        <DataTable
          columns={columns}
          data={orgs}
          rowKey={(org) => org.name}
          onRowClick={(org) => navigate(`/teams/${encodeURIComponent(org.name)}`)}
          ariaLabel="Teams list"
        />
      )}

      {modal.kind === "create" && (
        <FormModal
          title="Create Team"
          description="Create a new TerminusDB organisation."
          submitLabel="Create Team"
          isLoading={isCreating}
          error={createError}
          onSubmit={handleCreate}
          onCancel={() => setModal({ kind: "closed" })}
        >
          <div>
            <label
              htmlFor="team-name"
              className="block text-sm font-medium text-gray-700"
            >
              Team Name
            </label>
            <input
              id="team-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={isCreating}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
              required
              pattern="[a-zA-Z0-9._\-]{1,128}"
              placeholder="my-team"
            />
            <p className="mt-1 text-xs text-gray-500">
              Letters, numbers, dots, underscores, hyphens. Max 128 characters.
            </p>
          </div>
        </FormModal>
      )}

      {modal.kind === "delete" && (
        <ConfirmModal
          title="Delete Team"
          description={`This will permanently delete the team "${modal.org.name}" and revoke all access. This action cannot be undone.`}
          confirmLabel="Delete Team"
          destructive
          isLoading={isDeleting}
          typeToConfirm={modal.org.name}
          typeToConfirmHint={`Type "${modal.org.name}" to confirm deletion`}
          onConfirm={() => handleDelete(modal.org)}
          onCancel={() => setModal({ kind: "closed" })}
        />
      )}
    </div>
  );
};
