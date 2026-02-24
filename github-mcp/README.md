# GitHub MCP Server

A TypeScript MCP server for GitHub operations via the GitHub REST API.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build:
   ```bash
   npm run build
   ```

3. Set your GitHub token:
   ```bash
   export GITHUB_TOKEN=ghp_yourtoken
   ```

## Claude Desktop / Claude Code Config

Add to your MCP config (e.g. `claude_desktop_config.json` or `.mcp.json`):

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["/absolute/path/to/github-mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_yourtoken"
      }
    }
  }
}
```

## Available Tools

### Files
| Tool | Description |
|------|-------------|
| `get_file_contents` | Read a file or list a directory |
| `create_or_update_file` | Create or update a file (single commit) |
| `push_files` | Push multiple files in one commit |
| `delete_file` | Delete a file |
| `list_repo_contents` | List files/dirs at a path |

### Commits
| Tool | Description |
|------|-------------|
| `list_commits` | List commits on a branch |
| `get_commit` | Get commit details + diff |

### Branches
| Tool | Description |
|------|-------------|
| `list_branches` | List branches |
| `create_branch` | Create a new branch |

### Pull Requests
| Tool | Description |
|------|-------------|
| `list_pull_requests` | List PRs |
| `get_pull_request` | Get PR details |
| `create_pull_request` | Open a PR |
| `merge_pull_request` | Merge a PR |

### Issues
| Tool | Description |
|------|-------------|
| `list_issues` | List issues |
| `get_issue` | Get issue details |
| `create_issue` | Create an issue |
| `create_issue_comment` | Comment on an issue/PR |

### Repositories
| Tool | Description |
|------|-------------|
| `get_repository` | Get repo details |
| `create_repository` | Create a new repo |
| `fork_repository` | Fork a repo |
| `list_repositories` | List your repos |

### Search
| Tool | Description |
|------|-------------|
| `search_code` | Search code on GitHub |
| `search_repositories` | Search repositories |

### Users
| Tool | Description |
|------|-------------|
| `get_user` | Get user info (or authenticated user) |
