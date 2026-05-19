import React, { useCallback, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  useGetOrganizationQuery,
  useListOrgMembersQuery,
  useListUsersQuery,
  useListRolesQuery,
  useGrantCapabilityMutation,
  useRevokeCapabilityMutation,
  useAppSelector,
  selectIsGlobalAdmin,
} from "@/store";
import type { TdbOrgMember } from "@/store";
import {
  DataTable,
  Badge,
  ConfirmModal,
  GrantAccessDialog,
  ErrorState,
  LoadingState,
  EmptyState,
} from "@/components/shared";
import { extractRoleName } from "@/utils/extractRoleName";

/** Modal state for add-member and revoke flows */
type ModalState =
  | { readonly kind: "closed" }
  | { readonly kind: "add-member" }
  | { readonly kind: "revoke"; readonly member: TdbOrgMember; readonly roleId: string; readonly roleName: string };

export const TeamDetailPage: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const orgName = name ?? "";
  const isGlobalAdmin = useAppSelector(selectIsGlobalAdmin);

  const [modal, setModal] = useState<ModalState>({ kind: "closed" });

  // Skip org detail query for non-global-admin users (returns 403).
  // The org name is available from the URL param — org detail is a nice-to-have.
  const {
    data: org,
    isLoading: isLoadingOrg,
    isError: isOrgError,
    error: orgError,
    refetch: refetchOrg,
  } = useGetOrganizationQuery(orgName, { skip: orgName.length === 0 || !isGlobalAdmin });

  const {
    data: members,
    isLoading: isLoadingMembers,
    isError: isMembersError,
    error: membersError,
    refetch: refetchMembers,
  } = useListOrgMembersQuery(orgName, { skip: orgName.length === 0 });

  // Users and roles lists are only needed for the "Grant Permissions" dialog (admin only)
  const { data: users } = useListUsersQuery(undefined, { skip: !isGlobalAdmin });
  const { data: roles } = useListRolesQuery(undefined, { skip: !isGlobalAdmin });
  const [grantCapability, { isLoading: isGranting }] = useGrantCapabilityMutation();
  const [revokeCapability, { isLoading: isRevoking }] = useRevokeCapabilityMutation();

  // Defensive: ensure members is an array
  const safeMembers: ReadonlyArray<TdbOrgMember> = useMemo(
    () => (Array.isArray(members) ? members : []),
    [members]
  );

  // For global admin: full user list from /api/users
  // For non-admin: derive suggestions from existing member names (user can still type any name)
  const availableUsers = useMemo(
    () => {
      if (isGlobalAdmin && users) {
        return users.map((u) => u.name).filter((n) => n !== "anonymous");
      }
      return safeMembers.map((m) => m.name);
    },
    [isGlobalAdmin, users, safeMembers]
  );

  const availableRoles = useMemo(
    () => (roles ?? []).map((r) => r.name),
    [roles]
  );

  // Derive role presets from existing member capabilities (for non-admin users
  // who cannot call /api/roles). Produces {label, value} pairs deduped by roleId.
  const derivedRolePairs = useMemo(() => {
    const seen = new Set<string>();
    const pairs: Array<{ readonly label: string; readonly value: string }> = [];
    for (const member of safeMembers) {
      if (!member.capability) continue;
      for (const cap of member.capability) {
        if (cap.roleId.length > 0 && !seen.has(cap.roleId)) {
          seen.add(cap.roleId);
          pairs.push({ label: extractRoleName(cap.role), value: cap.roleId });
        }
      }
    }
    return pairs.sort((a, b) => a.label.localeCompare(b.label));
  }, [safeMembers]);

  const handleAddMember = useCallback(
    async (user: string, selectedRoles: ReadonlyArray<string>) => {
      try {
        if (isGlobalAdmin) {
          // Global admin: scope_type mode — TDB resolves names to IDs
          await grantCapability({
            user,
            roles: selectedRoles,
            scope: orgName,
            scopeType: "organization",
            useNameBasedLookup: true,
          }).unwrap();
        } else {
          // Non-admin: full document ID mode — scope_type omitted, raw IDs required.
          const fullUser = user.startsWith("User/") ? user : `User/${user}`;
          const fullScope = `Organization/${orgName}`;
          await grantCapability({
            user: fullUser,
            roles: selectedRoles,
            scope: fullScope,
            scopeType: "organization",
            useNameBasedLookup: false,
          }).unwrap();
        }
        setModal({ kind: "closed" });
      } catch {
        // Error feedback handled by GrantAccessDialog / RTK Query
      }
    },
    [grantCapability, orgName, isGlobalAdmin]
  );

  const handleRevokeMember = useCallback(
    async (member: TdbOrgMember, roleId: string, roleName: string) => {
      try {
        if (isGlobalAdmin) {
          // Global admin: scope_type mode — TDB expects the role's display name
          // (e.g. "Admin Role", "Consumer Role") for name-based lookup, NOT the
          // @id slug ("admin", "consumer"). The display name matches the "name"
          // field in the TDB Role document.
          await revokeCapability({
            user: member.name,
            roles: [roleName],
            scope: orgName,
            scopeType: "organization",
            useNameBasedLookup: true,
          }).unwrap();
        } else {
          // Non-admin: full document ID mode — use @id format for user, role, and scope
          await revokeCapability({
            user: `User/${member.name}`,
            roles: [roleId],
            scope: `Organization/${orgName}`,
            scopeType: "organization",
            useNameBasedLookup: false,
          }).unwrap();
        }
        setModal({ kind: "closed" });
      } catch {
        // Error handled by RTK Query
      }
    },
    [revokeCapability, orgName, isGlobalAdmin]
  );

  if (orgName.length === 0) {
    return (
      <ErrorState
        title="Invalid team"
        message="No team name provided in the URL."
      />
    );
  }

  // Only block on org loading for global admin (non-admin skips org query)
  if ((isGlobalAdmin && isLoadingOrg) || isLoadingMembers) {
    return (
      <div>
        <Breadcrumb orgName={orgName} />
        <LoadingState rows={4} />
      </div>
    );
  }

  // Org error is fatal only for global admin (non-admin skips org query entirely)
  if (isGlobalAdmin && isOrgError) {
    const errorMsg = orgError && "status" in orgError
      ? orgError.status === 404
        ? `Team "${orgName}" not found.`
        : `Server returned ${orgError.status}`
      : "Network error — cannot reach TerminusDB.";

    return (
      <div>
        <Breadcrumb orgName={orgName} />
        <ErrorState title="Failed to load team" message={errorMsg} onRetry={refetchOrg} />
      </div>
    );
  }

  if (isMembersError) {
    const errorMsg = membersError && "status" in membersError
      ? `Server returned ${membersError.status}`
      : "Network error — cannot reach TerminusDB.";

    return (
      <div>
        <Breadcrumb orgName={orgName} />
        <ErrorState title="Failed to load members" message={errorMsg} onRetry={refetchMembers} />
      </div>
    );
  }

  const memberColumns = [
    {
      key: "name",
      header: "Username",
      render: (member: TdbOrgMember) => (
        <span className="font-medium text-gray-900">{member.name}</span>
      ),
    },
    {
      key: "roles",
      header: "Roles",
      render: (member: TdbOrgMember) => {
        if (!member.capability || member.capability.length === 0) {
          return <Badge label="No role" variant="neutral" />;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {member.capability.map((cap) => {
              const roleName = extractRoleName(cap.role);
              return (
                <Badge
                  key={`${cap.role}-${cap.scope}`}
                  label={roleName}
                  variant={roleName.toLowerCase().includes("admin") ? "info" : "neutral"}
                />
              );
            })}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      align: "right" as const,
      render: (member: TdbOrgMember) => {
        // The admin user in the admin team is a fixed system relationship — cannot be removed
        const isFixedAdminMember = orgName === "admin" && member.name === "admin";
        // roleId = @id format like "Role/admin" (for non-admin revoke API call)
        // role = display name like "Admin Role" (for admin scope_type revoke API call)
        const firstCap = member.capability?.[0];
        return (
          <div className="flex items-center justify-end gap-2">
            {firstCap && !isFixedAdminMember && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setModal({ kind: "revoke", member, roleId: firstCap.roleId, roleName: firstCap.role });
                }}
                className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                aria-label={`Remove ${member.name} from team`}
              >
                Remove
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <Breadcrumb orgName={orgName} />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {org?.name ?? orgName}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Team members and their roles within this organisation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ kind: "add-member" })}
          className="self-start rounded-md bg-dfrntBlue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 focus:outline-none focus:ring-2 focus:ring-dfrntBlue-500 focus:ring-offset-2 transition-colors sm:self-auto"
        >
          Grant Permissions
        </button>
      </div>

      <section aria-labelledby="members-heading">
        <h2 id="members-heading" className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-500">
          Members ({safeMembers.length})
        </h2>

        {safeMembers.length === 0 ? (
          <EmptyState
            title="No members"
            description="This team has no members yet. Click 'Grant Permissions' to give a user access."
          />
        ) : (
          <DataTable
            columns={memberColumns}
            data={safeMembers}
            rowKey={(m) => m.name}
            ariaLabel={`Members of team ${orgName}`}
          />
        )}
      </section>

      {/* Add Member dialog */}
      {modal.kind === "add-member" && (
        <GrantAccessDialog
          scopeType="organization"
          scope={orgName}
          availableRoles={isGlobalAdmin ? [...availableRoles] : []}
          availableUsers={[...availableUsers]}
          rolePairsFromGrants={derivedRolePairs}
          isLoading={isGranting}
          onGrant={handleAddMember}
          onCancel={() => setModal({ kind: "closed" })}
        />
      )}

      {/* Revoke / Remove member confirmation */}
      {modal.kind === "revoke" && (
        <ConfirmModal
          title="Remove Member"
          description={`Remove role "${extractRoleName(modal.roleName)}" from "${modal.member.name}" on team "${orgName}"? They will lose access to this team's resources.`}
          confirmLabel="Remove"
          destructive
          isLoading={isRevoking}
          onConfirm={() => handleRevokeMember(modal.member, modal.roleId, modal.roleName)}
          onCancel={() => setModal({ kind: "closed" })}
        />
      )}
    </div>
  );
};

// --- Sub-components ---

const Breadcrumb: React.FC<{ readonly orgName: string }> = ({ orgName }) => (
  <nav className="mb-4" aria-label="Breadcrumb">
    <ol className="flex items-center gap-2 text-sm text-gray-500">
      <li>
        <Link to="/teams" className="hover:text-gray-700">Teams</Link>
      </li>
      <li aria-hidden="true">/</li>
      <li className="font-medium text-gray-900">{orgName}</li>
    </ol>
  </nav>
);
