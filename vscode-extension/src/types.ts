export interface ToolCallPayload {
  agent_action?: 'tool_call';
  id: string;
  command: 'file:read' | 'file:write' | 'file:edit' | 'file:list' | 'npm:run' | 'terminal:exec' | string;
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

export interface AgentBusyPayload {
  type: 'agent:busy';
  state: 'busy';
  id: string;
  command: string;
  argsSummary?: string;
  startedAt: number;
  phase?: string;
}

export interface AgentHeartbeatPayload {
  type: 'agent:heartbeat';
  state: 'busy';
  id: string;
  command: string;
  elapsedMs: number;
  heartbeatTimestamp: number;
  phase?: string;
}

export interface AgentIdlePayload {
  type: 'agent:idle';
  state: 'idle';
  id?: string;
  totalElapsedMs?: number;
}

