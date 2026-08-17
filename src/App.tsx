import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { FloatingHUD } from './components/FloatingHUD';
import { GeminiChatSimulator } from './components/GeminiChatSimulator';
import { WorkspaceExplorer } from './components/WorkspaceExplorer';
import { BridgeConsole } from './components/BridgeConsole';
import { ExtensionHub } from './components/ExtensionHub';
import { ChatMessage, ToolCallPayload, ToolResultPayload, ServerStatus, LogEntry, ApprovalPolicy, AgentBusyState } from './types';

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'sys_1',
    role: 'system',
    content: `[Developer Agent Mode Active]
VS Code Embedded Bridge Server 연결됨.
안정적인 코드 수정(\`file:patch\` - 라인 번호 / Unified Diff), 파일 읽기/생성, 디렉토리 탐색, 터미널 실행 시 JSON 코드 블록(\`tool_call\`)을 통해 요청이 처리됩니다.
실행 중인 작업의 Deadlock/지연 여부는 Agent HUD에 실시간으로 표시됩니다.`,
    timestamp: new Date().toISOString(),
  },
  {
    id: 'model_1',
    role: 'model',
    content: '안녕하세요! VS Code Agent Bridge가 연결되었습니다. 공백 및 줄바꿈 오차가 없는 라인 번호/Diff 기반 file:patch 도구와 실시간 작업 상태(Busy/Deadlock 감지) 모니터링이 지원됩니다. 어떤 개발 작업을 시작할까요?',
    timestamp: new Date().toISOString(),
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'workspace' | 'console' | 'extension'>('chat');
  const [approvalPolicy, setApprovalPolicy] = useState<ApprovalPolicy>('safety');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [hudMessage, setHudMessage] = useState<string | null>('Connected to VS Code Bridge');
  const [isSending, setIsSending] = useState(false);

  // Live Agent Busy State & Deadlock Tracking
  const [busyState, setBusyState] = useState<AgentBusyState>({
    isBusy: false,
    callId: undefined,
    command: undefined,
    startedAt: 0,
    lastHeartbeatAt: 0,
    phase: '',
    elapsedSeconds: 0,
    isStalled: false,
  });

  const wsRef = useRef<WebSocket | null>(null);

  // Busy ticker for live HUD seconds and stall checking
  useEffect(() => {
    if (!busyState.isBusy) return;

    const interval = setInterval(() => {
      setBusyState((prev) => {
        if (!prev.isBusy) return prev;
        const elapsedSec = Math.floor((Date.now() - (prev.startedAt ?? Date.now())) / 1000);
        const heartbeatDiff = Date.now() - (prev.lastHeartbeatAt ?? Date.now());
        const isStalled = elapsedSec >= 35 || (elapsedSec > 8 && heartbeatDiff > 6000);
        return {
          ...prev,
          elapsedSeconds: elapsedSec,
          isStalled,
        };
      });
    }, 500);

    return () => clearInterval(interval);
  }, [busyState.isBusy]);

  // Fetch Server Status
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setServerStatus(data);
      if (data.isBusy && data.activeCall) {
        setBusyState((prev) => ({
          ...prev,
          isBusy: true,
          callId: data.activeCall.id,
          command: data.activeCall.command,
          startedAt: data.activeCall.startedAt || Date.now(),
          phase: data.activeCall.phase || '작업 진행 중...',
        }));
      }
    } catch (err) {
      console.warn('Failed to fetch status:', err);
    }
  };

  // Fetch Logs
  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } catch (err) {
      console.warn('Failed to fetch logs:', err);
    }
  };

  const clearLogs = async () => {
    try {
      await fetch('/api/logs', { method: 'DELETE' });
      setLogs([]);
    } catch (err) {
      console.warn('Failed to clear logs:', err);
    }
  };

  // Setup WebSocket connection to Bridge Server
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    function connectWS() {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setWsConnected(true);
          setHudMessage('Bridge & VS Code 연결됨 (:3000)');
          ws.send(JSON.stringify({
            type: 'register',
            client: 'web-dashboard-simulator',
            url: window.location.href,
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'agent:busy' || data.state === 'busy') {
              setBusyState({
                isBusy: true,
                callId: data.id,
                command: data.command,
                startedAt: data.startedAt || Date.now(),
                lastHeartbeatAt: Date.now(),
                phase: data.phase || '작업 진행 중...',
                elapsedSeconds: 0,
                isStalled: false,
              });
              setHudMessage(`⚡ 작업 시작: ${data.command || data.id}`);
            } else if (data.type === 'agent:heartbeat') {
              setBusyState((prev) => ({
                ...prev,
                lastHeartbeatAt: data.heartbeatTimestamp || Date.now(),
                phase: data.phase || prev.phase,
              }));
            } else if (data.type === 'agent:idle' || data.state === 'idle' || data.type === 'tool_result' || data.type === 'agent:aborted') {
              setBusyState((prev) => ({
                ...prev,
                isBusy: false,
                isStalled: false,
              }));
              if (data.type === 'agent:aborted') {
                setHudMessage(`⏹️ 작업 중단됨 (${data.id || 'all'})`);
              }
            }

            fetchLogs();
          } catch (e) {}
        };

        ws.onclose = () => {
          setWsConnected(false);
          setHudMessage('Bridge 미연결 (재시도 중)');
          setTimeout(connectWS, 4000);
        };

        ws.onerror = () => {
          setWsConnected(false);
        };
      } catch (err) {
        setTimeout(connectWS, 5000);
      }
    }

    connectWS();
    fetchStatus();
    fetchLogs();

    const interval = setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 5000);

    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Abort execution handler
  const handleAbortExecution = async (callId?: string | null) => {
    try {
      setHudMessage('작업 중단 요청 중...');
      const targetId = callId || busyState.callId || 'all';

      // 1. Send via WebSocket if open
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'agent:abort',
          command: 'agent:abort',
          id: targetId,
          timestamp: Date.now(),
        }));
      }

      // 2. Send via HTTP API fallback
      await fetch('/api/tools/abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetId }),
      });

      setBusyState((prev) => ({
        ...prev,
        isBusy: false,
        isStalled: false,
      }));
      setHudMessage(`⏹️ 작업 중단 신호 전송 완료 (ID: ${targetId})`);
      fetchLogs();
    } catch (err: any) {
      console.error('Failed to abort execution:', err);
    }
  };

  // Tool Call Execution Engine
  const executeToolCall = async (messageId: string, toolCall: ToolCallPayload): Promise<ToolResultPayload> => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status: 'executing' } : m))
    );
    setHudMessage(`도구 실행 중: ${toolCall.command}`);
    setBusyState({
      isBusy: true,
      callId: toolCall.id,
      command: toolCall.command,
      startedAt: Date.now(),
      lastHeartbeatAt: Date.now(),
      phase: '실행 요청 전송 중...',
      elapsedSeconds: 0,
      isStalled: false,
    });

    try {
      const res = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolCall),
      });
      const result: ToolResultPayload = await res.json();

      setBusyState((prev) => ({
        ...prev,
        isBusy: false,
        isStalled: false,
      }));

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, status: 'completed', toolResult: result }
            : m
        )
      );

      setHudMessage(`결과 수신 (${toolCall.command}): ${result.status}`);
      fetchLogs();

      // In Full Auto or standard loop: inject Tool Result back to Gemini
      const toolResultText = `[Tool Execution Result]
ID: ${result.id || toolCall.id}
Status: ${result.status}
${result.result ? `Output:\n${typeof result.result === 'object' ? JSON.stringify(result.result, null, 2) : result.result}` : ''}
${result.error ? `Error:\n${result.error}` : ''}

다음 단계의 작업을 진행해주세요.`;

      // Trigger automatic follow-up prompt
      setTimeout(() => {
        handleFollowUpResult(toolResultText);
      }, 600);

      return result;
    } catch (err: any) {
      setBusyState((prev) => ({
        ...prev,
        isBusy: false,
        isStalled: false,
      }));

      const errorResult: ToolResultPayload = {
        agent_response: 'tool_result',
        id: toolCall.id,
        status: 'error',
        error: err.message,
      };
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, status: 'completed', toolResult: errorResult }
            : m
        )
      );
      return errorResult;
    }
  };

  const handleFollowUpResult = async (resultPrompt: string) => {
    const userMsg: ChatMessage = {
      id: `res_${Date.now()}`,
      role: 'user',
      content: resultPrompt,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: resultPrompt,
          conversationHistory: [...messages, userMsg],
        }),
      });
      const data = await res.json();
      processModelResponse(data.reply);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const parseToolCallFromText = (text: string): ToolCallPayload | undefined => {
    try {
      const match = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        const parsed = JSON.parse(match[1]);
        if (parsed.command || parsed.agent_action === 'tool_call') {
          return parsed;
        }
      }
      // Raw json match
      const rawMatch = text.match(/\{[\s\S]*?"command"\s*:[\s\S]*?\}/);
      if (rawMatch) {
        const parsed = JSON.parse(rawMatch[0]);
        if (parsed.command) return parsed;
      }
    } catch (e) {}
    return undefined;
  };

  const processModelResponse = (replyText: string) => {
    const toolCall = parseToolCallFromText(replyText);
    const modelMsgId = `model_${Date.now()}`;

    const isReadOnlyBlocked =
      approvalPolicy === 'read-only' &&
      toolCall &&
      (toolCall.command === 'file:write' || toolCall.command === 'file:patch' || toolCall.command === 'terminal:exec' || toolCall.command === 'npm:run');

    const newMsg: ChatMessage = {
      id: modelMsgId,
      role: 'model',
      content: replyText,
      timestamp: new Date().toISOString(),
      toolCall: toolCall,
      status: toolCall
        ? isReadOnlyBlocked
          ? 'rejected'
          : approvalPolicy === 'full-auto'
          ? 'approved'
          : 'pending'
        : undefined,
    };

    setMessages((prev) => [...prev, newMsg]);

    if (toolCall) {
      if (isReadOnlyBlocked) {
        setHudMessage(`🔒 Read-only mode blocked: ${toolCall.command}`);
      } else if (approvalPolicy === 'full-auto') {
        // Auto-execute immediately
        setTimeout(() => {
          executeToolCall(modelMsgId, toolCall);
        }, 500);
      } else {
        setHudMessage(`도구 실행 승인 대기: ${toolCall.command}`);
      }
    }
  };

  const handleSendMessage = async (prompt: string) => {
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          conversationHistory: [...messages, userMsg],
        }),
      });
      const data = await res.json();
      processModelResponse(data.reply);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'system',
          content: 'Failed to communicate with Agent API. Check server logs.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleRejectTool = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status: 'rejected' } : m))
    );
    setHudMessage('도구 실행이 거부되었습니다.');
  };

  const handleBootstrapPrompt = () => {
    const bootstrapText = `안녕하세요! 앞으로 함께 소프트웨어 개발 프로젝트 작업을 진행하려고 합니다.

효율적인 작업 진행과 원활한 코드 관리를 위해, 작업 단계마다 파일 조회, 파일 수정, 파일 생성, 명령어 실행 제안이 필요한 경우 일반 설명과 함께 아래와 같은 **JSON 포맷(tool_call)** 코드 블록을 포함하여 답변해 주시기 바랍니다.

[출력 포맷 규약]
1. 기존 파일 내용 확인이 필요한 경우 (라인 번호 확인):
\`\`\`json
{
  "agent_action": "tool_call",
  "id": "call_1",
  "command": "file:read",
  "args": { "path": "src/App.tsx" }
}
\`\`\`

2. 기존 파일 부분 수정이 필요한 경우 (★가장 권장 - 라인 번호 치환 또는 Unified Diff 패치):
[방법 A: 라인 번호 기반 치환 (권장)]
\`\`\`json
{
  "agent_action": "tool_call",
  "id": "call_2",
  "command": "file:patch",
  "args": {
    "path": "src/App.tsx",
    "line_start": 10,
    "line_end": 12,
    "replacement": "const [count, setCount] = useState(100);"
  }
}
\`\`\`
[방법 B: Unified Diff / Hunk 패치]
\`\`\`json
{
  "agent_action": "tool_call",
  "id": "call_2",
  "command": "file:patch",
  "args": {
    "path": "src/App.tsx",
    "patch": "@@ -10,3 +10,3 @@\\n-const [count, setCount] = useState(0);\\n+const [count, setCount] = useState(100);"
  }
}
\`\`\`
※ 기존 파일을 수정할 때는 전체를 다시 쓰는 file:write 대신, 먼저 file:read로 내용을 확인한 뒤 반드시 file:patch를 사용하여 수정할 부분만 라인 번호(line_start, line_end) 또는 Diff 포맷으로 지정해 주세요.

3. 새 파일 생성 또는 전체 파일 작성이 필요한 경우:
\`\`\`json
{
  "agent_action": "tool_call",
  "id": "call_3",
  "command": "file:write",
  "args": {
    "path": "src/components/MyComponent.tsx",
    "content": "export function MyComponent() { return <div>Hello</div>; }"
  }
}
\`\`\`

4. 특정 디렉토리 파일 목록 확인이 필요한 경우:
\`\`\`json
{
  "agent_action": "tool_call",
  "id": "call_4",
  "command": "file:list",
  "args": { "path": "." }
}
\`\`\`

5. 빌드 또는 패키지 스크립트 실행이 필요한 경우:
\`\`\`json
{
  "agent_action": "tool_call",
  "id": "call_5",
  "command": "npm:run",
  "args": { "script": "build" }
}
\`\`\`

6. 터미널 명령어 실행 제안이 필요한 경우:
\`\`\`json
{
  "agent_action": "tool_call",
  "id": "call_6",
  "command": "terminal:exec",
  "args": { "cmd": "npm install lodash" }
}
\`\`\`

[진행 방식]
- 한 번에 한 단계씩 작업을 제안하고 위의 JSON 포맷을 출력해 주세요.
- 기존 코드를 변경할 때는 공백/줄바꿈 매칭 오차 및 지연을 방지하기 위해 file:read 후 file:patch(라인 번호 기반 또는 Diff)를 사용해 주세요.
- 제가 해당 작업의 결과를 다음 메시지([Tool Execution Result])로 전달해 드리면, 그 결과를 바탕으로 다음 단계 작업을 이어가 주시면 됩니다.

위 규약으로 진행할 준비가 되셨다면, 불필요한 초기 파일 목록 조회(file:list)를 즉시 실행하지 마시고, 준비되었다는 확인 메시지(예: '준비되었습니다. 어떤 개발 작업을 진행할까요?')로 답변해 주세요.`;

    handleSendMessage(bootstrapText);
  };

  const handleDownloadChromeZip = () => {
    window.location.href = '/api/extension/download-chrome-zip';
  };

  const handleDownloadSuiteZip = () => {
    window.location.href = '/api/extension/download-suite-zip';
  };

  const handleDownloadVsix = () => {
    window.location.href = '/api/extension/download-vsix';
  };

  const pendingCount = messages.filter((m) => m.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Global Navigation Header */}
      <Header
        status={serverStatus}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        approvalPolicy={approvalPolicy}
        setApprovalPolicy={setApprovalPolicy}
        onDownloadSuite={handleDownloadSuiteZip}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 overflow-hidden flex flex-col">
        {activeTab === 'chat' && (
          <GeminiChatSimulator
            messages={messages}
            onSendMessage={handleSendMessage}
            onExecuteTool={executeToolCall}
            onRejectTool={handleRejectTool}
            approvalPolicy={approvalPolicy}
            isSending={isSending}
          />
        )}

        {activeTab === 'workspace' && <WorkspaceExplorer />}

        {activeTab === 'console' && (
          <BridgeConsole
            logs={logs}
            onRefreshLogs={fetchLogs}
            onClearLogs={clearLogs}
            busyState={busyState}
            onAbortExecution={handleAbortExecution}
            onExecuteCustomTool={async (payload) => {
              const res = await fetch('/api/tools/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              const data = await res.json();
              fetchLogs();
              return data;
            }}
          />
        )}

        {activeTab === 'extension' && (
          <ExtensionHub
            onDownloadChromeZip={handleDownloadChromeZip}
            onDownloadSuiteZip={handleDownloadSuiteZip}
            onDownloadVsix={handleDownloadVsix}
            approvalPolicy={approvalPolicy}
            setApprovalPolicy={setApprovalPolicy}
          />
        )}
      </main>

      {/* Floating HUD matching Chrome extension's injected interface */}
      <FloatingHUD
        wsConnected={wsConnected}
        approvalPolicy={approvalPolicy}
        setApprovalPolicy={setApprovalPolicy}
        onBootstrapPrompt={handleBootstrapPrompt}
        lastMessage={hudMessage}
        pendingCount={pendingCount}
        busyState={busyState}
        onAbortExecution={handleAbortExecution}
      />
    </div>
  );
}
