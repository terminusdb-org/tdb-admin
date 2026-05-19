/**
 * Auth state slice — manages authentication state for both auth modes.
 *
 * Basic mode (M3 standalone):
 *   - User types credentials → login action stores Base64-encoded credentials
 *   - Credentials are injected by prepareHeaders on every request
 *
 * Proxy mode (M4 Enterprise):
 *   - User is authenticated by oauth2-proxy session (or VITE_DEV_TOKEN in dev)
 *   - Session is assumed active until a 401 response invalidates it
 *   - sessionInvalidated action triggers redirect to /login
 *   - No credentials stored client-side — proxy handles token injection
 *
 * Hooks exported for frontend-engineer:
 *   - useIsAuthenticated — whether the current session/credentials are valid
 *   - useAuthUsername — current username (if known)
 */

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { config } from "@/config";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AuthState {
  /** Base64-encoded "user:password" for Basic Auth (basic mode only) */
  readonly credentials: string | null;
  /** The authenticated username (if known) */
  readonly username: string | null;
  /** Whether the user is currently authenticated */
  readonly isAuthenticated: boolean;
  /**
   * Whether the session was invalidated by a 401 response.
   * When true, the app should redirect to /login.
   * Reset on successful re-authentication.
   */
  readonly sessionInvalidated: boolean;
  /** Whether the authenticated user is the global admin (username === "admin") */
  readonly isGlobalAdmin: boolean;
}

function buildInitialState(): AuthState {
  if (config.authMode === "proxy") {
    // In proxy mode, the user is authenticated if we're running
    // (oauth2-proxy would have redirected unauthenticated users).
    // Dev token also counts as authenticated.
    const hasSession = config.devToken !== null || typeof window !== "undefined";
    return {
      credentials: null,
      username: null,
      isAuthenticated: hasSession,
      sessionInvalidated: false,
      isGlobalAdmin: false,
    };
  }

  // Basic mode: not authenticated until login action
  return {
    credentials: null,
    username: null,
    isAuthenticated: false,
    sessionInvalidated: false,
    isGlobalAdmin: false,
  };
}

const initialState: AuthState = buildInitialState();

// ─── Slice ──────────────────────────────────────────────────────────────────

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /**
     * Basic mode login — stores credentials for API requests.
     * In proxy mode, this is a no-op (auth handled externally).
     */
    login(state, action: PayloadAction<{ username: string; password: string }>) {
      const { username, password } = action.payload;
      state.credentials = btoa(`${username}:${password}`);
      state.username = username;
      state.isAuthenticated = true;
      state.sessionInvalidated = false;
      state.isGlobalAdmin = username === "admin";
    },

    /**
     * Logout — clears credentials and marks session as not authenticated.
     * In proxy mode, the actual session termination must be done via oauth2-proxy
     * (redirect to /oauth2/sign_out). This action only clears local state.
     */
    logout(state) {
      state.credentials = null;
      state.username = null;
      state.isAuthenticated = false;
      state.sessionInvalidated = false;
      state.isGlobalAdmin = false;
    },

    /**
     * Mark the session as invalidated (triggered by 401 response).
     * The UI layer should listen for this and redirect to /login.
     */
    sessionInvalidated(state) {
      state.credentials = null;
      state.username = null;
      state.isAuthenticated = false;
      state.sessionInvalidated = true;
      state.isGlobalAdmin = false;
    },

    /**
     * Proxy mode: set the username if discovered from token claims or API response.
     * This does not change auth state — only enriches display info.
     */
    setUsername(state, action: PayloadAction<string>) {
      state.username = action.payload;
    },
  },
});

export const { login, logout, sessionInvalidated, setUsername } = authSlice.actions;

// ─── Selectors ──────────────────────────────────────────────────────────────
// Use a local interface to avoid circular import from store.ts

interface AuthRootState {
  readonly auth: AuthState;
}

export const selectIsAuthenticated = (state: AuthRootState): boolean =>
  state.auth.isAuthenticated;

export const selectSessionInvalidated = (state: AuthRootState): boolean =>
  state.auth.sessionInvalidated;

export const selectAuthUsername = (state: AuthRootState): string | null =>
  state.auth.username;

export const selectIsGlobalAdmin = (state: AuthRootState): boolean =>
  state.auth.isGlobalAdmin;

export default authSlice.reducer;
