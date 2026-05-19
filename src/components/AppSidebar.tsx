import React, { useCallback, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store";
import { logout, selectIsGlobalAdmin } from "@/store";
import { config } from "@/config";
import { SidebarSection } from "./SidebarSection";
import { NavItem } from "./NavItem";

// --- Section configuration types ---

interface NavItemConfig {
  readonly path: string;
  readonly label: string;
  readonly icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  readonly badge?: string | number;
  readonly badgeVariant?: "warning" | "info";
  readonly disabled?: boolean;
}

interface SectionConfig {
  readonly id: string;
  readonly label: string;
  readonly items: ReadonlyArray<NavItemConfig>;
  readonly disabled?: boolean;
  readonly disabledMessage?: string;
}

// --- Icon components (inline SVGs to avoid dependency) ---

const UsersIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-1.997m0 0A8.959 8.959 0 0112 15.75a8.958 8.958 0 01-3.213-.598m6.426 0a3 3 0 10-4.426-3.489 3 3 0 004.426 3.489" />
  </svg>
);

const BuildingOffice2Icon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5M3.75 3v18m4.5-18v18m4.5-18v18m4.5-18v18m4.5-18v18M3.75 3h16.5M3.75 21h16.5M5.25 6h.008v.008H5.25V6zM5.25 9h.008v.008H5.25V9zm0 3h.008v.008H5.25V12zm0 3h.008v.008H5.25V15zm4.5-9h.008v.008H9.75V6zm0 3h.008v.008H9.75V9zm0 3h.008v.008H9.75V12zm0 3h.008v.008H9.75V15zm4.5-9h.008v.008h-.008V6zm0 3h.008v.008h-.008V9zm0 3h.008v.008h-.008V12zm0 3h.008v.008h-.008V15z" />
  </svg>
);

const ShieldCheckIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const UserPlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
  </svg>
);

const ArrowPathIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const KeyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
  </svg>
);

const LockClosedIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const CircleStackIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
  </svg>
);

const BranchIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
  </svg>
);

// --- URL parsing for hierarchical nav ---

interface DataProductNavContext {
  /** Whether we are inside a data product route */
  readonly insideProduct: boolean;
  /** Org extracted from /data-products/:org/:db/... */
  readonly org?: string;
  /** DB extracted from /data-products/:org/:db/... */
  readonly db?: string;
  /** Whether we are inside a branch route */
  readonly insideBranch: boolean;
  /** Branch name extracted from /data-products/:org/:db/branches/:branch/... */
  readonly branch?: string;
}

/**
 * Parse the current URL to determine hierarchical navigation context.
 *
 * URL patterns:
 * - /data-products → list page (not inside product)
 * - /data-products/:org/:db/branches → inside product, branch list
 * - /data-products/:org/:db/branches/:branch/schema → inside branch
 */
function parseDataProductNavContext(pathname: string): DataProductNavContext {
  // Pattern: /data-products/:org/:db/branches/:branch/...
  const branchMatch = pathname.match(
    /^\/data-products\/([^/]+)\/([^/]+)\/branches\/([^/]+)/
  );
  if (branchMatch) {
    return {
      insideProduct: true,
      org: decodeURIComponent(branchMatch[1]),
      db: decodeURIComponent(branchMatch[2]),
      insideBranch: true,
      branch: decodeURIComponent(branchMatch[3]),
    };
  }

  // Pattern: /data-products/:org/:db/branches
  const productMatch = pathname.match(
    /^\/data-products\/([^/]+)\/([^/]+)/
  );
  if (productMatch) {
    return {
      insideProduct: true,
      org: decodeURIComponent(productMatch[1]),
      db: decodeURIComponent(productMatch[2]),
      insideBranch: false,
    };
  }

  return { insideProduct: false, insideBranch: false };
}

// --- Section definitions ---

/** Build sidebar sections based on feature flags and user role. */
function buildSections(openBaoEnabled: boolean, isGlobalAdmin: boolean): ReadonlyArray<SectionConfig> {
  const adminItems: ReadonlyArray<NavItemConfig> = [
    ...(isGlobalAdmin ? [{ path: "/users", label: "Users", icon: UsersIcon }] : []),
    { path: "/teams", label: "Teams", icon: BuildingOffice2Icon },
    ...(isGlobalAdmin ? [{ path: "/roles", label: "Roles", icon: ShieldCheckIcon }] : []),
    { path: "/grants", label: "Grants", icon: LockClosedIcon },
    ...(isGlobalAdmin ? [{ path: "/invitations", label: "Invitations", icon: UserPlusIcon }] : []),
    ...(isGlobalAdmin && openBaoEnabled
      ? [{ path: "/admin/team-sync", label: "Team Sync", icon: ArrowPathIcon }]
      : []),
    ...(isGlobalAdmin ? [{ path: "/password-reset", label: "Password Reset", icon: KeyIcon }] : []),
    { path: "/data-products", label: "Data Products", icon: CircleStackIcon },
  ];

  return [
    {
      id: "admin",
      label: "ADMIN",
      items: adminItems,
    },
  ];
}

