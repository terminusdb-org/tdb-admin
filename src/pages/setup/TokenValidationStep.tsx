import React, { useState, useEffect, useRef, useCallback } from "react";
import type { TokenErrorKind } from "./types";
import { ioValidateToken } from "./useBootstrapApi";
import { config } from "@/config";

interface TokenValidationStepProps {
  readonly tokenFromUrl: string | null;
  readonly onComplete: () => void;
}

const ERROR_MESSAGES: Record<TokenErrorKind, { title: string; variant: "red" | "amber" | "blue" }> = {
  invalid: {
    title: "This token is not valid. Check you copied the full token from the Azure Portal deployment outputs.",
    variant: "red",
  },
  expired: {
    title: "This setup token has expired (valid for 24 hours after deployment). To get a new token, redeploy the managed application from Azure Marketplace.",
    variant: "amber",
  },
  locked: {
    title: "Too many failed attempts. Setup is locked for 1 hour. If you believe this is an error, contact DFRNT support.",
    variant: "red",
  },
  network: {
    title: "Cannot reach the server. Check the application is running and try again.",
    variant: "red",
  },
  "already-bootstrapped": {
    title: "This system has already been set up. Go to the login page to sign in.",
    variant: "blue",
  },
};

function bannerClasses(variant: "red" | "amber" | "blue"): string {
  switch (variant) {
    case "red":
      return "bg-red-50 border-red-200 text-red-800";
    case "amber":
      return "bg-amber-50 border-amber-200 text-amber-800";
    case "blue":
      return "bg-dfrntBlue-50 border-dfrntBlue-200 text-dfrntBlue-800";
    default:
      throw new Error(`Unknown variant: ${variant}`);
  }
}

export const TokenValidationStep: React.FC<TokenValidationStepProps> = ({
  tokenFromUrl,
  onComplete,
}) => {
  const [manualToken, setManualToken] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<TokenErrorKind | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoValidated = useRef(false);

  const validate = useCallback(async (token: string) => {
    setIsValidating(true);
    setError(null);

    const result = await ioValidateToken(token);

    if (result.ok) {
      onComplete();
    } else {
      setError(result.error);
      setIsValidating(false);
      // Re-focus input on error (if manual mode)
      if (!tokenFromUrl) {
        inputRef.current?.focus();
      }
    }
  }, [onComplete, tokenFromUrl]);

  // Auto-validate if token is in URL
  useEffect(() => {
    if (tokenFromUrl && !autoValidated.current) {
      autoValidated.current = true;
      validate(tokenFromUrl);
    }
  }, [tokenFromUrl, validate]);

  const handleManualSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (manualToken.trim().length === 0) {
      setError("invalid");
      return;
    }
    validate(manualToken.trim());
  };

  // Auto-validate mode (token from URL)
  if (tokenFromUrl && isValidating && !error) {
    return (
      <div className="text-center" aria-live="polite">
        <h2 className="text-lg font-semibold text-gray-900">
          Verifying your setup token...
        </h2>
        <div className="mt-6 flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-dfrntBlue-200 border-t-dfrntBlue-600" />
        </div>
        <p className="mt-4 text-sm text-gray-600">
          Confirming you are the authorised deployer. This takes a moment.
        </p>
      </div>
    );
  }

  // Error for "already bootstrapped" — special case with link
  if (error === "already-bootstrapped") {
    return (
      <div className="text-center">
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-dfrntBlue-200 bg-dfrntBlue-50 px-4 py-3 text-sm text-dfrntBlue-800"
        >
          {ERROR_MESSAGES["already-bootstrapped"].title}
        </div>
        <a
          href={`${config.basePath}/login`}
          className="mt-6 inline-flex items-center gap-1 rounded-lg bg-dfrntBlue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 transition-colors"
        >
          Go to Login
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    );
  }

  // Error for "locked" — no input shown, just countdown
  if (error === "locked") {
    return (
      <div className="text-center">
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {ERROR_MESSAGES.locked.title}
        </div>
      </div>
    );
  }

  // Manual entry mode
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">
        Welcome to DFRNT Platform Setup
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        To begin, enter the setup token from your Azure deployment outputs.
      </p>

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${bannerClasses(ERROR_MESSAGES[error].variant)}`}
        >
          {ERROR_MESSAGES[error].title}
          {error === "network" && (
            <button
              type="button"
              onClick={() => validate(manualToken.trim())}
              className="mt-2 block text-sm font-medium underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleManualSubmit} className="mt-6">
        <div>
          <label
            htmlFor="setup-token"
            className="block text-sm font-medium text-gray-700"
          >
            Setup token
          </label>
          <input
            ref={inputRef}
            id="setup-token"
            type="text"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            disabled={isValidating}
            className="mt-1 block w-full rounded-md border-gray-300 font-mono tracking-wider shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100 sm:text-sm"
            placeholder="a7b3c9d4e5f6..."
            autoFocus
            aria-describedby="token-hint"
          />
          <p id="token-hint" className="mt-1.5 text-xs text-gray-500">
            Find this in Azure Portal → Managed Application → Outputs → &quot;Setup URL&quot;
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={isValidating || manualToken.trim().length === 0}
            className="inline-flex items-center gap-1 rounded-lg bg-dfrntBlue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 disabled:bg-dfrntBlue-400 disabled:cursor-not-allowed transition-colors"
          >
            {isValidating ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Verifying…
              </>
            ) : (
              <>
                Verify Token
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
