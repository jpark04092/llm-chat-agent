# Project Architecture Context Document (Token-Optimized)

## Project Overview
- **Name:** gemini-vscode-agent (v1.1.0)
- **Tech Stack:** React 18, Vite, Tailwind CSS v4, Express, WebSocket (`ws`), TypeScript, Node.js, `esbuild`  
- **Purpose:** Full-duplex VS Code Bridge Server & Web Dashboard managing agent tool execution (`tool_call`) across Client-Server-Extension environments.

## File Hierarchy
```
.
├── server.ts              # Express HTTP + WebSocket Server & Agent Execution APIs
├── vite.config.ts         # Vite bundler setup
├── tsconfig.json          # TypeScript config
├── chrome-extension/      # Extension source for Chrome browser integration
├── vscode-extension/      # Extension source for VS Code integration
└── src/                   # React Frontend App
    ├── App.tsx            # Main state manager, WS client, and tool handler
    ├── main.tsx           # React entry point
    ├── index.css          # Tailwind CSS styles
    ├── types.ts           # Core TS interfaces (Payloads, Logs, Chat, ServerStatus)
    └── components/        # UI Views
        ├── Header.tsx             # Global navigation & status bar
        ├── FloatingHUD.tsx        # Injected overlay HUD component
        ├── GeminiChatSimulator.tsx# Interactive agent chat interface
        ├── WorkspaceExplorer.tsx  # Workspace file browser
        ├── BridgeConsole.tsx      # Real-time WebSocket log viewer
        └── ExtensionHub.tsx       # Chrome/VS Code extension manager
```

## System Interfaces & JSON Protocol (`src/types.ts`)
```typescript
interface ToolCallPayload {
  agent_action?: 'tool_call';
  id: string;
  command: 'file:list' | 'file:read' | 'file:write' | 'file:edit' | 'npm:run' | 'terminal:exec';
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
```

## Core Execution Flow
1. **Agent (`/api/agent/chat`)** outputs Markdown containing JSON `tool_call` blocks.
2. **`App.tsx` (Parser)** extracts JSON via `parseToolCallFromText()`.
3. **Execution (`/api/tools/execute`)** runs requested command subject to `ApprovalPolicy`.
4. **Loop Handshake:** Formatted `[Tool Execution Result]` is piped back to agent.
