export { store } from "./store";
export type { RootState, AppDispatch } from "./store";
export { useAppDispatch, useAppSelector } from "./hooks";
export { baseApi } from "./baseApi";
export {
  login,
  logout,
  sessionInvalidated,
  setUsername,
  selectIsAuthenticated,
  selectSessionInvalidated,
  selectAuthUsername,
  selectIsGlobalAdmin,
} from "./authSlice";

// --- User API hooks + types ---
export {
  useListUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useChangePasswordMutation,
  useDeleteUserMutation,
} from "./api/tdbUserApi";
export type {
  TdbUser,
  ChangePasswordRequest,
  CreateUserRequest,
  TdbErrorResponse,
} from "./api/tdbUserApi";

// --- Organisation (Team) API hooks + types ---
export {
  useListOrganizationsQuery,
  useListOrganizationsForUserQuery,
  useGetOrganizationQuery,
  useCreateOrganizationMutation,
  useDeleteOrganizationMutation,
  useListOrgMembersQuery,
  useGetOrgMemberQuery,
  useAddOrgMemberMutation,
  useRemoveOrgMemberMutation,
  useGetOrgMemberDatabasesQuery,
} from "./api/tdbOrgApi";
export type {
  TdbOrganization,
  TdbOrgMember,
  TdbMemberCapability,
  TdbOrgDatabase,
  CreateOrganizationRequest,
  GetOrgMemberDatabasesRequest,
  AddOrgMemberRequest,
  RemoveOrgMemberRequest,
} from "./api/tdbOrgApi";

// --- Role + Capability API hooks + types ---
export {
  useListRolesQuery,
  useGetRoleQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useGrantCapabilityMutation,
  useRevokeCapabilityMutation,
  TDB_ACTIONS,
} from "./api/tdbRoleApi";
export type {
  TdbRole,
  TdbAction,
  CreateRoleRequest,
  UpdateRoleRequest,
  CapabilityScopeType,
  GrantCapabilityRequest,
  RevokeCapabilityRequest,
} from "./api/tdbRoleApi";

// --- Database (Data Product) API hooks + types ---
export {
  useListDatabasesQuery,
  useGetDatabaseQuery,
  useCreateDatabaseMutation,
  useUpdateDatabaseMutation,
  useDeleteDatabaseMutation,
} from "./api/tdbDatabaseApi";
export type {
  TdbDatabase,
  CreateDatabaseRequest,
  UpdateDatabaseRequest,
  DeleteDatabaseRequest,
  GetDatabaseRequest,
} from "./api/tdbDatabaseApi";

// --- Sync Status API hooks + types ---
export {
  useGetSyncStatusQuery,
  useCreateMissingGroupMutation,
  useCreateMissingOrgMutation,
} from "./api/syncApi";
export type {
  TeamSyncEntry,
  SyncSummary,
  SyncStatusResponse,
  CreateMissingGroupRequest,
  CreateMissingOrgRequest,
} from "./api/syncApi";

// --- Branch API hooks + types ---
export {
  useListBranchesQuery,
  useCreateBranchMutation,
  useDeleteBranchMutation,
} from "./api/tdbBranchApi";
export type {
  TdbBranch,
  ListBranchesRequest,
  CreateBranchRequest,
  DeleteBranchRequest,
} from "./api/tdbBranchApi";

// --- Mediation API hooks + types (proxy-mode-only operations) ---
export {
  useMediationCreateUserMutation,
  useMediationDeleteUserMutation,
  useMediationCreateTeamMutation,
  useMediationDeleteTeamMutation,
  useMediationAddTeamMemberMutation,
  useMediationRemoveTeamMemberMutation,
  useMediationGrantCapabilityMutation,
  useMediationRevokeCapabilityMutation,
  useTransferOwnershipMutation,
  useGetMediationHealthQuery,
} from "./api/mediationApi";
export type {
  MediationCreateUserRequest,
  MediationCreateTeamRequest,
  MediationAddTeamMemberRequest,
  MediationRemoveTeamMemberRequest,
  MediationGrantCapabilityRequest,
  MediationRevokeCapabilityRequest,
  MediationTransferOwnershipRequest,
  MediationSuccessResponse,
  MediationCreateUserResponse,
  MediationCreateTeamResponse,
  MediationErrorResponse,
  MediationErrorCode,
  MediationHealthResponse,
  DependencyHealth,
} from "./api/mediationApi";

// --- Indexer API hooks + types ---
export {
  useGetIndexStatusQuery,
  useTriggerIndexMutation,
  useDeleteIndexMutation,
} from "./api/indexerApi";
export type {
  IndexStatus,
  BranchProcessing,
  IndexEngine,
  IndexTriggerResponse,
  GetIndexStatusRequest,
  TriggerIndexRequest,
  DeleteIndexRequest,
} from "./api/indexerApi";

// --- Clustering API hooks + types ---
export {
  useGetClusteringQuery,
  useToggleClusteringMutation,
} from "./api/clusteringApi";
export type {
  ToggleClusteringRequest,
  ToggleClusteringResponse,
  GetClusteringRequest,
  GetClusteringResponse,
} from "./api/clusteringApi";
