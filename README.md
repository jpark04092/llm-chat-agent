# Gemini Web – VS Code Orchestrated Agent Suite (Embedded Server Edition)

본 프로젝트는 Gemini Web UI (gemini.google.com), Chrome Extension, 그리고 **WebSocket 서버가 내장된 VS Code Extension**을 직접 연결하여 터미널 데몬 실행 없이 로컬 자율 코딩 에이전트를 가동하는 통합 시스템입니다.

## 📁 통합 구성 요소 (2대 모듈)
1. `vscode-extension/`: **WebSocket Server (ws://localhost:9999) 내장** + 로컬 파일 시스템 I/O 및 터미널 Passthrough 실행기
2. `chrome-extension/`: Chrome 확장 프로그램 (Manifest V3 - gemini.google.com DOM 파서, 승인 가드, VS Code 직접 연결)

## 🚀 초간편 실행 순서
1. **VS Code Extension 실행**:
   - VS Code로 `vscode-extension` 폴더를 엽니다.
   - `npm install` 실행 후 `F5` 키를 눌러 Extension Development Host 창을 엽니다.
   - 명령어 팔레트(`Ctrl+Shift+P` / `Cmd+Shift+P`)에서 **`Gemini Agent: Connect Bridge Server`**를 실행하거나 우측 하단 상태바의 `Gemini Bridge`를 클릭하여 서버를 시작합니다.
   - 우측 하단 상태바에 `$(radio-tower) Gemini Bridge :9999 (0 Clients)`가 표시됩니다.

2. **Chrome Extension 로드**:
   - Chrome 주소창에 `chrome://extensions/` 입력
   - 우측 상단 '개발자 모드' 활성화 -> '압축해제된 확장 프로그램을 로드합니다' 클릭
   - `chrome-extension` 폴더 선택

3. **Gemini Web 접속 및 코딩 시작**:
   - https://gemini.google.com 접속
   - 우측 하단 플로팅 HUD에서 `VS Code 내장 서버 연결됨 (:9999)` 확인
   - "package.json 읽어줘", "src/App.tsx의 특정 코드를 수정해줘(`file:edit` 고속 부분 패치)", 또는 "npm test 실행해줘" 등으로 자율 코딩 루프를 실행하세요!

## ⚡ 지원 도구 (Tool Commands)
- `file:read`: 파일 내용 읽기 (`{"path": "..."}`)
- `file:edit`: **[강력 추천]** 기존 파일의 특정 텍스트를 고속으로 치환 수정 (`{"path": "...", "target": "...", "replacement": "..."}`) — 대용량 파일 수정 시 지연 시간 대폭 단축
- `file:write`: 새 파일 생성 또는 전체 파일 덮어쓰기 (`{"path": "...", "content": "..."}`)
- `file:list`: 디렉토리 파일 목록 조회 (`{"path": "."}`)
- `npm:run`: package.json 스크립트 실행 (`{"script": "build"}`)
- `terminal:exec`: 셸/터미널 명령어 실행 (`{"cmd": "..."}`)
