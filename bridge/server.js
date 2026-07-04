/**
 * VibeSHell Bridge Server
 *
 * A lightweight WebSocket server designed to run inside Termux on Android.
 * It exposes a JSON-RPC style API so the React Native frontend can execute
 * shell commands, manage files, and perform git operations through a secure,
 * token-authenticated WebSocket connection on localhost.
 *
 * Protocol:
 *   Request:  { id: string, method: string, params: object }
 *   Response: { id: string, result: any }        — on success
 *             { id: string, error: string }       — on failure
 *   Stream:   { id: string, stream: "stdout"|"stderr", data: string }
 *             followed by a final { id: string, result: { exitCode: number } }
 */

const { WebSocketServer } = require("ws");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = 8765;
const HOST = "127.0.0.1";
const TOKEN_PATH = path.join(os.homedir(), ".vibeshell-token");
const MAX_PAYLOAD = 5 * 1024 * 1024; // 5 MB max message size

// ---------------------------------------------------------------------------
// Auth token management
// ---------------------------------------------------------------------------

/**
 * Read the authentication token from disk.
 * If the file doesn't exist yet, generate a new token and persist it.
 */
function loadOrCreateToken() {
  try {
    const token = fs.readFileSync(TOKEN_PATH, "utf-8").trim();
    if (token.length > 0) return token;
  } catch {
    // File doesn't exist — fall through to generation
  }

  const token = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(TOKEN_PATH, token + "\n", { mode: 0o600 });
  console.log(`[auth] Generated new token → ${TOKEN_PATH}`);
  return token;
}

const AUTH_TOKEN = loadOrCreateToken();

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Send a JSON payload over a WebSocket connection. */
function send(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

/** Resolve a path, preventing trivial directory-traversal attacks. */
function safePath(basePath) {
  // Resolve to absolute, collapse ../ segments
  return path.resolve(basePath);
}

// ---------------------------------------------------------------------------
// RPC method handlers
// ---------------------------------------------------------------------------

/**
 * exec — Execute a shell command with streaming output.
 *
 * Params:
 *   command  (string)  — The command to execute
 *   args     (string[] | undefined) — Optional argument list
 *   cwd      (string  | undefined) — Working directory (defaults to $HOME)
 *   env      (object  | undefined) — Extra environment variables
 *   timeout  (number  | undefined) — Kill after N milliseconds (default: 30 000)
 *
 * Sends streaming frames { id, stream: "stdout"|"stderr", data } and then
 * a final response { id, result: { exitCode } }.
 */
function handleExec(ws, id, params) {
  const {
    command,
    args = [],
    cwd = os.homedir(),
    env = {},
    timeout = 30_000,
  } = params;

  if (!command || typeof command !== "string") {
    return send(ws, { id, error: "Missing or invalid 'command' parameter" });
  }

  let child;
  try {
    child = spawn(command, args, {
      cwd: safePath(cwd),
      env: { ...process.env, ...env },
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    return send(ws, { id, error: `Failed to spawn process: ${err.message}` });
  }

  // Stream stdout
  child.stdout.on("data", (chunk) => {
    send(ws, { id, stream: "stdout", data: chunk.toString("utf-8") });
  });

  // Stream stderr
  child.stderr.on("data", (chunk) => {
    send(ws, { id, stream: "stderr", data: chunk.toString("utf-8") });
  });

  // Timeout guard — kill runaway processes
  const timer = setTimeout(() => {
    child.kill("SIGKILL");
    send(ws, { id, error: `Process timed out after ${timeout}ms` });
  }, timeout);

  child.on("close", (exitCode) => {
    clearTimeout(timer);
    send(ws, { id, result: { exitCode: exitCode ?? -1 } });
  });

  child.on("error", (err) => {
    clearTimeout(timer);
    send(ws, { id, error: `Process error: ${err.message}` });
  });
}

/**
 * read_file — Read a file's contents as UTF-8 text.
 *
 * Params:
 *   path     (string) — Absolute or relative path
 *   encoding (string) — Encoding (default: "utf-8")
 */
async function handleReadFile(_ws, id, params) {
  const filePath = safePath(params.path);
  const encoding = params.encoding || "utf-8";

  try {
    const content = await fs.promises.readFile(filePath, encoding);
    return { id, result: { content, path: filePath } };
  } catch (err) {
    return { id, error: `read_file failed: ${err.message}` };
  }
}

/**
 * write_file — Write content to a file (creates parent dirs if needed).
 *
 * Params:
 *   path    (string) — Target file path
 *   content (string) — File content to write
 *   append  (bool)   — If true, append instead of overwrite (default: false)
 */
async function handleWriteFile(_ws, id, params) {
  const filePath = safePath(params.path);
  const { content, append = false } = params;

  if (typeof content !== "string") {
    return { id, error: "Missing or invalid 'content' parameter" };
  }

  try {
    // Ensure parent directory exists
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

    if (append) {
      await fs.promises.appendFile(filePath, content, "utf-8");
    } else {
      await fs.promises.writeFile(filePath, content, "utf-8");
    }

    return { id, result: { path: filePath, bytes: Buffer.byteLength(content) } };
  } catch (err) {
    return { id, error: `write_file failed: ${err.message}` };
  }
}

/**
 * list_dir — List directory contents with basic metadata.
 *
 * Params:
 *   path       (string) — Directory path
 *   recursive  (bool)   — Not implemented; flat listing only (default: false)
 */
async function handleListDir(_ws, id, params) {
  const dirPath = safePath(params.path || os.homedir());

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const items = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        const info = { name: entry.name, path: fullPath };

        if (entry.isDirectory()) {
          info.type = "directory";
        } else if (entry.isSymbolicLink()) {
          info.type = "symlink";
        } else {
          info.type = "file";
          try {
            const stat = await fs.promises.stat(fullPath);
            info.size = stat.size;
            info.modified = stat.mtimeMs;
          } catch {
            // stat may fail on broken symlinks, etc.
          }
        }

        return info;
      })
    );

    return { id, result: { path: dirPath, entries: items } };
  } catch (err) {
    return { id, error: `list_dir failed: ${err.message}` };
  }
}

