# Gemini Web Orchestrated Agent (VS Code Extension with Embedded Server)

Gemini 웹(`gemini.google.com`)과 직접 통신하는 **내장형 WebSocket Bridge Server(`ws://localhost:9999`)** 및 로컬 파일/터미널 명령을 수행하는 **Passthrough Command Executor**가 하나로 통합된 VS Code 확장 프로그램입니다.

## 🚀 차별점 (Embedded Architecture)
- 별도의 Node.js 서버 프로세스를 백그라운드나 터미널에서 수동으로 켤 필요가 없습니다.
- **VS Code 내에서 직접 WebSocket 브리지 서버가 구동**되며, 명령어 팔레트 또는 상태 표시줄을 통해 간편하게 제어할 수 있습니다.
- Chrome Extension이 `ws://localhost:9999`로 연결하여 즉시 도구 호출(Tool Call)을 수행합니다.

## 🛠️ 실행 방법
1. VS Code에서 `vscode-extension` 폴더를 엽니다.
2. `npm install` 실행
3. `F5` 키를 눌러 Extension Development Host 창을 실행합니다.
4. 명령어 팔레트(`Ctrl+Shift+P` / `Cmd+Shift+P`)에서 **`Gemini Agent: Connect Bridge Server`**를 실행하거나, 우측 하단 상태 표시줄의 `Gemini Bridge` 항목을 클릭하여 서버를 연결합니다.
5. 이제 `gemini.google.com`에서 요청을 보내면 바로 로컬 파일 읽기/수정(`file:edit` 고속 패치)/생성 및 터미널 명령이 실행됩니다!

## ⌨️ 명령어 팔레트 (Command Palette) 기능
VS Code에서 `Ctrl+Shift+P` (macOS: `Cmd+Shift+P`)를 누른 뒤 **`Gemini Agent:`**를 입력하면 다음 명령들을 바로 실행할 수 있습니다:

| 명령어 (Title) | Command ID | 설명 |
| :--- | :--- | :--- |
| **`Gemini Agent: Connect Bridge Server`** | `geminiAgent.startServer` | 내장 WebSocket 브리지 서버를 시작하고 포트(기본 9999)에서 연결을 대기합니다. |
| **`Gemini Agent: Disconnect Bridge Server`** | `geminiAgent.stopServer` | 실행 중인 브리지 서버를 안전하게 중지하고 연결을 해제합니다. |
| **`Gemini Agent: Restart Bridge Server`** | `geminiAgent.restartServer` | 브리지 서버를 즉시 재시작하여 새로운 연결을 준비합니다. |
| **`Gemini Agent: Manage Bridge Server`** | `geminiAgent.toggleServer` | 빠른 선택 메뉴(QuickPick)를 열어 현재 상태에 맞춰 연결/중지/재시작/로그 보기를 한눈에 선택합니다. |
| **`Gemini Agent: Show Output Channel`** | `geminiAgent.showLogs` | 'Gemini Web Agent' 전용 출력(Output) 창을 열어 브리지 통신 및 도구 실행 로그를 실시간으로 확인합니다. |

### 📌 상태 표시줄 (Status Bar) 빠른 제어
- VS Code 우측 하단 상태 표시줄에 현재 서버 상태와 접속된 클라이언트 수가 실시간 표시됩니다:
  - 연결 시: `$(radio-tower) Gemini Bridge :9999 (N Clients)`
  - 미연결 시: `$(plug) Gemini Bridge: Disconnected`
- 상태 표시줄 항목을 클릭하면 `Gemini Agent: Manage Bridge Server` QuickPick 메뉴가 즉시 나타납니다.

## ⚙️ 확장 프로그램 설정 (Configuration)
VS Code 설정(`Ctrl+,` / `Cmd+,`)에서 `Gemini Agent`를 검색하거나 `settings.json`에서 다음 설정을 변경할 수 있습니다:

```json
{
  "geminiAgent.serverPort": 9999,
  "geminiAgent.autoStartServer": false
}
```

- **`geminiAgent.serverPort`** (기본값: `9999`): 내장 WebSocket 브리지 서버가 수신 대기할 포트 번호입니다.
- **`geminiAgent.autoStartServer`** (기본값: `false`): `true`로 설정 시 VS Code가 열릴 때 브리지 서버를 자동으로 시작합니다.

## ⚡ 지원 도구 (Tool Commands)
- `file:read`: 파일 읽기 (`{"path": "..."}`)
- `file:edit`: 기존 파일의 특정 구문 고속 교체 (`target` -> `replacement`, 전체 재작성 없이 즉각 수정)
- `file:write`: 새 파일 쓰기 / 전체 생성 (`{"path": "...", "content": "..."}`)
- `file:list`: 디렉토리 탐색 (`{"path": "."}`)
- `npm:run`: NPM 스크립트 실행 (`{"script": "build"}`)
- `terminal:exec`: 셸 명령 실행 (`{"cmd": "..."}`)

