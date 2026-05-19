import React, { useState } from "react";
import {
  useListRolesQuery,
  useCreateRoleMutation,
  useDeleteRoleMutation,
  TDB_ACTIONS,
  useAppSelector,
  selectIsGlobalAdmin,
} from "@/store";
import type { TdbRole } from "@/store";
import {
  DataTable,
  CollapsibleBadgeList,
  ConfirmModal,
  FormModal,
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/shared";
import { isConflictError, extractApiMessage } from "@/utils/extractErrorStatus";

const BUILT_IN_ROLES = ["Admin Role", "Consumer Role"] as const;

function isBuiltIn(roleName: string): boolean {
  return (BUILT_IN_ROLES as ReadonlyArray<string>).includes(roleName);
}

/**
 * Normalise action items to plain strings.
 *
 * TDB may return actions as either plain strings (e.g. "create_database")
 * or as JSON-LD objects with a `name` field (e.g. { "@id": "...", "name": "create_database" }).
 * This ensures CollapsibleBadgeList always receives string labels.
 */
function normalizeActions(actions: ReadonlyArray<string>): ReadonlyArray<string> {
  return actions.map((action) => {
    if (typeof action === "string") return action;
    // Runtime shape may be an object despite the static type
    const obj = action as unknown as Record<string, unknown>;
    if (typeof obj.name === "string") return obj.name;
    if (typeof obj["@id"] === "string") return obj["@id"];
    return String(action);
  });
}

type ModalState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "delete"; role: TdbRole };

export const RoleListPage: React.FC = () => {
  const isGlobalAdmin = useAppSelector(selectIsGlobalAdmin);
  const { data: roles, isLoading, isError, error, refetch } = useListRolesQuery();
  const [createRole, { isLoading: isCreating }] = useCreateRoleMutation();
  const [deleteRole, { isLoading: isDeleting }] = useDeleteRoleMutation();

  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [newName, setNewName] = useState("");
  const [selectedActions, setSelectedActions] = useState<ReadonlyArray<string>>([]);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError(null);

    const trimmedName = newName.trim();
    if (trimmedName.length === 0) {
      setCreateError("Role name is required.");
      return;
    }
    if (selectedActions.length === 0) {
      setCreateError("Select at least one action.");
      return;
    }

    try {
      await createRole({ name: trimmedName, actions: selectedActions }).unwrap();
      setModal({ kind: "closed" });
      setNewName("");
      setSelectedActions([]);
    } catch (err: unknown) {
      if (isConflictError(err)) {
        setCreateError(`A role with the name "${trimmedName}" already exists. Please choose a different name.`);
      } else {
        const apiMsg = extractApiMessage(err);
        setCreateError(apiMsg ?? "Failed to create role. Please try again.");
      }
    }
  };

  const handleDelete = async (role: TdbRole) => {
    try {
      await deleteRole(role.name).unwrap();
      setModal({ kind: "closed" });
    } catch {
      // Error handled by RTK Query
    }
  };

  const toggleAction = (action: string) => {
    setSelectedActions((prev) =>
      prev.includes(action)
        ? prev.filter((a) => a !== action)
        : [...prev, action]
    );
  };

  const columns = [
    {
      key: "name",
      header: "Role",
      render: (role: TdbRole) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{role.name}</span>
          {isBuiltIn(role.name) && (
            <Badge label="Built-in" variant="info" />
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (role: TdbRole) => (
        <CollapsibleBadgeList
          items={normalizeActions(role.action)}
          variant="neutral"
          formatLabel={(action) => action.replace(/_/g, " ")}
        />
      ),
    },
    {
      key: "controls",
      header: "",
      align: "right" as const,
      render: (role: TdbRole) =>
        !isGlobalAdmin || isBuiltIn(role.name) ? null : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setModal({ kind: "delete", role });
            }}
            className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
            aria-label={`Delete role ${role.name}`}
          >
            Delete
          </button>
        ),
    },
  ];

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Roles</h1>
          <p className="mt-1 text-sm text-gray-600">
            View and manage roles and their permissions.
          </p>
        </div>
        <LoadingState rows={3} />
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
          <h1 className="text-xl font-semibold text-gray-900">Roles</h1>
          <p className="mt-1 text-sm text-gray-600">
            View and manage roles and their permissions.
          </p>
        </div>
        <ErrorState title="Failed to load roles" message={errorMsg} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Roles</h1>
          <p className="mt-1 text-sm text-gray-600">
            {isGlobalAdmin
              ? "View and manage roles and their permissions."
              : "View roles and their permissions."}
          </p>
        </div>
        {isGlobalAdmin && (
          <button
            type="button"
            onClick={() => setModal({ kind: "create" })}
            className="self-start rounded-md bg-dfrntBlue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 focus:outline-none focus:ring-2 focus:ring-dfrntBlue-500 focus:ring-offset-2 transition-colors sm:self-auto"
          >
            Create Role
          </button>
        )}
      </div>

      {!roles || roles.length === 0 ? (
        <EmptyState
          title="No roles found"
          description="Roles define what actions users can perform. Create a custom role or use built-in roles."
        />
      ) : (
        <DataTable
          columns={columns}
          data={roles}
          rowKey={(role) => role.name}
          ariaLabel="Roles list"
        />
      )}

      {modal.kind === "create" && (
        <FormModal
          title="Create Role"
          description="Define a custom role with specific permissions."
          submitLabel="Create Role"
          isLoading={isCreating}
          error={createError}
          onSubmit={handleCreate}
          onCancel={() => setModal({ kind: "closed" })}
        >
          <div>
            <label
              htmlFor="role-name"
              className="block text-sm font-medium text-gray-700"
            >
              Role Name
            </label>
            <input
              id="role-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={isCreating}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
              required
              placeholder="Custom Role Name"
            />
          </div>
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700">
              Actions (permissions)
            </legend>
            <div className="mt-2 space-y-2">
              {TDB_ACTIONS.map((action) => (
                <label
                  key={action}
                  className="flex items-center gap-2 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedActions.includes(action)}
                    onChange={() => toggleAction(action)}
                    disabled={isCreating}
                    className="h-4 w-4 rounded border-gray-300 text-dfrntBlue-600 focus:ring-dfrntBlue-500"
                  />
                  {action.replace(/_/g, " ")}
                </label>
              ))}
            </div>
          </fieldset>
        </FormModal>
      )}

      {modal.kind === "delete" && (
        <ConfirmModal
          title="Delete Role"
          description={`Delete the custom role "${modal.role.name}"? Users with this role will lose its permissions.`}
          confirmLabel="Delete Role"
          destructive
          isLoading={isDeleting}
          onConfirm={() => handleDelete(modal.role)}
          onCancel={() => setModal({ kind: "closed" })}
        />
      )}
    </div>
  );
};
