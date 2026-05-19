/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TDB_URL: string;
  readonly VITE_TDB_USER: string;
  readonly VITE_AUTH_MODE: string;
  /** Dev-only: static Bearer token to bypass oauth2-proxy in local development. */
  readonly VITE_DEV_TOKEN: string;
  /** Base URL for mediation layer API (proxy mode). Defaults to relative "/api/v1/admin". */
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
