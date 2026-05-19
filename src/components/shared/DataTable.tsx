import React from "react";

interface Column<T> {
  /** Unique key for this column */
  readonly key: string;
  /** Column header text */
  readonly header: string;
  /** Render the cell content for a row */
  readonly render: (row: T) => React.ReactNode;
  /** Text alignment */
  readonly align?: "left" | "right" | "center";
}

interface DataTableProps<T> {
  /** Column definitions */
  readonly columns: ReadonlyArray<Column<T>>;
  /** Row data */
  readonly data: ReadonlyArray<T>;
  /** Unique key extractor for each row */
  readonly rowKey: (row: T) => string;
  /** Optional row click handler */
  readonly onRowClick?: (row: T) => void;
  /** aria-label for the table */
  readonly ariaLabel?: string;
}

const ALIGN_CLASSES = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  ariaLabel,
}: DataTableProps<T>): React.ReactElement {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table
        className="min-w-full divide-y divide-gray-200"
        aria-label={ariaLabel}
      >
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 ${ALIGN_CLASSES[col.align ?? "left"]}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              className={`transition-colors ${
                onRowClick
                  ? "cursor-pointer hover:bg-gray-50"
                  : "hover:bg-gray-50"
              }`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              role={onRowClick ? "button" : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`whitespace-nowrap px-6 py-4 text-sm ${ALIGN_CLASSES[col.align ?? "left"]}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
