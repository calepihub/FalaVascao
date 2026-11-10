import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Support JSON bodies for lineup photos and metadata
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Database storage file path
const dbFilePath = path.resolve(__dirname, 'data', 'interbase_database.json');

function getDB() {
  try {
    if (!fs.existsSync(path.dirname(dbFilePath))) {
      fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
    }
    if (fs.existsSync(dbFilePath)) {
      return JSON.parse(fs.readFileSync(dbFilePath, 'utf-8'));
    }
  } catch (err) {
    console.warn('Error reading interbase_database.json:', err);
  }
  return { lineup: null, plays: [], boards: [], community_lineups: [], users: [], settings: null };
}

function saveDB(data: any) {
  try {
    if (!fs.existsSync(path.dirname(dbFilePath))) {
      fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
    }
    fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Error saving to interbase_database.json:', e);
  }
}

// Cache for YouTube feed aggregation (120 seconds)
let youtubeCache: { data: any; expires: number } | null = null;

async function fetchYouTubeFeed() {
  const now = Date.now();
  if (youtubeCache && youtubeCache.expires > now) {
    return youtubeCache.data;
  }

  const channelId = 'UCKXHqZ8jfdFGpJR_hHVWMqQ';
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  try {
    const [rssRes, streamsRes, shortsRes, videosRes] = await Promise.allSettled([
      fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
        headers: { 'User-Agent': 'FalaVascaoPortal/1.0' }
      }),
      fetch('https://www.youtube.com/@FalaVascao1/streams', { headers }),
      fetch('https://www.youtube.com/@FalaVascao1/shorts', { headers }),
      fetch('https://www.youtube.com/@FalaVascao1/videos', { headers })
    ]);

    const videoMap = new Map<
      string,
      {
        id: string;
        title: string;
        published: string;
        thumb: string;
        views: number;
        url: string;
        isLive: boolean;
        isShort: boolean;
        category: 'lives' | 'shorts' | 'videos';
      }
    >();

    const addOrUpdate = (
      id: string,
      item: {
        id: string;
        title: string;
        published: string;
        thumb: string;
        views: number;
        url: string;
        isLive: boolean;
        isShort: boolean;
        category: 'lives' | 'shorts' | 'videos';
      }
    ) => {
      if (!id || id.length !== 11) return;
      const existing = videoMap.get(id);
      if (!existing) {
        videoMap.set(id, item);
      } else {
        videoMap.set(id, {
          ...existing,
          ...item,
          published:
            existing.published && !existing.published.startsWith(new Date().toISOString().slice(0, 10))
              ? existing.published
              : item.published || existing.published,
          views: existing.views && existing.views > 0 ? existing.views : item.views || 0
        });
      }
    };

    // 1. Streams (/streams) - Real live broadcasts & full stream recordings
    if (streamsRes.status === 'fulfilled' && streamsRes.value.ok) {
      try {
        const html = await streamsRes.value.text();
        const lockupRegex =
          /"lockupMetadataViewModel":\{"title":\{"content":"([^"]+)"\}.*?"(?:watchEndpoint|videoCommand)":\{[^}]*?"videoId":"([a-zA-Z0-9_-]{11})"/g;
        let m;
        while ((m = lockupRegex.exec(html)) !== null) {
          const title = m[1];
          const id = m[2];
          addOrUpdate(id, {
            id,
            title,
            published: new Date().toISOString(),
            thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            views: 0,
            url: `https://www.youtube.com/watch?v=${id}`,
            isLive: true,
            isShort: false,
            category: 'lives'
          });
        }
      } catch (e) {
        console.warn('Error parsing streams html', e);
      }
    }

    // 2. Regular Uploaded Videos (/videos)
    if (videosRes.status === 'fulfilled' && videosRes.value.ok) {
      try {
        const html = await videosRes.value.text();
        const lockupRegex =
          /"lockupMetadataViewModel":\{"title":\{"content":"([^"]+)"\}.*?"(?:watchEndpoint|videoCommand)":\{[^}]*?"videoId":"([a-zA-Z0-9_-]{11})"/g;
        let m;
        while ((m = lockupRegex.exec(html)) !== null) {
          const title = m[1];
          const id = m[2];
          addOrUpdate(id, {
            id,
            title,
            published: new Date().toISOString(),
            thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            views: 0,
            url: `https://www.youtube.com/watch?v=${id}`,
            isLive: false,
            isShort: false,
            category: 'videos'
          });
        }
      } catch (e) {
        console.warn('Error parsing videos html', e);
      }
    }

    // 3. Shorts (/shorts) - Real shorts with titles and portrait links
    if (shortsRes.status === 'fulfilled' && shortsRes.value.ok) {
      try {
        const html = await shortsRes.value.text();
        const reelRegex = /"reelWatchEndpoint":\{"videoId":"([^"]+)".*?"accessibilityText":"([^"]+)"/g;
        let m;
        while ((m = reelRegex.exec(html)) !== null) {
          const id = m[1];
          const rawText = m[2];
          const title = rawText
            .replace(/,\s*[\d.,]+\s*(?:thousand|million|mil|visualizações|views).*/i, '')
            .trim();
          addOrUpdate(id, {
            id,
            title,
            published: new Date().toISOString(),
            thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            views: 0,
            url: `https://www.youtube.com/shorts/${id}`,
            isLive: false,
            isShort: true,
            category: 'shorts'
          });
        }
      } catch (e) {
        console.warn('Error parsing shorts html', e);
      }
    }

    // 4. RSS Feed - Most recent uploads with high precision published timestamp and view statistics
    const rssEntries: string[] = [];
    if (rssRes.status === 'fulfilled' && rssRes.value.ok) {
      try {
        const xml = await rssRes.value.text();
        const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
        let match;
        while ((match = entryRegex.exec(xml)) !== null) {
          const chunk = match[1];
          const id = (chunk.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
          const title = (chunk.match(/<title>([^<]+)<\/title>/) || [])[1];
          const published = (chunk.match(/<published>([^<]+)<\/published>/) || [])[1];
          const thumb =
            (chunk.match(/<media:thumbnail[^>]+url="([^"]+)"/) || [])[1] ||
            `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
          const viewsStr = (chunk.match(/<media:statistics[^>]+views="([^"]+)"/) || [])[1];
          const views = viewsStr ? parseInt(viewsStr, 10) : 0;

          if (id && title) {
            rssEntries.push(id);
            const existing = videoMap.get(id);
            const isShort = existing ? existing.isShort : title.toLowerCase().includes('#short') || (title.length < 50 && title.includes('#'));
            const isLive = existing ? existing.isLive : title.includes('AO VIVO') || title.includes('🔴') || title.includes('DIRETO DA BARREIRA');
            const category = isShort ? 'shorts' : isLive ? 'lives' : 'videos';

            addOrUpdate(id, {
              id,
              title,
              published: published || new Date().toISOString(),
              thumb,
              views,
              url: isShort ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
              isLive,
              isShort,
              category
            });
          }
        }
      } catch (e) {
        console.warn('Error parsing RSS XML', e);
      }
    }

    // Sort order: items in RSS feed first (chronologically newest), followed by remaining streams, regular videos, then shorts
    const entries = Array.from(videoMap.values()).sort((a, b) => {
      const aRss = rssEntries.indexOf(a.id);
      const bRss = rssEntries.indexOf(b.id);
      if (aRss !== -1 && bRss !== -1) return aRss - bRss;
      if (aRss !== -1) return -1;
      if (bRss !== -1) return 1;
      if (a.published && b.published && a.published !== b.published) {
        return new Date(b.published).getTime() - new Date(a.published).getTime();
      }
      return 0;
    });

    const result = {
      channel: {
        title: 'Fala Vascão',
        handle: '@FalaVascao1',
        id: channelId,
        youtubeUrl: 'https://www.youtube.com/@FalaVascao1',
        youtubeVideosUrl: 'https://www.youtube.com/@FalaVascao1/videos',
        youtubeShortsUrl: 'https://www.youtube.com/@FalaVascao1/shorts',
        youtubeStreamsUrl: 'https://www.youtube.com/@FalaVascao1/streams',
        kickUrl: 'https://kick.com/falavascao',
        kickVideosUrl: 'https://kick.com/falavascao/videos'
      },
      videos: entries,
      counts: {
        total: entries.length,
        lives: entries.filter((e) => e.isLive || e.category === 'lives').length,
        shorts: entries.filter((e) => e.isShort || e.category === 'shorts').length,
        videos: entries.filter((e) => e.category === 'videos' || (!e.isLive && !e.isShort)).length
      },
      lastUpdated: new Date().toISOString()
    };

    youtubeCache = {
      data: result,
      expires: now + 120000 // 2 minutes
    };

    return result;
  } catch (e) {
    console.warn('Could not aggregate YouTube feeds:', e);
    return youtubeCache?.data || { channel: {}, videos: [] };
  }
}

// 1. YouTube Live & Feed API
app.get('/api/youtube/videos', async (_req: Request, res: Response) => {
  const data = await fetchYouTubeFeed();
  res.json(data);
});

// 2. Lineup
app.get('/api/interbase/lineup', (_req: Request, res: Response) => {
  const db = getDB();
  res.json(db.lineup || null);
});

app.post('/api/interbase/lineup', (req: Request, res: Response) => {
  const db = getDB();
  db.lineup = req.body;
  saveDB(db);
  res.json({ status: 'ok', message: 'Lineup saved' });
});

// 3. Plays
app.get('/api/interbase/plays', (_req: Request, res: Response) => {
  const db = getDB();
  res.json(db.plays || []);
});

app.post('/api/interbase/plays', (req: Request, res: Response) => {
  const db = getDB();
  db.plays = db.plays || [];
  const play = req.body;
  const existingIndex = db.plays.findIndex((p: any) => p.id === play.id);
  if (existingIndex >= 0) {
    db.plays[existingIndex] = play;
  } else {
    db.plays.push(play);
  }
  saveDB(db);
  res.json({ status: 'ok', id: play.id });
});

// 4. Boards
app.get('/api/interbase/boards', (_req: Request, res: Response) => {
  const db = getDB();
  res.json(db.boards || []);
});

app.post('/api/interbase/boards', (req: Request, res: Response) => {
  const db = getDB();
  db.boards = db.boards || [];
  const board = req.body;
  const existingIndex = db.boards.findIndex((b: any) => b.id === board.id);
  if (existingIndex >= 0) {
    db.boards[existingIndex] = board;
  } else {
    db.boards.push(board);
  }
  saveDB(db);
  res.json({ status: 'ok', id: board.id });
});

// 5. Community Lineups ("Mural da Torcida" - strictly genuine data only)
app.get('/api/community/lineups', (_req: Request, res: Response) => {
  const db = getDB();
  res.json(db.community_lineups || []);
});

app.post('/api/community/lineups', (req: Request, res: Response) => {
  const db = getDB();
  db.community_lineups = db.community_lineups || [];
  const newLineup = {
    ...req.body,
    id: req.body.id || `com_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    likes: req.body.likes || 0,
    publishedAt: req.body.publishedAt || new Date().toISOString()
  };
  db.community_lineups.unshift(newLineup);
  saveDB(db);
  res.json({ status: 'ok', lineup: newLineup });
});

app.delete('/api/community/lineups', (req: Request, res: Response) => {
  const db = getDB();
  const targetId = req.query.id as string;
  if (targetId) {
    db.community_lineups = (db.community_lineups || []).filter((l: any) => l.id !== targetId);
    saveDB(db);
    res.json({ status: 'ok', deleted: targetId });
  } else {
    res.status(400).json({ error: 'Target ID required' });
  }
});

// 6. Community Like
app.post('/api/community/like', (req: Request, res: Response) => {
  const { id } = req.body;
  const db = getDB();
  db.community_lineups = db.community_lineups || [];
  const target = db.community_lineups.find((l: any) => l.id === id);
  if (target) {
    target.likes = (target.likes || 0) + 1;
    saveDB(db);
    res.json({ status: 'ok', likes: target.likes });
  } else {
    res.status(404).json({ error: 'Lineup not found' });
  }
});

// 7. Users & Permissions API (InterBase Database)
const OWNER_EMAIL = 'tazmaniacrvg@gmail.com';

function ensureOwnerExists(db: any) {
  db.users = db.users || [];
  let owner = db.users.find((u: any) => u.email?.toLowerCase() === OWNER_EMAIL.toLowerCase());
  if (!owner) {
    owner = {
      id: 'owner_tazmaniacrvg',
      email: OWNER_EMAIL,
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
    db.users.unshift(owner);
    saveDB(db);
  } else {
    owner.role = 'owner';
    owner.status = 'active';
    owner.permissions = {
      canPostMural: true,
      canUseTactics: true,
      canUseAdvancedTools: true,
      canModerate: true
    };
  }
  return owner;
}

app.get('/api/interbase/users', (_req: Request, res: Response) => {
  const db = getDB();
  ensureOwnerExists(db);
  res.json(db.users);
});

app.post('/api/interbase/users', (req: Request, res: Response) => {
  const db = getDB();
  ensureOwnerExists(db);

  const userData = req.body;
  const email = (userData.email || '').trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: 'Email required' });
    return;
  }

  const isOwner = email === OWNER_EMAIL.toLowerCase();
  let existing = db.users.find((u: any) => u.email?.toLowerCase() === email);

  if (existing) {
    existing.name = userData.name || existing.name;
    if (userData.avatar) existing.avatar = userData.avatar;
    if (isOwner) {
      existing.role = 'owner';
      existing.status = 'active';
      existing.permissions = {
        canPostMural: true,
        canUseTactics: true,
        canUseAdvancedTools: true,
        canModerate: true
      };
    }
    saveDB(db);
    res.json({ status: 'ok', user: existing });
  } else {
    const newUser = {
      id: isOwner ? 'owner_tazmaniacrvg' : `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      email,
      name: userData.name || email.split('@')[0],
      avatar: userData.avatar || '',
      role: isOwner ? 'owner' : 'member',
      status: 'active',
      permissions: isOwner
        ? { canPostMural: true, canUseTactics: true, canUseAdvancedTools: true, canModerate: true }
        : { canPostMural: true, canUseTactics: true, canUseAdvancedTools: false, canModerate: false },
      createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    saveDB(db);
    res.json({ status: 'ok', user: newUser });
  }
});

app.put('/api/interbase/users', (req: Request, res: Response) => {
  const db = getDB();
  ensureOwnerExists(db);

  const update = req.body;
  const target = db.users.find(
    (u: any) => u.id === update.id || u.email?.toLowerCase() === update.email?.toLowerCase()
  );
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (target.email?.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
    res.status(400).json({ error: 'Owner cannot be modified' });
    return;
  }

  if (update.role) target.role = update.role;
  if (update.status) target.status = update.status;
  if (update.permissions) {
    target.permissions = { ...target.permissions, ...update.permissions };
  }
  saveDB(db);
  res.json({ status: 'ok', user: target });
});

app.delete('/api/interbase/users', (req: Request, res: Response) => {
  const db = getDB();
  ensureOwnerExists(db);

  const targetId = req.query.id as string;
  const target = db.users.find((u: any) => u.id === targetId);
  if (target && target.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
    db.users = db.users.filter((u: any) => u.id !== targetId);
    saveDB(db);
    res.json({ status: 'ok', deleted: targetId });
  } else {
    res.status(400).json({ error: 'Cannot delete owner or user not found' });
  }
});

// 8. Site Settings & Feature Visibility (controlled by Owner)
app.get('/api/interbase/settings', (_req: Request, res: Response) => {
  const db = getDB();
  db.settings = db.settings || {
    muralVisible: true,
    muralPublicPosting: true,
    tacticsVisible: true,
    advancedToolsVisible: true,
    liveStreamsVisible: true,
    kickBannerVisible: true
  };
  res.json(db.settings);
});

app.post('/api/interbase/settings', (req: Request, res: Response) => {
  const db = getDB();
  db.settings = { ...(db.settings || {}), ...req.body };
  saveDB(db);
  res.json({ status: 'ok', settings: db.settings });
});

// Health check endpoint for Cloud Run & AI Studio environment status
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', version: 50, timestamp: new Date().toISOString() });
});

// Setup dev server with Vite middlewares or production static files
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: Number(PORT)
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Fala Vascão PRO] Server running on http://0.0.0.0:${PORT} (mode: ${isProduction ? 'production' : 'development'})`);
  });
}

startServer();
