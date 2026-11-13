import { normName, TacticalPlay, BoardMeta } from '../tactics/tacticsLogic';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

export interface FieldTokenData {
  id: string;
  kind: 'vasco' | 'opp' | 'ball';
  name?: string;
  role?: string;
  num?: string | number;
  photo?: string;
  club?: string;
  playerId?: string;
  rawPosition?: string;
  birthDate?: string;
  age?: string;
  nationality?: string;
  contract?: string;
  marketValue?: string;
  profileUrl?: string;
  comment?: string;
  x: number; // 0 to 1 relative to pitch
  y: number; // 0 to 1 relative to pitch
  locked?: boolean;
}

export interface LineupSnapshot {
  version: number;
  savedAt: string;
  opponentClub: string;
  players: Array<{
    id: string;
    name: string;
    role: string;
    photo?: string;
    x: number;
    y: number;
    locked?: boolean;
  }>;
  opponents: Array<{
    id: string;
    number: string | number;
    x: number;
    y: number;
    locked?: boolean;
  }>;
  ball?: {
    id: string;
    x: number;
    y: number;
  } | null;
  drawing: string; // base64 dataURL
}

export interface SavedBoard {
  id?: number;
  meta: BoardMeta;
  state: {
    opponentClub: string;
    pieces: FieldTokenData[];
    drawing?: string;
  };
  savedAt: string;
}

export interface CommunityLineup {
  id: string;
  authorUid?: string;
  author: string;
  authorAvatar?: string;
  authorRole?: string;
  title: string;
  opponentClub: string;
  formation: string;
  players: Array<{ name: string; role: string; x: number; y: number; photo?: string }>;
  imageUrl?: string; // Static pitch photo snapshot (immutable view)
  likes: number;
  publishedAt: string;
}

