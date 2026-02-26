#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Octokit } from "@octokit/rest";
import { z } from "zod";

// ─── Octokit Setup ────────────────────────────────────────────────────────────

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }
  return new Octokit({ auth: token });
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const RepoParams = z.object({
  owner: z.string().describe("Repository owner (user or org)"),
  repo: z.string().describe("Repository name"),
});

const GetFileSchema = RepoParams.extend({
  path: z.string().describe("File path within the repository"),
  ref: z.string().optional().describe("Branch, tag, or commit SHA (default: repo default branch)"),
});

const CreateOrUpdateFileSchema = RepoParams.extend({
  path: z.string().describe("File path within the repository"),
  message: z.string().describe("Commit message"),
  content: z.string().describe("File content (plain text, will be base64-encoded)"),
  branch: z.string().optional().describe("Branch to commit to (default: repo default branch)"),
  sha: z.string().optional().describe("SHA of the file being replaced (required when updating)"),
});

const PushFilesSchema = RepoParams.extend({
  branch: z.string().describe("Branch to push to"),
  message: z.string().describe("Commit message"),
  files: z
    .array(
      z.object({
        path: z.string().describe("File path"),
        content: z.string().describe("File content"),
      })
    )
    .describe("Array of files to push"),
});

const DeleteFileSchema = RepoParams.extend({
  path: z.string().describe("File path to delete"),
  message: z.string().describe("Commit message"),
  sha: z.string().describe("SHA of the file to delete"),
  branch: z.string().optional().describe("Branch to delete from"),
});

const ListCommitsSchema = RepoParams.extend({
  branch: z.string().optional().describe("Branch name (default: repo default branch)"),
  per_page: z.number().optional().describe("Commits per page (max 100, default 30)"),
  page: z.number().optional().describe("Page number (default 1)"),
  path: z.string().optional().describe("Only commits touching this path"),
  author: z.string().optional().describe("GitHub username or email to filter by"),
  since: z.string().optional().describe("ISO 8601 date — commits after this date"),
  until: z.string().optional().describe("ISO 8601 date — commits before this date"),
});

const GetCommitSchema = RepoParams.extend({
  sha: z.string().describe("Commit SHA"),
});

const ListBranchesSchema = RepoParams.extend({
  per_page: z.number().optional().describe("Branches per page (default 30)"),
  page: z.number().optional().describe("Page number (default 1)"),
});

const CreateBranchSchema = RepoParams.extend({
  branch: z.string().describe("New branch name"),
  from_branch: z.string().optional().describe("Source branch (default: repo default branch)"),
});

const ListPRsSchema = RepoParams.extend({
  state: z.enum(["open", "closed", "all"]).optional().describe("PR state (default: open)"),
  per_page: z.number().optional().describe("PRs per page (default 30)"),
  page: z.number().optional().describe("Page number (default 1)"),
});

const GetPRSchema = RepoParams.extend({
  pull_number: z.number().describe("Pull request number"),
});

const CreatePRSchema = RepoParams.extend({
  title: z.string().describe("PR title"),
  body: z.string().optional().describe("PR description"),
  head: z.string().describe("Branch containing changes"),
  base: z.string().describe("Branch to merge into"),
  draft: z.boolean().optional().describe("Open as a draft PR"),
});

const MergePRSchema = RepoParams.extend({
  pull_number: z.number().describe("Pull request number"),
  commit_title: z.string().optional().describe("Merge commit title"),
  commit_message: z.string().optional().describe("Merge commit message"),
  merge_method: z.enum(["merge", "squash", "rebase"]).optional().describe("Merge method (default: merge)"),
});

const ListIssuesSchema = RepoParams.extend({
  state: z.enum(["open", "closed", "all"]).optional().describe("Issue state (default: open)"),
  labels: z.string().optional().describe("Comma-separated list of label names"),
  per_page: z.number().optional().describe("Issues per page (default 30)"),
  page: z.number().optional().describe("Page number (default 1)"),
});

const GetIssueSchema = RepoParams.extend({
  issue_number: z.number().describe("Issue number"),
});

const CreateIssueSchema = RepoParams.extend({
  title: z.string().describe("Issue title"),
  body: z.string().optional().describe("Issue body"),
  labels: z.array(z.string()).optional().describe("Labels to apply"),
  assignees: z.array(z.string()).optional().describe("Usernames to assign"),
});

