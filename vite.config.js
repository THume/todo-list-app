import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIRECTORY = path.resolve(process.cwd(), 'data');
const BACKUP_DIRECTORY = path.join(DATA_DIRECTORY, 'backups');
const BACKUP_INTERVAL_MS = 30 * 60 * 1000;
const BACKUP_WRITE_THRESHOLD = 20;
const MAX_BACKUP_SNAPSHOTS = 20;
const BACKUP_FILES = ['tasks.json', 'lists.json', 'completed.json'];
let lastBackupTime = 0;
let writesSinceBackup = 0;

const ensureDataDirectory = () => {
  if (!fs.existsSync(DATA_DIRECTORY)) {
    fs.mkdirSync(DATA_DIRECTORY, { recursive: true });
  }
};

const ensureBackupDirectory = () => {
  ensureDataDirectory();
  if (!fs.existsSync(BACKUP_DIRECTORY)) {
    fs.mkdirSync(BACKUP_DIRECTORY, { recursive: true });
  }
};

const resolveFilePath = (fileName) => {
  ensureDataDirectory();
  return path.join(DATA_DIRECTORY, fileName);
};

const buildBackupFolderName = (timestamp) => timestamp.replace(/[:.]/g, '-');
const parseBackupFolderName = (folderName) => {
  const match = folderName.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/
  );
  if (!match) {
    return null;
  }
  return `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`;
};

const listBackupSnapshots = () => {
  ensureBackupDirectory();
  return fs
    .readdirSync(BACKUP_DIRECTORY)
    .map((entry) => path.join(BACKUP_DIRECTORY, entry))
    .filter((entry) => fs.statSync(entry).isDirectory());
};

