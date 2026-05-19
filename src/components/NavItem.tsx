import React from "react";
import { Link, useLocation } from "react-router-dom";

interface NavItemProps {
  /** Route path this nav item links to */
  readonly path: string;
  /** Display label */
  readonly label: string;
  /** Optional icon component (rendered at w-4 h-4) */
  readonly icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Optional badge (count or status text) */
  readonly badge?: string | number;
  /** Variant for badge colour */
  readonly badgeVariant?: "warning" | "info";
  /** Whether this item is non-interactive */
  readonly disabled?: boolean;
  /** Callback fired on click (used by mobile drawer to close) */
  readonly onNavigate?: () => void;
}

/**
 * Determines if a nav item is active based on the current path.
 * Matches exact path or any nested child routes.
 */
function isNavItemActive(itemPath: string, currentPath: string): boolean {
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

export const NavItem: React.FC<NavItemProps> = ({
  path,
  label,
  icon: Icon,
  badge,
  badgeVariant = "info",
  disabled = false,
  onNavigate,
}) => {
  const location = useLocation();
  const isActive = isNavItemActive(path, location.pathname);

  const badgeClasses = badgeVariant === "warning"
    ? "bg-amber-100 text-amber-800"
    : "bg-blue-100 text-blue-800";

  if (disabled) {
    return (
      <span
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
        aria-disabled="true"
      >
        {Icon && <Icon className="h-4 w-4 text-gray-300" aria-hidden="true" />}
        <span>{label}</span>
        {badge !== undefined && (
          <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {badge}
          </span>
        )}
      </span>
    );
  }

  return (
    <Link
      to={path}
      onClick={onNavigate}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
        isActive
          ? "border-l-2 border-dfrntBlue-600 bg-dfrntBlue-50 text-dfrntBlue-700"
          : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
      }`}
      aria-current={isActive ? "page" : undefined}
    >
      {Icon && (
        <Icon
          className={`h-4 w-4 ${isActive ? "text-dfrntBlue-600" : "text-gray-400"}`}
          aria-hidden="true"
        />
      )}
      <span>{label}</span>
      {badge !== undefined && (
        <span className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClasses}`}>
          {badge}
        </span>
      )}
    </Link>
  );
};
