import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAppSelector } from "@/store";
import { config } from "@/config";

interface ProtectedRouteProps {
  readonly children: React.ReactNode;
}

/**
 * Route guard — behaviour depends on auth mode:
 *
 * - **proxy mode** (M4 Enterprise): Always renders children.
 *   Session protection is handled by oauth2-proxy at the infrastructure layer.
 *   If the session is invalid, oauth2-proxy intercepts the request before it
 *   reaches the SPA and redirects to the IdP login flow.
 *
 * - **basic mode** (M3 Community): Checks Redux auth state.
 *   Redirects to /login if no credentials are stored in session.
 *   Preserves the intended URL in state so LoginPage can redirect back after auth.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const location = useLocation();

  // In proxy mode, oauth2-proxy handles session protection at the infra layer.
  // The SPA always renders — if the session expires, the proxy intercepts API calls
  // and returns 401, which RTK Query's baseQuery handles with a redirect.
  if (config.authMode === "proxy") {
    return <>{children}</>;
  }

  // Basic mode: check Redux auth state directly.
  // Preserve the current URL so the login page can redirect back after successful auth.
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};
