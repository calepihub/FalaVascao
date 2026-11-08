import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';

// Embedded InterBase API server plugin for Vite
function interbaseApiPlugin(): Plugin {
  const dbFilePath = path.resolve(__dirname, 'data', 'interbase_database.json');

  function getDB() {
    try {
      if (!fs.existsSync(path.dirname(dbFilePath))) {
        fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
      }
      if (fs.existsSync(dbFilePath)) {
        return JSON.parse(fs.readFileSync(dbFilePath, 'utf-8'));
      }
    } catch {}
    return { lineup: null, plays: [], boards: [], community_lineups: [] };
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

  // Cache for YouTube RSS feed (60 seconds)
  let youtubeCache: { data: any; expires: number } | null = null;

  async function fetchYouTubeFeed() {
    const now = Date.now();
    if (youtubeCache && youtubeCache.expires > now) {
      return youtubeCache.data;
    }

    try {
      const channelId = 'UCKXHqZ8jfdFGpJR_hHVWMqQ';
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      const response = await fetch(feedUrl, { headers: { 'User-Agent': 'FalaVascaoPortal/1.0' } });
      const xml = await response.text();

      const entries: Array<{
        id: string;
        title: string;
        published: string;
        thumb: string;
        views: number;
        url: string;
        isLive: boolean;
        isShort: boolean;
      }> = [];

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
          const isLive = title.includes('AO VIVO') || title.includes('🔴') || title.includes('DIRETO DA BARREIRA');
          const isShort =
            title.toLowerCase().includes('#shorts') ||
            title.toLowerCase().includes('#short') ||
            title.length < 50 && title.includes('#');

          entries.push({
            id,
            title,
            published: published || new Date().toISOString(),
            thumb,
            views,
            url: `https://www.youtube.com/watch?v=${id}`,
            isLive,
            isShort
          });
        }
      }

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
        lastUpdated: new Date().toISOString()
      };

      youtubeCache = {
        data: result,
        expires: now + 60000 // 60s cache
      };

      return result;
    } catch (e) {
      console.warn('Could not fetch YouTube RSS feed:', e);
      return youtubeCache?.data || { channel: {}, videos: [] };
    }
  }

  return {
    name: 'interbase-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;

        // 1. YouTube Live & Feed API
        if (pathname === '/api/youtube/videos') {
          res.setHeader('Content-Type', 'application/json');
          const data = await fetchYouTubeFeed();
          res.statusCode = 200;
          res.end(JSON.stringify(data));
          return;
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });

        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json');
          const db = getDB();

          // 2. Lineup
          if (pathname === '/api/interbase/lineup') {
            if (req.method === 'POST') {
              try {
                db.lineup = JSON.parse(body);
                saveDB(db);
                res.statusCode = 200;
                res.end(JSON.stringify({ status: 'ok', message: 'Lineup saved' }));
              } catch {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
              return;
            } else if (req.method === 'GET') {
              res.statusCode = 200;
              res.end(JSON.stringify(db.lineup || null));
              return;
            }
          }

          // 3. Plays
          if (pathname === '/api/interbase/plays') {
            if (req.method === 'POST') {
              try {
                const play = JSON.parse(body);
                const existingIndex = db.plays.findIndex((p: any) => p.id === play.id);
                if (existingIndex >= 0) {
                  db.plays[existingIndex] = play;
                } else {
                  db.plays.push(play);
                }
                saveDB(db);
                res.statusCode = 200;
                res.end(JSON.stringify({ status: 'ok', id: play.id }));
              } catch {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
              return;
            } else if (req.method === 'GET') {
              res.statusCode = 200;
              res.end(JSON.stringify(db.plays || []));
              return;
            }
          }

          // 4. Boards
          if (pathname === '/api/interbase/boards') {
            if (req.method === 'POST') {
              try {
                const board = JSON.parse(body);
                const existingIndex = db.boards.findIndex((b: any) => b.id === board.id);
                if (existingIndex >= 0) {
                  db.boards[existingIndex] = board;
                } else {
                  db.boards.push(board);
                }
                saveDB(db);
                res.statusCode = 200;
                res.end(JSON.stringify({ status: 'ok', id: board.id }));
              } catch {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
              return;
            } else if (req.method === 'GET') {
              res.statusCode = 200;
              res.end(JSON.stringify(db.boards || []));
              return;
            }
          }

          // 5. Community Lineups ("Mural da Torcida")
          if (pathname === '/api/community/lineups') {
            db.community_lineups = db.community_lineups || [];
            if (req.method === 'POST') {
              try {
                const newLineup = JSON.parse(body);
                newLineup.id = newLineup.id || `com_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                newLineup.likes = newLineup.likes || 1;
                newLineup.publishedAt = newLineup.publishedAt || new Date().toISOString();
                db.community_lineups.unshift(newLineup);
                saveDB(db);
                res.statusCode = 200;
                res.end(JSON.stringify({ status: 'ok', lineup: newLineup }));
              } catch {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
              return;
            } else if (req.method === 'GET') {
              // Seed initial community lineups if empty
              if (db.community_lineups.length === 0) {
                db.community_lineups = [
                  {
                    id: 'com_demo_1',
                    author: 'Carlos da Barreira (Membro VIP)',
                    title: '4-3-3 Ofensivo para a Decisão',
                    opponentClub: 'Palmeiras',
                    formation: '4-3-3',
                    players: [
                      { name: 'Léo Jardim', role: 'GOL', x: 0.12, y: 0.5 },
                      { name: 'Paulo Henrique', role: 'LD', x: 0.28, y: 0.8 },
                      { name: 'Lucas Freitas', role: 'ZAG', x: 0.25, y: 0.6 },
                      { name: 'Robert Renan', role: 'ZAG', x: 0.25, y: 0.4 },
                      { name: 'Lucas Piton', role: 'LE', x: 0.28, y: 0.2 },
                      { name: 'Jair', role: 'VOL', x: 0.42, y: 0.5 },
                      { name: 'Tchê Tchê', role: 'VOL', x: 0.5, y: 0.65 },
                      { name: 'Lescano', role: 'MEI', x: 0.55, y: 0.35 },
                      { name: 'Adson', role: 'ATA', x: 0.72, y: 0.78 },
                      { name: 'Vegetti', role: 'ATA', x: 0.78, y: 0.5 },
                      { name: 'Nuno Moreira', role: 'ATA', x: 0.72, y: 0.22 }
                    ],
                    likes: 42,
                    publishedAt: '2026-11-08T12:00:00.000Z'
                  },
                  {
                    id: 'com_demo_2',
                    author: 'Torcida Vascaína Camisa 7',
                    title: 'Marcação Alta e Saída Rápida',
                    opponentClub: 'Flamengo',
                    formation: '4-2-3-1',
                    players: [
                      { name: 'Léo Jardim', role: 'GOL', x: 0.12, y: 0.5 },
                      { name: 'Puma Rodríguez', role: 'LD', x: 0.3, y: 0.82 },
                      { name: 'Carlos Cuesta', role: 'ZAG', x: 0.26, y: 0.58 },
                      { name: 'Saldivia', role: 'ZAG', x: 0.26, y: 0.42 },
                      { name: 'Lucas Piton', role: 'LE', x: 0.3, y: 0.18 },
                      { name: 'Thiago Mendes', role: 'VOL', x: 0.45, y: 0.6 },
                      { name: 'Mateus Carvalho', role: 'VOL', x: 0.45, y: 0.4 },
                      { name: 'Rojas', role: 'MEI', x: 0.6, y: 0.5 },
                      { name: 'David', role: 'ATA', x: 0.68, y: 0.8 },
                      { name: 'Andrés Gómez', role: 'ATA', x: 0.68, y: 0.2 },
                      { name: 'Brenner', role: 'ATA', x: 0.8, y: 0.5 }
                    ],
                    likes: 31,
                    publishedAt: '2026-11-07T18:30:00.000Z'
                  }
                ];
                saveDB(db);
              }
              res.statusCode = 200;
              res.end(JSON.stringify(db.community_lineups));
              return;
            }
          }

          // 6. Community Like
          if (pathname === '/api/community/like' && req.method === 'POST') {
            try {
              const { id } = JSON.parse(body);
              db.community_lineups = db.community_lineups || [];
              const target = db.community_lineups.find((l: any) => l.id === id);
              if (target) {
                target.likes = (target.likes || 0) + 1;
                saveDB(db);
                res.statusCode = 200;
                res.end(JSON.stringify({ status: 'ok', likes: target.likes }));
                return;
              }
            } catch {}
          }

          // Fallback
          res.statusCode = 200;
          res.end(JSON.stringify({ status: 'ok', db: 'InterBase Engine Active' }));
        });
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), interbaseApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
