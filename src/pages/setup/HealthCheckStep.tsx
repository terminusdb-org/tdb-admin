import React, { useState, useEffect, useCallback, useRef } from "react";
import type { HealthCheckItem, HealthErrorKind } from "./types";
import { ioRunHealthChecks } from "./useBootstrapApi";

interface HealthCheckStepProps {
  readonly onComplete: () => void;
}

function statusIcon(status: HealthCheckItem["status"]): React.ReactNode {
  switch (status) {
    case "waiting":
      return <span className="text-gray-400" aria-hidden="true">─</span>;
    case "checking":
      return (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-dfrntBlue-200 border-t-dfrntBlue-600" aria-hidden="true" />
      );
    case "success":
      return (
        <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    case "failed":
      return (
        <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    default:
      throw new Error(`Unknown status: ${status}`);
  }
}

function statusText(status: HealthCheckItem["status"]): { text: string; className: string } {
  switch (status) {
    case "waiting":
      return { text: "Waiting...", className: "text-gray-500" };
    case "checking":
      return { text: "Checking...", className: "text-dfrntBlue-600" };
    case "success":
      return { text: "Running", className: "text-green-700" };
    case "failed":
      return { text: "Not connected", className: "text-red-700" };
    default:
      throw new Error(`Unknown status: ${status}`);
  }
}

function determineError(items: ReadonlyArray<HealthCheckItem>): HealthErrorKind | null {
  const hasCriticalFail = items.some((item) => item.critical && item.status === "failed");
  const hasAnyFail = items.some((item) => item.status === "failed");

  if (hasCriticalFail) return "critical-failure";
  if (hasAnyFail) return "partial-failure";
  return null;
}

export const HealthCheckStep: React.FC<HealthCheckStepProps> = ({ onComplete }) => {
  const [items, setItems] = useState<ReadonlyArray<HealthCheckItem>>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [errorKind, setErrorKind] = useState<HealthErrorKind | null>(null);
  const hasRun = useRef(false);

  const runChecks = useCallback(async () => {
    setIsRunning(true);
    setErrorKind(null);

    try {
      const finalItems = await ioRunHealthChecks((progress) => {
        setItems(progress);
      });

      const error = determineError(finalItems);
      setErrorKind(error);
    } catch {
      setErrorKind("network");
    } finally {
      setIsRunning(false);
    }
  }, []);

  useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true;
      runChecks();
    }
  }, [runChecks]);

  const allPassed = !isRunning && !errorKind && items.length > 0;
  const canContinue = !isRunning && errorKind !== "critical-failure";

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">
        Checking your platform
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        We&apos;re verifying that all services started correctly.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
        <ul role="list" className="space-y-3" aria-label="Health check results">
          {items.map((item) => {
            const status = statusText(item.status);
            return (
              <li
                key={item.label}
                className="flex items-center justify-between"
                aria-live="polite"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-5 w-5 items-center justify-center">
                    {statusIcon(item.status)}
                  </div>
                  <span className="text-sm text-gray-900">{item.label}</span>
                </div>
                <span className={`text-xs font-medium ${status.className}`}>
                  {status.text}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Summary messages */}
      {allPassed && (
        <div className="mt-4" aria-live="assertive">
          <p className="text-sm font-medium text-green-700">
            Everything looks good.
          </p>
        </div>
      )}

      {errorKind === "partial-failure" && (
        <div
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-sm font-medium text-amber-800">
            Some services are not ready.
          </p>
          <p className="mt-1 text-xs text-amber-700">
            Non-critical services may resolve on their own within a few minutes as Azure provisions the resources.
          </p>
        </div>
      )}

      {errorKind === "critical-failure" && (
        <div
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-sm font-medium text-red-800">
            Cannot continue setup. A critical service is not responding.
          </p>
          <p className="mt-1 text-xs text-red-700">
            Check that all containers are running. See{" "}
            <a href="https://docs.dfrnt.com/troubleshooting" target="_blank" rel="noopener noreferrer" className="underline">
              troubleshooting docs
            </a>{" "}
            for help.
          </p>
        </div>
      )}

      {errorKind === "network" && (
        <div
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-sm font-medium text-red-800">
            Lost connection. Check the application is still running.
          </p>
        </div>
      )}

      {/* Buttons */}
      {!isRunning && (
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              hasRun.current = false;
              runChecks();
            }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Retry health checks"
          >
            Retry Checks
          </button>

          {canContinue && (
            <button
              type="button"
              onClick={onComplete}
              className="inline-flex items-center gap-1 rounded-lg bg-dfrntBlue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 transition-colors"
            >
              {errorKind === "partial-failure" ? "Continue Anyway" : "Continue: Create Account"}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
