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
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  sanitizeSpeculatedSquadForStorage,
  sanitizeSquadId,
  SpeculatedSquad
} from './speculatedSquadHelpers';

export * from './speculatedSquadHelpers';

const LOCAL_CACHE_PREFIX = 'fv_speculated_squads_v1_';

function readLocalCache(uid: string): SpeculatedSquad[] {
  if (typeof window === 'undefined' || !uid) return [];
  try {
    const raw = window.localStorage.getItem(`${LOCAL_CACHE_PREFIX}${uid}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalCache(uid: string, squads: SpeculatedSquad[]): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    window.localStorage.setItem(`${LOCAL_CACHE_PREFIX}${uid}`, JSON.stringify(squads));
  } catch {
    // Ignore storage quota issues; Firestore remains primary source of truth
  }
}

function toDocId(squadId: string): string {
  return `spec_${sanitizeSquadId(squadId)}`;
}

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function mapDocToSpeculatedSquad(id: string, data: Record<string, any>): SpeculatedSquad | null {
  if (data.kind !== 'speculated_squad' || !data.payload || typeof data.payload !== 'object') {
    return null;
  }
  const payload = data.payload as Record<string, any>;
  const rawId = String(payload.id || id.replace(/^spec_/, ''));
  return {
    id: sanitizeSquadId(rawId),
    name: String(payload.name || 'Elenco Especulado'),
    description: String(payload.description || ''),
    players: Array.isArray(payload.players) ? payload.players : [],
    createdAt: String(payload.createdAt || toIsoString(data.updatedAt)),
    updatedAt: String(payload.updatedAt || toIsoString(data.updatedAt))
  };
}

export const speculatedSquadService = {
  getCachedLocalSquads(uid: string): SpeculatedSquad[] {
    return readLocalCache(uid);
  },

  async loadUserSpeculatedSquads(uid: string): Promise<SpeculatedSquad[]> {
    if (!uid) return [];
    const path = `users/${uid}/tactical_data`;
    try {
      const q = query(collection(db, 'users', uid, 'tactical_data'), where('ownerUid', '==', uid));
      const snap = await getDocs(q);
      const list = snap.docs
        .map((d) => mapDocToSpeculatedSquad(d.id, d.data({ serverTimestamps: 'estimate' })))
        .filter((s): s is SpeculatedSquad => s !== null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      writeLocalCache(uid, list);
      return list;
    } catch (err) {
      console.warn(`Could not load speculated squads from ${path}:`, err);
      return readLocalCache(uid);
    }
  },

  subscribeUserSpeculatedSquads(
    uid: string,
    callback: (squads: SpeculatedSquad[]) => void,
    onError?: (err: unknown) => void
  ): () => void {
    if (!uid) {
      callback([]);
      return () => {};
    }
    const path = `users/${uid}/tactical_data`;
    const q = query(collection(db, 'users', uid, 'tactical_data'), where('ownerUid', '==', uid));
    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => mapDocToSpeculatedSquad(d.id, d.data({ serverTimestamps: 'estimate' })))
          .filter((s): s is SpeculatedSquad => s !== null)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        writeLocalCache(uid, list);
        callback(list);
      },
      (err) => {
        console.error(`Speculated squads listener error at ${path}:`, err);
        if (onError) onError(err);
      }
    );
  },

  async saveSpeculatedSquad(uid: string, squad: SpeculatedSquad): Promise<SpeculatedSquad> {
    const fbUser = auth.currentUser;
    if (!fbUser || !fbUser.emailVerified || fbUser.uid !== uid) {
      throw new Error('Faça login com uma Conta Google verificada para salvar seu elenco especulado.');
    }

    const sanitized = sanitizeSpeculatedSquadForStorage({
      ...squad,
      updatedAt: new Date().toISOString()
    });
    const docId = toDocId(sanitized.id);
    const path = `users/${uid}/tactical_data/${docId}`;
    const docRef = doc(db, 'users', uid, 'tactical_data', docId);
    const serializedPayload = JSON.parse(JSON.stringify(sanitized));

    try {
      const existingSnap = await getDoc(docRef);
      if (existingSnap.exists()) {
        await updateDoc(docRef, {
          payload: serializedPayload,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(docRef, {
          ownerUid: uid,
          kind: 'speculated_squad',
          payload: serializedPayload,
          updatedAt: serverTimestamp()
        });
      }

      const cached = readLocalCache(uid);
      const nextCache = [sanitized, ...cached.filter((s) => s.id !== sanitized.id)];
      writeLocalCache(uid, nextCache);
      return sanitized;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async deleteSpeculatedSquad(uid: string, squadId: string): Promise<void> {
    const fbUser = auth.currentUser;
    if (!fbUser || !fbUser.emailVerified || fbUser.uid !== uid) {
      throw new Error('Faça login com sua Conta Google para remover o elenco especulado.');
    }

    const docId = toDocId(squadId);
    const path = `users/${uid}/tactical_data/${docId}`;
    try {
      await deleteDoc(doc(db, 'users', uid, 'tactical_data', docId));
      const nextCache = readLocalCache(uid).filter((s) => s.id !== squadId);
      writeLocalCache(uid, nextCache);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }
};
