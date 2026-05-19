import React, { useCallback, useState } from "react";
import { Badge } from "./Badge";

/** Maximum badges visible before collapsing on mobile. */
const MOBILE_VISIBLE_COUNT = 3;

interface CollapsibleBadgeListProps {
  /** List of badge labels to display */
  readonly items: ReadonlyArray<string>;
  /** Badge variant */
  readonly variant?: "success" | "warning" | "danger" | "info" | "neutral";
  /** Format label for display (e.g., replace underscores) */
  readonly formatLabel?: (item: string) => string;
}

/**
 * A badge list that collapses to a configurable count on mobile
 * with a "+N more" toggle. Always expanded on desktop (md+).
 *
 * This prevents very tall table rows on narrow viewports.
 */
export const CollapsibleBadgeList: React.FC<CollapsibleBadgeListProps> = ({
  items,
  variant = "neutral",
  formatLabel,
}) => {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const format = formatLabel ?? ((item: string) => item);
  const overflowCount = items.length - MOBILE_VISIBLE_COUNT;
  const hasOverflow = overflowCount > 0;

  // Desktop: always show all items in a wrapping flex container
  // Mobile: show limited items with toggle
  return (
    <div className="flex flex-wrap gap-1">
      {/* Always-visible items (mobile limit or all on desktop) */}
      {items.map((item, index) => (
        <span
          key={item}
          className={
            !expanded && hasOverflow && index >= MOBILE_VISIBLE_COUNT
              ? "hidden md:inline-flex"
              : "inline-flex"
          }
        >
          <Badge label={format(item)} variant={variant} />
        </span>
      ))}

      {/* Mobile overflow toggle */}
      {hasOverflow && (
        <button
          type="button"
          onClick={handleToggle}
          className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-300 transition-colors md:hidden"
          aria-expanded={expanded}
          aria-label={
            expanded
              ? "Show fewer permissions"
              : `Show ${overflowCount} more permissions`
          }
        >
          {expanded ? "Show less" : `+${overflowCount} more`}
        </button>
      )}
    </div>
  );
};
