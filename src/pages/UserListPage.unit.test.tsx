/**
 * Unit tests for the UserListPage.
 *
 * After refactoring, UserListPage should use shared components:
 * - DataTable for the user table
 * - ConfirmModal for deactivation confirmation
 * - FormModal for adding users
 * - EmptyState for empty user list
 * - ErrorState for API errors
 * - LoadingState for loading skeleton
 * - Badge for status indicators
 *
 * Critical integration requirements:
 * - CRUD operations work (list, create, delete)
 * - Destructive actions require confirmation
 * - Protected entities handled (Section 13.3):
 *   - 'admin' user cannot be deleted
 *   - 'anonymous' user is hidden from UI entirely
 *
 * These tests mock RTK Query hooks to test component behaviour in isolation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, authenticatedState } from "@/test-utils";
import { UserListPage } from "./UserListPage";

// Mock the RTK Query hooks
vi.mock("@/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/store")>();
  return {
    ...actual,
    useListUsersQuery: vi.fn(),
    useDeleteUserMutation: vi.fn(),
    useCreateUserMutation: vi.fn(),
  };
});

// Import the mocked hooks for manipulation
import { useListUsersQuery, useDeleteUserMutation, useCreateUserMutation } from "@/store";
import type { TdbUser } from "@/store";

const mockUseListUsersQuery = vi.mocked(useListUsersQuery);
const mockUseDeleteUserMutation = vi.mocked(useDeleteUserMutation);
const mockUseCreateUserMutation = vi.mocked(useCreateUserMutation);

const sampleUsers: ReadonlyArray<TdbUser> = [
  { name: "admin" },
  { name: "alice" },
  { name: "bob" },
  { name: "anonymous" },
];

let deleteMutationTrigger: ReturnType<typeof vi.fn>;
let createMutationTrigger: ReturnType<typeof vi.fn>;

function setupDefaultMocks() {
  deleteMutationTrigger = vi.fn().mockReturnValue({ unwrap: () => Promise.resolve() });
  createMutationTrigger = vi.fn().mockReturnValue({ unwrap: () => Promise.resolve() });

  mockUseListUsersQuery.mockReturnValue({
    data: sampleUsers,
    isLoading: false,
    isError: false,
    error: undefined,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useListUsersQuery>);

  mockUseDeleteUserMutation.mockReturnValue([
    deleteMutationTrigger,
    { isLoading: false, reset: vi.fn() },
  ] as unknown as ReturnType<typeof useDeleteUserMutation>);

  mockUseCreateUserMutation.mockReturnValue([
    createMutationTrigger,
    { isLoading: false, reset: vi.fn() },
  ] as unknown as ReturnType<typeof useCreateUserMutation>);
}

describe("UserListPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupDefaultMocks();
  });

  describe("protected entities — Section 13.3", () => {
    it("hides the 'anonymous' user from the user list entirely", () => {
      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      expect(screen.queryByText("anonymous")).not.toBeInTheDocument();
      // But other users should be visible
      expect(screen.getByText("alice")).toBeInTheDocument();
      expect(screen.getByText("bob")).toBeInTheDocument();
    });

    it("does not render a Deactivate button for the 'admin' user", () => {
      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      // admin should be visible but with no deactivate action
      expect(screen.getByText("admin")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /deactivate admin/i })
      ).not.toBeInTheDocument();
    });

    it("renders Deactivate buttons for non-admin, non-anonymous users", () => {
      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      expect(
        screen.getByRole("button", { name: /deactivate alice/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /deactivate bob/i })
      ).toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("renders LoadingState component when data is loading", () => {
      mockUseListUsersQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: undefined,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useListUsersQuery>);

      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      // Should show title even during loading
      expect(screen.getByText("Users")).toBeInTheDocument();
      // Should not show the table
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("renders ErrorState component with retry button when API returns error", () => {
      const refetch = vi.fn();
      mockUseListUsersQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { status: 500 },
        refetch,
      } as unknown as ReturnType<typeof useListUsersQuery>);

      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });

    it("calls refetch when Retry button is clicked", async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      mockUseListUsersQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { status: 500 },
        refetch,
      } as unknown as ReturnType<typeof useListUsersQuery>);

      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      await user.click(screen.getByRole("button", { name: /retry/i }));
      expect(refetch).toHaveBeenCalledOnce();
    });

    it("shows network error message for non-HTTP errors", () => {
      mockUseListUsersQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { error: "TypeError: Failed to fetch" },
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useListUsersQuery>);

      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("renders EmptyState when user list is empty", () => {
      mockUseListUsersQuery.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: undefined,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useListUsersQuery>);

      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(screen.getByText(/no users found/i)).toBeInTheDocument();
    });

    it("still shows Add User button in empty state", () => {
      mockUseListUsersQuery.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: undefined,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useListUsersQuery>);

      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      expect(screen.getByRole("button", { name: /add user/i })).toBeInTheDocument();
    });
  });

  describe("user table rendering", () => {
    it("renders a table with Username and Status columns", () => {
      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: /username/i })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: /status/i })).toBeInTheDocument();
    });

    it("shows Active badge for all listed users", () => {
      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      const badges = screen.getAllByText("Active");
      // admin + alice + bob = 3 (anonymous is hidden)
      expect(badges.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("deactivate user flow", () => {
    it("opens confirmation modal when Deactivate is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      await user.click(screen.getByRole("button", { name: /deactivate alice/i }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/deactivate user/i)).toBeInTheDocument();
    });

    it("calls deleteUser mutation when confirmation is confirmed", async () => {
      const user = userEvent.setup();
      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      await user.click(screen.getByRole("button", { name: /deactivate alice/i }));

      // Click the destructive confirm button in the modal
      const confirmBtn = screen.getByRole("button", { name: /deactivate$/i });
      await user.click(confirmBtn);

      expect(deleteMutationTrigger).toHaveBeenCalledWith("alice");
    });

    it("closes modal when Cancel is clicked in confirmation dialog", async () => {
      const user = userEvent.setup();
      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      await user.click(screen.getByRole("button", { name: /deactivate alice/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /cancel/i }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("closes modal after successful deletion", async () => {
      const user = userEvent.setup();
      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      await user.click(screen.getByRole("button", { name: /deactivate alice/i }));
      const confirmBtn = screen.getByRole("button", { name: /deactivate$/i });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("create user flow", () => {
    it("opens FormModal when Add User button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      await user.click(screen.getByRole("button", { name: /add user/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByLabelText("Principal")).toBeInTheDocument();
      expect(screen.getByLabelText("Credential")).toBeInTheDocument();
    });

    it("calls createUser mutation with trimmed username and password", async () => {
      const user = userEvent.setup();
      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      await user.click(screen.getByRole("button", { name: /add user/i }));
      await user.type(screen.getByLabelText("Principal"), "  newuser  ");
      await user.type(screen.getByLabelText("Credential"), "SecurePass123");
      await user.click(screen.getByRole("button", { name: /create principal/i }));

      expect(createMutationTrigger).toHaveBeenCalledWith({
        username: "newuser",
        password: "SecurePass123",
      });
    });

    it("shows validation error when username is empty", async () => {
      const user = userEvent.setup();
      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      await user.click(screen.getByRole("button", { name: /add user/i }));
      await user.type(screen.getByLabelText("Credential"), "SecurePass123");
      await user.click(screen.getByRole("button", { name: /create principal/i }));

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/principal name and credential are required/i)).toBeInTheDocument();
      expect(createMutationTrigger).not.toHaveBeenCalled();
    });

    it("shows error message when createUser mutation fails", async () => {
      const user = userEvent.setup();
      createMutationTrigger.mockReturnValue({
        unwrap: () => Promise.reject(new Error("User exists")),
      });

      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      await user.click(screen.getByRole("button", { name: /add user/i }));
      await user.type(screen.getByLabelText("Principal"), "existing");
      await user.type(screen.getByLabelText("Credential"), "SecurePass123");
      await user.click(screen.getByRole("button", { name: /create principal/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });

    it("closes modal and resets form after successful creation", async () => {
      const user = userEvent.setup();
      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      await user.click(screen.getByRole("button", { name: /add user/i }));
      await user.type(screen.getByLabelText("Principal"), "newuser");
      await user.type(screen.getByLabelText("Credential"), "SecurePass123");
      await user.click(screen.getByRole("button", { name: /create principal/i }));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("password reset navigation", () => {
    it("renders Reset Password button for each non-anonymous user", () => {
      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      expect(
        screen.getByRole("button", { name: /reset password for admin/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /reset password for alice/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /reset password for bob/i })
      ).toBeInTheDocument();
    });
  });

  describe("uses shared components (refactoring verification)", () => {
    it("uses DataTable for rendering the user list (has proper table semantics)", () => {
      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      const table = screen.getByRole("table");
      expect(table).toBeInTheDocument();
      // DataTable wraps in a div with specific classes
      expect(table.closest(".overflow-x-auto.rounded-lg.border")).toBeInTheDocument();
    });

    it("uses Badge component for status (has rounded-full class pattern)", () => {
      renderWithProviders(<UserListPage />, {
        preloadedState: authenticatedState,
      });

      const badges = screen.getAllByText("Active");
      badges.forEach((badge) => {
        expect(badge.className).toContain("rounded-full");
      });
    });
  });
});
