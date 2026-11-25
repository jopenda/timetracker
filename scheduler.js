const cron  = require('node-cron');
const fs    = require('fs');
const path  = require('path');

const CONFIG_PATH = path.join(__dirname, 'data', 'config.json');
const LOGS_PATH   = path.join(__dirname, 'data', 'logs.json');

// ─── 로그 기록 ───────────────────────────────────────────
function addLog(entry) {
  const logs = JSON.parse(fs.readFileSync(LOGS_PATH, 'utf-8'));
  logs.push({ ...entry, timestamp: new Date().toISOString() });
  // 최대 200개 보관
  if (logs.length > 200) logs.splice(0, logs.length - 200);
  fs.writeFileSync(LOGS_PATH, JSON.stringify(logs, null, 2));
}

// ─── 메인 자동화 ─────────────────────────────────────────
async function runAutomation() {
  if (global.isRunning) {
    console.log('⚠️  이미 실행 중입니다. 건너뜁니다.');
    return;
  }

  global.isRunning = true;
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

  // 설정 검증
  if (!config.pljec.email || !config.pljec.password) {
    const msg = 'PLJEC 계정 정보가 설정되지 않았습니다.';
    console.error('❌', msg);
    addLog({ status: 'error', message: msg });
    global.isRunning = false;
    return;
  }
  if (!config.jira.email || !config.jira.password) {
    const msg = 'Jira 계정 정보가 설정되지 않았습니다.';
    console.error('❌', msg);
    addLog({ status: 'error', message: msg });
    global.isRunning = false;
    return;
  }

  console.log('\n🔄 [', new Date().toLocaleString('ko-KR'), '] 근태 자동화 시작...');

  try {
    // ── STEP 1: PLJEC에서 출퇴근 시간 가져오기 ──
    console.log('📍 PLJEC에서 출퇴근 시간 가져오는 중...');
    const { getPljekAttendance } = require('./automation/pljec');
    const attendance = await getPljekAttendance(config.pljec);
    console.log(`✅ 출근: ${attendance.clockIn} / 퇴근: ${attendance.clockOut}`);

    // ── STEP 2: Jira Timetracker에 Log Work 입력 ──
    console.log('📝 Jira에 worklog 입력 중...');
    const { logWorkToJira } = require('./automation/jira');
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    await logWorkToJira(config.jira, {
      date:             today,
      startTime:        attendance.clockIn,
      endTime:          attendance.clockOut,
      issue:            config.jiraIssue,
      worklogAttribute: config.worklogAttribute
    });

    const msg = `성공 — 출근 ${attendance.clockIn} / 퇴근 ${attendance.clockOut} → ${config.jiraIssue} 기록 완료`;
    console.log('✅', msg);
    addLog({
      status:   'success',
      clockIn:  attendance.clockIn,
      clockOut: attendance.clockOut,
      issue:    config.jiraIssue,
      message:  msg
    });

  } catch (err) {
    const msg = err.message || String(err);
    console.error('❌ 오류:', msg);
    addLog({ status: 'error', message: msg });
  } finally {
    global.isRunning = false;
  }
}

// ─── 스케줄러 시작 ───────────────────────────────────────
function startScheduler() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  const hour   = config.scheduleHour ?? 23;

  // 평일(월~금) 매일 설정된 시각에 실행
  cron.schedule(`0 ${hour} * * 1-5`, () => {
    console.log(`\n⏰ 스케줄 실행 (${hour}:00 KST)`);
    runAutomation();
  }, { timezone: 'Asia/Seoul' });

  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const now  = new Date();
  console.log(`⏰ 스케줄러 등록: 평일 ${hour}:00 KST (현재 ${days[now.getDay()]}요일 ${now.toLocaleTimeString('ko-KR')})`);
}

module.exports = { startScheduler, runAutomation };
