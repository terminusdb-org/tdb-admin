import React from "react";
import { useAppSelector } from "@/store";
import { config } from "@/config";

interface MobileHeaderProps {
  /** Callback to open the mobile navigation drawer */
  readonly onMenuOpen: () => void;
  /** Whether the drawer is currently open */
  readonly isDrawerOpen: boolean;
  /** Ref attached to the hamburger button for focus restoration after drawer close */
  readonly hamburgerRef: React.Ref<HTMLButtonElement>;
}

/**
 * Slim header bar visible only on mobile/tablet (< 1024px).
 * Contains hamburger button, brand text, and user area.
 * Hidden on desktop where the sidebar is always visible.
 */
export const MobileHeader: React.FC<MobileHeaderProps> = ({
  onMenuOpen,
  isDrawerOpen,
  hamburgerRef,
}) => {
  const username = useAppSelector((state) => state.auth.username);

  return (
    <header
      role="banner"
      className="fixed top-0 left-0 right-0 z-40 flex h-12 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden"
    >
      {/* Hamburger button */}
      <button
        ref={hamburgerRef}
        type="button"
        onClick={onMenuOpen}
        className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        aria-label="Open navigation menu"
        aria-expanded={isDrawerOpen}
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Brand */}
      <span className="flex items-center gap-1.5">
        <span className="font-headline text-sm font-bold text-dfrntBlue-700">
          TDB Admin
        </span>
        <span className="rounded bg-gray-100 px-1 py-0.5 text-[10px] font-medium text-gray-500">
          {config.edition}
        </span>
      </span>

      {/* User area — truncated to prevent overlap with brand */}
      <span className="shrink-0 text-xs text-gray-600 truncate max-w-[80px] sm:max-w-[120px]">
        {username}
      </span>
    </header>
  );
};