const CreateIssueCommentSchema = RepoParams.extend({
  issue_number: z.number().describe("Issue or PR number"),
  body: z.string().describe("Comment body"),
});

const ListRepoContentsSchema = RepoParams.extend({
  path: z.string().optional().describe("Directory path (default: root)"),
  ref: z.string().optional().describe("Branch, tag, or commit SHA"),
});

const SearchCodeSchema = z.object({
  query: z.string().describe("GitHub code search query (e.g. 'repo:owner/repo filename:index.ts')"),
  per_page: z.number().optional().describe("Results per page (default 30)"),
  page: z.number().optional().describe("Page number (default 1)"),
});

const SearchReposSchema = z.object({
  query: z.string().describe("GitHub repository search query"),
  sort: z.enum(["stars", "forks", "help-wanted-issues", "updated"]).optional(),
  per_page: z.number().optional(),
  page: z.number().optional(),
});

const GetRepoSchema = RepoParams;

const CreateRepoSchema = z.object({
  name: z.string().describe("Repository name"),
  description: z.string().optional().describe("Repository description"),
  private: z.boolean().optional().describe("Make the repository private (default: false)"),
  auto_init: z.boolean().optional().describe("Initialize with a README (default: false)"),
  gitignore_template: z.string().optional().describe("Gitignore template language (e.g. Node)"),
});

const ForkRepoSchema = RepoParams.extend({
  organization: z.string().optional().describe("Organization to fork into (default: authenticated user)"),
});

const ListReposSchema = z.object({
  type: z.enum(["all", "owner", "public", "private", "member"]).optional(),
  sort: z.enum(["created", "updated", "pushed", "full_name"]).optional(),
  per_page: z.number().optional(),
  page: z.number().optional(),
});

const GetUserSchema = z.object({
  username: z.string().optional().describe("GitHub username (default: authenticated user)"),
});

