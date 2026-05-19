import React, { useEffect, useRef } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";

interface FormModalProps {
  /** Modal title */
  readonly title: string;
  /** Optional description below the title */
  readonly description?: string;
  /** Label for the submit button */
  readonly submitLabel?: string;
  /** Whether the form is submitting */
  readonly isLoading?: boolean;
  /** Error message to display above the form */
  readonly error?: string | null;
  /** Called when form is submitted */
  readonly onSubmit: (event: React.FormEvent) => void;
  /** Called when modal is dismissed */
  readonly onCancel: () => void;
  /** Form content (fields) */
  readonly children: React.ReactNode;
}

export const FormModal: React.FC<FormModalProps> = ({
  title,
  description,
  submitLabel = "Create",
  isLoading = false,
  error,
  onSubmit,
  onCancel,
  children,
}) => {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // Focus the first focusable input in the form after HeadlessUI finishes its own focus management
    const timer = setTimeout(() => {
      const firstInput = formRef.current?.querySelector<HTMLElement>(
        "input, select, textarea"
      );
      firstInput?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

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
          {description && (
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          )}

          {error && (
            <div
              role="alert"
              className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200"
            >
              {error}
            </div>
          )}

          <form ref={formRef} onSubmit={onSubmit} className="mt-4 space-y-4">
            {children}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-md bg-dfrntBlue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-dfrntBlue-700 disabled:bg-dfrntBlue-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "Processing…" : submitLabel}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};
