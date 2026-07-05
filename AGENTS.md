# AGENTS.md — VibeSHell

## What this is

Mobile agentic coding client for Android. Expo RN app communicates over WebSocket with a proot bridge server (Debian rootfs) that executes shell commands, reads/writes files, and runs git. The AI agent loop (prompt → tool calls → repeat) runs entirely in JS; the bridge is a stateless executor. Runs without Termux — uses proot + Android foreground service.

## Commands

```bash
# Dev server (Expo)
npm start            # or: expo start
npm run android      # expo start --android
npm run web          # expo start --web

# Bridge server (separate package in /bridge, runs inside proot)
cd bridge && npm start   # runs node server.js on ws://127.0.0.1:8765
# Or use: ~/.vibeshell/start.sh (proot-based, daemon mode)
```

No lint, test, or typecheck commands are configured yet. To typecheck:
```bash
npx tsc --noEmit
```

Suggested additions to `package.json` scripts:
```json
"typecheck": "tsc --noEmit",
"lint": "eslint . --ext .ts,.tsx"
```

## Architecture

```
app/              expo-router file-based routes (index, settings, onboarding, chat/[workspaceId])
src/agent/        AgentLoop.ts — core loop; tools.ts — tool definitions; providers/openrouter.ts — API
src/bridge/       WebSocketClient.ts — connection + reconnect; commands.ts — high-level bridge API
src/store/        Zustand stores: useSettings, useBridgeStore, useChatStore, useWorkspaces
src/components/   ChatMessage, ChatInput, ConnectionStatus, ToolCallCard, MarkdownRenderer, WorkspaceCard, DiffViewer
src/theme/        Custom theme: colors, typography, spacing (import from '@/theme')
bridge/           Standalone Node.js WebSocket server (server.js, install.sh for proot setup)
```

## Key facts an agent would miss

- **OpenRouter, not Anthropic directly.** Provider is `https://openrouter.ai/api/v1`. API key format: `sk-or-v1-...`. Models are prefixed (e.g. `anthropic/claude-sonnet-4`).
- **Bridge auth protocol.** First WebSocket message must be `{ "token": "..." }`. Server replies `{ "authenticated": true }` or closes. Token stored at `~/.vibeshell-token`. Bridge runs inside proot Debian rootfs, launched by Android foreground service (`BridgeForegroundService.kt`).
- **expo-router file routing.** Routes are defined by files in `app/`. Dynamic route: `app/chat/[workspaceId].tsx`. Layout: `app/_layout.tsx`.
- **Zustand stores are the source of truth.** Settings loaded from `expo-secure-store` on boot. Bridge connection managed by `useBridgeStore`. Chat state by `useChatStore`.
- **Tool definitions live in `src/agent/tools.ts`.** Seven tools: `run_command`, `read_file`, `write_file`, `list_dir`, `apply_patch`, `git_diff`, `git_commit`. Icons and Turkish labels also defined there.
- **TypeScript strict mode** is enabled via `tsconfig.json` extending `expo/tsconfig.base`.
- **Bridge uses streaming for exec.** The `exec` and `git_*` methods send `{ id, stream: "stdout"|"stderr", data }` frames followed by a final `{ id, result: { exitCode } }`.

## Things to fix

- `DiffViewer` (`src/components/DiffViewer.tsx`) is NOT exported from `src/components/index.ts`. Add it to the barrel export if used.
- No ESLint, Prettier, or test framework configured. Add tooling before the codebase grows.
- `onboarding.tsx` imports `expo-clipboard` which is not in `package.json` dependencies.