const TasksAutLogsSchema = z.object({
  last: z.number().optional().describe("Return only the last N log entries"),
  from: z.number().optional().describe("Return log entries starting this unix epoch timestamp (in milliseconds)"),
  to: z.number().optional().describe("Return log entries up to this unix epoch timestamp (in milliseconds)"),
});

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  // Files
  {
    name: "get_file_contents",
    description: "Get the contents of a file or directory from a GitHub repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        path: { type: "string", description: "File path" },
        ref: { type: "string", description: "Branch, tag, or SHA" },
      },
      required: ["owner", "repo", "path"],
    },
  },
  {
    name: "create_or_update_file",
    description: "Create or update a single file and commit it to a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        path: { type: "string", description: "File path" },
        message: { type: "string", description: "Commit message" },
        content: { type: "string", description: "File content (plain text)" },
        branch: { type: "string" },
        sha: { type: "string", description: "Required when updating an existing file" },
      },
      required: ["owner", "repo", "path", "message", "content"],
    },
  },
  {
    name: "push_files",
    description: "Push multiple files in a single commit to a repository branch",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        branch: { type: "string", description: "Target branch" },
        message: { type: "string", description: "Commit message" },
        files: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
            required: ["path", "content"],
          },
        },
      },
      required: ["owner", "repo", "branch", "message", "files"],
    },
  },
  {
    name: "delete_file",
    description: "Delete a file from a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        path: { type: "string" },
        message: { type: "string" },
        sha: { type: "string", description: "SHA of the file to delete" },
        branch: { type: "string" },
      },
      required: ["owner", "repo", "path", "message", "sha"],
    },
  },
  {
    name: "list_repo_contents",
    description: "List files and directories at a path in a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        path: { type: "string", description: "Directory path (default: root)" },
        ref: { type: "string" },
      },
      required: ["owner", "repo"],
    },
  },
  // Commits
  {
    name: "list_commits",
    description: "List commits on a repository branch",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        branch: { type: "string" },
        per_page: { type: "number" },
        page: { type: "number" },
        path: { type: "string" },
        author: { type: "string" },
        since: { type: "string" },
        until: { type: "string" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "get_commit",
    description: "Get details of a specific commit including changed files",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        sha: { type: "string" },
      },
      required: ["owner", "repo", "sha"],
    },
  },
  // Branches
  {
    name: "list_branches",
    description: "List branches in a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        per_page: { type: "number" },
        page: { type: "number" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "create_branch",
    description: "Create a new branch in a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        branch: { type: "string", description: "New branch name" },
        from_branch: { type: "string", description: "Source branch (default: default branch)" },
      },
      required: ["owner", "repo", "branch"],
    },
  },
  // Pull Requests
  {
    name: "list_pull_requests",
    description: "List pull requests in a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        state: { type: "string", enum: ["open", "closed", "all"] },
        per_page: { type: "number" },
        page: { type: "number" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "get_pull_request",
    description: "Get details of a specific pull request",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        pull_number: { type: "number" },
      },
      required: ["owner", "repo", "pull_number"],
    },
  },
  {
    name: "create_pull_request",
    description: "Create a new pull request",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        title: { type: "string" },
        body: { type: "string" },
        head: { type: "string", description: "Branch with changes" },
        base: { type: "string", description: "Branch to merge into" },
        draft: { type: "boolean" },
      },
      required: ["owner", "repo", "title", "head", "base"],
    },
  },
  {
    name: "merge_pull_request",
    description: "Merge a pull request",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        pull_number: { type: "number" },
        commit_title: { type: "string" },
        commit_message: { type: "string" },
        merge_method: { type: "string", enum: ["merge", "squash", "rebase"] },
      },
      required: ["owner", "repo", "pull_number"],
    },
  },
  // Issues
  {
    name: "list_issues",
    description: "List issues in a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        state: { type: "string", enum: ["open", "closed", "all"] },
        labels: { type: "string" },
        per_page: { type: "number" },
        page: { type: "number" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "get_issue",
    description: "Get details of a specific issue",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        issue_number: { type: "number" },
      },
      required: ["owner", "repo", "issue_number"],
    },
  },
  {
    name: "create_issue",
    description: "Create a new issue in a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        title: { type: "string" },
        body: { type: "string" },
        labels: { type: "array", items: { type: "string" } },
        assignees: { type: "array", items: { type: "string" } },
      },
      required: ["owner", "repo", "title"],
    },
  },
  {
    name: "create_issue_comment",
    description: "Add a comment to an issue or pull request",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        issue_number: { type: "number" },
        body: { type: "string" },
      },
      required: ["owner", "repo", "issue_number", "body"],
    },
  },
  // Repositories
  {
    name: "get_repository",
    description: "Get details about a GitHub repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "create_repository",
    description: "Create a new GitHub repository",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        private: { type: "boolean" },
        auto_init: { type: "boolean" },
        gitignore_template: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "fork_repository",
    description: "Fork a repository to the authenticated user or an organization",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        organization: { type: "string" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "list_repositories",
    description: "List repositories for the authenticated user",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["all", "owner", "public", "private", "member"] },
        sort: { type: "string", enum: ["created", "updated", "pushed", "full_name"] },
        per_page: { type: "number" },
        page: { type: "number" },
      },
    },
  },
  // Search
  {
    name: "search_code",
    description: "Search for code on GitHub",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query, e.g. 'repo:owner/repo filename:index.ts'" },
        per_page: { type: "number" },
        page: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    name: "search_repositories",
    description: "Search GitHub repositories",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        sort: { type: "string", enum: ["stars", "forks", "help-wanted-issues", "updated"] },
        per_page: { type: "number" },
        page: { type: "number" },
      },
      required: ["query"],
    },
  },
  // User
  {
    name: "get_user",
    description: "Get information about a GitHub user (or the authenticated user if no username given)",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string" },
      },
    },
  },
  // AUT
  {
    name: "tasksAutLogs",
    description: "Get logs from the AUT task management server",
    inputSchema: {
      type: "object",
      properties: {
        last: { type: "number", description: "Return only the last N log entries" },
        from: { type: "number", description: "Return log entries starting from this index (0-based)" },
        to: { type: "number", description: "Return log entries up to this index (0-based, inclusive)" },
      },
    },
  },
];

// ─── Tool Handlers ────────────────────────────────────────────────────────────

async function handleGetFileContents(args: unknown) {
  const { owner, repo, path, ref } = GetFileSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.repos.getContent({ owner, repo, path, ref });
  const data = response.data;

  if (Array.isArray(data)) {
    // Directory listing
    return data.map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type,
      size: item.size,
      sha: item.sha,
      url: item.html_url,
    }));
  }

  if (data.type === "file") {
    const content = data.encoding === "base64" && data.content
      ? Buffer.from(data.content, "base64").toString("utf-8")
      : data.content ?? "";
    return {
      name: data.name,
      path: data.path,
      sha: data.sha,
      size: data.size,
      type: data.type,
      encoding: data.encoding,
      content,
      url: data.html_url,
    };
  }

  return data;
}

