/**
 * Test utilities for rendering tdb-admin components with required providers.
 * Provides a configureStore wrapper with baseApi, authSlice, and MemoryRouter.
 */
import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { MemoryRouter, type MemoryRouterProps } from "react-router-dom";
import { baseApi } from "@/store/baseApi";
import authReducer from "@/store/authSlice";

/** Shape of preloaded auth state for test setup */
interface TestAuthState {
  readonly credentials: string | null;
  readonly username: string | null;
  readonly isAuthenticated: boolean;
  readonly sessionInvalidated: boolean;
  readonly isGlobalAdmin: boolean;
}

interface TestPreloadedState {
  readonly auth: TestAuthState;
}

type CustomRenderOptions = Omit<RenderOptions, "wrapper"> & {
  readonly preloadedState?: TestPreloadedState;
  readonly routerProps?: MemoryRouterProps;
};

/**
 * Creates a fresh Redux store for testing.
 * Each test gets an isolated store to prevent state leakage.
 */
export function createTestStore(preloadedState?: TestPreloadedState) {
  return configureStore({
    reducer: {
      auth: authReducer,
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(baseApi.middleware),
    preloadedState,
  });
}

/**
 * Renders a component wrapped in all required providers:
 * - Redux Provider (with configurable preloaded state)
 * - MemoryRouter (with configurable initial entries)
 */
export function renderWithProviders(
  ui: React.ReactElement,
  {
    preloadedState,
    routerProps,
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  const store = createTestStore(preloadedState);

  function Wrapper({ children }: { readonly children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <MemoryRouter {...routerProps}>
          {children}
        </MemoryRouter>
      </Provider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    store,
  };
}

/**
 * Default authenticated state for tests.
 * Simulates a logged-in admin user in basic mode.
 */
export const authenticatedState: TestPreloadedState = {
  auth: {
    credentials: btoa("admin:testpassword"),
    username: "admin",
    isAuthenticated: true,
    sessionInvalidated: false,
    isGlobalAdmin: true,
  },
};
