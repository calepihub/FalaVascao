export type UserRole = 'owner' | 'admin' | 'moderator' | 'vip' | 'member';
export type UserStatus = 'active' | 'pending' | 'blocked';

export interface UserPermissions {
  canPostMural: boolean;
  canUseTactics: boolean;
  canUseAdvancedTools: boolean;
  canModerate: boolean;
}

export interface AppUser {
  id: string;
  email: string;
  emailVerified?: boolean;
  name: string;
  avatar: string;
  role: UserRole;
  status: UserStatus;
  permissions: UserPermissions;
  createdAt: string;
}

export interface SiteSettings {
  muralVisible: boolean;
  muralPublicPosting: boolean;
  tacticsVisible: boolean;
  advancedToolsVisible: boolean;
  liveStreamsVisible: boolean;
  kickBannerVisible: boolean;
}

export const OWNER_EMAIL = 'tazmaniacrvg@gmail.com';

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  muralVisible: true,
  muralPublicPosting: true,
  tacticsVisible: true,
  advancedToolsVisible: true,
  liveStreamsVisible: true,
  kickBannerVisible: true
};

export function isVerifiedOwnerEmail(email?: string | null, emailVerified = true): boolean {
  if (!email || !emailVerified) return false;
  return email.trim().toLowerCase() === OWNER_EMAIL.toLowerCase();
}

export function isOwnerUser(user?: AppUser | null): boolean {
  if (!user) return false;
  return (
    isVerifiedOwnerEmail(user.email, user.emailVerified !== false) &&
    user.role === 'owner'
  );
}

export function isAdminOrOwnerUser(user?: AppUser | null): boolean {
  if (!user) return false;
  if (isOwnerUser(user)) return true;
  return user.role === 'admin' && user.status === 'active';
}

export function buildDefaultPermissionsForRole(role: UserRole): UserPermissions {
  if (role === 'owner' || role === 'admin') {
    return {
      canPostMural: true,
      canUseTactics: true,
      canUseAdvancedTools: true,
      canModerate: true
    };
  }
  if (role === 'moderator') {
    return {
      canPostMural: true,
      canUseTactics: true,
      canUseAdvancedTools: true,
      canModerate: true
    };
  }
  if (role === 'vip') {
    return {
      canPostMural: true,
      canUseTactics: true,
      canUseAdvancedTools: true,
      canModerate: false
    };
  }
  return {
    canPostMural: true,
    canUseTactics: true,
    canUseAdvancedTools: false,
    canModerate: false
  };
}

export function resolveInitialRoleForGoogleEmail(
  email?: string | null,
  emailVerified = false
): UserRole {
  return isVerifiedOwnerEmail(email, emailVerified) ? 'owner' : 'member';
}

export type TacticsAccessDenialReason =
  | 'unauthenticated'
  | 'blocked'
  | 'disabled_by_admin'
  | 'permission_denied';

export interface TacticsAccessResult {
  allowed: boolean;
  reason?: TacticsAccessDenialReason;
}

export function canAccessTacticsBoard(
  user?: AppUser | null,
  tacticsVisible = true
): TacticsAccessResult {
  if (!user || user.emailVerified === false) {
    return { allowed: false, reason: 'unauthenticated' };
  }
  if (isOwnerUser(user)) {
    return { allowed: true };
  }
  if (user.status === 'blocked') {
    return { allowed: false, reason: 'blocked' };
  }
  if (!tacticsVisible && !isAdminOrOwnerUser(user)) {
    return { allowed: false, reason: 'disabled_by_admin' };
  }
  if (user.permissions && user.permissions.canUseTactics === false && !isAdminOrOwnerUser(user)) {
    return { allowed: false, reason: 'permission_denied' };
  }
  return { allowed: true };
}
