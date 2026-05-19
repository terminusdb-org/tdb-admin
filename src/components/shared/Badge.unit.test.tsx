/**
 * Unit tests for the Badge shared component.
 *
 * Badge renders a label with a coloured pill style.
 * Variants: success, warning, danger, info, neutral (default).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders the label text", () => {
    render(<Badge label="Active" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies neutral variant classes by default", () => {
    render(<Badge label="Default" />);
    const badge = screen.getByText("Default");
    expect(badge.className).toContain("bg-gray-100");
    expect(badge.className).toContain("text-gray-700");
  });

  it("applies success variant classes", () => {
    render(<Badge label="Online" variant="success" />);
    const badge = screen.getByText("Online");
    expect(badge.className).toContain("bg-green-100");
    expect(badge.className).toContain("text-green-800");
  });

  it("applies warning variant classes", () => {
    render(<Badge label="Pending" variant="warning" />);
    const badge = screen.getByText("Pending");
    expect(badge.className).toContain("bg-yellow-100");
    expect(badge.className).toContain("text-yellow-800");
  });

  it("applies danger variant classes", () => {
    render(<Badge label="Error" variant="danger" />);
    const badge = screen.getByText("Error");
    expect(badge.className).toContain("bg-red-100");
    expect(badge.className).toContain("text-red-800");
  });

  it("applies info variant classes", () => {
    render(<Badge label="New" variant="info" />);
    const badge = screen.getByText("New");
    expect(badge.className).toContain("bg-blue-100");
    expect(badge.className).toContain("text-blue-800");
  });

  it("renders as an inline-flex span with rounded-full", () => {
    render(<Badge label="Tag" />);
    const badge = screen.getByText("Tag");
    expect(badge.tagName).toBe("SPAN");
    expect(badge.className).toContain("inline-flex");
    expect(badge.className).toContain("rounded-full");
  });
});