class StorageManager {
  private photoCache: Record<string, string> = {};
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported in this environment'));
        return;
      }

      const request = indexedDB.open('PV19Fotos', 4);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('photos')) {
          db.createObjectStore('photos');
        }
        if (!db.objectStoreNames.contains('lineup')) {
          db.createObjectStore('lineup');
        }
        if (!db.objectStoreNames.contains('plays')) {
          db.createObjectStore('plays', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('boards')) {
          db.createObjectStore('boards', { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  async loadPhotoCache(): Promise<Record<string, string>> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('photos', 'readonly');
      const store = tx.objectStore('photos');
      const keysReq = store.getAllKeys();

      return new Promise((resolve) => {
        keysReq.onsuccess = () => {
          const keys = keysReq.result;
          if (!keys.length) {
            resolve(this.photoCache);
            return;
          }
          let pending = keys.length;
          keys.forEach((key) => {
            const req = store.get(key);
            req.onsuccess = () => {
              this.photoCache[String(key)] = req.result as string;
              pending--;
              if (pending === 0) resolve(this.photoCache);
            };
            req.onerror = () => {
              pending--;
              if (pending === 0) resolve(this.photoCache);
            };
          });
        };
        keysReq.onerror = () => resolve(this.photoCache);
      });
    } catch {
      return this.photoCache;
    }
  }

  getPhoto(playerName: string, fallbackUrl = ''): string {
    const key = normName(playerName);
    return this.photoCache[key] || fallbackUrl;
  }

  async storePhoto(playerName: string, base64: string): Promise<void> {
    const key = normName(playerName);
    this.photoCache[key] = base64;
    try {
      const db = await this.openDB();
      const tx = db.transaction('photos', 'readwrite');
      tx.objectStore('photos').put(base64, key);
    } catch (e) {
      console.warn('Could not store photo in IndexedDB', e);
    }
  }

  async saveLineup(snapshot: LineupSnapshot): Promise<void> {
    // 1. Save in IndexedDB
    try {
      const db = await this.openDB();
      const tx = db.transaction('lineup', 'readwrite');
      tx.objectStore('lineup').put(snapshot, 'last');
    } catch (e) {
      console.warn('Error saving lineup to IndexedDB:', e);
    }

    // 2. Fallback to localStorage
    try {
      localStorage.setItem('pv_last_lineup_v50', JSON.stringify(snapshot));
    } catch {}

    // 3. Cloud sync to user's private Firestore subcollection when signed in
    const uid = auth.currentUser?.uid;
    if (uid && auth.currentUser?.emailVerified) {
      const path = `users/${uid}/tactical_data/lineup_last`;
      try {
        await setDoc(doc(db, 'users', uid, 'tactical_data', 'lineup_last'), {
          ownerUid: uid,
          kind: 'lineup',
          payload: JSON.parse(JSON.stringify(snapshot)),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn(`Firestore sync warning at ${path}:`, err);
      }
    }
  }

  async loadLastLineup(): Promise<LineupSnapshot | null> {
    // Try IndexedDB first
    try {
      const db = await this.openDB();
      const tx = db.transaction('lineup', 'readonly');
      const req = tx.objectStore('lineup').get('last');
      const result = await new Promise<LineupSnapshot | null>((resolve) => {
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (result) return result;
    } catch {}

    // Try localStorage
    try {
      const raw = localStorage.getItem('pv_last_lineup_v50');
      if (raw) return JSON.parse(raw);
    } catch {}

    return null;
  }

  async getAllPlays(): Promise<TacticalPlay[]> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('plays', 'readonly');
      const req = tx.objectStore('plays').getAll();
      const result = await new Promise<TacticalPlay[]>((resolve) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });

      return result || [];
    } catch {
      return [];
    }
  }

  async savePlay(play: TacticalPlay): Promise<number | string> {
    const playData = {
      ...play,
      updated: new Date().toISOString()
    };

    try {
      const idb = await this.openDB();
      const tx = idb.transaction('plays', 'readwrite');
      const store = tx.objectStore('plays');

      const dataToSave: any = { ...playData };
      if (!dataToSave.id) delete dataToSave.id;

      return new Promise((resolve, reject) => {
        const req = store.put(dataToSave);
        req.onsuccess = () => {
          const id = req.result as number;
          const uid = auth.currentUser?.uid;
          if (uid && auth.currentUser?.emailVerified) {
            const docId = `play_${String(id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
            setDoc(doc(db, 'users', uid, 'tactical_data', docId), {
              ownerUid: uid,
              kind: 'play',
              payload: JSON.parse(JSON.stringify({ ...dataToSave, id })),
              updatedAt: serverTimestamp()
            }).catch((err) => console.warn('Firestore play sync warning:', err));
          }
          resolve(id);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return Date.now();
    }
  }

  async deletePlay(id: number | string): Promise<void> {
    try {
      const dbIdb = await this.openDB();
      const tx = dbIdb.transaction('plays', 'readwrite');
      tx.objectStore('plays').delete(id as any);
      const uid = auth.currentUser?.uid;
      if (uid && auth.currentUser?.emailVerified) {
        const docId = `play_${String(id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        deleteDoc(doc(db, 'users', uid, 'tactical_data', docId)).catch(() => {});
      }
    } catch (e) {
      console.warn('Could not delete play', e);
    }
  }

  async getAllBoards(): Promise<SavedBoard[]> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('boards', 'readonly');
      const req = tx.objectStore('boards').getAll();
      return new Promise<SavedBoard[]>((resolve) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async saveNamedBoard(board: SavedBoard): Promise<number | string> {
    try {
      const idb = await this.openDB();
      const tx = idb.transaction('boards', 'readwrite');
      const store = tx.objectStore('boards');
      const dataToSave: any = { ...board, savedAt: new Date().toISOString() };
      if (!dataToSave.id) delete dataToSave.id;

      return new Promise((resolve, reject) => {
        const req = store.put(dataToSave);
        req.onsuccess = () => {
          const id = req.result as number;
          const uid = auth.currentUser?.uid;
          if (uid && auth.currentUser?.emailVerified) {
            const docId = `board_${String(id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
            setDoc(doc(db, 'users', uid, 'tactical_data', docId), {
              ownerUid: uid,
              kind: 'board',
              payload: JSON.parse(JSON.stringify({ ...dataToSave, id })),
              updatedAt: serverTimestamp()
            }).catch((err) => console.warn('Firestore board sync warning:', err));
          }
          resolve(id);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return Date.now();
    }
  }

  async deleteBoard(id: number | string): Promise<void> {
    try {
      const dbIdb = await this.openDB();
      const tx = dbIdb.transaction('boards', 'readwrite');
      tx.objectStore('boards').delete(id as any);
      const uid = auth.currentUser?.uid;
      if (uid && auth.currentUser?.emailVerified) {
        const docId = `board_${String(id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        deleteDoc(doc(db, 'users', uid, 'tactical_data', docId)).catch(() => {});
      }
    } catch (e) {
      console.warn('Could not delete board', e);
    }
  }

  createDefaultDemoPlay(): TacticalPlay {
    return {
      name: 'EXEMPLO - Triangulação e infiltração',
      scope: 'both',
      speed: 1200,
      isDemo: true,
      frames: [
        {
          positions: [
            { id: 'demo_v_0', x: 0.26, y: 0.57 },
            { id: 'demo_v_1', x: 0.39, y: 0.48 },
            { id: 'demo_v_2', x: 0.5, y: 0.38 },
            { id: 'demo_a_1', x: 0.58, y: 0.39 },
            { id: 'demo_a_2', x: 0.61, y: 0.55 },
            { id: 'bola', x: 0.35, y: 0.52 }
          ]
        },
        {
          positions: [
            { id: 'demo_v_0', x: 0.34, y: 0.61 },
            { id: 'demo_v_1', x: 0.46, y: 0.5 },
            { id: 'demo_v_2', x: 0.58, y: 0.32 },
            { id: 'demo_a_1', x: 0.61, y: 0.35 },
            { id: 'demo_a_2', x: 0.65, y: 0.51 },
            { id: 'bola', x: 0.46, y: 0.5 }
          ]
        },
        {
          positions: [
            { id: 'demo_v_0', x: 0.4, y: 0.62 },
            { id: 'demo_v_1', x: 0.52, y: 0.49 },
            { id: 'demo_v_2', x: 0.68, y: 0.28 },
            { id: 'demo_a_1', x: 0.65, y: 0.32 },
            { id: 'demo_a_2', x: 0.69, y: 0.48 },
            { id: 'bola', x: 0.65, y: 0.3 }
          ]
        }
      ]
    };
  }

  async getCommunityLineups(): Promise<CommunityLineup[]> {
    const path = 'community_lineups';
    try {
      const q = query(collection(db, path), orderBy('publishedAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as Record<string, any>;
        const publishedAt =
          data.publishedAt instanceof Timestamp
            ? data.publishedAt.toDate().toISOString()
            : String(data.publishedAt || new Date().toISOString());
        return {
          id: d.id,
          authorUid: String(data.authorUid || ''),
          author: String(data.author || 'Torcedor'),
          authorAvatar: String(data.authorAvatar || ''),
          authorRole: String(data.authorRole || 'member'),
          title: String(data.title || 'Escalação'),
          opponentClub: String(data.opponentClub || 'Geral'),
          formation: String(data.formation || '4-3-3'),
          players: Array.isArray(data.players) ? data.players : [],
          imageUrl: String(data.imageUrl || ''),
          likes: Number(data.likes || 0),
          publishedAt
        };
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  }

  async publishCommunityLineup(
    lineup: Omit<CommunityLineup, 'id' | 'likes' | 'publishedAt'>
  ): Promise<CommunityLineup | null> {
    const uid = auth.currentUser?.uid;
    if (!uid || !auth.currentUser?.emailVerified) {
      throw new Error('Faça login com uma Conta Google verificada para publicar.');
    }

    const lineupId = `com_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const path = `community_lineups/${lineupId}`;
    const sanitizedPlayers = (lineup.players || []).slice(0, 25).map((p) => ({
      name: String(p.name || '').slice(0, 80),
      role: String(p.role || '').slice(0, 20),
      x: Number(p.x || 0),
      y: Number(p.y || 0),
      photo: String(p.photo || '').slice(0, 500)
    }));

    const docData = {
      authorUid: uid,
      author: String(lineup.author || auth.currentUser.displayName || 'Torcedor').slice(0, 120),
      authorAvatar: String(lineup.authorAvatar || auth.currentUser.photoURL || '').slice(0, 500),
      authorRole: String(lineup.authorRole || 'member').slice(0, 30),
      title: String(lineup.title || 'Escalação').slice(0, 160),
      opponentClub: String(lineup.opponentClub || 'Geral').slice(0, 100),
      formation: String(lineup.formation || '4-3-3').slice(0, 30),
      players: sanitizedPlayers,
      imageUrl: String(lineup.imageUrl || '').slice(0, 900000),
      likes: 0,
      publishedAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'community_lineups', lineupId), docData);
      return {
        id: lineupId,
        ...docData,
        publishedAt: new Date().toISOString()
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }

  async likeCommunityLineup(id: string): Promise<number | null> {
    const path = `community_lineups/${id}`;
    try {
      const ref = doc(db, 'community_lineups', id);
      await updateDoc(ref, {
        likes: increment(1)
      });
      const updated = await getDoc(ref);
      return updated.exists() ? Number(updated.data().likes || 0) : null;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async deleteCommunityLineup(id: string): Promise<boolean> {
    const path = `community_lineups/${id}`;
    try {
      await deleteDoc(doc(db, 'community_lineups', id));
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }
}

export const storage = new StorageManager();
