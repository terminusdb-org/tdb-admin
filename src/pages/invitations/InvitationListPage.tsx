import React, { useState } from "react";
import {
  useCreateUserMutation,
  useListOrganizationsQuery,
  useListOrganizationsForUserQuery,
  useListRolesQuery,
  useGrantCapabilityMutation,
  useAppSelector,
  selectIsGlobalAdmin,
} from "@/store";
import { isConflictError, extractApiMessage } from "@/utils/extractErrorStatus";

type WizardStep = 1 | 2 | 3;

interface WizardState {
  readonly username: string;
  readonly password: string;
  readonly team: string;
  readonly role: string;
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const values = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(values)
    .map((v) => chars[v % chars.length])
    .join("");
}

export const InvitationListPage: React.FC = () => {
  const isGlobalAdmin = useAppSelector(selectIsGlobalAdmin);
  const adminOrgQuery = useListOrganizationsQuery(undefined, { skip: !isGlobalAdmin });
  const userOrgQuery = useListOrganizationsForUserQuery(undefined, { skip: isGlobalAdmin });
  const { data: orgs } = isGlobalAdmin ? adminOrgQuery : userOrgQuery;
  const { data: roles } = useListRolesQuery();
  const [createUser, { isLoading: isCreatingUser }] = useCreateUserMutation();
  const [grantCapability, { isLoading: isGranting }] = useGrantCapabilityMutation();

  const [step, setStep] = useState<WizardStep>(1);
  const [wizardState, setWizardState] = useState<WizardState>({
    username: "",
    password: generatePassword(),
    team: "",
    role: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isProcessing = isCreatingUser || isGranting;

  const handleStep1Submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (wizardState.username.trim().length === 0) {
      setError("Username is required.");
      return;
    }

    setStep(2);
  };

  const handleStep2Submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (wizardState.team.length === 0) {
      setError("Please select a team.");
      return;
    }
    if (wizardState.role.length === 0) {
      setError("Please select a role.");
      return;
    }

    try {
      // Step 1: Create the user
      await createUser({
        username: wizardState.username.trim(),
        password: wizardState.password,
      }).unwrap();

      // Step 2: Grant capability on the selected team
      await grantCapability({
        scopeType: "organization",
        scope: wizardState.team,
        user: wizardState.username.trim(),
        roles: [wizardState.role],
      }).unwrap();

      setStep(3);
    } catch (err: unknown) {
      if (isConflictError(err)) {
        setError(
          `A user with the name "${wizardState.username.trim()}" already exists. Please choose a different username.`
        );
      } else {
        const apiMsg = extractApiMessage(err);
        setError(apiMsg ?? "Failed to create user or assign access. Please try again.");
      }
    }
  };

  const handleCopyCredentials = async () => {
    const text = `Username: ${wizardState.username.trim()}\nPassword: ${wizardState.password}\nTeam: ${wizardState.team}\nRole: ${wizardState.role}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setStep(1);
    setWizardState({
      username: "",
      password: generatePassword(),
      team: "",
      role: "",
    });
    setError(null);
    setCopied(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Invitations</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create and onboard new users with team and role assignment.
        </p>
      </div>

      <div className="max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {/* Progress indicator */}
        <div className="mb-6 flex items-center gap-2" aria-label="Wizard progress">
          {([1, 2, 3] as const).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  s === step
                    ? "bg-dfrntBlue-600 text-white"
                    : s < step
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-200 text-gray-500"
                }`}
                aria-current={s === step ? "step" : undefined}
              >
                {s < step ? "✓" : s}
              </div>
              {s < 3 && (
                <div
                  className={`h-0.5 w-8 ${
                    s < step ? "bg-green-300" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200"
          >
            {error}
          </div>
        )}

        {/* Step 1: User details */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit}>
            <h2 className="mb-4 text-base font-medium text-gray-900">
              Step 1: User Details
            </h2>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="inv-new-member"
                  className="block text-sm font-medium text-gray-700"
                >
                  Username
                </label>
                <input
                  id="inv-new-member"
                  type="text"
                  value={wizardState.username}
                  onChange={(e) =>
                    setWizardState({ ...wizardState, username: e.target.value })
                  }
                  autoComplete="off"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 sm:text-sm"
                  required
                  autoFocus
                  placeholder="new-user"
                />
              </div>
              <div>
                <label
                  htmlFor="inv-initial-credential"
                  className="block text-sm font-medium text-gray-700"
                >
                  Temporary Password{" "}
                  <span className="text-gray-400">(auto-generated)</span>
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id="inv-initial-credential"
                    type="text"
                    value={wizardState.password}
                    readOnly
                    autoComplete="new-password"
                    className="block w-full rounded-md border-gray-300 bg-gray-50 font-data text-sm shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setWizardState({ ...wizardState, password: generatePassword() })
                    }
                    className="rounded-md px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                    title="Regenerate password"
                  >
                    ↻
                  </button>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full rounded-md bg-dfrntBlue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 transition-colors"
                >
                  Next: Assign Team
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Step 2: Team + Role */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit}>
            <h2 className="mb-4 text-base font-medium text-gray-900">
              Step 2: Team &amp; Role
            </h2>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="inv-team"
                  className="block text-sm font-medium text-gray-700"
                >
                  Team
                </label>
                <select
                  id="inv-team"
                  value={wizardState.team}
                  onChange={(e) =>
                    setWizardState({ ...wizardState, team: e.target.value })
                  }
                  disabled={isProcessing}
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
                  htmlFor="inv-role"
                  className="block text-sm font-medium text-gray-700"
                >
                  Role
                </label>
                <select
                  id="inv-role"
                  value={wizardState.role}
                  onChange={(e) =>
                    setWizardState({ ...wizardState, role: e.target.value })
                  }
                  disabled={isProcessing}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
                  required
                >
                  <option value="">Select a role…</option>
                  {roles?.map((role) => (
                    <option key={role.name} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={isProcessing}
                  className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 rounded-md bg-dfrntBlue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 disabled:bg-dfrntBlue-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? "Creating…" : "Create & Assign"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div>
            <h2 className="mb-4 text-base font-medium text-gray-900">
              Step 3: Done
            </h2>
            <div className="rounded-md bg-green-50 px-4 py-3 border border-green-200">
              <p className="text-sm font-medium text-green-800">
                User created successfully
              </p>
              <p className="mt-1 text-sm text-green-700">
                <strong>{wizardState.username.trim()}</strong> has been created
                with <strong>{wizardState.role}</strong> on team{" "}
                <strong>{wizardState.team}</strong>.
              </p>
            </div>

            <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                Credentials (share securely)
              </p>
              <div className="space-y-1 font-data text-sm text-gray-800">
                <p>
                  <span className="text-gray-500">Username:</span>{" "}
                  {wizardState.username.trim()}
                </p>
                <p>
                  <span className="text-gray-500">Password:</span>{" "}
                  {wizardState.password}
                </p>
                <p>
                  <span className="text-gray-500">Team:</span>{" "}
                  {wizardState.team}
                </p>
                <p>
                  <span className="text-gray-500">Role:</span>{" "}
                  {wizardState.role}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="mt-3 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 shadow-sm hover:bg-gray-50 transition-colors"
              >
                {copied ? "Copied!" : "Copy Credentials"}
              </button>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 rounded-md bg-dfrntBlue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 transition-colors"
              >
                Create Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
