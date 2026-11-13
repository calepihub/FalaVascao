import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType
} from './firebase';
import {
  AppUser,
  buildDefaultPermissionsForRole,
  DEFAULT_SITE_SETTINGS,
  isAdminOrOwnerUser,
  isOwnerUser,
  isVerifiedOwnerEmail,
  OWNER_EMAIL,
  resolveInitialRoleForGoogleEmail,
  SiteSettings,
  UserPermissions,
  UserRole,
  UserStatus
} from './authRoles';

export type {
  AppUser,
  SiteSettings,
  UserPermissions,
  UserRole,
  UserStatus
};
export {
  DEFAULT_SITE_SETTINGS,
  OWNER_EMAIL,
  buildDefaultPermissionsForRole,
  isAdminOrOwnerUser,
  isOwnerUser,
  isVerifiedOwnerEmail,
  resolveInitialRoleForGoogleEmail
};

let cachedCurrentUser: AppUser | null = null;
const inFlightSyncByUid = new Map<string, Promise<AppUser>>();

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function clampString(val: string | null | undefined, max: number): string {
  return (val || '').trim().slice(0, max);
}

async function performSyncFirebaseUserToFirestore(fbUser: FirebaseUser): Promise<AppUser> {
  const email = clampString(fbUser.email, 200).toLowerCase();
  if (!email || !fbUser.emailVerified) {
    await signOut(auth).catch(() => {});
    throw new Error('Sua Conta Google precisa ter um e-mail verificado.');
  }

  const ownerMatch = isVerifiedOwnerEmail(email, fbUser.emailVerified);
  const displayName =
    clampString(fbUser.displayName, 120) ||
    clampString(email.split('@')[0], 120) ||
    'Torcedor';
  const avatar = clampString(fbUser.photoURL, 500);
  const userPath = `users/${fbUser.uid}`;
  const userRef = doc(db, 'users', fbUser.uid);

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
  }

  if (!snap.exists()) {
    const initialRole = resolveInitialRoleForGoogleEmail(email, fbUser.emailVerified);
    const initialPerms = buildDefaultPermissionsForRole(initialRole);
    const payload = {
      uid: fbUser.uid,
      email,
      name: displayName,
      avatar,
      role: initialRole,
      status: 'active' as UserStatus,
      permissions: initialPerms,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(userRef, payload);
    } catch (err) {
      // Check if a concurrent tab/session created the doc a millisecond earlier
      try {
        const retrySnap = await getDoc(userRef);
        if (retrySnap.exists()) {
          const existing = retrySnap.data() as Record<string, any>;
          const resolvedRole: UserRole = ownerMatch
            ? 'owner'
            : (existing.role as UserRole) || 'member';
          const syncedUser: AppUser = {
            id: fbUser.uid,
            email,
            emailVerified: fbUser.emailVerified,
            name: String(existing.name || displayName),
            avatar: String(existing.avatar || avatar),
            role: resolvedRole,
            status: ownerMatch ? 'active' : (existing.status as UserStatus) || 'active',
            permissions: ownerMatch
              ? buildDefaultPermissionsForRole('owner')
              : existing.permissions || buildDefaultPermissionsForRole(resolvedRole),
            createdAt: toIsoString(existing.createdAt)
          };
          cachedCurrentUser = syncedUser;
          return syncedUser;
        }
      } catch {
        // Ignore retry read error and fall through to handleFirestoreError
      }
      handleFirestoreError(err, OperationType.CREATE, userPath);
    }

    const createdUser: AppUser = {
      id: fbUser.uid,
      email,
      emailVerified: fbUser.emailVerified,
      name: displayName,
      avatar,
      role: initialRole,
      status: 'active',
      permissions: initialPerms,
      createdAt: new Date().toISOString()
    };
    cachedCurrentUser = createdUser;
    return createdUser;
  }

  const existing = snap.data() as Record<string, any>;
  if (existing.status === 'blocked' && !ownerMatch) {
    await signOut(auth).catch(() => {});
    throw new Error('Esta conta foi suspensa pela administração do Fala Vascão.');
  }

  // Action A: Self profile sync only when name or avatar actually changed
  if (existing.name !== displayName || (existing.avatar || '') !== avatar) {
    try {
      await updateDoc(userRef, {
        name: displayName,
        avatar,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userPath);
    }
  }

  const resolvedRole: UserRole = ownerMatch
    ? 'owner'
    : (existing.role as UserRole) || 'member';
  const resolvedPermissions: UserPermissions = ownerMatch
    ? buildDefaultPermissionsForRole('owner')
    : existing.permissions || buildDefaultPermissionsForRole(resolvedRole);

  const syncedUser: AppUser = {
    id: fbUser.uid,
    email,
    emailVerified: fbUser.emailVerified,
    name: displayName,
    avatar,
    role: resolvedRole,
    status: ownerMatch ? 'active' : (existing.status as UserStatus) || 'active',
    permissions: resolvedPermissions,
    createdAt: toIsoString(existing.createdAt)
  };
  cachedCurrentUser = syncedUser;
  return syncedUser;
}

function syncFirebaseUserToFirestore(fbUser: FirebaseUser): Promise<AppUser> {
  const existingPromise = inFlightSyncByUid.get(fbUser.uid);
  if (existingPromise) {
    return existingPromise;
  }

  const syncPromise = performSyncFirebaseUserToFirestore(fbUser).finally(() => {
    inFlightSyncByUid.delete(fbUser.uid);
  });
  inFlightSyncByUid.set(fbUser.uid, syncPromise);
  return syncPromise;
}

