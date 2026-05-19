/**
 * Vitest setup file for @testing-library/jest-dom matchers.
 * Adds custom matchers like toBeInTheDocument(), toHaveAccessibleName(), etc.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Ensure DOM cleanup between tests (RTL auto-cleanup may not work with vitest)
afterEach(() => {
  cleanup();
});