// --- Collapse state management ---

const STORAGE_KEY = "tdb-admin-sidebar-sections";

interface CollapseState {
  readonly [sectionId: string]: boolean;
}

function loadCollapseState(): CollapseState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as CollapseState;
    }
  } catch {
    // Ignore parse errors — fall through to default
  }
  return {};
}

function saveCollapseState(state: CollapseState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore write errors (private browsing, quota)
  }
}

// --- Active state detection ---

function isSectionActive(section: SectionConfig, currentPath: string): boolean {
  return section.items.some(
    (item) => currentPath === item.path || currentPath.startsWith(`${item.path}/`)
  );
}

// --- AppSidebar component ---

interface AppSidebarProps {
  /** Callback when a nav item is clicked (for mobile — closes drawer) */
  readonly onNavigate?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ onNavigate }) => {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const username = useAppSelector((state) => state.auth.username);
  const isGlobalAdmin = useAppSelector(selectIsGlobalAdmin);

  const sections = useMemo(() => buildSections(config.openBaoEnabled, isGlobalAdmin), [isGlobalAdmin]);

  const [collapseState, setCollapseState] = useState<CollapseState>(loadCollapseState);

  // Parse hierarchical nav context from current URL
  const navContext = useMemo(
    () => parseDataProductNavContext(location.pathname),
    [location.pathname]
  );

  const handleToggleSection = useCallback((sectionId: string) => {
    setCollapseState((prev) => {
      const next = { ...prev, [sectionId]: !prev[sectionId] };
      saveCollapseState(next);
      return next;
    });
  }, []);

  const handleSignOut = useCallback(() => {
    dispatch(logout());
  }, [dispatch]);

  // Build hierarchical sub-items for data products based on current context
  const dataProductSubItems = useMemo((): ReadonlyArray<NavItemConfig> => {
    const items: NavItemConfig[] = [];

    if (navContext.insideProduct && navContext.org && navContext.db) {
      const branchesPath = `/data-products/${encodeURIComponent(navContext.org)}/${encodeURIComponent(navContext.db)}/branches`;
      items.push({
        path: branchesPath,
        label: `${navContext.org}/${navContext.db}`,
        icon: BranchIcon,
      });

    }

    return items;
  }, [navContext]);

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className="flex h-full flex-col border-r border-gray-200 bg-white"
    >
      {/* Brand header */}
      <div className="border-b border-gray-200 px-4 py-4">
        <Link to="/" className="flex items-center gap-2" onClick={onNavigate}>
          <span className="font-headline text-lg font-bold text-dfrntBlue-700">
            TDB Admin
          </span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
            {config.edition}
          </span>
        </Link>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto py-2">
        {sections.map((section) => {
          const hasActive = isSectionActive(section, location.pathname);
          const isCollapsed = collapseState[section.id] ?? false;

          return (
            <SidebarSection
              key={section.id}
              id={section.id}
              label={section.label}
              collapsed={isCollapsed}
              onToggle={() => handleToggleSection(section.id)}
              hasActiveChild={hasActive}
              disabled={section.disabled}
              disabledMessage={section.disabledMessage}
            >
              {section.items.map((item) => (
                <NavItem
                  key={item.path}
                  path={item.path}
                  label={item.label}
                  icon={item.icon}
                  badge={item.badge}
                  badgeVariant={item.badgeVariant}
                  disabled={item.disabled}
                  onNavigate={onNavigate}
                />
              ))}
              {/* Hierarchical sub-items for Data Products */}
              {section.id === "admin" && dataProductSubItems.length > 0 && (
                <div className="ml-4 mt-1 space-y-0.5 border-l border-gray-200 pl-2">
                  {dataProductSubItems.map((item) => (
                    <NavItem
                      key={item.path}
                      path={item.path}
                      label={item.label}
                      icon={item.icon}
                      disabled={item.disabled}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              )}
            </SidebarSection>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 truncate max-w-[120px]">
            {username}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
};
