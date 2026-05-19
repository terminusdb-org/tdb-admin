/**
 * Unit tests for the LoadingState shared component.
 *
 * LoadingState renders a skeleton loader with configurable number of rows.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LoadingState } from "./LoadingState";

describe("LoadingState", () => {
  it("renders 5 skeleton rows by default", () => {
    const { container } = render(<LoadingState />);
    const skeletonRows = container.querySelectorAll(".border-b.border-gray-100");
    expect(skeletonRows).toHaveLength(5);
  });

  it("renders the specified number of skeleton rows", () => {
    const { container } = render(<LoadingState rows={3} />);
    const skeletonRows = container.querySelectorAll(".border-b.border-gray-100");
    expect(skeletonRows).toHaveLength(3);
  });

  it("has animate-pulse class for loading animation", () => {
    const { container } = render(<LoadingState />);
    const pulseElement = container.querySelector(".animate-pulse");
    expect(pulseElement).toBeInTheDocument();
  });

  it("renders a header skeleton row", () => {
    const { container } = render(<LoadingState />);
    const header = container.querySelector(".bg-gray-50");
    expect(header).toBeInTheDocument();
  });

  it("is wrapped in a styled container with border", () => {
    const { container } = render(<LoadingState />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("rounded-lg");
    expect(wrapper?.className).toContain("border");
  });
});
