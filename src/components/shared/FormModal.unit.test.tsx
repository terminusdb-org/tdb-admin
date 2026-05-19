/**
 * Unit tests for the FormModal shared component.
 *
 * FormModal wraps a form in a modal dialog with title, description,
 * submit/cancel buttons, and error display.
 *
 * Tests verify: rendering, accessibility, keyboard interaction,
 * form submission, error display, loading state, and focus management.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormModal } from "./FormModal";

const defaultProps = {
  title: "Add User",
  onSubmit: vi.fn((e: React.FormEvent) => e.preventDefault()),
  onCancel: vi.fn(),
  children: (
    <div>
      <label htmlFor="test-input">Username</label>
      <input id="test-input" type="text" />
    </div>
  ),
};

describe("FormModal", () => {
  describe("rendering", () => {
    it("renders with role=dialog and aria-modal=true", () => {
      render(<FormModal {...defaultProps} />);
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });

    it("renders the title", () => {
      render(<FormModal {...defaultProps} />);
      expect(screen.getByText("Add User")).toBeInTheDocument();
    });

    it("renders optional description", () => {
      render(
        <FormModal {...defaultProps} description="Create a new TDB user." />
      );
      expect(screen.getByText("Create a new TDB user.")).toBeInTheDocument();
    });

    it("does not render description paragraph when not provided", () => {
      const { container } = render(<FormModal {...defaultProps} />);
      // Title exists but no description paragraph
      const paragraphs = container.querySelectorAll("p");
      expect(paragraphs).toHaveLength(0);
    });

    it("renders children as form content", () => {
      render(<FormModal {...defaultProps} />);
      expect(screen.getByLabelText("Username")).toBeInTheDocument();
    });

    it("renders submit button with default label 'Create'", () => {
      render(<FormModal {...defaultProps} />);
      expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    });

    it("renders submit button with custom label", () => {
      render(<FormModal {...defaultProps} submitLabel="Save Changes" />);
      expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
    });

    it("renders Cancel button", () => {
      render(<FormModal {...defaultProps} />);
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });
  });

  describe("error display", () => {
    it("renders error message with role=alert when error prop is set", () => {
      render(<FormModal {...defaultProps} error="Username already exists." />);
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Username already exists.");
    });

    it("does not render error alert when error is null", () => {
      render(<FormModal {...defaultProps} error={null} />);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("does not render error alert when error is undefined", () => {
      render(<FormModal {...defaultProps} />);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("calls onSubmit when form is submitted", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
      render(<FormModal {...defaultProps} onSubmit={onSubmit} />);

      await user.click(screen.getByRole("button", { name: "Create" }));
      expect(onSubmit).toHaveBeenCalledOnce();
    });

    it("calls onCancel when Cancel button is clicked", async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<FormModal {...defaultProps} onCancel={onCancel} />);

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it("calls onCancel when Escape key is pressed", async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<FormModal {...defaultProps} onCancel={onCancel} />);

      await user.keyboard("{Escape}");
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it("calls onCancel when clicking the backdrop overlay", async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<FormModal {...defaultProps} onCancel={onCancel} />);

      const backdrop = screen.getByRole("dialog");
      await user.click(backdrop);
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  describe("loading state", () => {
    it("shows 'Processing…' on submit button when isLoading=true", () => {
      render(<FormModal {...defaultProps} isLoading />);
      expect(screen.getByRole("button", { name: "Processing…" })).toBeInTheDocument();
    });

    it("disables submit button when isLoading=true", () => {
      render(<FormModal {...defaultProps} isLoading />);
      expect(screen.getByRole("button", { name: "Processing…" })).toBeDisabled();
    });

    it("disables cancel button when isLoading=true", () => {
      render(<FormModal {...defaultProps} isLoading />);
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    });
  });

  describe("focus management", () => {
    it("focuses the first input inside the form on mount", async () => {
      vi.useFakeTimers();
      render(<FormModal {...defaultProps} />);
      await vi.advanceTimersByTimeAsync(10);
      expect(screen.getByLabelText("Username")).toHaveFocus();
      vi.useRealTimers();
    });
  });

  describe("accessibility", () => {
    it("has aria-labelledby linking to the dialog title", () => {
      render(<FormModal {...defaultProps} />);
      const dialog = screen.getByRole("dialog");
      const labelledById = dialog.getAttribute("aria-labelledby");
      expect(labelledById).toBeTruthy();
      // HeadlessUI auto-generates the ID; verify the referenced element has our title text
      const titleEl = document.getElementById(labelledById!);
      expect(titleEl).toHaveTextContent("Add User");
    });
  });
});
