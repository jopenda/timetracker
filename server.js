const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const LOGS_PATH = path.join(DATA_DIR, 'logs.json');

// ─── 초기화 ─────────────────────────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(CONFIG_PATH)) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({
    pljec:            { email: '', password: '' },
    jira:             { email: '', password: '' },
    jiraIssue:        'SLSIXPU-1',
    worklogAttribute: 'PI',
    scheduleHour:     23
  }, null, 2));
}

if (!fs.existsSync(LOGS_PATH)) {
  fs.writeFileSync(LOGS_PATH, JSON.stringify([], null, 2));
}

// ─── 미들웨어 ────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── 헬퍼 ───────────────────────────────────────────────
function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function readLogs() {
  return JSON.parse(fs.readFileSync(LOGS_PATH, 'utf-8'));
}

// ─── API ─────────────────────────────────────────────────

/** 설정 조회 (비밀번호는 마스킹) */
app.get('/api/config', (req, res) => {
  const cfg = readConfig();
  const masked = JSON.parse(JSON.stringify(cfg));
  if (masked.pljec?.password)  masked.pljec.password  = '••••••••';
  if (masked.jira?.password)   masked.jira.password   = '••••••••';
  res.json(masked);
});

/** 설정 저장 */
app.post('/api/config', (req, res) => {
  const existing = readConfig();
  const body = req.body;

  const updated = {
    pljec: {
      email:    body.pljec?.email    ?? existing.pljec.email,
      password: body.pljec?.password === '••••••••'
                  ? existing.pljec.password
                  : (body.pljec?.password ?? existing.pljec.password)
    },
    jira: {
      email:    body.jira?.email    ?? existing.jira.email,
      password: body.jira?.password === '••••••••'
                  ? existing.jira.password
                  : (body.jira?.password ?? existing.jira.password)
    },
    jiraIssue:        body.jiraIssue        ?? existing.jiraIssue,
    worklogAttribute: body.worklogAttribute ?? existing.worklogAttribute,
    scheduleHour:     body.scheduleHour     ?? existing.scheduleHour
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
  res.json({ success: true, message: '설정이 저장되었습니다.' });
});

/** 로그 조회 (최신 50개) */
app.get('/api/logs', (req, res) => {
  const logs = readLogs();
  res.json(logs.slice(-50).reverse());
});

/** 상태 조회 */
app.get('/api/status', (req, res) => {
  const logs  = readLogs();
  const last  = logs[logs.length - 1] ?? null;
  const { scheduleHour } = readConfig();

  const now     = new Date();
  const nextRun = new Date();
  nextRun.setHours(scheduleHour, 0, 0, 0);
  if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1);

  res.json({ lastRun: last, nextRun: nextRun.toISOString(), running: global.isRunning ?? false });
});

/** 수동 실행 */
app.post('/api/run', async (req, res) => {
  if (global.isRunning) {
    return res.status(409).json({ success: false, message: '이미 실행 중입니다.' });
  }
  res.json({ success: true, message: '자동화를 시작했습니다. 로그를 확인하세요.' });
  const { runAutomation } = require('./scheduler');
  runAutomation();   // 백그라운드 실행
});

// ─── 서버 시작 ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🤖 근태 자동화 봇 실행 중 → http://localhost:${PORT}\n`);
  require('./scheduler').startScheduler();
});
