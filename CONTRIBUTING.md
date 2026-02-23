# Contributing to Ship It 2026

## Getting Access

Send your GitHub username to the repo owner to be added as a collaborator on [github.com/ryan65/shipit-2026](https://github.com/ryan65/shipit-2026).

Once added, check your email or go to [github.com/notifications](https://github.com/notifications) and accept the invite.

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- Git installed
- A GitHub account

## Setup

### 1. Clone the repo

**SSH** (recommended if you have a GitHub SSH key set up):
```bash
git clone git@github.com:ryan65/shipit-2026.git
cd shipit-2026
```

**HTTPS** (no SSH key needed):
```bash
git clone https://github.com/ryan65/shipit-2026.git
cd shipit-2026
```

### 2. Install dependencies
```bash
cd aut
npm install
```

### 3. Set up the data file
```bash
cp data/tasks.json.example data/tasks.json
```

### 4. Run the app
```bash
npm start
```

Open [http://localhost:3000/main](http://localhost:3000/main) in your browser.

## Project Structure

```
shipit-2026/
└── aut/
    ├── server.js          # Express server & all API routes
    ├── logger.js          # Winston logger configuration
    ├── data/
    │   └── tasks.json     # Local task store (git-ignored, create from .example)
    ├── logs/              # Runtime log files (git-ignored)
    └── public/            # Frontend HTML pages
        ├── main.html
        ├── history.html
        ├── new-task.html
        ├── edit-task.html
        ├── logs.html
        └── api-examples.html
```

## Making Changes

1. Create a new branch for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit:
   ```bash
   git add <files>
   git commit -m "Description of your change"
   ```

3. Push your branch:
   ```bash
   git push origin feature/your-feature-name
   ```

4. Open a Pull Request on GitHub against `master`.
