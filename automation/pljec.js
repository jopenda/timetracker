/**
 * PLJEC HR (hr.pljec.cloud) 에서 오늘의 출퇴근 시간을 가져옵니다.
 *
 * ⚠️  셀렉터 주의: 실제 DOM을 확인 후 필요하면 수정하세요.
 *   디버그 모드: headless: false 로 바꾸면 브라우저 창이 열립니다.
 */

const { chromium } = require('playwright');

async function getPljekAttendance({ email, password }) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();
  const page    = await context.newPage();

  try {
    // ── 1. 로그인 페이지 이동 ──────────────────────────────
    // ── 로그인 페이지로 직접 이동 ──────────────────────────────
    await page.goto('https://hr.pljec.cloud/main/login', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 로그인 폼이 있으면 로그인 (선택자 확인 완료)
    const loginForm = await page.$('#login_id');
    if (loginForm) {
      await page.fill('#login_id', email);
      await page.fill('#login_passwd', password);
      await page.click('button.login_btn');
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    // ── 2. 대시보드에서 출퇴근 시간 읽기 ─────────────────────
    // 선택자 확인 완료:
    //   출근: #home2_work_time_from_str  예) "08:52 AM"
    //   퇴근: #home2_work_time_to_str    예) "05:40 PM"
    await page.waitForTimeout(2000);

    // 대시보드가 로드될 때까지 출근 시간 요소 대기
    await page.waitForSelector('#home2_work_time_from_str', { timeout: 15000 });

    const clockInRaw  = await page.textContent('#home2_work_time_from_str');
    const clockOutRaw = await page.textContent('#home2_work_time_to_str');

    console.log('  출근 원본:', clockInRaw);
    console.log('  퇴근 원본:', clockOutRaw);

    const clockIn  = parseTimeStr(clockInRaw);
    const clockOut = parseTimeStr(clockOutRaw);

    if (!clockIn) {
      await page.screenshot({ path: 'data/debug_pljec.png', fullPage: true });
      throw new Error(`출근 시간을 파싱할 수 없습니다: "${clockInRaw}"`);
    }

    if (!clockOut || clockOutRaw.trim() === '' || clockOutRaw.includes('-')) {
      await page.screenshot({ path: 'data/debug_pljec.png', fullPage: true });
      throw new Error('퇴근 시간이 없습니다. 퇴근 버튼을 먼저 눌러주세요.');
    }

    return { clockIn, clockOut };

  } finally {
    await browser.close();
  }
}

// ─── 텍스트에서 출퇴근 시간 추출 ────────────────────────────
// PLJEC 화면에서 "08:52 AM" 형태의 첫 번째 → 출근, 두 번째 → 퇴근
function extractClockIn(text) {
  const matches = [...text.matchAll(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi)];
  return matches[0] ? parseTimeStr(matches[0][1]) : null;
}

function extractClockOut(text) {
  const matches = [...text.matchAll(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi)];
  return matches[1] ? parseTimeStr(matches[1][1]) : null;
}

// "08:52 AM" 또는 "18:30" → "08:52" / "18:30"
function parseTimeStr(str) {
  if (!str) return null;
  str = str.trim();

  // AM/PM 형식
  const ampm = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m   = ampm[2];
    const mer = ampm[3].toUpperCase();
    if (mer === 'PM' && h !== 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }

  // 24시간 형식
  const plain = str.match(/(\d{1,2}):(\d{2})/);
  if (plain) return `${plain[1].padStart(2, '0')}:${plain[2]}`;

  return null;
}

module.exports = { getPljekAttendance };