async function handleCreateOrUpdateFile(args: unknown) {
  const { owner, repo, path, message, content, branch, sha } = CreateOrUpdateFileSchema.parse(args);
  const octokit = getOctokit();
  const encoded = Buffer.from(content, "utf-8").toString("base64");
  const response = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: encoded,
    branch,
    sha,
  });
  return {
    commit: {
      sha: response.data.commit.sha,
      message: response.data.commit.message,
      url: response.data.commit.html_url,
    },
    content: {
      path: response.data.content?.path,
      sha: response.data.content?.sha,
      url: response.data.content?.html_url,
    },
  };
}

async function handlePushFiles(args: unknown) {
  const { owner, repo, branch, message, files } = PushFilesSchema.parse(args);
  const octokit = getOctokit();

  // Get the latest commit SHA on the branch
  const branchData = await octokit.repos.getBranch({ owner, repo, branch });
  const latestCommitSha = branchData.data.commit.sha;
  const baseTreeSha = branchData.data.commit.commit.tree.sha;

  // Create blobs for each file
  const treeItems = await Promise.all(
    files.map(async (file) => {
      const blob = await octokit.git.createBlob({
        owner,
        repo,
        content: Buffer.from(file.content, "utf-8").toString("base64"),
        encoding: "base64",
      });
      return {
        path: file.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.data.sha,
      };
    })
  );

  // Create a new tree
  const newTree = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: treeItems,
  });

  // Create the commit
  const newCommit = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: newTree.data.sha,
    parents: [latestCommitSha],
  });

  // Update the branch reference
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.data.sha,
  });

  return {
    commit: {
      sha: newCommit.data.sha,
      message: newCommit.data.message,
      url: newCommit.data.html_url,
    },
    files_pushed: files.length,
  };
}

async function handleDeleteFile(args: unknown) {
  const { owner, repo, path, message, sha, branch } = DeleteFileSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.repos.deleteFile({ owner, repo, path, message, sha, branch });
  return {
    commit: {
      sha: response.data.commit.sha,
      message: response.data.commit.message,
      url: response.data.commit.html_url,
    },
  };
}

async function handleListRepoContents(args: unknown) {
  const { owner, repo, path, ref } = ListRepoContentsSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.repos.getContent({ owner, repo, path: path ?? "", ref });
  const data = response.data;
  if (Array.isArray(data)) {
    return data.map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type,
      size: item.size,
      sha: item.sha,
    }));
  }
  return data;
}

async function handleListCommits(args: unknown) {
  const { owner, repo, branch, per_page, page, path, author, since, until } = ListCommitsSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.repos.listCommits({
    owner,
    repo,
    sha: branch,
    per_page,
    page,
    path,
    author,
    since,
    until,
  });
  return response.data.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    author: c.commit.author?.name,
    date: c.commit.author?.date,
    url: c.html_url,
  }));
}

async function handleGetCommit(args: unknown) {
  const { owner, repo, sha } = GetCommitSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.repos.getCommit({ owner, repo, ref: sha });
  const c = response.data;
  return {
    sha: c.sha,
    message: c.commit.message,
    author: c.commit.author?.name,
    date: c.commit.author?.date,
    url: c.html_url,
    stats: c.stats,
    files: c.files?.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch,
    })),
  };
}

async function handleListBranches(args: unknown) {
  const { owner, repo, per_page, page } = ListBranchesSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.repos.listBranches({ owner, repo, per_page, page });
  return response.data.map((b) => ({
    name: b.name,
    sha: b.commit.sha,
    protected: b.protected,
  }));
}

