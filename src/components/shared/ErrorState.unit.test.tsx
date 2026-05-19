/**
 * Unit tests for the ErrorState shared component.
 *
 * ErrorState renders an error alert with optional title, message, and retry button.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorState } from "./ErrorState";

describe("ErrorState", () => {
  it("renders with role=alert for accessibility", () => {
    render(<ErrorState message="Connection failed" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders the default title 'Something went wrong'", () => {
    render(<ErrorState message="Connection failed" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders a custom title when provided", () => {
    render(<ErrorState title="Failed to load users" message="Server returned 500" />);
    expect(screen.getByText("Failed to load users")).toBeInTheDocument();
  });

  it("renders the error message", () => {
    render(<ErrorState message="Network error — cannot reach TerminusDB." />);
    expect(screen.getByText("Network error — cannot reach TerminusDB.")).toBeInTheDocument();
  });

  it("renders a Retry button when onRetry is provided", () => {
    render(<ErrorState message="Error" onRetry={() => {}} />);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("does not render Retry button when onRetry is not provided", () => {
    render(<ErrorState message="Error" />);
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("calls onRetry when Retry button is clicked", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState message="Error" onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("uses red colour scheme for the alert container", () => {
    render(<ErrorState message="Error" />);
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("border-red-200");
    expect(alert.className).toContain("bg-red-50");
  });
});
