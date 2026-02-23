# Ship It 2026 🚀

A lightweight task management web app built with Node.js, Express, and Winston logging.

## Features

- **Task management** — create, edit, and delete tasks stored in a local JSON file
- **Task history** — view all tasks with timestamps
- **Log viewer** — view, refresh, and clear server logs in the browser
- **REST API** — full CRUD API for tasks plus log endpoints
- **API examples** — built-in curl reference page

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+

### Installation

```bash
# Clone the repo
git clone <your-repo-url>
cd shipit-2026

# Install dependencies
npm install

# Create the data file from the example
cp data/tasks.json.example data/tasks.json
```

### Run

```bash
npm start
```

The server starts at **http://localhost:3000/main**

## Project Structure

```
├── server.js          # Express server & all API routes
├── logger.js          # Winston logger configuration
├── data/
│   └── tasks.json     # Local task store (git-ignored)
├── logs/              # Runtime log files (git-ignored)
└── public/            # Frontend HTML pages
    ├── main.html
    ├── history.html
    ├── new-task.html
    ├── edit-task.html
    ├── logs.html
    └── api-examples.html
```

## API Reference

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | Get all tasks |
| POST | `/api/tasks` | Create a task `{ name, description }` |
| PUT | `/api/tasks/:id` | Update a task `{ name, description }` |
| DELETE | `/api/tasks/:id` | Delete a task |

### Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/logs` | Get all log entries as JSON |
| GET | `/api/logs/raw` | Get raw log file as plain text |
| DELETE | `/api/logs` | Clear all log files |
