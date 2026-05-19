import React, { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import type { TOTPSecretData, TOTPErrorKind } from "./types";
import { ioGenerateTOTP, ioVerifyTOTP } from "./useBootstrapApi";

interface TOTPEnrolmentStepProps {
  readonly onComplete: () => void;
}

const MAX_ATTEMPTS = 5;

function digitInputClasses(hasError: boolean): string {
  const base = "h-14 w-12 rounded-lg border-2 text-center text-2xl font-mono focus:outline-none focus:ring-2 focus:ring-dfrntBlue-200 transition-colors";
  if (hasError) {
    return `${base} border-red-500 text-red-900`;
  }
  return `${base} border-gray-300 focus:border-dfrntBlue-500 text-gray-900`;
}

export const TOTPEnrolmentStep: React.FC<TOTPEnrolmentStepProps> = ({ onComplete }) => {
  const [totpData, setTotpData] = useState<TOTPSecretData | null>(null);
  const [qrSvg, setQrSvg] = useState<string>("");
  const [isLoadingQR, setIsLoadingQR] = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [digits, setDigits] = useState<ReadonlyArray<string>>(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<TOTPErrorKind | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS);
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState(false);

  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  const generateSecret = useCallback(async () => {
    setIsLoadingQR(true);
    setQrError(false);
    setQrSvg("");

    const result = await ioGenerateTOTP();
    if (result.ok) {
      setTotpData(result.data);
      try {
        const svg = await QRCode.toString(result.data.uri, {
          type: "svg",
          width: 200,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        });
        setQrSvg(svg);
      } catch {
        // QR generation failed client-side — show manual entry instead
        setQrSvg("");
      }
    } else {
      setQrError(true);
    }
    setIsLoadingQR(false);
  }, []);

  useEffect(() => {
    generateSecret();
  }, [generateSecret]);

  const handleDigitChange = (index: number, value: string) => {
    // Only accept single digits
    const digit = value.replace(/\D/g, "").slice(-1);

    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError(null);

    // Auto-advance to next input
    if (digit.length === 1 && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && digits[index] === "" && index > 0) {
      // Move focus back on backspace when current is empty
      digitRefs.current[index - 1]?.focus();
      const newDigits = [...digits];
      newDigits[index - 1] = "";
      setDigits(newDigits);
    }
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    event.preventDefault();
    const pastedText = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);

    if (pastedText.length > 0) {
      const newDigits = [...digits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pastedText[i] || "";
      }
      setDigits(newDigits);
      setError(null);

      // Focus the last filled digit or the next empty one
      const focusIndex = Math.min(pastedText.length, 5);
      digitRefs.current[focusIndex]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = digits.join("");
    if (code.length !== 6) return;

    setIsVerifying(true);
    setError(null);

    const result = await ioVerifyTOTP(code);

    if (result.ok) {
      onComplete();
    } else {
      setError(result.error);
      setAttemptsRemaining((prev) => prev - 1);
      setIsVerifying(false);
      // Clear and re-focus
      setDigits(["", "", "", "", "", ""]);
      digitRefs.current[0]?.focus();
    }
  };

  const handleCopySecret = async () => {
    if (!totpData || !navigator.clipboard) return;
    await navigator.clipboard.writeText(totpData.secret.replace(/\s/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codeComplete = digits.every((d) => d.length === 1);

  // QR loading state
  if (isLoadingQR) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Secure your account
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Two-factor authentication protects your admin account from unauthorised access, even if your password is compromised.
        </p>
        <div className="mt-8 flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-dfrntBlue-200 border-t-dfrntBlue-600" />
          <p className="mt-4 text-sm text-gray-500">Generating your authentication code…</p>
        </div>
      </div>
    );
  }

  // QR generation error
  if (qrError) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Secure your account
        </h2>
        <div
          role="alert"
          aria-live="assertive"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          Could not generate authentication code. Please try again.
        </div>
        <button
          type="button"
          onClick={generateSecret}
          className="mt-4 rounded-lg bg-dfrntBlue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">
        Secure your account
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        Two-factor authentication protects your admin account from unauthorised access, even if your password is compromised.
      </p>

      <div className="mt-6 space-y-6">
        {/* Step 1: Install app */}
        <div className="flex gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-dfrntBlue-100 text-xs font-bold text-dfrntBlue-700">
            1
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Install an authenticator app</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Google Authenticator, Microsoft Authenticator, Authy, 1Password, or Bitwarden.
            </p>
          </div>
        </div>

        {/* Step 2: QR Code */}
        <div className="flex gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-dfrntBlue-100 text-xs font-bold text-dfrntBlue-700">
            2
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Scan this QR code</p>
            <div className="mt-3 inline-block rounded-lg border border-gray-200 bg-white p-4">
              {qrSvg ? (
                <div
                  className="h-48 w-48"
                  aria-label="QR code for authenticator app setup"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : (
                <div
                  className="flex h-48 w-48 items-center justify-center bg-gray-50 text-xs text-gray-500"
                  aria-label="QR code for authenticator app setup"
                >
                  <p>QR code unavailable — use manual entry below</p>
                </div>
              )}
            </div>

            {/* Manual entry toggle */}
            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              className="mt-3 text-sm text-dfrntBlue-600 hover:text-dfrntBlue-700 font-medium"
            >
              {showManual ? "Hide manual code ▴" : "Can't scan? Enter code manually ▾"}
            </button>

            {showManual && totpData && (
              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-600">Enter this code in your authenticator app:</p>
                <div className="mt-2 flex items-center gap-2">
                  <code
                    className="flex-1 font-mono text-sm tracking-widest text-gray-900"
                    aria-label="Manual TOTP secret code"
                  >
                    {totpData.secret}
                  </code>
                  {typeof navigator !== "undefined" && navigator.clipboard && (
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="shrink-0 rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                      aria-label="Copy secret to clipboard"
                    >
                      {copied ? "Copied!" : "📋"}
                    </button>
                  )}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  <p>Account name: {totpData.accountName}</p>
                  <p>Issuer: {totpData.issuer}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Enter code */}
        <div className="flex gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-dfrntBlue-100 text-xs font-bold text-dfrntBlue-700">
            3
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Enter the 6-digit code from your app</p>

            <div className="mt-3 flex gap-2" onPaste={handlePaste}>
              {digits.map((digit, index) => (
                <React.Fragment key={index}>
                  <input
                    ref={(el) => { digitRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(index, e)}
                    disabled={isVerifying}
                    className={digitInputClasses(error !== null)}
                    aria-label={`Digit ${index + 1} of 6`}
                  />
                  {index === 2 && <div className="w-2" aria-hidden="true" />}
                </React.Fragment>
              ))}
            </div>

            {/* Error messages */}
            {error === "wrong-code" && (
              <p className="mt-2 text-xs text-red-600" role="alert" aria-live="assertive">
                Incorrect code. Check your authenticator app and try again.
                {attemptsRemaining > 0 && ` (${attemptsRemaining} attempts remaining)`}
              </p>
            )}
            {error === "code-expired" && (
              <p className="mt-2 text-xs text-red-600" role="alert" aria-live="assertive">
                Code expired. Wait for a new code to appear in your app (refreshes every 30 seconds).
              </p>
            )}
            {error === "too-many-attempts" && (
              <div className="mt-2" role="alert" aria-live="assertive">
                <p className="text-xs text-red-600">
                  Too many incorrect codes. Please re-scan the QR code and ensure your device clock is correct.
                </p>
                <button
                  type="button"
                  onClick={generateSecret}
                  className="mt-2 text-xs font-medium text-dfrntBlue-600 hover:text-dfrntBlue-700"
                >
                  Generate New Code
                </button>
              </div>
            )}
            {attemptsRemaining <= 2 && attemptsRemaining > 0 && error === "wrong-code" && (
              <p className="mt-1 text-xs text-amber-600">
                Tip: Make sure your device clock is set to automatic. TOTP codes are time-based.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Submit button */}
      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={handleVerify}
          disabled={!codeComplete || isVerifying}
          className="inline-flex items-center gap-1 rounded-lg bg-dfrntBlue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 disabled:bg-dfrntBlue-400 disabled:cursor-not-allowed transition-colors"
        >
          {isVerifying ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Verifying…
            </>
          ) : (
            <>
              Verify & Complete Setup
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