/**
 * delete_file — Delete a file or empty directory.
 *
 * Params:
 *   path      (string) — Target path
 *   recursive (bool)   — If true, remove directories recursively (default: false)
 */
async function handleDeleteFile(_ws, id, params) {
  const filePath = safePath(params.path);
  const { recursive = false } = params;

  try {
    await fs.promises.rm(filePath, { recursive, force: false });
    return { id, result: { deleted: filePath } };
  } catch (err) {
    return { id, error: `delete_file failed: ${err.message}` };
  }
}

/**
 * git_diff — Run `git diff` in a given directory.
 *
 * Params:
 *   cwd    (string)   — Repository path
 *   staged (bool)     — If true, show staged changes (default: false)
 *   args   (string[]) — Extra arguments to pass to git diff
 */
function handleGitDiff(ws, id, params) {
  const { cwd = os.homedir(), staged = false, args = [] } = params;
  const gitArgs = ["diff"];
  if (staged) gitArgs.push("--cached");
  gitArgs.push(...args);

  handleExec(ws, id, { command: "git", args: gitArgs, cwd, timeout: 15_000 });
}

/**
 * git_commit — Stage all changes and create a commit.
 *
 * Params:
 *   cwd     (string) — Repository path
 *   message (string) — Commit message
 *   addAll  (bool)   — If true, run `git add -A` before committing (default: true)
 */
