import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AppUser,
  buildDefaultPermissionsForRole,
  canAccessTacticsBoard,
  computeServerPresenceNowMs,
  formatLastSeenLabel,
  isAdminOrOwnerUser,
  isOwnerUser,
  isUserCurrentlyOnline,
  isVerifiedOwnerEmail,
  ONLINE_PRESENCE_TTL_MS,
  OWNER_EMAIL,
  resolveInitialRoleForGoogleEmail,
  sanitizeAdminMessageText
} from './authRoles';

test('recognizes verified tazmaniacrvg@gmail.com as Owner and Super Admin', () => {
  const ownerUser: AppUser = {
    id: 'uid_owner',
    email: OWNER_EMAIL,
    emailVerified: true,
    name: 'Tazmania CRVG',
    avatar: '',
    role: 'owner',
    status: 'active',
    permissions: buildDefaultPermissionsForRole('owner'),
    createdAt: new Date().toISOString()
  };

  assert.equal(isOwnerUser(ownerUser), true);
  assert.equal(isAdminOrOwnerUser(ownerUser), true);
  assert.equal(resolveInitialRoleForGoogleEmail('tazmaniacrvg@gmail.com', true), 'owner');
});

test('enforces owner recognition case-insensitively when Google email is verified', () => {
  const upperCaseOwner: AppUser = {
    id: 'uid_owner_upper',
    email: 'TAZMANIACRVG@GMAIL.COM',
    emailVerified: true,
    name: 'Tazmania CRVG',
    avatar: '',
    role: 'owner',
    status: 'active',
    permissions: buildDefaultPermissionsForRole('owner'),
    createdAt: new Date().toISOString()
  };

  assert.equal(isOwnerUser(upperCaseOwner), true);
  assert.equal(isAdminOrOwnerUser(upperCaseOwner), true);
  assert.equal(isVerifiedOwnerEmail('TAZMANIACRVG@GMAIL.COM', true), true);
});

test('rejects unverified email spoofing even when email string matches owner', () => {
  const spoofedOwner: AppUser = {
    id: 'uid_spoof',
    email: OWNER_EMAIL,
    emailVerified: false,
    name: 'Spoofer',
    avatar: '',
    role: 'owner',
    status: 'active',
    permissions: buildDefaultPermissionsForRole('owner'),
    createdAt: new Date().toISOString()
  };

  assert.equal(isOwnerUser(spoofedOwner), false);
  assert.equal(isAdminOrOwnerUser(spoofedOwner), false);
  assert.equal(resolveInitialRoleForGoogleEmail(OWNER_EMAIL, false), 'member');
});

test('routes any other Google email to standard member role without admin access', () => {
  assert.equal(resolveInitialRoleForGoogleEmail('torcedor@gmail.com', true), 'member');

  const member: AppUser = {
    id: 'uid_member',
    email: 'torcedor@gmail.com',
    emailVerified: true,
    name: 'Torcedor Vascaíno',
    avatar: '',
    role: 'member',
    status: 'active',
    permissions: buildDefaultPermissionsForRole('member'),
    createdAt: new Date().toISOString()
  };

  assert.equal(isOwnerUser(member), false);
  assert.equal(isAdminOrOwnerUser(member), false);
  assert.equal(member.permissions.canPostMural, true);
  assert.equal(member.permissions.canUseTactics, true);
  assert.equal(member.permissions.canUseAdvancedTools, false);
  assert.equal(member.permissions.canModerate, false);
});