export const authService = {
  getCurrentUser(): AppUser | null {
    return cachedCurrentUser;
  },

  isOwner(user?: AppUser | null): boolean {
    return isOwnerUser(user);
  },

  isAdminOrOwner(user?: AppUser | null): boolean {
    return isAdminOrOwnerUser(user);
  },

  onAuthChange(
    callback: (user: AppUser | null, errorMessage?: string) => void
  ): () => void {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        cachedCurrentUser = null;
        callback(null);
        return;
      }

      try {
        const synced = await syncFirebaseUserToFirestore(fbUser);
        callback(synced);
      } catch (err) {
        cachedCurrentUser = null;
        const msg =
          err instanceof Error
            ? err.message
            : 'Falha ao validar sua Conta Google no Firestore.';
        callback(null, msg);
      }
    });
  },

  async signInWithGoogle(): Promise<AppUser> {
    const credential = await signInWithPopup(auth, googleProvider);
    return await syncFirebaseUserToFirestore(credential.user);
  },

  async logout(): Promise<void> {
    cachedCurrentUser = null;
    await signOut(auth);
  },

  async getRegisteredUsers(): Promise<AppUser[]> {
    const path = 'users';
    try {
      const snapshot = await getDocs(collection(db, path));
      const list: AppUser[] = snapshot.docs.map((d) => {
        const data = d.data() as Record<string, any>;
        return {
          id: d.id,
          email: String(data.email || ''),
          emailVerified: true,
          name: String(data.name || 'Torcedor'),
          avatar: String(data.avatar || ''),
          role: (data.role as UserRole) || 'member',
          status: (data.status as UserStatus) || 'active',
          permissions:
            (data.permissions as UserPermissions) ||
            buildDefaultPermissionsForRole('member'),
          createdAt: toIsoString(data.createdAt)
        };
      });
      // Owner always listed first, then newest
      return list.sort((a, b) => {
        if (isOwnerUser(a) && !isOwnerUser(b)) return -1;
        if (!isOwnerUser(a) && isOwnerUser(b)) return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async updateUser(update: {
    id: string;
    role?: UserRole;
    status?: UserStatus;
    permissions?: Partial<UserPermissions>;
  }): Promise<AppUser | null> {
    const path = `users/${update.id}`;
    const userRef = doc(db, 'users', update.id);
    try {
      const currentSnap = await getDoc(userRef);
      if (!currentSnap.exists()) return null;
      const currentData = currentSnap.data() as Record<string, any>;

      const nextRole = update.role || (currentData.role as UserRole);
      const nextStatus = update.status || (currentData.status as UserStatus);
      const nextPermissions: UserPermissions = update.permissions
        ? { ...(currentData.permissions || {}), ...update.permissions }
        : currentData.permissions;

      await updateDoc(userRef, {
        role: nextRole,
        status: nextStatus,
        permissions: nextPermissions,
        updatedAt: serverTimestamp()
      });

      return {
        id: update.id,
        email: String(currentData.email || ''),
        emailVerified: true,
        name: String(currentData.name || ''),
        avatar: String(currentData.avatar || ''),
        role: nextRole,
        status: nextStatus,
        permissions: nextPermissions,
        createdAt: toIsoString(currentData.createdAt)
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  async deleteUser(userId: string): Promise<boolean> {
    const path = `users/${userId}`;
    try {
      await deleteDoc(doc(db, 'users', userId));
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  async getSiteSettings(): Promise<SiteSettings> {
    const path = 'settings/site';
    try {
      const snap = await getDoc(doc(db, 'settings', 'site'));
      if (snap.exists()) {
        const d = snap.data() as Partial<SiteSettings>;
        return { ...DEFAULT_SITE_SETTINGS, ...d };
      }
    } catch (err) {
      console.warn('Erro ao ler configurações do Firestore, usando padrão:', err);
    }
    return { ...DEFAULT_SITE_SETTINGS };
  },

  subscribeSiteSettings(callback: (settings: SiteSettings) => void): () => void {
    const path = 'settings/site';
    return onSnapshot(
      doc(db, 'settings', 'site'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data() as Partial<SiteSettings>;
          callback({ ...DEFAULT_SITE_SETTINGS, ...d });
        } else {
          callback({ ...DEFAULT_SITE_SETTINGS });
        }
      },
      (err) => {
        console.warn(`Snapshot listener error at ${path}:`, err);
      }
    );
  },

  async updateSiteSettings(
    settings: Partial<SiteSettings>
  ): Promise<SiteSettings | null> {
    const path = 'settings/site';
    try {
      const current = await this.getSiteSettings();
      const merged: SiteSettings = {
        muralVisible: settings.muralVisible ?? current.muralVisible,
        muralPublicPosting: settings.muralPublicPosting ?? current.muralPublicPosting,
        tacticsVisible: settings.tacticsVisible ?? current.tacticsVisible,
        advancedToolsVisible:
          settings.advancedToolsVisible ?? current.advancedToolsVisible,
        liveStreamsVisible: settings.liveStreamsVisible ?? current.liveStreamsVisible,
        kickBannerVisible: settings.kickBannerVisible ?? current.kickBannerVisible
      };
      await setDoc(doc(db, 'settings', 'site'), {
        ...merged,
        updatedAt: serverTimestamp()
      });
      return merged;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }
};
