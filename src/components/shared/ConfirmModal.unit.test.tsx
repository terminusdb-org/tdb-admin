/**
 * Unit tests for the ConfirmModal shared component.
 *
 * ConfirmModal provides "Are you sure?" confirmation for destructive actions.
 * Supports type-to-confirm (e.g., type username to enable delete button).
 *
 * Tests verify: rendering, accessibility, keyboard interaction,
 * type-to-confirm gating, loading state, and cancel behaviour.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmModal } from "./ConfirmModal";

const defaultProps = {
  title: "Delete User",
  description: "Are you sure you want to delete this user?",
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe("ConfirmModal", () => {
  describe("rendering", () => {
    it("renders with role=dialog and aria-modal=true", () => {
      render(<ConfirmModal {...defaultProps} />);
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });

    it("renders title and description", () => {
      render(<ConfirmModal {...defaultProps} />);
      expect(screen.getByText("Delete User")).toBeInTheDocument();
      expect(screen.getByText("Are you sure you want to delete this user?")).toBeInTheDocument();
    });

    it("renders confirm button with default label 'Confirm'", () => {
      render(<ConfirmModal {...defaultProps} />);
      expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    });

    it("renders confirm button with custom label", () => {
      render(<ConfirmModal {...defaultProps} confirmLabel="Deactivate" />);
      expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
    });

    it("renders Cancel button", () => {
      render(<ConfirmModal {...defaultProps} />);
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });
  });

  describe("destructive variant", () => {
    it("applies red styling to confirm button when destructive=true", () => {
      render(<ConfirmModal {...defaultProps} destructive />);
      const confirmBtn = screen.getByRole("button", { name: "Confirm" });
      expect(confirmBtn.className).toContain("bg-red-600");
    });

    it("applies blue styling to confirm button when destructive=false", () => {
      render(<ConfirmModal {...defaultProps} destructive={false} />);
      const confirmBtn = screen.getByRole("button", { name: "Confirm" });
      expect(confirmBtn.className).toContain("bg-dfrntBlue-600");
    });
  });

  describe("interactions", () => {
    it("calls onConfirm when confirm button is clicked", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);

      await user.click(screen.getByRole("button", { name: "Confirm" }));
      expect(onConfirm).toHaveBeenCalledOnce();
    });

    it("calls onCancel when Cancel button is clicked", async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it("calls onCancel when Escape key is pressed", async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);

      await user.keyboard("{Escape}");
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it("calls onCancel when clicking the backdrop overlay", async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);

      const backdrop = screen.getByRole("dialog");
      await user.click(backdrop);
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  describe("type-to-confirm", () => {
    it("renders input with hint when typeToConfirm is set", () => {
      render(
        <ConfirmModal
          {...defaultProps}
          typeToConfirm="admin"
          typeToConfirmHint='Type "admin" to confirm deletion'
        />
      );
      expect(screen.getByLabelText("Type \"admin\" to confirm deletion")).toBeInTheDocument();
    });

    it("disables confirm button until exact match is typed", () => {
      render(
        <ConfirmModal {...defaultProps} typeToConfirm="admin" />
      );
      const confirmBtn = screen.getByRole("button", { name: "Confirm" });
      expect(confirmBtn).toBeDisabled();
    });

    it("enables confirm button when exact match is typed", async () => {
      const user = userEvent.setup();
      render(
        <ConfirmModal {...defaultProps} typeToConfirm="admin" />
      );

      const input = screen.getByRole("textbox");
      await user.type(input, "admin");

      const confirmBtn = screen.getByRole("button", { name: "Confirm" });
      expect(confirmBtn).toBeEnabled();
    });

    it("does not enable confirm button for partial match", async () => {
      const user = userEvent.setup();
      render(
        <ConfirmModal {...defaultProps} typeToConfirm="admin" />
      );

      const input = screen.getByRole("textbox");
      await user.type(input, "admi");

      const confirmBtn = screen.getByRole("button", { name: "Confirm" });
      expect(confirmBtn).toBeDisabled();
    });

    it("is case-sensitive — 'Admin' does not match 'admin'", async () => {
      const user = userEvent.setup();
      render(
        <ConfirmModal {...defaultProps} typeToConfirm="admin" />
      );

      const input = screen.getByRole("textbox");
      await user.type(input, "Admin");

      const confirmBtn = screen.getByRole("button", { name: "Confirm" });
      expect(confirmBtn).toBeDisabled();
    });
  });

  describe("loading state", () => {
    it("shows 'Processing…' on confirm button when isLoading=true", () => {
      render(<ConfirmModal {...defaultProps} isLoading />);
      expect(screen.getByRole("button", { name: "Processing…" })).toBeInTheDocument();
    });

    it("disables both buttons when isLoading=true", () => {
      render(<ConfirmModal {...defaultProps} isLoading />);
      expect(screen.getByRole("button", { name: "Processing…" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    });

    it("disables the type-to-confirm input when isLoading=true", () => {
      render(
        <ConfirmModal {...defaultProps} typeToConfirm="admin" isLoading />
      );
      const input = screen.getByRole("textbox");
      expect(input).toBeDisabled();
    });
  });

  describe("focus management", () => {
    it("focuses Cancel button on mount (safe default for destructive actions)", async () => {
      vi.useFakeTimers();
      render(<ConfirmModal {...defaultProps} />);
      await vi.advanceTimersByTimeAsync(10);
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
      vi.useRealTimers();
    });
  });
});
