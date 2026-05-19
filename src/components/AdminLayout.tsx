import React, { useCallback, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { MobileHeader } from "./MobileHeader";
import { MobileDrawer } from "./MobileDrawer";

/**
 * Admin layout with left sidebar navigation.
 *
 * Desktop (≥ 1024px): Fixed sidebar + content area offset by sidebar width.
 * Mobile (< 1024px): Sidebar hidden, hamburger in MobileHeader opens drawer overlay.
 *
 * @see projects/2026-05-customer-premise-deployment/specs/tdb-admin-sidebar-layout.md
 */
export const AdminLayout: React.FC = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const handleOpenDrawer = useCallback(() => {
    setIsDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Skip link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-dfrntBlue-700 focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar — hidden below lg, fixed position */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0">
        <AppSidebar />
      </aside>

      {/* Mobile header — fixed top bar visible below lg */}
      <MobileHeader
        onMenuOpen={handleOpenDrawer}
        isDrawerOpen={isDrawerOpen}
        hamburgerRef={hamburgerRef}
      />

      {/* Mobile drawer — only rendered when open, below lg */}
      <MobileDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        triggerRef={hamburgerRef}
      >
        <AppSidebar onNavigate={handleCloseDrawer} />
      </MobileDrawer>

      {/* Main content — offset by sidebar on desktop, offset by header on mobile */}
      <main
        id="main-content"
        className="pt-12 lg:pt-0 lg:pl-60"
      >
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
