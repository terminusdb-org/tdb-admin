import React, { useState } from "react";
import { FormModal } from "./FormModal";
import type { CapabilityScopeType } from "@/store";

interface RolePreset {
  readonly label: string;
  readonly value: string;
}

/** Hardcoded fallback presets when no roles are available from API or grants */
const FALLBACK_PRESETS_BY_ID: ReadonlyArray<RolePreset> = [
  { label: "Admin Role", value: "Role/admin" },
  { label: "Consumer Role", value: "Role/consumer" },
];

/** Role pair shape shared with GrantsPage (label = display name, value = rawRole ID) */
interface GrantDerivedRole {
  readonly label: string;
  readonly value: string;
}

interface GrantAccessDialogProps {
  /** The scope type (org or database) */
  readonly scopeType: CapabilityScopeType;
  /** The scope identifier (org name or org/db) */
  readonly scope: string;
  /** Available roles from /api/roles — only populated for global admin */
  readonly availableRoles: ReadonlyArray<string>;
  /** Role label+ID pairs from existing grants — label is display name, value is rawRole ID */
  readonly rolePairsFromGrants?: ReadonlyArray<GrantDerivedRole>;
  /** Suggested usernames for the datalist (optional; user can still type any name) */
  readonly availableUsers: ReadonlyArray<string>;
  /** Whether the grant is in progress */
  readonly isLoading?: boolean;
  /** Called when user confirms the grant */
  readonly onGrant: (user: string, roles: ReadonlyArray<string>) => void;
  /** Called when dialog is dismissed */
  readonly onCancel: () => void;
}

export const GrantAccessDialog: React.FC<GrantAccessDialogProps> = ({
  scopeType,
  scope,
  availableRoles,
  rolePairsFromGrants = [],
  availableUsers,
  isLoading = false,
  onGrant,
  onCancel,
}) => {
  const [userInput, setUserInput] = useState("");
  const [roleInput, setRoleInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmedUser = userInput.trim();
    const trimmedRole = roleInput.trim();

    if (trimmedUser.length === 0) {
      setError("Please enter a principal name.");
      return;
    }
    if (trimmedRole.length === 0) {
      setError("Please enter or select a role.");
      return;
    }

    onGrant(trimmedUser, [trimmedRole]);
  };

  const scopeLabel = scopeType === "organization" ? "team" : "database";

  const isGlobalAdmin = availableRoles.length > 0;

  // Build presets:
  // - Global admin: names from /api/roles → value = role name (TDB name-based lookup via scope_type)
  //   Grant-derived pairs are skipped — /api/roles is already the complete source.
  // - Non-admin: grant-derived pairs → label = display name, value = rawRole ID (e.g. "Role/admin")
  //   TDB requires full IDs when scope_type is omitted.
  // - Fallback if neither source has data: hardcoded ID-based presets
  const presets: ReadonlyArray<RolePreset> = (() => {
    if (isGlobalAdmin) {
      return availableRoles.map((r) => ({ label: r, value: r }));
    }
    if (rolePairsFromGrants.length > 0) {
      return [...rolePairsFromGrants];
    }
    return FALLBACK_PRESETS_BY_ID;
  })();

  const roleHint = isGlobalAdmin
    ? 'Select a preset above or type a role name (e.g. "Admin Role") or ID (e.g. "Role/admin").'
    : 'Select a preset above or type a role ID (e.g. "Role/admin", "Role/consumer").';

  return (
    <FormModal
      title="Grant Access"
      description={`Assign a role to a principal on ${scopeLabel} "${scope}".`}
      submitLabel="Grant Access"
      isLoading={isLoading}
      error={error}
      onSubmit={handleSubmit}
      onCancel={onCancel}
    >
      {/* Principal — free-text with optional suggestions */}
      <div>
        <label
          htmlFor="grant-tdb-principal"
          className="block text-sm font-medium text-gray-700"
        >
          Principal
        </label>
        <input
          id="grant-tdb-principal"
          name="grant-tdb-principal"
          type="text"
          list="grant-tdb-principal-suggestions"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          disabled={isLoading}
          placeholder={availableUsers.length > 0 ? "Enter principal name…" : "Enter principal name (e.g. alice)…"}
          autoComplete="off"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
          required
        />
        {availableUsers.length > 0 ? (
          <datalist id="grant-tdb-principal-suggestions">
            {availableUsers.map((user) => (
              <option key={user} value={user} />
            ))}
          </datalist>
        ) : (
          <p className="mt-1 text-xs text-gray-500">
            Enter the exact name of the principal to grant access to.
          </p>
        )}
      </div>

      {/* Role — quick-pick buttons + free-text */}
      <div>
        <label
          htmlFor="grant-role"
          className="block text-sm font-medium text-gray-700"
        >
          Role
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              disabled={isLoading}
              onClick={() => setRoleInput(preset.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-dfrntBlue-500 focus:ring-offset-1 ${
                roleInput === preset.value
                  ? "bg-dfrntBlue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <input
          id="grant-role"
          type="text"
          value={roleInput}
          onChange={(e) => setRoleInput(e.target.value)}
          disabled={isLoading}
          placeholder={isGlobalAdmin ? "Or type a role name / ID…" : "Or type a role ID…"}
          autoComplete="off"
          className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
          required
        />
        <p className="mt-1 text-xs text-gray-500">{roleHint}</p>
      </div>

      <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <strong>Scope:</strong> {scopeType} &mdash; {scope}
      </div>
    </FormModal>
  );
};
