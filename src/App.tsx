import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AdminLayout, ProtectedRoute } from "@/components";
import { LoginPage, UserListPage, PasswordResetPage, TeamSyncPage, IndexingStatusPage } from "@/pages";
import { TeamListPage, TeamDetailPage } from "@/pages/teams";
import { DataProductListPage } from "@/pages/data-products";
import { RoleListPage } from "@/pages/roles";
import { InvitationListPage } from "@/pages/invitations";
import { BootstrapWizardPage } from "@/pages/setup";
import { BranchListPage } from "@/pages/branches";
import { GrantsPage } from "@/pages/grants";
import { config } from "@/config";
import { useAppSelector, selectIsGlobalAdmin } from "@/store";

const AdminOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isGlobalAdmin = useAppSelector(selectIsGlobalAdmin);
  return isGlobalAdmin ? <>{children}</> : <Navigate to="/teams" replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter basename={config.basePath || "/"}>
      <Routes>
        {/* Parent is a splat route so it matches the basename root (/app/admin/)
            and every child path regardless of deployment basename. */}
        <Route path="/*" element={<Outlet />}>
          {/* Bootstrap wizard — public, only active in bootstrap mode */}
          <Route path="setup" element={<BootstrapWizardPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            {/* M2 routes */}
            <Route path="users" element={<UserListPage />} />
            <Route path="password-reset" element={<PasswordResetPage />} />

            {/* M3 routes */}
            <Route path="teams" element={<TeamListPage />} />
            <Route path="teams/:name" element={<TeamDetailPage />} />
            <Route
              path="roles"
              element={
                <AdminOnlyRoute>
                  <RoleListPage />
                </AdminOnlyRoute>
              }
            />
            <Route path="grants" element={<GrantsPage />} />
            <Route path="data-products" element={<DataProductListPage />} />
            <Route path="data-products/:org/:db/branches" element={<BranchListPage />} />
            <Route path="indexing" element={<IndexingStatusPage />} />
            <Route
              path="invitations"
              element={
                <AdminOnlyRoute>
                  <InvitationListPage />
                </AdminOnlyRoute>
              }
            />

            {/* M4 admin routes — only available when OpenBao is enabled */}
            {config.openBaoEnabled && <Route path="admin/team-sync" element={<TeamSyncPage />} />}

            <Route index element={<Navigate to="/teams" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
