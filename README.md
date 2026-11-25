# 근태 자동화 봇 🤖

PLJEC HR → Jira Timetracker 근태 자동 연동 웹앱

## 기능
- 매일 평일 23:00 (KST) 자동 실행
- PLJEC HR에서 출퇴근 시간 자동 조회
- Jira Timetracker Log Work 자동 제출 (이슈/시간/PI 고정)
- 웹 대시보드에서 설정 관리 & 로그 확인
- 수동 실행 버튼 지원

## 로컬 실행

```bash
# 1. 의존성 설치 (Chromium 자동 설치 포함)
npm install

# 2. 서버 실행
npm start

# 3. 브라우저에서 열기
# http://localhost:3000
```

## 클라우드 배포 (Railway 추천)

1. [Railway](https://railway.app) 가입
2. 이 폴더를 GitHub에 올리기
3. Railway에서 새 프로젝트 → GitHub 연결
4. 환경변수 설정 없이 바로 배포 (설정은 웹 UI에서)
5. 배포 후 웹 UI에서 계정 정보 입력 & 저장

## 주의사항

- **셀렉터 조정 필요**: PLJEC 화면 구조에 따라 `automation/pljec.js`의 선택자를 수정해야 할 수 있습니다.
- **Jira SSO**: 회사 계정이 SSO(Google/Microsoft)라면 `automation/jira.js`의 로그인 부분을 조정하세요.
- **디버그**: 오류 발생 시 `data/debug_pljec.png`, `data/debug_jira.png` 스크린샷으로 확인하세요.
- **주말 제외**: 평일(월~금)만 자동 실행됩니다.

## 파일 구조

```
attendance-bot/
├── server.js          # Express 서버 + API
├── scheduler.js       # cron 스케줄러 + 메인 로직
├── automation/
│   ├── pljec.js       # PLJEC HR 스크래핑
│   └── jira.js        # Jira Log Work 자동화
├── public/
│   └── index.html     # 대시보드 UI
├── data/              # 설정 & 로그 (gitignore됨)
└── package.json
```
