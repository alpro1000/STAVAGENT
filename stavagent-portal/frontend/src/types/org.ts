/**
 * Organization and Role types — Sprint 1
 */

export type PlanType = 'free' | 'starter' | 'professional' | 'enterprise';
export type StorageMode = 'managed' | 'byos' | 'private';
export type OrgRole = 'admin' | 'manager' | 'estimator' | 'viewer' | 'api_client';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: PlanType;
  storage_mode: StorageMode;
  max_projects: number;
  max_storage_gb: number;
  max_team_members: number;
  is_active: boolean;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
  owner_id: number;
  /** Populated when listing own orgs */
  my_role?: OrgRole;
  my_joined_at?: string;
}

export interface OrgMember {
  id: string;
  user_id: number;
  org_id?: string;
  role: OrgRole;
  name: string;
  email: string;
  avatar_url: string | null;
  invited_at: string;
  joined_at: string | null;
}

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  admin: 'Administrátor',
  manager: 'Manažer',
  estimator: 'Rozpočtář',
  viewer: 'Prohlížeč',
  api_client: 'API klient',
};

export const PLAN_LABELS: Record<PlanType, string> = {
  free: 'Zdarma',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

export const PLAN_COLORS: Record<PlanType, string> = {
  free: '#6b7280',
  starter: '#3b82f6',
  professional: '#8b5cf6',
  enterprise: '#f59e0b',
};
