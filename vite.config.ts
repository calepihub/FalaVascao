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
    return { lineup: null, plays: [], boards: [] };
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

  return {
    name: 'interbase-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/interbase')) {
          return next();
        }

        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });

        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json');

          const db = getDB();

          // 1. Lineup
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

          // 2. Plays
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

          // 3. Boards
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
