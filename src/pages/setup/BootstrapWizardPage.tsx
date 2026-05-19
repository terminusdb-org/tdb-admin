import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { config } from "@/config";
import type { WizardStep, BootstrapStatus } from "./types";
import { ioCheckBootstrapStatus, ioCompleteBootstrap } from "./useBootstrapApi";
import { StepIndicator } from "./StepIndicator";
import { TokenValidationStep } from "./TokenValidationStep";
import { HealthCheckStep } from "./HealthCheckStep";
import { CreateAccountStep } from "./CreateAccountStep";
import { TOTPEnrolmentStep } from "./TOTPEnrolmentStep";
import { SetupCompleteStep } from "./SetupCompleteStep";

type PageState =
  | { kind: "loading" }
  | { kind: "wizard"; step: WizardStep }
  | { kind: "already-complete" }
  | { kind: "unavailable" };

/**
 * Bootstrap Wizard Page — `/setup`
 *
 * Forward-only 5-step wizard for first-time platform setup.
 * Detects resume state from backend on mount.
 * Route only accessible in bootstrap mode.
 */
export const BootstrapWizardPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token");

  const [pageState, setPageState] = useState<PageState>({ kind: "loading" });
  const [username] = useState("admin");

  // Detect bootstrap status on mount (for resume logic)
  useEffect(() => {
    async function checkStatus() {
      try {
        const status: BootstrapStatus = await ioCheckBootstrapStatus();

        switch (status.mode) {
          case "bootstrap":
            setPageState({ kind: "wizard", step: status.resumeStep });
            break;
          case "complete":
            setPageState({ kind: "already-complete" });
            break;
          case "unavailable":
            setPageState({ kind: "unavailable" });
            break;
          default:
            throw new Error("Unknown bootstrap mode");
        }
      } catch {
        // If we can't check status, default to starting the wizard
        setPageState({ kind: "wizard", step: 0 });
      }
    }

    checkStatus();
  }, []);

  const advanceStep = useCallback(() => {
    setPageState((prev) => {
      if (prev.kind !== "wizard") return prev;
      const nextStep = Math.min(prev.step + 1, 4) as WizardStep;
      return { kind: "wizard", step: nextStep };
    });
  }, []);

  const handleAccountCreated = useCallback(() => {
    // Could capture the username from the form if needed
    advanceStep();
  }, [advanceStep]);

  const handleTOTPComplete = useCallback(async () => {
    // Finalise bootstrap (locks setup mode)
    await ioCompleteBootstrap();
    advanceStep();
  }, [advanceStep]);

  // Loading state
  if (pageState.kind === "loading") {
    return (
      <BootstrapShell currentStep={0}>
        <div className="flex flex-col items-center py-8">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-dfrntBlue-200 border-t-dfrntBlue-600" />
          <p className="mt-4 text-sm text-gray-500">Loading setup wizard…</p>
        </div>
      </BootstrapShell>
    );
  }

  // Already complete state
  if (pageState.kind === "already-complete") {
    return (
      <BootstrapShell currentStep={4}>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Setup Already Complete</h2>
          <p className="mt-3 text-sm text-gray-600">
            This platform has already been configured. The setup wizard is no longer available.
          </p>
          <p className="mt-2 text-sm text-gray-600">
            If you need to manage users or settings, sign in to the admin panel.
          </p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <a
              href={`${config.basePath}/login`}
              className="rounded-lg bg-dfrntBlue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 transition-colors"
            >
              Go to Login
            </a>
            <a
              href="https://docs.dfrnt.com/setup"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              View Documentation
            </a>
          </div>
        </div>
      </BootstrapShell>
    );
  }

  // Unavailable state
  if (pageState.kind === "unavailable") {
    return (
      <BootstrapShell currentStep={0}>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Setup Unavailable</h2>
          <p className="mt-3 text-sm text-gray-600">
            The setup wizard is not available at this time.
          </p>
        </div>
      </BootstrapShell>
    );
  }

  // Active wizard
  const { step } = pageState;

  return (
    <BootstrapShell currentStep={step}>
      {step === 0 && (
        <TokenValidationStep
          tokenFromUrl={tokenFromUrl}
          onComplete={advanceStep}
        />
      )}
      {step === 1 && (
        <HealthCheckStep onComplete={advanceStep} />
      )}
      {step === 2 && (
        <CreateAccountStep onComplete={handleAccountCreated} />
      )}
      {step === 3 && (
        <TOTPEnrolmentStep onComplete={handleTOTPComplete} />
      )}
      {step === 4 && (
        <SetupCompleteStep username={username} />
      )}
    </BootstrapShell>
  );
};

/** Shell layout for the bootstrap wizard — centred card with progress */
const BootstrapShell: React.FC<{
  readonly currentStep: WizardStep;
  readonly children: React.ReactNode;
}> = ({ currentStep, children }) => {
  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-dfrntBlue-50 px-4 py-8">
      <main
        role="main"
        aria-label="Platform setup wizard"
        className={`w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl sm:p-10 ${
          prefersReducedMotion ? "" : "transition-all duration-300"
        }`}
      >
        {/* Logo + Title */}
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-dfrntBlue-600 text-lg font-bold text-white">
            D
          </div>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">
            DFRNT Platform Setup
          </h1>
        </div>

        {/* Step Indicator */}
        <div className="mb-8">
          <StepIndicator currentStep={currentStep} />
        </div>

        {/* Step Content */}
        <div className="min-h-[300px]">
          {children}
        </div>

        {/* Step Counter */}
        {currentStep > 0 && currentStep < 4 && (
          <p className="mt-6 text-center text-sm text-gray-500">
            Step {currentStep} of 4
          </p>
        )}
      </main>

      {/* Help Link */}
      <p className="mt-6 text-xs text-gray-500">
        Need help?{" "}
        <a
          href="https://docs.dfrnt.com/setup"
          target="_blank"
          rel="noopener noreferrer"
          className="text-dfrntBlue-600 hover:underline"
        >
          docs.dfrnt.com/setup
        </a>
      </p>
    </div>
  );
};
