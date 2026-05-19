import React from "react";

interface SidebarSectionProps {
  /** Section identifier (used for ARIA IDs) */
  readonly id: string;
  /** Section label displayed as header ("ADMIN", "SCHEMA", "DATA") */
  readonly label: string;
  /** Whether the section is collapsed */
  readonly collapsed: boolean;
  /** Toggle collapse state */
  readonly onToggle: () => void;
  /** Whether this section contains the active route (prevents collapse) */
  readonly hasActiveChild: boolean;
  /** Whether this section is disabled (coming soon) */
  readonly disabled?: boolean;
  /** Message displayed when disabled */
  readonly disabledMessage?: string;
  /** Optional context picker (DataProductPicker) rendered above nav items */
  readonly contextPicker?: React.ReactNode;
  /** Nav items rendered within this section */
  readonly children: React.ReactNode;
}

/**
 * Collapsible sidebar section with a header and grouped navigation items.
 *
 * Behaviour:
 * - Click header toggles collapsed state
 * - Section with active child cannot be collapsed (always expanded)
 * - Disabled sections appear collapsed with a "coming soon" badge
 */
export const SidebarSection: React.FC<SidebarSectionProps> = ({
  id,
  label,
  collapsed,
  onToggle,
  hasActiveChild,
  disabled = false,
  disabledMessage,
  contextPicker,
  children,
}) => {
  const headingId = `section-${id}-heading`;

  // Section with active child is always expanded
  const isExpanded = hasActiveChild || !collapsed;

  // Disabled sections are always visually collapsed
  const showContent = !disabled && isExpanded;

  return (
    <div role="group" aria-labelledby={headingId} className="py-1">
      <h2 id={headingId} className="sr-only">
        {label}
      </h2>
      <button
        type="button"
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        className={`flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
          disabled
            ? "text-gray-400 cursor-default"
            : "text-gray-500 hover:text-gray-700"
        }`}
        aria-expanded={disabled ? false : isExpanded}
        aria-controls={`section-${id}-content`}
      >
        <span className="flex items-center gap-2">
          {label}
          {disabled && disabledMessage && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-gray-500">
              {disabledMessage}
            </span>
          )}
        </span>
        {!disabled && (
          <svg
            className={`h-3.5 w-3.5 text-gray-400 transition-transform ${
              isExpanded ? "rotate-0" : "-rotate-90"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        )}
      </button>

      {showContent && (
        <div id={`section-${id}-content`} className="mt-1 space-y-0.5 px-1">
          {contextPicker && (
            <div className="px-2 pb-2">
              {contextPicker}
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
};
