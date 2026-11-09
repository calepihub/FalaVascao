import test from 'node:test';
import assert from 'node:assert/strict';
import { authService, OWNER_EMAIL, AppUser } from './auth';

test('authService recognizes tazmaniacrvg@gmail.com as Owner and Super Admin', () => {
  const ownerUser: AppUser = {
    id: 'test_owner',
    email: 'tazmaniacrvg@gmail.com',
    name: 'Tazmania CRVG',
    avatar: '',
    role: 'owner',
    status: 'active',
    permissions: {
      canPostMural: true,
      canUseTactics: true,
      canUseAdvancedTools: true,
      canModerate: true
    },
    createdAt: new Date().toISOString()
  };

  assert.equal(authService.isOwner(ownerUser), true);
  assert.equal(authService.isAdminOrOwner(ownerUser), true);
});

test('authService enforces owner status even if email has uppercase characters', () => {
  const upperCaseOwner: AppUser = {
    id: 'test_owner_upper',
    email: 'TAZMANIACRVG@GMAIL.COM',
    name: 'Tazmania CRVG',
    avatar: '',
    role: 'owner',
    status: 'active',
    permissions: {
      canPostMural: true,
      canUseTactics: true,
      canUseAdvancedTools: true,
      canModerate: true
    },
    createdAt: new Date().toISOString()
  };

  assert.equal(authService.isOwner(upperCaseOwner), true);
  assert.equal(authService.isAdminOrOwner(upperCaseOwner), true);
});

test('regular member is not owner but can use allowed features', () => {
  const member: AppUser = {
    id: 'test_member',
    email: 'torcedor@gmail.com',
    name: 'Torcedor Vascaíno',
    avatar: '',
    role: 'member',
    status: 'active',
    permissions: {
      canPostMural: true,
      canUseTactics: true,
      canUseAdvancedTools: false,
      canModerate: false
    },
    createdAt: new Date().toISOString()
  };

  assert.equal(authService.isOwner(member), false);
  assert.equal(authService.isAdminOrOwner(member), false);
  assert.equal(member.permissions.canPostMural, true);
  assert.equal(member.permissions.canUseTactics, true);
  assert.equal(member.permissions.canUseAdvancedTools, false);
});
