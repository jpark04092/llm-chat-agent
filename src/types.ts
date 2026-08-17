export interface ToolCallPayload {
  agent_action?: 'tool_call';
  id: string;
  command: 'file:read' | 'file:write' | 'file:patch' | 'file:list' | 'npm:run' | 'terminal:exec' | string;
  args?: Record<string, any>;
}

export interface ToolResultPayload {
  agent_response: 'tool_result';
  id: string;
  status: 'success' | 'error' | 'aborted';
  result?: any;
  error?: string;
  timestamp?: number;
}

export interface AgentBusyState {
  isBusy: boolean;
  command?: string;
  callId?: string;
  argsSummary?: string;
  startedAt?: number;
  elapsedSeconds?: number;
  lastHeartbeatAt?: number;
  phase?: string;
  isStalled?: boolean; // suspected deadlock (> 30s or missed heartbeats)
  canAbort?: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'inbound' | 'outbound' | 'system' | 'executor' | 'busy' | 'heartbeat';
  command?: string;
  data: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: string;
  toolCall?: ToolCallPayload;
  toolResult?: ToolResultPayload;
  status?: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'aborted';
  executionStartedAt?: number;
}

export interface WorkspaceFile {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface ServerStatus {
  status: string;
  port: number;
  workspace: string;
  workspacePath: string;
  connectedClients: number;
  hasGeminiApiKey: boolean;
  nodeVersion: string;
  isBusy?: boolean;
  currentTool?: string;
}

export type ApprovalPolicy = 'full-auto' | 'safety' | 'read-only';

export interface PresetSiteItem {
  id: string;
  name: string;
  tag: string;
  tagClass: 'official' | 'popular' | 'self-hosted' | 'custom';
  urlDisplay: string;
  urlPatterns: string[];
  defaultEnabled: boolean;
  enabled: boolean;
}

export interface CustomSiteItem {
  id: string;
  name: string;
  urlPattern: string;
  enabled: boolean;
  inputSelector?: string;
  sendSelector?: string;
  messageSelector?: string;
  injectionMode?: 'react-setter' | 'standard-input' | 'contenteditable-paste';
}