async function handleCreateBranch(args: unknown) {
  const { owner, repo, branch, from_branch } = CreateBranchSchema.parse(args);
  const octokit = getOctokit();

  let sha: string;
  if (from_branch) {
    const branchData = await octokit.repos.getBranch({ owner, repo, branch: from_branch });
    sha = branchData.data.commit.sha;
  } else {
    const repoData = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.data.default_branch;
    const branchData = await octokit.repos.getBranch({ owner, repo, branch: defaultBranch });
    sha = branchData.data.commit.sha;
  }

  const response = await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branch}`,
    sha,
  });

  return {
    ref: response.data.ref,
    sha: response.data.object.sha,
    url: response.data.url,
  };
}

async function handleListPRs(args: unknown) {
  const { owner, repo, state, per_page, page } = ListPRsSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.pulls.list({ owner, repo, state, per_page, page });
  return response.data.map((pr) => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    draft: pr.draft,
    head: pr.head.ref,
    base: pr.base.ref,
    author: pr.user?.login,
    created_at: pr.created_at,
    url: pr.html_url,
  }));
}

async function handleGetPR(args: unknown) {
  const { owner, repo, pull_number } = GetPRSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.pulls.get({ owner, repo, pull_number });
  const pr = response.data;
  return {
    number: pr.number,
    title: pr.title,
    state: pr.state,
    draft: pr.draft,
    body: pr.body,
    head: pr.head.ref,
    base: pr.base.ref,
    author: pr.user?.login,
    created_at: pr.created_at,
    updated_at: pr.updated_at,
    merged: pr.merged,
    mergeable: pr.mergeable,
    url: pr.html_url,
    additions: pr.additions,
    deletions: pr.deletions,
    changed_files: pr.changed_files,
  };
}

async function handleCreatePR(args: unknown) {
  const { owner, repo, title, body, head, base, draft } = CreatePRSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.pulls.create({ owner, repo, title, body, head, base, draft });
  const pr = response.data;
  return {
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    state: pr.state,
    draft: pr.draft,
  };
}

async function handleMergePR(args: unknown) {
  const { owner, repo, pull_number, commit_title, commit_message, merge_method } = MergePRSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.pulls.merge({
    owner,
    repo,
    pull_number,
    commit_title,
    commit_message,
    merge_method,
  });
  return {
    sha: response.data.sha,
    merged: response.data.merged,
    message: response.data.message,
  };
}

async function handleListIssues(args: unknown) {
  const { owner, repo, state, labels, per_page, page } = ListIssuesSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.issues.listForRepo({ owner, repo, state, labels, per_page, page });
  return response.data
    .filter((issue) => !issue.pull_request)
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      author: issue.user?.login,
      labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name)),
      created_at: issue.created_at,
      url: issue.html_url,
    }));
}

async function handleGetIssue(args: unknown) {
  const { owner, repo, issue_number } = GetIssueSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.issues.get({ owner, repo, issue_number });
  const issue = response.data;
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state,
    body: issue.body,
    author: issue.user?.login,
    labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name)),
    assignees: issue.assignees?.map((a) => a.login),
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    url: issue.html_url,
  };
}

async function handleCreateIssue(args: unknown) {
  const { owner, repo, title, body, labels, assignees } = CreateIssueSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.issues.create({ owner, repo, title, body, labels, assignees });
  return {
    number: response.data.number,
    title: response.data.title,
    url: response.data.html_url,
    state: response.data.state,
  };
}

async function handleCreateIssueComment(args: unknown) {
  const { owner, repo, issue_number, body } = CreateIssueCommentSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.issues.createComment({ owner, repo, issue_number, body });
  return {
    id: response.data.id,
    url: response.data.html_url,
    created_at: response.data.created_at,
  };
}

async function handleGetRepository(args: unknown) {
  const { owner, repo } = GetRepoSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.repos.get({ owner, repo });
  const r = response.data;
  return {
    full_name: r.full_name,
    description: r.description,
    private: r.private,
    default_branch: r.default_branch,
    language: r.language,
    stars: r.stargazers_count,
    forks: r.forks_count,
    open_issues: r.open_issues_count,
    created_at: r.created_at,
    updated_at: r.updated_at,
    url: r.html_url,
    clone_url: r.clone_url,
    topics: r.topics,
  };
}

async function handleCreateRepository(args: unknown) {
  const { name, description, private: isPrivate, auto_init, gitignore_template } = CreateRepoSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.repos.createForAuthenticatedUser({
    name,
    description,
    private: isPrivate,
    auto_init,
    gitignore_template,
  });
  return {
    full_name: response.data.full_name,
    url: response.data.html_url,
    clone_url: response.data.clone_url,
    private: response.data.private,
    default_branch: response.data.default_branch,
  };
}

async function handleForkRepository(args: unknown) {
  const { owner, repo, organization } = ForkRepoSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.repos.createFork({ owner, repo, organization });
  return {
    full_name: response.data.full_name,
    url: response.data.html_url,
    clone_url: response.data.clone_url,
  };
}

async function handleListRepositories(args: unknown) {
  const { type, sort, per_page, page } = ListReposSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.repos.listForAuthenticatedUser({ type, sort, per_page, page });
  return response.data.map((r) => ({
    full_name: r.full_name,
    description: r.description,
    private: r.private,
    language: r.language,
    stars: r.stargazers_count,
    url: r.html_url,
  }));
}

async function handleSearchCode(args: unknown) {
  const { query, per_page, page } = SearchCodeSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.search.code({ q: query, per_page, page });
  return {
    total_count: response.data.total_count,
    items: response.data.items.map((item) => ({
      name: item.name,
      path: item.path,
      repository: item.repository.full_name,
      url: item.html_url,
    })),
  };
}

async function handleSearchRepositories(args: unknown) {
  const { query, sort, per_page, page } = SearchReposSchema.parse(args);
  const octokit = getOctokit();
  const response = await octokit.search.repos({ q: query, sort, per_page, page });
  return {
    total_count: response.data.total_count,
    items: response.data.items.map((r) => ({
      full_name: r.full_name,
      description: r.description,
      stars: r.stargazers_count,
      language: r.language,
      url: r.html_url,
    })),
  };
}

async function handleGetUser(args: unknown) {
  const { username } = GetUserSchema.parse(args);
  const octokit = getOctokit();
  if (username) {
    const response = await octokit.users.getByUsername({ username });
    const u = response.data;
    return {
      login: u.login,
      name: u.name,
      bio: u.bio,
      company: u.company,
      location: u.location,
      public_repos: u.public_repos,
      followers: u.followers,
      following: u.following,
      url: u.html_url,
    };
  } else {
    const response = await octokit.users.getAuthenticated();
    const u = response.data;
    return {
      login: u.login,
      name: u.name,
      bio: u.bio,
      company: u.company,
      location: u.location,
      public_repos: u.public_repos,
      private_repos: u.total_private_repos,
      followers: u.followers,
      following: u.following,
      url: u.html_url,
    };
  }
}

async function handleTasksAutLogs(args: unknown) {
  const { last, from, to } = TasksAutLogsSchema.parse(args);
  const baseUrl = process.env.AUT_BASE_URL ?? "http://localhost:3000";
  const url = new URL("/api/logs", baseUrl);
  if (last !== undefined) {
    url.searchParams.set("last", String(last));
  }
  if (from !== undefined) {
    url.searchParams.set("from", String(from));
  }
  if (to !== undefined) {
    url.searchParams.set("to", String(to));
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`AUT logs API returned ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

