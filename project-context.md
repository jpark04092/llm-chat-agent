# Project Architecture Context Document (Token-Optimized)

## Project Overview
- **Name:** universal-web-ai-vscode-agent (v2.1 Allowlist Edition)
- **Tech Stack:** React 18, Vite, Tailwind CSS v4, Express, WebSocket (`ws`), TypeScript, Node.js, `esbuild`  
- **Purpose:** Full-duplex VS Code Bridge Server & Multi-LLM Web Dashboard managing agent tool execution across Client-Server-Extension environments with selective URL filtering and enterprise LLM support.

## File Hierarchy
```
.
├── server.ts              # Express HTTP + WebSocket Server & Agent Execution APIs
├── vite.config.ts         # Vite bundler setup
├── tsconfig.json          # TypeScript config
├── chrome-extension/      # Extension source for Chrome browser integration
│   ├── manifest.json      # MV3 manifest with storage & host permissions
│   ├── content.js         # Selective HUD injector, DOM parser & Tool call scanner
│   ├── background.js      # Service worker handling connection lifetime
│   ├── options.html       # Allowed sites & custom LLM management UI
│   ├── options.js         # Chrome storage sync & CRUD controller
│   └── options.css        # Clean dark-mode stylesheet
├── vscode-extension/      # Extension source for VS Code integration
│   ├── src/extension.ts   # Embedded WS server (:9999) + File I/O + Terminal
│   └── package.json       # VS Code extension manifest
└── src/                   # React Frontend App
    ├── App.tsx            # Main state manager, WS client, and tool handler
    ├── types.ts           # Core TS interfaces (Payloads, Presets, CustomSites)
    └── components/        # UI Views
        ├── Header.tsx             # Global navigation & status bar
        ├── FloatingHUD.tsx        # Injected overlay HUD component
        ├── GeminiChatSimulator.tsx# Multi-LLM interactive agent chat interface
        ├── WorkspaceExplorer.tsx  # Workspace file browser
        ├── BridgeConsole.tsx      # Real-time WebSocket log viewer
        └── ExtensionHub.tsx       # Sites allowlist manager & extension download hub
```

## System Interfaces & JSON Protocol (`src/types.ts`)
```typescript
interface ToolCallPayload {
  agent_action?: 'tool_call';
  id: string;
  command: 'file:list' | 'file:read' | 'file:write' | 'file:patch' | 'npm:run' | 'terminal:exec';
  args?: Record<string, any>;
}

interface ToolResultPayload {
  agent_response: 'tool_result';
  id: string;
  status: 'success' | 'error';
  result?: any;
  error?: string;
  timestamp?: number;
}

type ApprovalPolicy = 'full-auto' | 'safety' | 'read-only';

interface PresetSiteItem {
  id: string;
  name: string;
  tag: string;
  tagClass: 'official' | 'popular' | 'self-hosted' | 'custom';
  urlDisplay: string;
  urlPatterns: string[];
  defaultEnabled: boolean;
  enabled: boolean;
}

interface CustomSiteItem {
  id: string;
  name: string;
  urlPattern: string;
  enabled: boolean;
  inputSelector?: string;
  sendSelector?: string;
  messageSelector?: string;
  injectionMode?: 'react-setter' | 'standard-input' | 'contenteditable-paste';
}
```

## Core Execution Flow
1. **URL Evaluation (`evaluateUrlPermission()`)**: Verifies if the active page matches enabled presets or custom URL patterns. If not allowed, zero background work is performed.
2. **HUD Injection (`createAgentHUD()`)**: Renders on allowed domains; stays disconnected until user clicks [연결] to protect against historical loop re-execution.
3. **Agent Output Parsing**: Detects tool calls (`file:patch`, `file:read`, `terminal:exec`, etc.) from chat responses.
4. **Execution over WebSocket (:9999)**: Dispatches tool payload to VS Code or Server according to `ApprovalPolicy`.
5. **Loop Handshake:** Formatted `[Tool Execution Result]` is returned and injected into the web chat.

