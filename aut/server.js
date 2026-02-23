const express = require('express');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

const app = express();
const port = 3000;
const TASKS_FILE = path.join(__dirname, 'data', 'tasks.json');

// Helpers
function readTasks() {
  const raw = fs.readFileSync(TASKS_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeTasks(tasks) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// HTTP request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// ── Page routes ────────────────────────────────────────────
app.get('/', (req, res) => {
  logger.debug('Root route hit');
  res.send('Hello, World!');
});

app.get('/main', (req, res) => {
  logger.debug('Main page hit');
  res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

app.get('/main/history', (req, res) => {
  logger.debug('History page hit');
  res.sendFile(path.join(__dirname, 'public', 'history.html'));
});

app.get('/main/new-task', (req, res) => {
  logger.debug('New task page hit');
  res.sendFile(path.join(__dirname, 'public', 'new-task.html'));
});

app.get('/main/edit-task', (req, res) => {
  logger.debug('Edit task page hit');
  res.sendFile(path.join(__dirname, 'public', 'edit-task.html'));
});

app.get('/main/logs', (req, res) => {
  logger.debug('Logs page hit');
  res.sendFile(path.join(__dirname, 'public', 'logs.html'));
});

app.get('/main/api-examples', (req, res) => {
  logger.debug('API examples page hit');
  res.sendFile(path.join(__dirname, 'public', 'api-examples.html'));
});

// ── Logs API ───────────────────────────────────────────────

// GET /api/logs — returns all log entries as JSON array
// Each entry: { timestamp, level, message }
app.get('/api/logs', (req, res) => {
  try {
    const LOG_FILE = path.join(__dirname, 'logs', 'combined.log');
    if (!fs.existsSync(LOG_FILE)) return res.json([]);
    const raw = fs.readFileSync(LOG_FILE, 'utf-8');
    const lineRegex = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[(\w+)\]: (.+)$/;
    const entries = raw
      .split('\n')
      .map(l => l.replace(/\r$/, ''))
      .filter(l => l.trim())
      .map(line => {
        const m = line.match(lineRegex);
        if (!m) return null;
        return { timestamp: m[1], level: m[2].toLowerCase(), message: m[3] };
      })
      .filter(e => e !== null);
    res.json(entries);
  } catch (err) {
    logger.error(`Failed to read logs: ${err.message}`);
    res.status(500).json({ error: 'Failed to read logs' });
  }
});

// DELETE /api/logs — clears all log files
app.delete('/api/logs', (req, res) => {
  try {
    const LOG_FILE = path.join(__dirname, 'logs', 'combined.log');
    const ERROR_LOG_FILE = path.join(__dirname, 'logs', 'error.log');
    if (fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '');
    if (fs.existsSync(ERROR_LOG_FILE)) fs.writeFileSync(ERROR_LOG_FILE, '');
    logger.info('Logs cleared');
    res.json({ message: 'Logs cleared' });
  } catch (err) {
    logger.error(`Failed to clear logs: ${err.message}`);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

// GET /api/logs/raw — returns the raw log file as plain text
app.get('/api/logs/raw', (req, res) => {
  try {
    const LOG_FILE = path.join(__dirname, 'logs', 'combined.log');
    if (!fs.existsSync(LOG_FILE)) return res.type('text').send('');
    const raw = fs.readFileSync(LOG_FILE, 'utf-8');
    res.type('text').send(raw);
  } catch (err) {
    logger.error(`Failed to read logs: ${err.message}`);
    res.status(500).type('text').send('Failed to read logs');
  }
});

// ── Tasks API ──────────────────────────────────────────────

// GET all tasks
app.get('/api/tasks', (req, res) => {
  try {
    const tasks = readTasks();
    res.json(tasks);
  } catch (err) {
    logger.error(`Failed to read tasks: ${err.message}`);
    res.status(500).json({ error: 'Failed to read tasks' });
  }
});

// POST new task
app.post('/api/tasks', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required' });
    }
    const tasks = readTasks();
    const newTask = {
      id: Date.now(),
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks.push(newTask);
    writeTasks(tasks);
    logger.info(`[TASK ADDED] name="${name}" id=${newTask.id}`);
    res.status(201).json(newTask);
  } catch (err) {
    logger.error(`Failed to create task: ${err.message}`);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT update task
app.put('/api/tasks/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description } = req.body;
    const tasks = readTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Task not found' });
    tasks[idx] = { ...tasks[idx], name, description, updatedAt: new Date().toISOString() };
    writeTasks(tasks);
    logger.info(`[TASK UPDATED] name="${tasks[idx].name}" id=${id}`);
    res.json(tasks[idx]);
  } catch (err) {
    logger.error(`Failed to update task: ${err.message}`);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE task
app.delete('/api/tasks/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tasks = readTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Task not found' });
    const [deleted] = tasks.splice(idx, 1);
    writeTasks(tasks);
    logger.info(`[TASK DELETED] name="${deleted.name}" id=${id}`);
    res.json({ message: 'Task deleted', task: deleted });
  } catch (err) {
    logger.error(`Failed to delete task: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ── Error routes ───────────────────────────────────────────

// Example error route
app.get('/error', (req, res) => {
  logger.error('Something went wrong on /error route');
  res.status(500).json({ error: 'Internal Server Error' });
});

// 404 handler
app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, () => {
  logger.info(`Server running at http://localhost:${port}`);
});
