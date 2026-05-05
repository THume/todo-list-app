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

// Write JSON file helper
async function writeJsonFile(fileName, data) {
  try {
    const filePath = path.join(DATA_DIR, fileName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`Failed to write ${fileName}`, error);
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

// POST /api/v1/tasks
app.post('/api/v1/tasks', async (req, res) => {
  try {
    const {
      title,
      description,
      due,
      recurrence,
      recurrenceAnchor,
      listId,
      reminderOffsetMinutes,
      completed = false,
      subtasks = [],
      isLongTerm = false,
      startDate = null,
    } = req.body;

    // Validate required fields
    if (!title || typeof title !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'Title is required and must be a string',
      });
    }

    // Read existing tasks
    const existingTasks = await readJsonFile('tasks.json') || [];
    
    // Generate new ID (find max ID and increment)
    const maxId = existingTasks.length > 0
      ? Math.max(...existingTasks.map(t => t.id || 0))
      : 0;
    const newId = maxId + 1;

    // Create new task object
    const newTask = {
      id: newId,
      title: title.trim(),
      description: description || '',
      completed: Boolean(completed),
      completedAt: null,
      due: due || null,
      recurrence: recurrence || null,
      recurrenceAnchor: recurrenceAnchor === 'completion' ? 'completion' : 'due',
      listId: listId || 'default',
      reminderOffsetMinutes: reminderOffsetMinutes || null,
      subtasks: Array.isArray(subtasks) ? subtasks : [],
      isLongTerm: Boolean(isLongTerm),
      startDate: startDate || null,
    };

    // Add to tasks array
    existingTasks.push(newTask);

    // Write updated tasks back to file
    await writeJsonFile('tasks.json', existingTasks);

    res.status(201).json({
      ok: true,
      data: newTask,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to create task', error);
    res.status(500).json({ ok: false, error: 'Failed to create task' });
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
