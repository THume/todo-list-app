# External API Implementation

## Architecture

Two independent servers reading from the same `data/` directory:

1. **Vue App** (unchanged): Runs on port 4173, uses Vite middleware to read/write JSON
2. **API Server** (new): Runs on port 3000, provides REST endpoints for external apps to read tasks

---

## Required Changes

### 1. **Create Backend API Server** ✏️

Node.js/Express server on port 3000 that reads from `data/` and provides two REST endpoints for external apps.

### 2. **Create Two Endpoints**

```
GET  /api/v1/tasks       - Get all tasks
GET  /api/v1/due-today   - Get tasks due today (today's date)
```

### 3. **Configuration** ✏️

Optionally create `.env` for backend API configuration:

```
API_PORT=3000
API_CORS_ORIGIN=*
```

### 4. **Update package.json** ✏️

Add script to run external API:

```json
{
  "scripts": {
    "api": "node backend/api.js",
    "dev:with-api": "concurrently \"npm run api\" \"npm run dev\""
  }
}
```

### 5. **Update README.md** ✏️

Document how to run the API server and what endpoints are available.

---

## Files to Create/Modify

| File | Change | Effort |
|------|--------|--------|
| `backend/api.js` | Create new | 30 minutes |
| `package.json` | Add scripts | 10 minutes |
| `.env` | Create optional config | 5 minutes |
| `README.md` | Update with API info | 15 minutes |

**Total Effort: ~1 hour**

---

## Backend Code (Node.js/Express)

```javascript
// backend/api.js
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const PORT = process.env.API_PORT || 3000;

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Read JSON file helper
async function readJsonFile(fileName) {
  try {
    const filePath = path.join(DATA_DIR, fileName);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

// GET /api/v1/tasks
app.get('/api/v1/tasks', async (req, res) => {
  try {
    const tasks = await readJsonFile('tasks.json');
    res.json({
      ok: true,
      data: tasks || [],
      count: (tasks || []).length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to read tasks', error);
    res.status(500).json({ ok: false, error: 'Failed to read tasks' });
  }
});

// GET /api/v1/due-today
app.get('/api/v1/due-today', async (req, res) => {
  try {
    const tasks = await readJsonFile('tasks.json');
    const today = new Date().toISOString().split('T')[0];
    
    const dueTodayTasks = (tasks || []).filter(task => {
      if (!task.due || task.completed) return false;
      return task.due.startsWith(today);
    });
    
    res.json({
      ok: true,
      data: dueTodayTasks,
      count: dueTodayTasks.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to read due today', error);
    res.status(500).json({ ok: false, error: 'Failed to read due today' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`Reading from: ${DATA_DIR}`);
});
```

---

## Response Format Example

```json
{
  "ok": true,
  "data": [
    {
      "id": 384,
      "title": "Task title",
      "due": "2026-03-18T13:10:00.000Z",
      "completed": false
    }
  ],
  "count": 1,
  "timestamp": "2026-03-17T20:45:30.123Z"
}
```

---

## Running the API

```bash
# Run API and Vue apps together
npm run dev:with-api

# Or run separately
npm run api              # Terminal 1
npm run dev              # Terminal 2
```

API runs on `http://localhost:3000`, Vue app on `http://localhost:4173`.

---

## Testing

```bash
# Test the endpoints
curl http://localhost:3000/api/v1/tasks
curl http://localhost:3000/api/v1/due-today
```
