# Universal Web AI – VS Code Orchestrated Agent Suite (Embedded Server Edition)

본 프로젝트는 ChatGPT (chatgpt.com), Claude (claude.ai), Gemini (gemini.google.com), DeepSeek (chat.deepseek.com), Open WebUI, LibreChat, Dify 및 **사내 엔터프라이즈 Custom LLM 웹 챗**, Chrome Extension, 그리고 **WebSocket 서버가 내장된 VS Code Extension**을 직접 연결하여 터미널 데몬 실행 없이 로컬 자율 코딩 에이전트를 가동하는 통합 범용 시스템입니다.

---

## 🌟 주요 기능 및 최신 업데이트 (v2.1 Allowlist Edition)

### 1. 🌐 사이트 선택적 HUD 활성화 및 URL 허용 관리 (Selective URL Allowlist)
- **Zero-Overhead 리소스 보호**: 일반 포털, 뉴스, 사내 업무 시스템 등 사용하지 않는 사이트에서는 HUD가 일체 마운트되지 않으며, 백그라운드 DOM 스캔 및 웹소켓 연결 리소스 소모가 완전히 차단(0%)됩니다.
- **기본 지원 AI 서비스별 독립 On/Off 토글**:
  - OpenAI ChatGPT (`chatgpt.com`, `chat.openai.com`)
  - Anthropic Claude.ai (`claude.ai`)
  - Google Gemini (`gemini.google.com`)
  - DeepSeek Chat (`chat.deepseek.com`)
  - Open WebUI (`localhost:8080`, `*openwebui*`)
  - LibreChat (`localhost:3080`, `*librechat*`)
  - Dify.ai Chat (`cloud.dify.ai`, `*dify*`)
- **사내망 Custom LLM 웹 챗 등록 (Enterprise Custom Domains)**:
  - 사내망 주소(예: `*://*.internal/*`, `*://chat.corp.*`, `localhost:8080/*`)를 자유롭게 추가·수정·삭제하고 개별 On/Off 스위치를 제공합니다.
  - 필요 시 DOM 입력창(`textarea`), 전송 버튼, 어시스턴트 메시지 컨테이너, React State Setter 주입 모드를 커스텀 지정할 수 있습니다.
- **실시간 즉시 동기화 (Live Reactive Sync)**:
  - Extension 설정(Options) 또는 웹 대시보드에서 토글을 변경하는 즉시 열려 있는 웹 페이지에 HUD가 실시간으로 생성되거나 제거됩니다.
- **페이지 로드/새로고침 시 자동 연결 방지 (No Auto-Connect Guard)**:
  - F5나 페이지 이동 시 이전 대화 히스토리의 Tool Call이 의도치 않게 재실행되는 사고를 원천 방지하기 위해, 명시적인 **[연결]** 버튼 클릭 시에만 안전하게 로컬 VS Code에 접속합니다.

---

## 📁 통합 구성 요소 (2대 모듈)
1. `vscode-extension/`: **WebSocket Server (ws://localhost:9999) 내장** + 로컬 파일 시스템 I/O 및 터미널 Passthrough 실행기
2. `chrome-extension/`: Chrome 확장 프로그램 (Manifest V3 - 다중 LLM DOM 파서, URL Allowlist 가드, VS Code 직접 연결)

---

## 🚀 초간편 실행 순서

### 1. VS Code Extension 실행:
1. VS Code로 `vscode-extension` 폴더를 엽니다.
2. `npm install` 실행 후 `F5` 키를 눌러 Extension Development Host 창을 엽니다.
3. 명령어 팔레트(`Ctrl+Shift+P` / `Cmd+Shift+P`)에서 **`AI Agent: Connect Bridge Server`** (또는 `Gemini Agent: Connect Bridge Server`)를 실행하거나 우측 하단 상태바의 `AI Agent Bridge`를 클릭하여 서버를 시작합니다.
4. 우측 하단 상태바에 `$(radio-tower) AI Agent Bridge :9999 (0 Clients)`가 표시됩니다.

### 2. Chrome Extension 로드 및 사이트 설정:
1. Chrome 주소창에 `chrome://extensions/` 입력
2. 우측 상단 **'개발자 모드'** 활성화 -> **'압축해제된 확장 프로그램을 로드합니다'** 클릭
3. `chrome-extension` 폴더 선택
4. 확장 프로그램 아이콘 우클릭 -> **[옵션(Options)]** 또는 대시보드의 **[🌐 작동 사이트 & URL 허용 관리]** 탭에서 원하는 AI 서비스 On/Off 확인

### 3. Web AI 접속 및 코딩 시작:
1. 허용 목록에 등록된 웹 챗(ChatGPT, Claude, Gemini, DeepSeek, 사내 LLM 등) 접속
2. 우측 하단 플로팅 HUD에서 **[연결]** 버튼 클릭 (`VS Code 내장 서버 연결됨 (:9999)` 확인)
3. **[부트스트랩 전송]** 클릭 후 "package.json 읽어줘", "src/App.tsx를 수정해줘(`file:edit` 고속 부분 패치)", 또는 "npm test 실행해줘" 등으로 자율 코딩 루프를 실행하세요!

---

## ⚡ 지원 도구 (Tool Commands)
- `file:read`: 파일 내용 읽기 (`{"path": "..."}`)
- `file:edit`: **[강력 추천]** 기존 파일의 특정 텍스트를 고속으로 치환 수정 (`{"path": "...", "target": "...", "replacement": "..."}`) — 대용량 파일 수정 시 지연 시간 대폭 단축
- `file:write`: 새 파일 생성 또는 전체 파일 덮어쓰기 (`{"path": "...", "content": "..."}`)
- `file:list`: 디렉토리 파일 목록 조회 (`{"path": "."}`)
- `npm:run`: package.json 스크립트 실행 (`{"script": "build"}`)
- `terminal:exec`: 셸/터미널 명령어 실행 (`{"cmd": "..."}`)

