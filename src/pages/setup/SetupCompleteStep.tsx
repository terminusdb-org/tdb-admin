import React, { useEffect, useRef } from "react";
import { config } from "@/config";

interface SetupCompleteStepProps {
  readonly username: string;
}

const COMPLETED_ITEMS: ReadonlyArray<string> = [
  "Admin account created",
  "Two-factor authentication enabled",
  "Setup token consumed (cannot be reused)",
  "Platform secured",
];

const NEXT_STEPS: ReadonlyArray<string> = [
  "Sign in with your new credentials",
  "Create a team for your organisation",
  "Create your first data product (database)",
  "Invite team members",
  "Configure Azure AD SSO (optional)",
];

export const SetupCompleteStep: React.FC<SetupCompleteStepProps> = ({ username }) => {
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const prefersReducedMotion = useRef(
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  // Auto-focus CTA after animation completes
  useEffect(() => {
    const delay = prefersReducedMotion.current ? 100 : 1200;
    const timer = setTimeout(() => {
      ctaRef.current?.focus();
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const animationClass = prefersReducedMotion.current
    ? "opacity-100"
    : "animate-fade-in";

  return (
    <div className="text-center" aria-live="assertive">
      {/* Success Icon */}
      <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 ${animationClass}`}>
        <svg
          className="h-10 w-10 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
            className={prefersReducedMotion.current ? "" : "animate-draw-check"}
          />
        </svg>
      </div>

      <h2 className="mt-6 text-2xl font-bold text-gray-900">
        Your platform is ready
      </h2>

      {/* Completed items */}
      <div className="mx-auto mt-6 max-w-sm rounded-lg border border-gray-200 bg-white p-4 text-left">
        <ul role="list" className="space-y-2">
          {COMPLETED_ITEMS.map((item, index) => (
            <li
              key={item}
              className={`flex items-center gap-2 text-sm text-gray-700 ${animationClass}`}
              style={
                prefersReducedMotion.current
                  ? undefined
                  : { animationDelay: `${600 + index * 150}ms`, animationFillMode: "backwards" }
              }
            >
              <svg className="h-4 w-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {item === "Admin account created" ? `Admin account '${username}' created` : item}
            </li>
          ))}
        </ul>
      </div>

      {/* What's next */}
      <div className="mx-auto mt-6 max-w-sm text-left">
        <h3 className="text-sm font-semibold text-gray-900">What&apos;s next</h3>
        <ul role="list" className="mt-3 space-y-2">
          {NEXT_STEPS.map((step) => (
            <li key={step} className="flex items-center gap-2 text-sm text-gray-600">
              <div className="h-4 w-4 shrink-0 rounded border border-gray-300" aria-hidden="true" />
              {step}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="mt-8">
        <a
          ref={ctaRef}
          href={`${config.basePath}/login`}
          className="inline-flex items-center gap-2 rounded-lg bg-dfrntBlue-600 px-8 py-3 text-lg font-medium text-white shadow-sm hover:bg-dfrntBlue-700 focus:outline-none focus:ring-2 focus:ring-dfrntBlue-500 focus:ring-offset-2 transition-colors"
        >
          Go to Login
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
};
