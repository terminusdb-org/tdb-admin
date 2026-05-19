import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  useListUsersQuery,
  useChangePasswordMutation,
  useAppSelector,
  selectIsGlobalAdmin,
} from "@/store";

type FormStatus = "idle" | "loading" | "success" | "error";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Password reset/change screen — allows admin to reset any user's password.
 *
 * Pre-fills the username from URL query params (e.g., ?user=alice)
 * when navigating from the user list "Reset Password" action.
 */
export const PasswordResetPage: React.FC = () => {
  const navigate = useNavigate();
  const isGlobalAdmin = useAppSelector(selectIsGlobalAdmin);
  const [searchParams] = useSearchParams();
  const prefilledUser = searchParams.get("user") ?? "";

  useEffect(() => {
    if (!isGlobalAdmin) {
      navigate("/teams", { replace: true });
    }
  }, [isGlobalAdmin, navigate]);

  const { data: users, isLoading: isLoadingUsers } = useListUsersQuery();
  const [changePassword] = useChangePasswordMutation();

  const [selectedUser, setSelectedUser] = useState(prefilledUser);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ReadonlyArray<string>>([]);

  const passwordRef = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  // Update selected user when navigating with query param
  useEffect(() => {
    if (prefilledUser) {
      setSelectedUser(prefilledUser);
    }
  }, [prefilledUser]);

  // Focus management: move focus to success message for screen readers
  useEffect(() => {
    if (status === "success") {
      successRef.current?.focus();
    }
  }, [status]);

  function validate(): ReadonlyArray<string> {
    const errors: Array<string> = [];

    if (selectedUser.trim().length === 0) {
      errors.push("Please select a principal.");
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      errors.push(`Credential must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (newPassword !== confirmPassword) {
      errors.push("Credentials do not match.");
    }

    return errors;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setValidationErrors([]);

    const errors = validate();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setStatus("loading");

    try {
      await changePassword({
        username: selectedUser.trim(),
        password: newPassword,
      }).unwrap();

      setStatus("success");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setStatus("error");
      setErrorMessage(
        "Failed to change credential. The principal may not exist or the server may be unreachable."
      );
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setErrorMessage(null);
    setValidationErrors([]);
    setNewPassword("");
    setConfirmPassword("");
    passwordRef.current?.focus();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Credential Reset</h1>
        <p className="mt-1 text-sm text-gray-600">
          Reset a principal&apos;s credential on the TerminusDB instance.
        </p>
      </div>

      <div className="max-w-lg rounded-lg border border-gray-200 bg-white px-3 py-4 sm:p-6 shadow-sm">
        {status === "success" && (
          <div
            ref={successRef}
            role="alert"
            aria-live="polite"
            tabIndex={-1}
            className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 border border-green-200"
          >
            <p className="font-medium">Credential changed successfully</p>
            <p className="mt-1">
              The credential for{" "}
              <span className="font-medium">{selectedUser}</span> has been
              updated.
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="mt-2 text-sm font-medium text-green-700 underline hover:text-green-900"
            >
              Reset another credential
            </button>
          </div>
        )}

        {status !== "success" && (
          <form onSubmit={handleSubmit} aria-labelledby="credential-reset-heading">
            <h2 id="credential-reset-heading" className="sr-only">
              Credential reset form
            </h2>

            {errorMessage && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200"
              >
                {errorMessage}
              </div>
            )}

            {validationErrors.length > 0 && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-4 rounded-md bg-yellow-50 px-3 py-2 border border-yellow-200"
              >
                <ul className="list-disc pl-4 text-sm text-yellow-800">
                  {validationErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-4">
              {/* Principal selector */}
              <div>
                <label
                  htmlFor="tdb-principal-select"
                  className="block text-sm font-medium text-gray-700"
                >
                  Principal
                </label>
                {isLoadingUsers ? (
                  <div className="mt-1 h-9 w-full animate-pulse rounded-md bg-gray-200" />
                ) : (
                  <select
                    id="tdb-principal-select"
                    name="tdb-principal-select"
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    disabled={status === "loading"}
                    autoComplete="off"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
                    required
                  >
                    <option value="">Select a principal…</option>
                    {users?.map((user) => (
                      <option key={user.name} value={user.name}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* New credential */}
              <div>
                <label
                  htmlFor="tdb-reset-credential"
                  className="block text-sm font-medium text-gray-700"
                >
                  New Credential
                </label>
                <input
                  ref={passwordRef}
                  id="tdb-reset-credential"
                  name="tdb-reset-credential"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={status === "loading"}
                  minLength={MIN_PASSWORD_LENGTH}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
                  required
                  aria-describedby="credential-hint"
                />
                <p id="credential-hint" className="mt-1 text-xs text-gray-500">
                  Minimum {MIN_PASSWORD_LENGTH} characters.
                </p>
              </div>

              {/* Confirm credential */}
              <div>
                <label
                  htmlFor="tdb-confirm-credential"
                  className="block text-sm font-medium text-gray-700"
                >
                  Confirm Credential
                </label>
                <input
                  id="tdb-confirm-credential"
                  name="tdb-confirm-credential"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={status === "loading"}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
                  required
                />
                {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                  <p className="mt-1 text-xs text-red-600" role="alert">
                    Credentials do not match.
                  </p>
                )}
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full rounded-md bg-dfrntBlue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 focus:outline-none focus:ring-2 focus:ring-dfrntBlue-500 focus:ring-offset-2 disabled:bg-dfrntBlue-400 disabled:cursor-not-allowed transition-colors"
                >
                  {status === "loading" ? "Changing Credential…" : "Change Credential"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
