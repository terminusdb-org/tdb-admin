import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useListUsersQuery,
  useDeleteUserMutation,
  useCreateUserMutation,
  useMediationCreateUserMutation,
  useMediationDeleteUserMutation,
  useAppSelector,
  selectIsGlobalAdmin,
} from "@/store";
import type { TdbUser } from "@/store";
import { config } from "@/config";
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

type ModalState =
  | { kind: "closed" }
  | { kind: "confirm-deactivate"; user: TdbUser }
  | { kind: "add-user" };

/**
 * User list screen — displays all TDB users in a table with actions.
 *
 * Write operations (create/delete) route through the mediation layer in proxy mode,
 * ensuring dual-system consistency (OpenBao + TDB). In basic mode, writes go
 * directly to TDB via the legacy tdbUserApi hooks.
 *
 * Read operations always go to TDB (directly or via proxy).
 */
export const UserListPage: React.FC = () => {
  const navigate = useNavigate();
  const isGlobalAdmin = useAppSelector(selectIsGlobalAdmin);

  // Redirect team admins — this page is global-admin only
  useEffect(() => {
    if (!isGlobalAdmin) {
      navigate("/teams", { replace: true });
    }
  }, [isGlobalAdmin, navigate]);

  const { data: users, isLoading, isError, error, refetch } = useListUsersQuery();

  // Write operations: mediation layer in proxy mode, direct TDB in basic mode
  const [mediationCreate, { isLoading: isMediationCreating }] = useMediationCreateUserMutation();
  const [mediationDelete, { isLoading: isMediationDeleting }] = useMediationDeleteUserMutation();
  const [directCreate, { isLoading: isDirectCreating }] = useCreateUserMutation();
  const [directDelete, { isLoading: isDirectDeleting }] = useDeleteUserMutation();

  const isCreating = config.authMode === "proxy" ? isMediationCreating : isDirectCreating;
  const isDeleting = config.authMode === "proxy" ? isMediationDeleting : isDirectDeleting;

  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const handleDeactivate = async (user: TdbUser) => {
    try {
      if (config.authMode === "proxy") {
        await mediationDelete(user.name).unwrap();
      } else {
        await directDelete(user.name).unwrap();
      }
      setModal({ kind: "closed" });
    } catch {
      // Error is handled by RTK Query — mutation error state
    }
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError(null);

    const trimmedUsername = newUsername.trim();
    if (trimmedUsername.length === 0 || newPassword.length === 0) {
      setCreateError("Principal name and credential are required.");
      return;
    }

    try {
      if (config.authMode === "proxy") {
        // Mediation layer: dual-system provisioning (OpenBao + TDB)
        await mediationCreate({
          username: trimmedUsername,
          email: `${trimmedUsername}@localhost`,
          initialPassword: newPassword,
          teams: [],
          capabilities: [],
        }).unwrap();
      } else {
        // Basic mode: direct TDB API
        await directCreate({ username: trimmedUsername, password: newPassword }).unwrap();
      }
      setModal({ kind: "closed" });
      setNewUsername("");
      setNewPassword("");
    } catch (err: unknown) {
      if (isConflictError(err)) {
        setCreateError(`A principal with the name "${trimmedUsername}" already exists. Please choose a different name.`);
      } else {
        const apiMsg = extractApiMessage(err);
        setCreateError(apiMsg ?? "Failed to create principal. Please try again.");
      }
    }
  };

  const columns = [
    {
      key: "name",
      header: "Username",
      render: (user: TdbUser) => (
        <span className="font-medium text-gray-900">{user.name}</span>
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
      render: (user: TdbUser) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/password-reset?user=${encodeURIComponent(user.name)}`);
            }}
            className="rounded px-2 py-1 text-xs font-medium text-dfrntBlue-600 hover:bg-dfrntBlue-50 transition-colors"
            aria-label={`Reset password for ${user.name}`}
          >
            Reset Password
          </button>
          {user.name !== "admin" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setModal({ kind: "confirm-deactivate", user });
              }}
              className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
              aria-label={`Deactivate ${user.name}`}
            >
              Deactivate
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
          <h1 className="text-xl font-semibold text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage TerminusDB users and their permissions.
          </p>
        </div>
        <LoadingState rows={5} />
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
          <h1 className="text-xl font-semibold text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage TerminusDB users and their permissions.
          </p>
        </div>
        <ErrorState title="Failed to load users" message={errorMsg} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage TerminusDB users and their permissions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ kind: "add-user" })}
          className="self-start rounded-md bg-dfrntBlue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 focus:outline-none focus:ring-2 focus:ring-dfrntBlue-500 focus:ring-offset-2 transition-colors sm:self-auto"
        >
          Add User
        </button>
      </div>

      {!users || users.filter((u) => u.name !== "anonymous").length === 0 ? (
        <EmptyState
          title="No users found"
          description="Create the first user to get started."
        />
      ) : (
        <DataTable
          columns={columns}
          data={users.filter((u) => u.name !== "anonymous")}
          rowKey={(user) => user.name}
          ariaLabel="Users list"
        />
      )}

      {modal.kind === "add-user" && (
        <FormModal
          title="Add Principal"
          description="Create a new TerminusDB principal with credentials."
          submitLabel="Create Principal"
          isLoading={isCreating}
          error={createError}
          onSubmit={handleCreateUser}
          onCancel={() => setModal({ kind: "closed" })}
        >
          <div>
            <label
              htmlFor="tdb-new-identity"
              className="block text-sm font-medium text-gray-700"
            >
              Principal
            </label>
            <input
              id="tdb-new-identity"
              name="tdb-new-identity"
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              disabled={isCreating}
              autoComplete="off"
              placeholder="Enter principal name"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
              autoFocus
            />
          </div>
          <div>
            <label
              htmlFor="tdb-new-credential"
              className="block text-sm font-medium text-gray-700"
            >
              Credential
            </label>
            <input
              id="tdb-new-credential"
              name="tdb-new-credential"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isCreating}
              autoComplete="new-password"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
            />
          </div>
        </FormModal>
      )}

      {modal.kind === "confirm-deactivate" && (
        <ConfirmModal
          title="Deactivate User"
          description={`Are you sure you want to deactivate "${modal.user.name}"? This will immediately revoke their access.`}
          confirmLabel="Deactivate"
          destructive
          isLoading={isDeleting}
          onConfirm={() => handleDeactivate(modal.user)}
          onCancel={() => setModal({ kind: "closed" })}
        />
      )}
    </div>
  );
};
