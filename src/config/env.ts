/**
 * Application configuration — centralised env var access.
 * Components MUST use this module instead of reading import.meta.env directly.
 *
 * Resolution order:
 *   1. window.__ENV__ (runtime injection via docker-entrypoint.sh / env-config.js)
 *   2. import.meta.env (Vite build-time injection, used in dev)
 *
 * This allows the same built image to be deployed with different TDB URLs.
 *
 * Auth Modes (M3→M4 transition, §15 of m3-enterprise-admin-architecture):
 *   - "basic": Direct TDB access with username:password (M3 standalone / Community)
 *   - "proxy": Behind oauth2-proxy — Bearer token injected by proxy (Enterprise Hub)
 *
 * In proxy mode, oauth2-proxy sets the Authorization header on all proxied requests.
 * The frontend does not need to inject auth — it just must NOT overwrite the header.
 *
 * Dev token support (VITE_DEV_TOKEN):
 *   In proxy mode during local development (without oauth2-proxy running), set
 *   VITE_DEV_TOKEN to a valid Bearer token. The app will inject it as Authorization
 *   header on all requests — simulating what oauth2-proxy would do in production.
 */

/** Auth mode determines how the admin panel authenticates API requests. */
type AuthMode = "basic" | "proxy";

/** Edition label derived from auth mode — drives UI branding. */
type Edition = "Community" | "Enterprise";

interface AppConfig {
  /** API base URL: TDB direct URL (basic mode) or mediation layer (proxy mode). */
  readonly apiUrl: string;
  /** Which authentication strategy to use for API requests. */
  readonly authMode: AuthMode;
  /** Deployment edition label for UI branding. */
  readonly edition: Edition;
  /** Default TDB username (only relevant in basic auth mode). */
  readonly tdbUser: string;
  /**
   * Dev token for local testing without oauth2-proxy.
   * Only used in proxy mode — injected as Bearer token in Authorization header.
   * In production, oauth2-proxy handles token injection and this is empty.
   */
  readonly devToken: string | null;
  /**
   * Whether OpenBao integration is available.
   * When false (default for community edition), features requiring OpenBao
   * (e.g. Team Sync) are hidden from the UI.
   */
  readonly openBaoEnabled: boolean;
  /**
   * Base path for client-side routing (BrowserRouter basename).
   * When embedded in TDB's built-in dashboard handler, this is "/dashboard".
   * In standalone mode (nginx/dev server), this is "/" (default).
   * Injected at runtime via window.__ENV__.VITE_BASE_PATH or at build time via Vite base.
   */
  readonly basePath: string;
  /**
   * UI package version, baked at release-build time by the release workflow
   * (the release tag, e.g. "v0.1.2"). "dev" for local builds.
   */
  readonly appVersion: string;
}

interface RuntimeEnv {
  readonly VITE_APP_VERSION?: string;
  readonly VITE_TDB_URL?: string;
  readonly VITE_TDB_USER?: string;
  readonly VITE_AUTH_MODE?: string;
  readonly VITE_DEV_TOKEN?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_OPENBAO_ENABLED?: string;
  readonly VITE_BASE_PATH?: string;
}

declare global {
  interface Window {
    __ENV__?: RuntimeEnv;
  }
}

function getEnvVar(name: keyof RuntimeEnv): string | undefined {
  // Runtime injection (window.__ENV__ from env-config.js) takes priority.
  // Empty string IS a valid runtime value — e.g. VITE_TDB_URL="" means "same-origin".
  if (typeof window !== "undefined" && window.__ENV__) {
    const runtimeValue = window.__ENV__[name];
    if (typeof runtimeValue === "string" && !runtimeValue.includes("PLACEHOLDER")) {
      return runtimeValue;
    }
  }

  // Build-time fallback (Vite's import.meta.env), also filtering PLACEHOLDERs.
  // Empty string is a valid value here too (e.g. VITE_TDB_URL="" for same-origin).
  const buildValue = import.meta.env[name];
  if (typeof buildValue === "string" && !buildValue.includes("PLACEHOLDER")) {
    return buildValue;
  }
  return undefined;
}

/** Parse the auth mode string into a typed union. Defaults to "basic". */
export function parseAuthMode(raw: string | undefined): AuthMode {
  if (raw === "proxy") {
    return "proxy";
  }
  return "basic";
}

/** Build AppConfig from resolved env values. Pure function — no side effects. */
export function buildConfig(env: {
  authMode: string | undefined;
  tdbUrl: string | undefined;
  tdbUser: string | undefined;
  devToken: string | undefined;
  apiUrl: string | undefined;
  openBaoEnabled: string | undefined;
  basePath: string | undefined;
  appVersion?: string;
}): AppConfig {
  const authMode = parseAuthMode(env.authMode);
  const tdbUser = typeof env.tdbUser === "string" && env.tdbUser.length > 0
    ? env.tdbUser
    : "admin";
  const devToken = typeof env.devToken === "string" && env.devToken.length > 0
    ? env.devToken
    : null;
  const openBaoEnabled = env.openBaoEnabled === "true" || env.openBaoEnabled === "1";
  // Base path for BrowserRouter: runtime env takes priority, then Vite's BASE_URL
  const basePath = typeof env.basePath === "string" && env.basePath.length > 0
    ? env.basePath.replace(/\/$/, "")
    : import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

  const edition: Edition = authMode === "proxy" ? "Enterprise" : "Community";
  const appVersion = env.appVersion ?? "dev";

  if (authMode === "proxy") {
    // In proxy mode, API calls go through oauth2-proxy → mediation layer (dfrnt-api).
    // VITE_API_URL overrides the default relative path for dev flexibility.
    const apiUrl = typeof env.apiUrl === "string" && env.apiUrl.length > 0
      ? env.apiUrl.replace(/\/$/, "")
      : "/api/v1/admin";
    return { apiUrl, authMode, edition, tdbUser, devToken, openBaoEnabled, basePath, appVersion };
  }

  // Basic mode: direct TDB access (M3 standalone / Community edition)
  if (typeof env.tdbUrl !== "string") {
    throw new Error(
      "VITE_TDB_URL is not configured. Set the environment variable or include env-config.js."
    );
  }

  // Empty string means "same-origin" — the browser uses the current host:port.
  // This is the default when tdb-admin is embedded in TDB's dashboard handler.
  return {
    apiUrl: env.tdbUrl.length > 0 ? env.tdbUrl.replace(/\/$/, "") : "",
    authMode,
    edition,
    tdbUser,
    devToken: null,
    openBaoEnabled,
    basePath,
    appVersion,
  };
}

function loadConfig(): AppConfig {
  return buildConfig({
    authMode: getEnvVar("VITE_AUTH_MODE"),
    tdbUrl: getEnvVar("VITE_TDB_URL"),
    tdbUser: getEnvVar("VITE_TDB_USER"),
    devToken: getEnvVar("VITE_DEV_TOKEN"),
    apiUrl: getEnvVar("VITE_API_URL"),
    openBaoEnabled: getEnvVar("VITE_OPENBAO_ENABLED"),
    basePath: getEnvVar("VITE_BASE_PATH"),
    appVersion: getEnvVar("VITE_APP_VERSION"),
  });
}

export type { AppConfig, AuthMode, Edition };
export const config: AppConfig = loadConfig();
