#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════════════
# Runtime environment injection for Vite SPA
# ═══════════════════════════════════════════════════════════════════════════════
#
# Vite bakes environment variables at build time. For runtime configuration
# (e.g., different TDB URLs per deployment), we generate env-config.js at
# container start. The app's config loader reads window.__ENV__ first.
#
# Supported env vars:
#   VITE_TDB_URL  — TerminusDB API URL (required)
#   VITE_TDB_USER — Default admin username (optional, defaults to "admin")
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

ENV_FILE="/usr/share/nginx/html/env-config.js"

# Default values
TDB_URL="${VITE_TDB_URL:-http://localhost:6363}"
TDB_USER="${VITE_TDB_USER:-admin}"

# Generate runtime config
cat > "$ENV_FILE" <<EOF
// Runtime environment configuration — generated at container start
// Do not edit manually; set environment variables on the container instead.
window.__ENV__ = {
  VITE_TDB_URL: "${TDB_URL}",
  VITE_TDB_USER: "${TDB_USER}"
};
EOF

echo "env-config.js generated: TDB_URL=${TDB_URL}, TDB_USER=${TDB_USER}"

# Execute the CMD (nginx)
exec "$@"
