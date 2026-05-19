import React from "react";
import {
  useGetSyncStatusQuery,
  useCreateMissingGroupMutation,
  useCreateMissingOrgMutation,
} from "@/store/api/syncApi";
import type { TeamSyncEntry } from "@/store/api/syncApi";
import { Badge, ErrorState, LoadingState } from "@/components/shared";

// --- Sync status derivation (pure) ---

type TeamSyncState = "synced" | "missing-group" | "missing-org" | "discrepancy";

function deriveSyncState(team: TeamSyncEntry): TeamSyncState {
  if (!team.tdbOrgExists) {
    return "missing-org";
  }
  if (!team.openBaoGroupExists) {
    return "missing-group";
  }
  if (team.discrepancies.length > 0) {
    return "discrepancy";
  }
  return "synced";
}

// --- Sub-components ---

interface SummaryBarProps {
  readonly synced: number;
  readonly discrepancies: number;
}

const SummaryBar: React.FC<SummaryBarProps> = ({ synced, discrepancies }) => (
  <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-6 py-4">
    <div className="flex items-center gap-2">
      <span className="inline-block h-3 w-3 rounded-full bg-green-500" aria-hidden="true" />
      <span className="text-sm font-medium text-gray-700">
        {synced} {synced === 1 ? "team" : "teams"} synced
      </span>
    </div>
    <div className="h-4 w-px bg-gray-300" aria-hidden="true" />
    <div className="flex items-center gap-2">
      <span className="inline-block h-3 w-3 rounded-full bg-amber-500" aria-hidden="true" />
      <span className="text-sm font-medium text-gray-700">
        {discrepancies} {discrepancies === 1 ? "discrepancy" : "discrepancies"} found
      </span>
    </div>
  </div>
);

interface TeamRowProps {
  readonly team: TeamSyncEntry;
  readonly onCreateGroup: (teamName: string) => void;
  readonly onCreateOrg: (teamName: string) => void;
  readonly isRemediating: boolean;
}

const TeamRow: React.FC<TeamRowProps> = ({
  team,
  onCreateGroup,
  onCreateOrg,
  isRemediating,
}) => {
  const syncState = deriveSyncState(team);

  return (
    <tr className="border-b border-gray-100 last:border-b-0">
      {/* Team name */}
      <td className="px-6 py-4">
        <span className="text-sm font-medium text-gray-900">{team.name}</span>
        {team.memberCount > 0 && (
          <span className="ml-2 text-xs text-gray-500">
            ({team.memberCount} {team.memberCount === 1 ? "member" : "members"})
          </span>
        )}
      </td>

      {/* TDB Org status */}
      <td className="px-6 py-4 text-center">
        {team.tdbOrgExists ? (
          <Badge label="Exists" variant="success" />
        ) : (
          <Badge label="Missing" variant="danger" />
        )}
      </td>

      {/* OpenBao Group status */}
      <td className="px-6 py-4 text-center">
        {team.openBaoGroupExists ? (
          <Badge label="Exists" variant="success" />
        ) : (
          <Badge label="Missing" variant="danger" />
        )}
      </td>

      {/* Status / discrepancies */}
      <td className="px-6 py-4">
        {syncState === "synced" && (
          <Badge label="Synced" variant="success" />
        )}
        {syncState === "missing-group" && (
          <Badge label="Group missing" variant="warning" />
        )}
        {syncState === "missing-org" && (
          <Badge label="Org missing" variant="warning" />
        )}
        {syncState === "discrepancy" && (
          <div className="space-y-1">
            <Badge label="Discrepancy" variant="warning" />
            <ul className="mt-1 list-inside list-disc text-xs text-gray-600">
              {team.discrepancies.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        )}
      </td>

      {/* Actions */}
      <td className="px-6 py-4 text-right">
        {syncState === "missing-group" && (
          <button
            type="button"
            disabled={isRemediating}
            onClick={() => onCreateGroup(team.name)}
            className="rounded-md bg-dfrntBlue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-dfrntBlue-700 focus:outline-none focus:ring-2 focus:ring-dfrntBlue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            aria-label={`Create missing OpenBao group for ${team.name}`}
          >
            {isRemediating ? "Creating…" : "Create Group"}
          </button>
        )}
        {syncState === "missing-org" && (
          <button
            type="button"
            disabled={isRemediating}
            onClick={() => onCreateOrg(team.name)}
            className="rounded-md bg-dfrntBlue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-dfrntBlue-700 focus:outline-none focus:ring-2 focus:ring-dfrntBlue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            aria-label={`Create missing TDB organisation for ${team.name}`}
          >
            {isRemediating ? "Creating…" : "Create Org"}
          </button>
        )}
        {syncState === "synced" && (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
    </tr>
  );
};

// --- Main page component ---

export const TeamSyncPage: React.FC = () => {
  const { data, isLoading, isError, error, refetch } = useGetSyncStatusQuery();
  const [createGroup, { isLoading: isCreatingGroup }] = useCreateMissingGroupMutation();
  const [createOrg, { isLoading: isCreatingOrg }] = useCreateMissingOrgMutation();

  const handleCreateGroup = async (teamName: string) => {
    try {
      await createGroup({ teamName }).unwrap();
    } catch {
      // Error handled by RTK Query — refetch will show updated state
    }
  };

  const handleCreateOrg = async (teamName: string) => {
    try {
      await createOrg({ teamName }).unwrap();
    } catch {
      // Error handled by RTK Query — refetch will show updated state
    }
  };

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Team Sync</h1>
          <p className="mt-1 text-sm text-gray-600">
            Comparison of TDB organisations and OpenBao groups.
          </p>
        </div>
        <LoadingState rows={6} />
      </div>
    );
  }

  if (isError) {
    const errorMsg = error && "status" in error
      ? `Server returned ${error.status}`
      : "Cannot reach the mediation API.";

    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Team Sync</h1>
          <p className="mt-1 text-sm text-gray-600">
            Comparison of TDB organisations and OpenBao groups.
          </p>
        </div>
        <ErrorState
          title="Failed to load sync status"
          message={errorMsg}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (!data || data.teams.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Team Sync</h1>
          <p className="mt-1 text-sm text-gray-600">
            Comparison of TDB organisations and OpenBao groups.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm font-medium text-gray-700">No teams found</p>
          <p className="mt-1 text-sm text-gray-500">
            Create teams in TDB or OpenBao to see their sync status here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Team Sync</h1>
          <p className="mt-1 text-sm text-gray-600">
            Comparison of TDB organisations and OpenBao groups.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-dfrntBlue-500 focus:ring-offset-2 transition-colors"
          aria-label="Refresh sync status"
        >
          Refresh
        </button>
      </div>

      {/* Summary bar */}
      <div className="mb-6">
        <SummaryBar
          synced={data.summary.synced}
          discrepancies={data.summary.discrepancies}
        />
      </div>

      {/* Comparison table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full" aria-label="Team sync comparison table">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                Team
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                TDB Org
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                OpenBao Group
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {data.teams.map((team) => (
              <TeamRow
                key={team.name}
                team={team}
                onCreateGroup={handleCreateGroup}
                onCreateOrg={handleCreateOrg}
                isRemediating={isCreatingGroup || isCreatingOrg}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
