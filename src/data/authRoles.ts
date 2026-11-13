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
  isOnline?: boolean;
  lastSeenAt?: string;
  role: UserRole;
  status: UserStatus;
  permissions: UserPermissions;
  createdAt: string;
}

export interface AdminMessage {
  id: string;
  recipientUid: string;
  senderUid: string;
  senderName: string;
  message: string;
  acknowledged: boolean;
  createdAt: string;
  acknowledgedAt?: string;
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

export const ONLINE_PRESENCE_TTL_MS = 120_000;

export function isUserCurrentlyOnline(
  user?: Pick<AppUser, 'isOnline' | 'lastSeenAt'> | null,
  referenceNowMs = Date.now(),
  ttlMs = ONLINE_PRESENCE_TTL_MS
): boolean {
  if (!user || user.isOnline !== true || !user.lastSeenAt) return false;
  const lastSeenMs = Date.parse(user.lastSeenAt);
  if (!Number.isFinite(lastSeenMs)) return false;
  // Server-generated lastSeenAt ahead of or equal to referenceNowMs means active heartbeat/clock skew
  if (lastSeenMs >= referenceNowMs) return true;
  return referenceNowMs - lastSeenMs <= ttlMs;
}

export function computeServerPresenceNowMs(
  users: Array<Pick<AppUser, 'id' | 'isOnline' | 'lastSeenAt'>>,
  currentUserId?: string | null,
  serverAnchor?: { serverMs: number; observedLocalMs: number } | null,
  localNowMs = Date.now()
): number {
  const me = currentUserId ? users.find((u) => u.id === currentUserId) : undefined;
  const myLastSeenMs = me?.lastSeenAt ? Date.parse(me.lastSeenAt) : NaN;

  if (serverAnchor && Number.isFinite(serverAnchor.serverMs)) {
    const elapsed = Math.max(0, localNowMs - serverAnchor.observedLocalMs);
    const anchored = serverAnchor.serverMs + elapsed;
    if (Number.isFinite(myLastSeenMs) && myLastSeenMs > anchored) {
      return myLastSeenMs;
    }
    return anchored;
  }

  if (Number.isFinite(myLastSeenMs)) {
    return myLastSeenMs;
  }

  // Fallback to newest online server heartbeat if current user's doc has no lastSeenAt yet
  let newestOnlineMs = NaN;
  for (const u of users) {
    if (u.isOnline === true && u.lastSeenAt) {
      const ms = Date.parse(u.lastSeenAt);
      if (Number.isFinite(ms) && (!Number.isFinite(newestOnlineMs) || ms > newestOnlineMs)) {
        newestOnlineMs = ms;
      }
    }
  }
  return Number.isFinite(newestOnlineMs) ? newestOnlineMs : localNowMs;
}

export function formatLastSeenLabel(lastSeenAt?: string, nowMs = Date.now()): string {
  if (!lastSeenAt) return 'Sem registro';
  const lastSeenMs = Date.parse(lastSeenAt);
  if (!Number.isFinite(lastSeenMs)) return 'Sem registro';
  const diffSec = Math.max(0, Math.floor((nowMs - lastSeenMs) / 1000));
  if (diffSec < 60) return 'Há poucos segundos';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Há ${diffDays}d`;
}

export function sanitizeAdminMessageText(raw: string): string {
  return (raw || '').trim().slice(0, 1000);
}
