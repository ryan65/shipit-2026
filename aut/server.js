const express = require('express');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

// ── CLI options ────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { maxTasks: 3990 };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--maxTasks') {
      const val = parseInt(args[i + 1], 10);
      if (isNaN(val) || val < 1) {
        console.error('Error: --maxTasks must be a positive integer');
        process.exit(1);
      }
      opts.maxTasks = val;
      i++;
    }
  }

  return opts;
}

const { maxTasks } = parseArgs();

// ── App setup ──────────────────────────────────────────────

const app = express();
const port = 3000;
const TASKS_FILE   = path.join(__dirname, 'data', 'tasks.json');
const HISTORY_FILE = path.join(__dirname, 'data', 'history.json');

// Ensure data directory and files exist on startup
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(TASKS_FILE)) {
  fs.writeFileSync(TASKS_FILE, '[]');
  logger.info('Created empty tasks.json');
}
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, '[]');
  logger.info('Created empty history.json');
}

// ── Helpers ────────────────────────────────────────────────

function readTasks() {
  return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
}

function writeTasks(tasks) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

function readHistory() {
  return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
}

function writeHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function addHistoryEntry(action, task) {
  const history = readHistory();
  history.push({
    id: Date.now(),
    action,                        // 'CREATED' | 'UPDATED' | 'DELETED'
    taskId: task.id,
    taskName: task.name,
    taskDescription: task.description,
    timestamp: new Date().toISOString(),
  });
  writeHistory(history);
  logger.info(`[HISTORY] action=${action} taskId=${task.id} name="${task.name}"`);
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

app.get('/api/logs', (req, res) => {
  try {
    const LOG_FILE = path.join(__dirname, 'logs', 'combined.log');
    if (!fs.existsSync(LOG_FILE)) return res.json([]);

    // Optional date-range filters (UTC milliseconds)
    let from = null, to = null, last = null;
    if (req.query.from !== undefined) {
      from = parseInt(req.query.from, 10);
      if (isNaN(from)) return res.status(400).json({ error: "'from' must be a UTC milliseconds integer" });
    }
    if (req.query.to !== undefined) {
      to = parseInt(req.query.to, 10);
      if (isNaN(to)) return res.status(400).json({ error: "'to' must be a UTC milliseconds integer" });
    }
    if (req.query.last !== undefined) {
      last = parseInt(req.query.last, 10);
      if (isNaN(last) || last < 1) return res.status(400).json({ error: "'last' must be a positive integer" });
    }

    const raw = fs.readFileSync(LOG_FILE, 'utf-8');
    const lineRegex = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[(\w+)\]: (.+)$/;
    let entries = raw
      .split('\n')
      .map(l => l.replace(/\r$/, ''))
      .filter(l => l.trim())
      .map(line => {
        const m = line.match(lineRegex);
        if (!m) return null;
        return { timestamp: m[1], level: m[2].toLowerCase(), message: m[3] };
      })
      .filter(e => e !== null);

    if (from !== null || to !== null) {
      entries = entries.filter(e => {
        const ms = new Date(e.timestamp.replace(' ', 'T')).getTime();
        if (from !== null && ms < from) return false;
        if (to !== null && ms > to) return false;
        return true;
      });
    }

    if (last !== null) {
      entries = entries.slice(-last);
    }

    res.json(entries);
  } catch (err) {
    logger.error(`Failed to read logs: ${err.message}`);
    res.status(500).json({ error: 'Failed to read logs' });
  }
});

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

// ── History API ────────────────────────────────────────────

// GET /api/history — returns all history events
app.get('/api/history', (req, res) => {
  try {
    const history = readHistory();
    res.json(history);
  } catch (err) {
    logger.error(`Failed to read history: ${err.message}`);
    res.status(500).json({ error: 'Failed to read history' });
  }
});

// DELETE /api/history — clears all history events
app.delete('/api/history', (req, res) => {
  try {
    writeHistory([]);
    logger.info('History cleared');
    res.json({ message: 'History cleared' });
  } catch (err) {
    logger.error(`Failed to clear history: ${err.message}`);
    res.status(500).json({ error: 'Failed to clear history' });
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
    if (tasks.length >= maxTasks) {
     logger.error(`Cannot create task "${name}". Maximum limit of ${maxTasks} tasks reached.`);
      return res.status(400).json({ error: `Exceeded the maximum number of tasks allowed (${maxTasks}). Please increase limit or delete tasks` });
    }
    const newTask = {
      id: Date.now(),
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks.push(newTask);
    writeTasks(tasks);
    addHistoryEntry('CREATED', newTask);
    logger.info(`[TASK ADDED] name="${name}" id=${newTask.id}`);
    res.status(201).json(newTask);
  } catch (err) {
    logger.error(`Failed to create task: ${err.message}`);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// DELETE all tasks
app.delete('/api/tasks', (req, res) => {
  try {
    const tasks = readTasks();
    if (tasks.length === 0) {
      return res.json({ message: 'No tasks to delete', deleted: 0 });
    }
    // Write all DELETED history entries in one go
    const history = readHistory();
    const now = new Date().toISOString();
    tasks.forEach((task, i) => {
      history.push({
        id: Date.now() + i,
        action: 'DELETED',
        taskId: task.id,
        taskName: task.name,
        taskDescription: task.description,
        timestamp: now,
      });
    });
    writeHistory(history);
    writeTasks([]);
    logger.info(`[ALL TASKS DELETED] count=${tasks.length}`);
    res.json({ message: `Deleted ${tasks.length} tasks`, deleted: tasks.length });
  } catch (err) {
    logger.error(`Failed to delete all tasks: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete all tasks' });
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
    addHistoryEntry('UPDATED', tasks[idx]);
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
    addHistoryEntry('DELETED', deleted);
    logger.info(`[TASK DELETED] name="${deleted.name}" id=${id}`);
    res.json({ message: 'Task deleted', task: deleted });
  } catch (err) {
    logger.error(`Failed to delete task: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ── Error routes ───────────────────────────────────────────

app.get('/error', (req, res) => {
  logger.error('Something went wrong on /error route');
  res.status(500).json({ error: 'Internal Server Error' });
});

app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, () => {
  logger.info(`Server running at http://localhost:${port}`);
  logger.info(`Max tasks limit: ${maxTasks}`);
});
