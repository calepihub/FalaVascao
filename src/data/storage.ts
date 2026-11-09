import { normName, TacticalPlay, BoardMeta } from '../tactics/tacticsLogic';

export interface FieldTokenData {
  id: string;
  kind: 'vasco' | 'opp' | 'ball';
  name?: string;
  role?: string;
  num?: string | number;
  photo?: string;
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
  author: string;
  authorEmail?: string;
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

    // 3. Optional sync to backend API
    try {
      fetch('/api/interbase/lineup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot)
      }).catch(() => {});
    } catch {}
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
      const db = await this.openDB();
      const tx = db.transaction('plays', 'readwrite');
      const store = tx.objectStore('plays');

      const dataToSave: any = { ...playData };
      if (!dataToSave.id) delete dataToSave.id;

      return new Promise((resolve, reject) => {
        const req = store.put(dataToSave);
        req.onsuccess = () => {
          const id = req.result as number;
          // Sync with backend API
          fetch('/api/interbase/plays', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...dataToSave, id })
          }).catch(() => {});
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
      const db = await this.openDB();
      const tx = db.transaction('plays', 'readwrite');
      tx.objectStore('plays').delete(id as any);
      fetch(`/api/interbase/plays/${id}`, { method: 'DELETE' }).catch(() => {});
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
      const db = await this.openDB();
      const tx = db.transaction('boards', 'readwrite');
      const store = tx.objectStore('boards');
      const dataToSave: any = { ...board, savedAt: new Date().toISOString() };
      if (!dataToSave.id) delete dataToSave.id;

      return new Promise((resolve, reject) => {
        const req = store.put(dataToSave);
        req.onsuccess = () => {
          const id = req.result as number;
          fetch('/api/interbase/boards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...dataToSave, id })
          }).catch(() => {});
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
      const db = await this.openDB();
      const tx = db.transaction('boards', 'readwrite');
      tx.objectStore('boards').delete(id as any);
      fetch(`/api/interbase/boards/${id}`, { method: 'DELETE' }).catch(() => {});
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
    try {
      const res = await fetch('/api/community/lineups');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Could not load community lineups', e);
    }
    return [];
  }

  async publishCommunityLineup(
    lineup: Omit<CommunityLineup, 'id' | 'likes' | 'publishedAt'>
  ): Promise<CommunityLineup | null> {
    try {
      const res = await fetch('/api/community/lineups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lineup)
      });
      if (res.ok) {
        const data = await res.json();
        return data.lineup;
      }
    } catch (e) {
      console.warn('Could not publish lineup', e);
    }
    return null;
  }

  async likeCommunityLineup(id: string): Promise<number | null> {
    try {
      const res = await fetch('/api/community/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        const data = await res.json();
        return data.likes;
      }
    } catch {}
    return null;
  }

  async deleteCommunityLineup(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/community/lineups?id=${id}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch (e) {
      console.warn('Could not delete lineup', e);
      return false;
    }
  }
}

export const storage = new StorageManager();
