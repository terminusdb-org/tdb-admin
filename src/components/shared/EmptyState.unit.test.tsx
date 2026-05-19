/**
 * Unit tests for the EmptyState shared component.
 *
 * EmptyState renders a message when a list has no data,
 * with optional description and action (e.g., "Create first item" button).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="No users found" />);
    expect(screen.getByText("No users found")).toBeInTheDocument();
  });

  it("renders optional description", () => {
    render(
      <EmptyState
        title="No users found"
        description="Create the first user to get started."
      />
    );
    expect(screen.getByText("Create the first user to get started.")).toBeInTheDocument();
  });

  it("does not render description paragraph when not provided", () => {
    const { container } = render(<EmptyState title="Empty" />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(1); // Only the title paragraph
  });

  it("renders action element when provided", () => {
    render(
      <EmptyState
        title="No users"
        action={<button type="button">Add User</button>}
      />
    );
    expect(screen.getByRole("button", { name: "Add User" })).toBeInTheDocument();
  });

  it("does not render action container when action is not provided", () => {
    const { container } = render(<EmptyState title="Empty" />);
    // The component should not have a div wrapping an action
    const actionDiv = container.querySelector(".mt-4");
    expect(actionDiv).not.toBeInTheDocument();
  });

  it("is wrapped in a styled container with border", () => {
    const { container } = render(<EmptyState title="Empty" />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("rounded-lg");
    expect(wrapper?.className).toContain("border");
    expect(wrapper?.className).toContain("text-center");
  });
});
