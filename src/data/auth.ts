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
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType
} from './firebase';
import {
  AdminMessage,
  AppUser,
  buildDefaultPermissionsForRole,
  canAccessTacticsBoard,
  computeServerPresenceNowMs,
  DEFAULT_SITE_SETTINGS,
  formatLastSeenLabel,
  isAdminOrOwnerUser,
  isOwnerUser,
  isUserCurrentlyOnline,
  isVerifiedOwnerEmail,
  ONLINE_PRESENCE_TTL_MS,
  OWNER_EMAIL,
  resolveInitialRoleForGoogleEmail,
  sanitizeAdminMessageText,
  SiteSettings,
  TacticsAccessDenialReason,
  TacticsAccessResult,
  UserPermissions,
  UserRole,
  UserStatus
} from './authRoles';

export type {
  AdminMessage,
  AppUser,
  SiteSettings,
  TacticsAccessDenialReason,
  TacticsAccessResult,
  UserPermissions,
  UserRole,
  UserStatus
};
export {
  DEFAULT_SITE_SETTINGS,
  ONLINE_PRESENCE_TTL_MS,
  OWNER_EMAIL,
  buildDefaultPermissionsForRole,
  canAccessTacticsBoard,
  computeServerPresenceNowMs,
  formatLastSeenLabel,
  isAdminOrOwnerUser,
  isOwnerUser,
  isUserCurrentlyOnline,
  isVerifiedOwnerEmail,
  resolveInitialRoleForGoogleEmail,
  sanitizeAdminMessageText
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
      isOnline: true,
      lastSeenAt: serverTimestamp(),
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
            isOnline: true,
            lastSeenAt: new Date().toISOString(),
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

    const nowIso = new Date().toISOString();
    const createdUser: AppUser = {
      id: fbUser.uid,
      email,
      emailVerified: fbUser.emailVerified,
      name: displayName,
      avatar,
      isOnline: true,
      lastSeenAt: nowIso,
      role: initialRole,
      status: 'active',
      permissions: initialPerms,
      createdAt: nowIso
    };
    cachedCurrentUser = createdUser;
    return createdUser;
  }

  const existing = snap.data() as Record<string, any>;
  if (existing.status === 'blocked' && !ownerMatch) {
    await signOut(auth).catch(() => {});
    throw new Error('Esta conta foi suspensa pela administração do Fala Vascão.');
  }

  // Action A: Self profile & presence sync on login
  try {
    await updateDoc(userRef, {
      name: displayName,
      avatar,
      isOnline: true,
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, userPath);
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
    isOnline: true,
    lastSeenAt: new Date().toISOString(),
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

  canAccessTactics(user?: AppUser | null, tacticsVisible = true): TacticsAccessResult {
    return canAccessTacticsBoard(user, tacticsVisible);
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
    await this.updateUserPresence(false).catch(() => {});
    cachedCurrentUser = null;
    await signOut(auth);
  },

  async updateUserPresence(isOnline: boolean): Promise<void> {
    const fbUser = auth.currentUser;
    if (!fbUser || !fbUser.emailVerified) return;
    const path = `users/${fbUser.uid}`;
    try {
      await updateDoc(doc(db, 'users', fbUser.uid), {
        isOnline,
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch {
      // Presence heartbeat errors should never crash the user session
      console.warn(`Presence update skipped for ${path}`);
    }
  },

  async getRegisteredUsers(): Promise<AppUser[]> {
    const path = 'users';
    try {
      const snapshot = await getDocs(collection(db, path));
      const list: AppUser[] = snapshot.docs.map((d) => {
        const data = d.data({ serverTimestamps: 'estimate' }) as Record<string, any>;
        return {
          id: d.id,
          email: String(data.email || ''),
          emailVerified: true,
          name: String(data.name || 'Torcedor'),
          avatar: String(data.avatar || ''),
          isOnline: data.isOnline === true,
          lastSeenAt: data.lastSeenAt ? toIsoString(data.lastSeenAt) : undefined,
          role: (data.role as UserRole) || 'member',
          status: (data.status as UserStatus) || 'active',
          permissions:
            (data.permissions as UserPermissions) ||
            buildDefaultPermissionsForRole('member'),
          createdAt: toIsoString(data.createdAt)
        };
      });
      // Owner always listed first, then online users, then newest
      return list.sort((a, b) => {
        if (isOwnerUser(a) && !isOwnerUser(b)) return -1;
        if (!isOwnerUser(a) && isOwnerUser(b)) return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  subscribeRegisteredUsers(
    callback: (users: AppUser[]) => void,
    onError?: (err: unknown) => void
  ): () => void {
    const path = 'users';
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const list: AppUser[] = snapshot.docs.map((d) => {
          const data = d.data({ serverTimestamps: 'estimate' }) as Record<string, any>;
          return {
            id: d.id,
            email: String(data.email || ''),
            emailVerified: true,
            name: String(data.name || 'Torcedor'),
            avatar: String(data.avatar || ''),
            isOnline: data.isOnline === true,
            lastSeenAt: data.lastSeenAt ? toIsoString(data.lastSeenAt) : undefined,
            role: (data.role as UserRole) || 'member',
            status: (data.status as UserStatus) || 'active',
            permissions:
              (data.permissions as UserPermissions) ||
              buildDefaultPermissionsForRole('member'),
            createdAt: toIsoString(data.createdAt)
          };
        });
        const refNowMs = computeServerPresenceNowMs(list, cachedCurrentUser?.id);
        list.sort((a, b) => {
          if (isOwnerUser(a) && !isOwnerUser(b)) return -1;
          if (!isOwnerUser(a) && isOwnerUser(b)) return 1;
          const aOn = isUserCurrentlyOnline(a, refNowMs);
          const bOn = isUserCurrentlyOnline(b, refNowMs);
          if (aOn && !bOn) return -1;
          if (!aOn && bOn) return 1;
          return b.createdAt.localeCompare(a.createdAt);
        });
        callback(list);
      },
      (err) => {
        console.error(`Firestore error at ${path}:`, err);
        if (onError) onError(err);
      }
    );
  },

  async sendAdminMessage(recipientUid: string, rawMessage: string): Promise<AdminMessage> {
    const fbUser = auth.currentUser;
    if (!fbUser || !fbUser.emailVerified) {
      throw new Error('Autentique-se com a conta de Administrador Google para enviar mensagens.');
    }
    const cleanText = sanitizeAdminMessageText(rawMessage);
    if (!cleanText) {
      throw new Error('Digite uma mensagem antes de enviar.');
    }

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const path = `users/${recipientUid}/messages/${msgId}`;
    const senderName =
      clampString(cachedCurrentUser?.name || fbUser.displayName, 120) || 'Administração Fala Vascão';

    const docData = {
      recipientUid,
      senderUid: fbUser.uid,
      senderName,
      message: cleanText,
      acknowledged: false,
      createdAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'users', recipientUid, 'messages', msgId), docData);
      return {
        id: msgId,
        recipientUid,
        senderUid: fbUser.uid,
        senderName,
        message: cleanText,
        acknowledged: false,
        createdAt: new Date().toISOString()
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },

  subscribePendingAdminMessages(
    userId: string,
    callback: (messages: AdminMessage[]) => void,
    onError?: (err: unknown) => void
  ): () => void {
    const path = `users/${userId}/messages`;
    // Must filter by recipientUid so Firestore static query security proves resource.data.recipientUid == request.auth.uid
    const q = query(
      collection(db, 'users', userId, 'messages'),
      where('recipientUid', '==', userId)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const items: AdminMessage[] = snapshot.docs
          .map((d) => {
            const data = d.data({ serverTimestamps: 'estimate' }) as Record<string, any>;
            return {
              id: d.id,
              recipientUid: String(data.recipientUid || userId),
              senderUid: String(data.senderUid || ''),
              senderName: String(data.senderName || 'Administração Fala Vascão'),
              message: String(data.message || ''),
              acknowledged: data.acknowledged === true,
              createdAt: toIsoString(data.createdAt)
            };
          })
          .filter((m) => !m.acknowledged && m.message.length > 0)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        callback(items);
      },
      (err) => {
        console.error(`Pending messages listener error at ${path}:`, err);
        if (onError) onError(err);
      }
    );
  },

  async acknowledgeAdminMessage(userId: string, messageId: string): Promise<void> {
    const path = `users/${userId}/messages/${messageId}`;
    try {
      await updateDoc(doc(db, 'users', userId, 'messages', messageId), {
        acknowledged: true,
        acknowledgedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
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
