import React from "react";
import type { WizardStep } from "./types";

interface StepIndicatorProps {
  readonly currentStep: WizardStep;
}

const STEPS: ReadonlyArray<{ step: WizardStep; label: string }> = [
  { step: 0, label: "Token" },
  { step: 1, label: "Health" },
  { step: 2, label: "Account" },
  { step: 3, label: "2FA" },
  { step: 4, label: "Done" },
];

function stepStateClasses(step: WizardStep, currentStep: WizardStep): string {
  if (step < currentStep) {
    return "bg-green-600 text-white";
  }
  if (step === currentStep) {
    return "bg-dfrntBlue-600 text-white";
  }
  return "bg-gray-300 text-gray-600";
}

function lineClasses(step: WizardStep, currentStep: WizardStep): string {
  if (step < currentStep) {
    return "bg-green-500";
  }
  return "bg-gray-200";
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  return (
    <div role="list" aria-label="Setup progress" className="flex items-center justify-center">
      {STEPS.map(({ step, label }, index) => (
        <div key={step} role="listitem" className="flex items-center">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${stepStateClasses(step, currentStep)}`}
            aria-current={step === currentStep ? "step" : undefined}
            aria-label={
              step < currentStep
                ? `Step ${step + 1} of ${STEPS.length}: ${label} — Complete`
                : step === currentStep
                  ? `Step ${step + 1} of ${STEPS.length}: ${label} — Current`
                  : `Step ${step + 1} of ${STEPS.length}: ${label} — Pending`
            }
          >
            {step < currentStep ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              step + 1
            )}
          </div>
          {index < STEPS.length - 1 && (
            <div
              className={`hidden h-0.5 w-8 sm:block ${lineClasses(step, currentStep)}`}
              aria-hidden="true"
            />
          )}
        </div>
      ))}
    </div>
  );
};