test('blocks Prancheta access unless user is logged in with a verified Google account', () => {
  assert.deepEqual(canAccessTacticsBoard(null, true), {
    allowed: false,
    reason: 'unauthenticated'
  });

  const unverified: AppUser = {
    id: 'uid_unverified',
    email: 'alguem@gmail.com',
    emailVerified: false,
    name: 'Alguém',
    avatar: '',
    role: 'member',
    status: 'active',
    permissions: buildDefaultPermissionsForRole('member'),
    createdAt: new Date().toISOString()
  };
  assert.deepEqual(canAccessTacticsBoard(unverified, true), {
    allowed: false,
    reason: 'unauthenticated'
  });

  const blocked: AppUser = { ...unverified, emailVerified: true, status: 'blocked' };
  assert.deepEqual(canAccessTacticsBoard(blocked, true), {
    allowed: false,
    reason: 'blocked'
  });

  const restrictedMember: AppUser = {
    ...unverified,
    emailVerified: true,
    permissions: { ...buildDefaultPermissionsForRole('member'), canUseTactics: false }
  };
  assert.deepEqual(canAccessTacticsBoard(restrictedMember, true), {
    allowed: false,
    reason: 'permission_denied'
  });

  const activeMember: AppUser = { ...unverified, emailVerified: true };
  assert.deepEqual(canAccessTacticsBoard(activeMember, false), {
    allowed: false,
    reason: 'disabled_by_admin'
  });
  assert.deepEqual(canAccessTacticsBoard(activeMember, true), { allowed: true });

  const owner: AppUser = {
    id: 'uid_owner',
    email: OWNER_EMAIL,
    emailVerified: true,
    name: 'Tazmania CRVG',
    avatar: '',
    role: 'owner',
    status: 'active',
    permissions: buildDefaultPermissionsForRole('owner'),
    createdAt: new Date().toISOString()
  };
  assert.deepEqual(canAccessTacticsBoard(owner, false), { allowed: true });
});

test('computes live online presence with TTL expiry and sanitizes admin messages', () => {
  const now = 1_700_000_000_000;
  const freshOnline = {
    isOnline: true,
    lastSeenAt: new Date(now - 30_000).toISOString()
  };
  const staleOnline = {
    isOnline: true,
    lastSeenAt: new Date(now - ONLINE_PRESENCE_TTL_MS - 5_000).toISOString()
  };
  const explicitOffline = {
    isOnline: false,
    lastSeenAt: new Date(now - 1_000).toISOString()
  };

  assert.equal(isUserCurrentlyOnline(freshOnline, now), true);
  assert.equal(isUserCurrentlyOnline(staleOnline, now), false);
  assert.equal(isUserCurrentlyOnline(explicitOffline, now), false);
  assert.equal(isUserCurrentlyOnline(null, now), false);

  assert.equal(formatLastSeenLabel(new Date(now - 10_000).toISOString(), now), 'Há poucos segundos');
  assert.equal(formatLastSeenLabel(new Date(now - 300_000).toISOString(), now), 'Há 5 min');
  assert.equal(formatLastSeenLabel(undefined, now), 'Sem registro');

  assert.equal(sanitizeAdminMessageText('   Olá torcedor!   '), 'Olá torcedor!');
  assert.equal(sanitizeAdminMessageText('a'.repeat(1500)).length, 1000);
});

test('keeps active members online accurately even with severe local clock skew relative to Firestore serverTimestamp', () => {
  const realServerTime = Date.parse('2025-05-15T12:00:00.000Z');
  const skewedLocalClock = Date.parse('2026-11-13T16:00:00.000Z');

  const users = [
    {
      id: 'admin_uid',
      isOnline: true,
      lastSeenAt: new Date(realServerTime).toISOString()
    },
    {
      id: 'member_online_uid',
      isOnline: true,
      lastSeenAt: new Date(realServerTime - 25_000).toISOString()
    },
    {
      id: 'member_stale_uid',
      isOnline: true,
      lastSeenAt: new Date(realServerTime - ONLINE_PRESENCE_TTL_MS - 10_000).toISOString()
    }
  ];

  // Without anchor, skewed local clock would falsely fail; with server anchor it stays accurate
  const refNowMs = computeServerPresenceNowMs(
    users,
    'admin_uid',
    { serverMs: realServerTime, observedLocalMs: skewedLocalClock - 5_000 },
    skewedLocalClock
  );

  assert.equal(isUserCurrentlyOnline(users[1], refNowMs), true);
  assert.equal(isUserCurrentlyOnline(users[2], refNowMs), false);
  // Newer server heartbeat ahead of admin's anchor is also treated as online
  assert.equal(
    isUserCurrentlyOnline(
      { isOnline: true, lastSeenAt: new Date(realServerTime + 90_000).toISOString() },
      refNowMs
    ),
    true
  );
});
