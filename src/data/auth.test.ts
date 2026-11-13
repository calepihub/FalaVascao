import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AppUser,
  buildDefaultPermissionsForRole,
  isAdminOrOwnerUser,
  isOwnerUser,
  isVerifiedOwnerEmail,
  OWNER_EMAIL,
  resolveInitialRoleForGoogleEmail
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
