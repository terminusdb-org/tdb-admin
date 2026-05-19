import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";

interface ConfirmModalProps {
  /** Modal title */
  readonly title: string;
  /** Description/warning message */
  readonly description: string;
  /** Label for the confirm button */
  readonly confirmLabel?: string;
  /** Whether confirmation is destructive (red button) */
  readonly destructive?: boolean;
  /** Whether the action is in progress */
  readonly isLoading?: boolean;
  /** If set, user must type this exact string to enable confirm button */
  readonly typeToConfirm?: string;
  /** Hint text shown below the input when typeToConfirm is set */
  readonly typeToConfirmHint?: string;
  /** Called when user confirms */
  readonly onConfirm: () => void;
  /** Called when user cancels */
  readonly onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  isLoading = false,
  typeToConfirm,
  typeToConfirmHint,
  onConfirm,
  onCancel,
}) => {
  const [confirmInput, setConfirmInput] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);

  const isConfirmEnabled = typeToConfirm
    ? confirmInput === typeToConfirm
    : true;

  // Focus the cancel button on mount (safe default for destructive actions)
  useEffect(() => {
    const timer = setTimeout(() => {
      cancelRef.current?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const confirmButtonClass = destructive
    ? "bg-red-600 hover:bg-red-700 disabled:bg-red-400"
    : "bg-dfrntBlue-600 hover:bg-dfrntBlue-700 disabled:bg-dfrntBlue-400";

  return (
    <Dialog
      open={true}
      onClose={onCancel}
      className="relative z-50"
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

      {/* Dialog positioning */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            {title}
          </DialogTitle>
          <p className="mt-2 text-sm text-gray-600">{description}</p>

          {typeToConfirm && (
            <div className="mt-4">
              <label
                htmlFor="confirm-input"
                className="block text-sm font-medium text-gray-700"
              >
                {typeToConfirmHint ?? `Type "${typeToConfirm}" to confirm`}
              </label>
              <input
                id="confirm-input"
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                disabled={isLoading}
                className="mt-1 block w-full rounded-md border-gray-300 font-data text-sm shadow-sm focus:border-dfrntBlue-500 focus:ring-dfrntBlue-500 disabled:bg-gray-100"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading || !isConfirmEnabled}
              className={`rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed transition-colors ${confirmButtonClass}`}
            >
              {isLoading ? "Processing…" : confirmLabel}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};
