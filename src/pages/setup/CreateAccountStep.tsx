import React, { useState } from "react";
import type { PasswordStrength, AccountErrorKind } from "./types";
import { ioCreateAdmin } from "./useBootstrapApi";

interface CreateAccountStepProps {
  readonly onComplete: () => void;
}

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;

function evaluatePasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) return "weak";
  if (password.length < 8) return "weak";
  if (password.length < 12) return "fair";

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const variety = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;

  if (password.length >= 16 && variety >= 3) return "strong";
  if (password.length >= 12 && variety >= 2) return "good";
  return "fair";
}

function strengthMeterConfig(strength: PasswordStrength): {
  width: string;
  color: string;
  label: string;
} {
  switch (strength) {
    case "weak":
      return { width: "w-1/4", color: "bg-red-500", label: "Weak" };
    case "fair":
      return { width: "w-2/4", color: "bg-amber-500", label: "Fair" };
    case "good":
      return { width: "w-3/4", color: "bg-dfrntBlue-500", label: "Good" };
    case "strong":
      return { width: "w-full", color: "bg-green-500", label: "Strong" };
    default:
      throw new Error(`Unknown strength: ${strength}`);
  }
}

export const CreateAccountStep: React.FC<CreateAccountStepProps> = ({ onComplete }) => {
  const [username, setUsername] = useState("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<AccountErrorKind | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    confirm?: string;
  }>({});

  const strength = evaluatePasswordStrength(password);
  const meter = strengthMeterConfig(strength);

  const validateForm = (): boolean => {
    const errors: typeof fieldErrors = {};

    if (!USERNAME_PATTERN.test(username)) {
      errors.username = "Username must be 2–64 characters, lowercase letters, numbers, dots, hyphens, or underscores.";
    }

    if (email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Please enter a valid email address.";
    }

    if (password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }

    if (password !== confirmPassword) {
      errors.confirm = "Passwords do not match.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!validateForm()) return;

    setIsSubmitting(true);

    const result = await ioCreateAdmin({
      username: username.trim(),
      password,
      email: email.trim() || undefined,
    });

    if (result.ok) {
      onComplete();
    } else {
      setError(result.error);
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">
        Create your administrator account
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        This will be the primary admin for your DFRNT platform. Choose a strong password — you&apos;ll add two-factor authentication in the next step.
      </p>

      {error === "server" && (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          Could not create account. Please try again.
        </div>
      )}

      {error === "username-taken" && (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          This username already exists. Choose a different username.
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* Username */}
        <div>
          <label htmlFor="setup-username" className="block text-sm font-medium text-gray-700">
            Username
          </label>
          <input
            id="setup-username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setFieldErrors((prev) => ({ ...prev, username: undefined }));
            }}
            disabled={isSubmitting}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
            aria-describedby="username-hint"
            autoFocus
          />
          <p id="username-hint" className="mt-1 text-xs text-gray-500">
            This will be your login name.
          </p>
          {fieldErrors.username && (
            <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.username}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="setup-email" className="block text-sm font-medium text-gray-700">
            Email <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="setup-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            disabled={isSubmitting}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
            placeholder="admin@company.com"
            aria-describedby="email-hint"
          />
          <p id="email-hint" className="mt-1 text-xs text-gray-500">
            For account recovery and notifications.
          </p>
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.email}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="setup-password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <div className="relative mt-1">
            <input
              id="setup-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              disabled={isSubmitting}
              className="block w-full rounded-md border-gray-300 pr-10 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.password}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="setup-confirm" className="block text-sm font-medium text-gray-700">
            Confirm password
          </label>
          <div className="relative mt-1">
            <input
              id="setup-confirm"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
              }}
              disabled={isSubmitting}
              className="block w-full rounded-md border-gray-300 pr-10 shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
            >
              {showConfirm ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>
          {fieldErrors.confirm && (
            <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.confirm}</p>
          )}
        </div>

        {/* Strength Meter */}
        {password.length > 0 && (
          <div aria-live="polite">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Strength:</span>
              <div className="h-2 flex-1 rounded-full bg-gray-200">
                <div
                  className={`h-2 rounded-full transition-all ${meter.width} ${meter.color}`}
                />
              </div>
              <span className="text-xs font-medium text-gray-700">{meter.label}</span>
            </div>
            {strength === "weak" && (
              <p className="mt-1 text-xs text-amber-600">
                We recommend a password of 12+ characters with a mix of letters, numbers, and symbols.
              </p>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-dfrntBlue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 disabled:bg-dfrntBlue-400 disabled:cursor-not-allowed transition-colors sm:w-auto sm:ml-auto sm:block"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Creating account…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                Create Account
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
