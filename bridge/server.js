/**
 * VibeSHell Bridge Server (v2 — exec-only)
 *
 * Lightweight WebSocket server for proot (Debian) on Android.
 * Only handles shell command execution — file/git operations are delegated
 * to OpenCode server.
 *
 * Protocol:
 *   Request:  { id: string, method: "exec", params: { command, cwd?, timeout? } }
 *   Stream:   { id: string, stream: "stdout"|"stderr", data: string }
 *   Response: { id: string, result: { exitCode: number } }
 *             { id: string, error: string }
 */

const { WebSocketServer } = require("ws");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const PORT = 8765;
const HOST = "127.0.0.1";
const TOKEN_PATH = path.join(os.homedir(), ".vibeshell-token");
const MAX_PAYLOAD = 5 * 1024 * 1024;

function loadOrCreateToken() {
  try {
    const token = fs.readFileSync(TOKEN_PATH, "utf-8").trim();
    if (token.length > 0) return token;
  } catch {}
  const token = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(TOKEN_PATH, token + "\n", { mode: 0o600 });
  console.log(`[auth] Generated new token → ${TOKEN_PATH}`);
  return token;
}

const AUTH_TOKEN = loadOrCreateToken();

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function safePath(basePath) {
  let resolvedBase = basePath;
  if (typeof resolvedBase === "string" && resolvedBase.startsWith("~/")) {
    resolvedBase = path.join(os.homedir(), resolvedBase.slice(2));
  } else if (resolvedBase === "~") {
    resolvedBase = os.homedir();
  }
  return path.resolve(resolvedBase);
}

// ---------------------------------------------------------------------------
// exec handler — the only method
// ---------------------------------------------------------------------------

function handleExec(ws, id, params) {
  const { command, args = [], cwd = os.homedir(), env = {}, timeout = 30_000 } = params;

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

  child.stdout.on("data", (chunk) => {
    send(ws, { id, stream: "stdout", data: chunk.toString("utf-8") });
  });

  child.stderr.on("data", (chunk) => {
    send(ws, { id, stream: "stderr", data: chunk.toString("utf-8") });
  });

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

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

async function dispatch(ws, message) {
  let parsed;
  try {
    parsed = JSON.parse(message);
  } catch {
    return send(ws, { id: null, error: "Invalid JSON" });
  }

  const { id, method, params = {} } = parsed;

  if (!id || !method) {
    return send(ws, { id: id || null, error: "Request must include 'id' and 'method'" });
  }

  if (method !== "exec") {
    return send(ws, { id, error: `Unknown method: ${method}. Only 'exec' is supported.` });
  }

  try {
    handleExec(ws, id, params);
  } catch (err) {
    send(ws, { id, error: `Internal error: ${err.message}` });
  }
}

// ---------------------------------------------------------------------------
// WebSocket server
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ host: HOST, port: PORT, maxPayload: MAX_PAYLOAD });

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

function shutdown(signal) {
  console.log(`\n[bridge] Received ${signal}, shutting down...`);
  wss.clients.forEach((client) => client.close(1001, "Server shutting down"));
  wss.close(() => {
    console.log("[bridge] Server closed.");
    process.exit(0);
  });
  setTimeout(() => {
    console.error("[bridge] Forced exit after timeout");
    process.exit(1);
  }, 5000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
