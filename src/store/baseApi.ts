/**
 * Base RTK Query API for TDB admin operations.
 * All TDB admin endpoints extend this base API.
 *
 * Supports two auth modes (see config/env.ts for details):
 *
 * - **basic**: Direct TDB access with Basic Auth credentials from Redux authSlice.
 *   Used in M3 standalone mode and Community edition.
 *
 * - **proxy**: Behind oauth2-proxy which injects Bearer JWT on all proxied requests.
 *   Used in M4 Enterprise Hub.
 *   - Production: oauth2-proxy sets Authorization header (`set_authorization_header = true`).
 *     The frontend does NOT set the header — fetch includes cookies and proxy does the rest.
 *   - Dev mode: VITE_DEV_TOKEN is injected as Bearer token directly by prepareHeaders,
 *     simulating what oauth2-proxy would do.
 *
 * 401 Handling:
 *   All API responses are intercepted. On 401 (Unauthorized), the auth session is
 *   invalidated via the sessionInvalidated action, which triggers UI redirect to /login.
 *
 * Switching modes requires only VITE_AUTH_MODE env var change — no code changes.
 * (See m3-enterprise-admin-architecture.md §15)
 */

import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { config } from "@/config";
import { sessionInvalidated } from "./authSlice";

// ─── Auth State Shape (for getState typing without circular import) ─────────

interface AuthStateShape {
  readonly auth: {
    readonly credentials: string | null;
  };
}

// ─── Base Query with prepareHeaders ─────────────────────────────────────────

const rawBaseQuery = fetchBaseQuery({
  baseUrl: config.apiUrl,
  prepareHeaders: (headers, { getState }) => {
    if (config.authMode === "basic") {
      // M3 mode: inject Basic Auth from Redux state (user typed credentials at login)
      const state = getState() as AuthStateShape;
      const credentials = state.auth.credentials;
      if (credentials) {
        headers.set("Authorization", `Basic ${credentials}`);
      }
    } else if (config.authMode === "proxy" && config.devToken) {
      // Dev mode: inject the dev token as Bearer (simulates oauth2-proxy)
      headers.set("Authorization", `Bearer ${config.devToken}`);
    }
    // Production proxy mode: oauth2-proxy already sets Authorization header
    // on all proxied requests. Do NOT overwrite it — the browser fetch includes
    // credentials from the proxy session.
    return headers;
  },
  // In proxy mode, include credentials (cookies) so oauth2-proxy session is sent
  credentials: config.authMode === "proxy" ? "include" : "same-origin",
});

// ─── Base Query with 401 Reauth Handling ────────────────────────────────────

/**
 * Wraps rawBaseQuery to intercept 401 responses and dispatch sessionInvalidated.
 * This ensures any expired/revoked session is caught globally, regardless of which
 * specific endpoint triggered the failure.
 */
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    // Session is expired or token is invalid — invalidate auth state.
    // The UI layer listens for sessionInvalidated and redirects to /login.
    api.dispatch(sessionInvalidated());
  }

  return result;
};

// ─── API Definition ─────────────────────────────────────────────────────────

export const baseApi = createApi({
  reducerPath: "tdbApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["User", "Organization", "Role", "Capability", "Database", "Branch"],
  endpoints: () => ({}),
});
