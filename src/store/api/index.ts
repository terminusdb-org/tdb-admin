// --- User API ---
export {
  tdbUserApi,
  useListUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useChangePasswordMutation,
  useDeleteUserMutation,
} from "./tdbUserApi";

export type {
  TdbUser,
  ChangePasswordRequest,
  CreateUserRequest,
  TdbErrorResponse,
} from "./tdbUserApi";

// --- Organisation (Team) API ---
export {
  tdbOrgApi,
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
} from "./tdbOrgApi";

export type {
  TdbOrganization,
  TdbOrgMember,
  TdbMemberCapability,
  TdbOrgDatabase,
  CreateOrganizationRequest,
  GetOrgMemberDatabasesRequest,
  AddOrgMemberRequest,
  RemoveOrgMemberRequest,
} from "./tdbOrgApi";

// --- Role + Capability API ---
export {
  tdbRoleApi,
  useListRolesQuery,
  useGetRoleQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useGrantCapabilityMutation,
  useRevokeCapabilityMutation,
  TDB_ACTIONS,
} from "./tdbRoleApi";

export type {
  TdbRole,
  TdbAction,
  CreateRoleRequest,
  UpdateRoleRequest,
  CapabilityScopeType,
  GrantCapabilityRequest,
  RevokeCapabilityRequest,
} from "./tdbRoleApi";

// --- Database (Data Product) API ---
export {
  tdbDatabaseApi,
  useListDatabasesQuery,
  useGetDatabaseQuery,
  useCreateDatabaseMutation,
  useUpdateDatabaseMutation,
  useDeleteDatabaseMutation,
} from "./tdbDatabaseApi";

export type {
  TdbDatabase,
  CreateDatabaseRequest,
  UpdateDatabaseRequest,
  DeleteDatabaseRequest,
  GetDatabaseRequest,
} from "./tdbDatabaseApi";

// --- Sync Status API ---
export {
  syncApi,
  useGetSyncStatusQuery,
  useCreateMissingGroupMutation,
  useCreateMissingOrgMutation,
} from "./syncApi";

export type {
  TeamSyncEntry,
  SyncSummary,
  SyncStatusResponse,
  CreateMissingGroupRequest,
  CreateMissingOrgRequest,
} from "./syncApi";

// --- Mediation API (proxy-mode-only operations) ---
export {
  mediationApi,
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
} from "./mediationApi";

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
} from "./mediationApi";