const readBackupCounts = (snapshotPath) => {
  const readCount = (fileName) => {
    const filePath = path.join(snapshotPath, fileName);
    if (!fs.existsSync(filePath)) {
      return 0;
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch (error) {
      console.error(`Failed to read backup file "${fileName}"`, error);
      return 0;
    }
  };

  return {
    tasks: readCount('tasks.json'),
    lists: readCount('lists.json'),
    completed: readCount('completed.json'),
  };
};

const listBackupMetadata = () => {
  return listBackupSnapshots()
    .map((snapshotPath) => {
      const folderName = path.basename(snapshotPath);
      const createdAt = parseBackupFolderName(folderName);
      return {
        id: folderName,
        createdAt,
        counts: readBackupCounts(snapshotPath),
        mtimeMs: fs.statSync(snapshotPath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
};

const restoreBackupSnapshot = (snapshotId) => {
  if (!snapshotId || typeof snapshotId !== 'string') {
    return { ok: false, error: 'Invalid snapshot id.' };
  }
  const snapshotPath = path.join(BACKUP_DIRECTORY, snapshotId);
  if (!fs.existsSync(snapshotPath) || !fs.statSync(snapshotPath).isDirectory()) {
    return { ok: false, error: 'Backup snapshot not found.' };
  }

  try {
    ensureDataDirectory();
    BACKUP_FILES.forEach((fileName) => {
      const sourcePath = path.join(snapshotPath, fileName);
      if (!fs.existsSync(sourcePath)) {
        return;
      }
      const targetPath = resolveFilePath(fileName);
      fs.copyFileSync(sourcePath, targetPath);
    });
    return { ok: true };
  } catch (error) {
    console.error('Failed to restore backup snapshot', error);
    return { ok: false, error: 'Failed to restore backup snapshot.' };
  }
};

const pruneBackupSnapshots = () => {
  const backups = listBackupSnapshots()
    .map((filePath) => ({
      filePath,
      mtimeMs: fs.statSync(filePath).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  backups.slice(MAX_BACKUP_SNAPSHOTS).forEach(({ filePath }) => {
    try {
      fs.rmSync(filePath, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to remove backup "${filePath}"`, error);
    }
  });
};

const maybeBackupBeforeWrite = () => {
  const now = Date.now();
  if (
    now - lastBackupTime < BACKUP_INTERVAL_MS
    && writesSinceBackup < BACKUP_WRITE_THRESHOLD
  ) {
    return;
  }

  ensureBackupDirectory();
  const timestamp = new Date(now).toISOString();
  const snapshotFolder = path.join(BACKUP_DIRECTORY, buildBackupFolderName(timestamp));

  try {
    fs.mkdirSync(snapshotFolder, { recursive: true });
    BACKUP_FILES.forEach((backupFile) => {
      const sourcePath = resolveFilePath(backupFile);
      if (!fs.existsSync(sourcePath)) {
        return;
      }
      const targetPath = path.join(snapshotFolder, backupFile);
      fs.copyFileSync(sourcePath, targetPath);
    });
    lastBackupTime = now;
    writesSinceBackup = 0;
    pruneBackupSnapshots();
  } catch (error) {
    console.error('Failed to create backup snapshot', error);
  }
};

const readJsonFromDisk = (fileName) => {
  const filePath = resolveFilePath(fileName);
  if (!fs.existsSync(filePath)) {
    return { ok: true, exists: false, data: null };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return { ok: true, exists: true, data: raw ? JSON.parse(raw) : null };
  } catch (error) {
    console.error(`Failed to read storage file "${fileName}"`, error);
    return { ok: false, exists: true, data: null, error };
  }
};

const writeJsonToDisk = (fileName, data) => {
  try {
    writesSinceBackup += 1;
    maybeBackupBeforeWrite();
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
    const relativePath = decodeURIComponent(url.pathname.replace('/api/storage/', ''));
    if (relativePath === 'export') {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.end();
        return;
      }

      if (req.method !== 'GET') {
        res.statusCode = 405;
        res.setHeader('Allow', 'GET');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method not allowed.' }));
        return;
      }

      const tasksResult = readJsonFromDisk('tasks.json');
      const listsResult = readJsonFromDisk('lists.json');
      const completedResult = readJsonFromDisk('completed.json');

      if (!tasksResult.ok || !listsResult.ok || !completedResult.ok) {
        res.statusCode = 500;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Failed to read storage files.' }));
        return;
      }

      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        tasks: Array.isArray(tasksResult.data) ? tasksResult.data : [],
        lists: Array.isArray(listsResult.data) ? listsResult.data : [],
        completed: Array.isArray(completedResult.data) ? completedResult.data : [],
      };

      res.statusCode = 200;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(payload));
      return;
    }

    if (relativePath === 'import') {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Allow', 'POST');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method not allowed.' }));
        return;
      }

      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const parsed = body.trim().length > 0 ? JSON.parse(body) : null;
          const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : null;
          const lists = Array.isArray(parsed?.lists) ? parsed.lists : null;
          const completed = Array.isArray(parsed?.completed) ? parsed.completed : null;

          if (!tasks || !lists || !completed) {
            res.statusCode = 400;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Invalid import payload.' }));
            return;
          }

          writeJsonToDisk('tasks.json', tasks);
          writeJsonToDisk('lists.json', lists);
          writeJsonToDisk('completed.json', completed);
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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
        console.error('Failed to process import request', error);
        res.statusCode = 500;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Failed to process request.' }));
      });
      return;
    }

    if (relativePath.startsWith('backups')) {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.end();
        return;
      }

      if (req.method === 'GET' && relativePath === 'backups') {
        const snapshots = listBackupMetadata();
        res.statusCode = 200;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ snapshots }));
        return;
      }

      if (req.method === 'POST' && relativePath === 'backups/restore') {
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const parsed = body.trim().length > 0 ? JSON.parse(body) : {};
            const snapshotId = typeof parsed.id === 'string' ? parsed.id.trim() : '';
            const result = restoreBackupSnapshot(snapshotId);
            if (!result.ok) {
              res.statusCode = 400;
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: result.error ?? 'Invalid backup restore request.' }));
              return;
            }
            res.statusCode = 204;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
          console.error('Failed to process backup restore request', error);
          res.statusCode = 500;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Failed to process request.' }));
        });
        return;
      }
    }

    const fileName = relativePath;

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
      const result = readJsonFromDisk(fileName);
      if (!result.exists) {
        res.statusCode = 404;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.end('');
        return;
      }

      if (!result.ok) {
        res.statusCode = 500;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Failed to read storage file.' }));
        return;
      } else {
        res.statusCode = 200;
      }
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result.data));
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
