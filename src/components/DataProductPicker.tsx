import React, { useCallback, useEffect, useRef, useState } from "react";
import { useListOrganizationsQuery } from "@/store";

interface DataProductPickerProps {
  /** Currently selected organisation */
  readonly selectedOrg?: string;
  /** Currently selected database */
  readonly selectedDb?: string;
  /** Callback when a data product is selected */
  readonly onSelect: (org: string, db: string) => void;
}

/**
 * Combobox-style picker for selecting a data product (org/database pair).
 * Uses ARIA combobox pattern with listbox dropdown.
 *
 * Currently loads organisations as the group headers.
 * Database listing within each org is handled via a secondary request.
 *
 * Note: This is an initial implementation that shows organisations.
 * Full nested database listing will be enhanced when the schema section
 * becomes active (currently Schema is a placeholder).
 */
export const DataProductPicker: React.FC<DataProductPickerProps> = ({
  selectedOrg,
  selectedDb,
  onSelect,
}) => {
  const { data: orgs, isLoading } = useListOrganizationsQuery();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const hasSelection = selectedOrg !== undefined && selectedDb !== undefined;
  const displayValue = hasSelection ? `${selectedOrg}/${selectedDb}` : undefined;

  // For now, flatten orgs into selectable items
  // Each org becomes a selectable option (database selection is a future enhancement)
  const items = orgs ?? [];

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
    triggerRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDropdown();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeDropdown]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !listboxRef.current?.contains(target)
      ) {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, closeDropdown]);

  const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
      case "Enter":
      case " ":
        event.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
        break;
      default:
        break;
    }
  };

  const handleListboxKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightedIndex((prev) =>
          prev < items.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < items.length) {
          const item = items[highlightedIndex];
          onSelect(item.name, "main");
          closeDropdown();
        }
        break;
      case "Escape":
        event.preventDefault();
        closeDropdown();
        break;
      default:
        break;
    }
  };

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls="dp-picker-listbox"
        aria-label={displayValue ? `Data product: ${displayValue}` : "Select data product"}
        className="flex w-full items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-left text-xs font-mono transition-colors hover:border-gray-300 focus:border-dfrntBlue-500 focus:outline-none focus:ring-1 focus:ring-dfrntBlue-500"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={displayValue ? "text-gray-900 truncate" : "text-gray-500"}>
          {displayValue ?? "Select data product…"}
        </span>
        <svg
          className={`ml-1 h-3.5 w-3.5 flex-shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listboxRef}
          id="dp-picker-listbox"
          role="listbox"
          aria-label="Select data product"
          className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
          onKeyDown={handleListboxKeyDown}
          tabIndex={-1}
        >
          {isLoading && (
            <div className="animate-pulse px-3 py-2">
              <div className="h-3 w-24 rounded bg-gray-200" />
              <div className="mt-2 h-3 w-32 rounded bg-gray-100" />
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <div className="px-3 py-3 text-xs text-gray-500">
              No databases. Create one in Admin → Data Products.
            </div>
          )}

          {!isLoading && items.length > 0 && (
            <div role="group" aria-label="Organisations">
              <div className="px-2.5 py-1 text-xs font-semibold uppercase text-gray-500">
                Organisations
              </div>
              {items.map((org, index) => {
                const isSelected = selectedOrg === org.name;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={org.name}
                    role="option"
                    aria-selected={isSelected}
                    className={`cursor-pointer px-3 py-1.5 text-xs font-mono ${
                      isHighlighted
                        ? "bg-gray-50"
                        : isSelected
                          ? "bg-dfrntBlue-50 text-dfrntBlue-700"
                          : "text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      onSelect(org.name, "main");
                      closeDropdown();
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    title={org.name}
                  >
                    <span className="truncate block">{org.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
