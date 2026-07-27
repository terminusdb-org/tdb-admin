// Runtime environment configuration for the embedded TerminusDB dashboard.
// In this deployment the admin UI is served from the same origin as the API,
// so VITE_TDB_URL is empty (same-origin) and the default admin user is used.
globalThis.__ENV__ = {
  VITE_TDB_URL: "",
  VITE_TDB_USER: "admin"
};
