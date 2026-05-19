import React from "react";

interface LoadingStateProps {
  /** Number of skeleton rows to display */
  readonly rows?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ rows = 5 }) => {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="animate-pulse">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
          <div className="h-4 w-48 rounded bg-gray-200" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="border-b border-gray-100 px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="h-4 w-32 rounded bg-gray-200" />
              <div className="h-4 w-20 rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
