import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIRECTORY = path.resolve(process.cwd(), 'data');

const ensureDataDirectory = () => {
  if (!fs.existsSync(DATA_DIRECTORY)) {
    fs.mkdirSync(DATA_DIRECTORY, { recursive: true });
  }
};

const resolveFilePath = (fileName) => {
  ensureDataDirectory();
  return path.join(DATA_DIRECTORY, fileName);
};

const readJsonFromDisk = (fileName) => {
  try {
    const filePath = resolveFilePath(fileName);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error(`Failed to read storage file "${fileName}"`, error);
    return null;
  }
};

const writeJsonToDisk = (fileName, data) => {
  try {
    const filePath = resolveFilePath(fileName);
    fs.writeFileSync(filePath, JSON.stringify(data ?? null, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Failed to write storage file "${fileName}"`, error);
  }
};

const isValidFileName = (fileName) => /^[\w.-]+$/.test(fileName);

const createJsonStorageMiddleware = () => {
  return async (req, res, next) => {
    if (!req.url || !req.url.startsWith('/api/storage/')) {
      next();
      return;
    }

    const url = new URL(req.url, 'http://localhost');
    const fileName = decodeURIComponent(url.pathname.replace('/api/storage/', ''));

    if (!fileName || !isValidFileName(fileName)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid or missing file name.' }));
      return;
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.end();
      return;
    }

    if (req.method === 'GET') {
      const data = readJsonFromDisk(fileName);
      if (data === null && !fs.existsSync(resolveFilePath(fileName))) {
        res.statusCode = 404;
      } else {
        res.statusCode = 200;
      }
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return;
    }

    if (req.method === 'PUT') {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const parsed = body.trim().length > 0 ? JSON.parse(body) : null;
          writeJsonToDisk(fileName, parsed);
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.end();
        } catch (error) {
          res.statusCode = 400;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid JSON payload.' }));
        }
      });
      req.on('error', (error) => {
        console.error('Failed to process storage request', error);
        res.statusCode = 500;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Failed to process request.' }));
      });
      return;
    }

    res.statusCode = 405;
    res.setHeader('Allow', 'GET, PUT');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed.' }));
  };
};

const jsonStoragePlugin = () => ({
  name: 'json-storage-plugin',
  configureServer(server) {
    server.middlewares.use(createJsonStorageMiddleware());
  },
  configurePreviewServer(server) {
    server.middlewares.use(createJsonStorageMiddleware());
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), jsonStoragePlugin()],
  server: {
    port: 4173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
