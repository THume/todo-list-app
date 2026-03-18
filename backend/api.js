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