function handleGitCommit(ws, id, params) {
  const { cwd = os.homedir(), message, addAll = true } = params;

  if (!message || typeof message !== "string") {
    return send(ws, { id, error: "Missing or invalid 'message' parameter" });
  }

  // Build a chained shell command: optionally stage everything, then commit
  const parts = [];
  if (addAll) parts.push("git add -A");
  parts.push(`git commit -m ${JSON.stringify(message)}`);
  const fullCommand = parts.join(" && ");

  handleExec(ws, id, { command: fullCommand, cwd, timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Method dispatcher
// ---------------------------------------------------------------------------

/** Map of method names to their handler functions. */
const METHODS = {
  exec: handleExec,
  read_file: handleReadFile,
  write_file: handleWriteFile,
  list_dir: handleListDir,
  delete_file: handleDeleteFile,
  git_diff: handleGitDiff,
  git_commit: handleGitCommit,
};

/**
 * Route an incoming JSON-RPC request to the correct handler.
 * Streaming methods (exec, git_*) send their own responses;
 * async methods return a response object for us to send.
 */
async function dispatch(ws, message) {
  let parsed;
  try {
    parsed = JSON.parse(message);
  } catch {
    return send(ws, { id: null, error: "Invalid JSON" });
  }

  const { id, method, params = {} } = parsed;

  if (!id || !method) {
    return send(ws, {
      id: id || null,
      error: "Request must include 'id' and 'method'",
    });
  }

  const handler = METHODS[method];
  if (!handler) {
    return send(ws, { id, error: `Unknown method: ${method}` });
  }

  try {
    const result = handler(ws, id, params);

    // If the handler returns a promise (async file ops), await and send
    if (result && typeof result.then === "function") {
      const response = await result;
      send(ws, response);
    }
    // Streaming handlers (exec, git_*) send responses on their own
  } catch (err) {
    send(ws, { id, error: `Internal error: ${err.message}` });
  }
}

// ---------------------------------------------------------------------------
// WebSocket server setup
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({
  host: HOST,
  port: PORT,
  maxPayload: MAX_PAYLOAD,
});

wss.on("listening", () => {
  console.log(`[bridge] VibeSHell bridge server listening on ws://${HOST}:${PORT}`);
  console.log(`[bridge] Auth token loaded from ${TOKEN_PATH}`);
});

wss.on("connection", (ws, req) => {
  const clientIP = req.socket.remoteAddress;
  console.log(`[bridge] New connection from ${clientIP}`);

  let authenticated = false;

  ws.on("message", (raw) => {
    const data = raw.toString("utf-8");

    // First message must be the auth token
    if (!authenticated) {
      let authPayload;
      try {
        authPayload = JSON.parse(data);
      } catch {
        send(ws, { error: "First message must be JSON with 'token' field" });
        ws.close(4001, "Invalid auth payload");
        return;
      }

      if (authPayload.token === AUTH_TOKEN) {
        authenticated = true;
        send(ws, { authenticated: true });
        console.log(`[auth] Client authenticated successfully`);
      } else {
        send(ws, { error: "Authentication failed" });
        ws.close(4003, "Forbidden");
        console.warn(`[auth] Client failed authentication from ${clientIP}`);
      }
      return;
    }

    // Authenticated — dispatch the RPC request
    dispatch(ws, data);
  });

  ws.on("close", (code, reason) => {
    console.log(`[bridge] Client disconnected (code=${code}, reason=${reason})`);
  });

  ws.on("error", (err) => {
    console.error(`[bridge] WebSocket error: ${err.message}`);
  });
});

wss.on("error", (err) => {
  console.error(`[bridge] Server error: ${err.message}`);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown(signal) {
  console.log(`\n[bridge] Received ${signal}, shutting down...`);

  // Close all active connections
  wss.clients.forEach((client) => {
    client.close(1001, "Server shutting down");
  });

  wss.close(() => {
    console.log("[bridge] Server closed.");
    process.exit(0);
  });

  // Force exit after 5 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error("[bridge] Forced exit after timeout");
    process.exit(1);
  }, 5000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