// ─── Tool Router ──────────────────────────────────────────────────────────────

async function callTool(name: string, args: unknown): Promise<unknown> {
  switch (name) {
    case "get_file_contents":       return handleGetFileContents(args);
    case "create_or_update_file":   return handleCreateOrUpdateFile(args);
    case "push_files":              return handlePushFiles(args);
    case "delete_file":             return handleDeleteFile(args);
    case "list_repo_contents":      return handleListRepoContents(args);
    case "list_commits":            return handleListCommits(args);
    case "get_commit":              return handleGetCommit(args);
    case "list_branches":           return handleListBranches(args);
    case "create_branch":           return handleCreateBranch(args);
    case "list_pull_requests":      return handleListPRs(args);
    case "get_pull_request":        return handleGetPR(args);
    case "create_pull_request":     return handleCreatePR(args);
    case "merge_pull_request":      return handleMergePR(args);
    case "list_issues":             return handleListIssues(args);
    case "get_issue":               return handleGetIssue(args);
    case "create_issue":            return handleCreateIssue(args);
    case "create_issue_comment":    return handleCreateIssueComment(args);
    case "get_repository":          return handleGetRepository(args);
    case "create_repository":       return handleCreateRepository(args);
    case "fork_repository":         return handleForkRepository(args);
    case "list_repositories":       return handleListRepositories(args);
    case "search_code":             return handleSearchCode(args);
    case "search_repositories":     return handleSearchRepositories(args);
    case "get_user":                return handleGetUser(args);
    case "tasksAutLogs":            return handleTasksAutLogs(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "github-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await callTool(name, args);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GitHub MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
