/**
 * Jira Everit Timetracker 에 Log Work를 자동으로 제출합니다.
 *
 * ⚠️  Atlassian Connect 앱은 iframe 내부에서 동작합니다.
 *   로그인 방식(이메일/비밀번호, SSO 등)에 따라 수정이 필요할 수 있습니다.
 */

const { chromium } = require('playwright');

const TIMETRACKER_URL =
  'https://coasia.atlassian.net/plugins/servlet/ac/org.everit.jira.timetracker.plugin/timetracker-page' +
  '?project.key=SOLSLT&project.id=10105#!/matrix';

async function logWorkToJira(credentials, { date, startTime, endTime, issue, worklogAttribute }) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();
  const page    = await context.newPage();

  try {
    // ── 1. Timetracker 페이지 열기 ──────────────────────────
    await page.goto(TIMETRACKER_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // ── 2. Atlassian 로그인 처리 ─────────────────────────────
    if (page.url().includes('/login') || page.url().includes('atlassian.net/login')) {
      await handleAtlassianLogin(page, credentials);
      await page.goto(TIMETRACKER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    }

    // ── 3. 타임트래커 로드 대기 ──────────────────────────────
    await page.waitForTimeout(3000);

    // Timetracker는 iframe 안에서 동작
    let frame = await waitForTimetrackerFrame(page);

    // ── 4. Log Work 버튼 클릭 ────────────────────────────────
    await frame.waitForSelector('button:has-text("Log Work"), .btn:has-text("Log Work")', { timeout: 15000 });
    await frame.click('button:has-text("Log Work"), .btn:has-text("Log Work")');
    await frame.waitForTimeout(1000);

    // ── 5. 폼 입력 ──────────────────────────────────────────
    console.log(`  날짜: ${date}, 출근: ${startTime}, 퇴근: ${endTime}`);
    console.log(`  이슈: ${issue}, Worklog Attribute: ${worklogAttribute}`);

    // Issue 필드 (필수)
    await fillIssueField(frame, issue);

    // Date 필드
    await fillField(frame, [
      'input[name="date"]',
      '#date',
      'input[placeholder*="date" i]',
      'input[placeholder*="날짜"]'
    ], date);

    // Start 시간
    await fillField(frame, [
      'input[name="start"]',
      'input[placeholder*="Start" i]',
      '#start',
      'input[name="startTime"]'
    ], startTime);

    // End 시간
    await fillField(frame, [
      'input[name="end"]',
      'input[placeholder*="End" i]',
      '#end',
      'input[name="endTime"]'
    ], endTime);

    // Worklog Attributes (PI 고정)
    await fillWorklogAttribute(frame, worklogAttribute);

    // ── 6. Submit ────────────────────────────────────────────
    await frame.click('button:has-text("Submit"), [type="submit"]');
    await frame.waitForTimeout(2000);

    // 성공 여부 확인 (에러 메시지가 없으면 성공으로 간주)
    const errorEl = await frame.$('.error, .alert-danger, [class*="error"]');
    if (errorEl) {
      const errMsg = await errorEl.textContent();
      throw new Error(`폼 제출 오류: ${errMsg}`);
    }

    console.log('  ✅ Jira Log Work 제출 완료');

  } catch (err) {
    // 디버그 스크린샷
    await page.screenshot({ path: 'data/debug_jira.png', fullPage: true });
    throw new Error(`Jira 오류: ${err.message} (data/debug_jira.png 확인)`);
  } finally {
    await browser.close();
  }
}

// ─── Atlassian 로그인 ────────────────────────────────────
async function handleAtlassianLogin(page, { email, password }) {
  console.log('  🔐 Atlassian 로그인 중...');

  // Step 1: 이메일 입력
  await page.waitForSelector('#username, input[name="username"], input[type="email"]', { timeout: 10000 });
  const emailField = page.locator('#username, input[name="username"], input[type="email"]').first();
  await emailField.fill(email);

  const continueBtn = page.locator('#login-submit, button:has-text("Continue"), button[type="submit"]').first();
  await continueBtn.click();

  // Step 2: 비밀번호 입력
  await page.waitForSelector('#password, input[name="password"]', { timeout: 10000 });
  const pwField = page.locator('#password, input[name="password"]').first();
  await pwField.fill(password);

  const loginBtn = page.locator('#login-submit, button:has-text("Log in"), button[type="submit"]').first();
  await loginBtn.click();
  await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 });
  console.log('  ✅ 로그인 완료');
}

// ─── Timetracker iframe 찾기 ─────────────────────────────
async function waitForTimetrackerFrame(page) {
  // iframe이 로드될 때까지 최대 15초 대기
  for (let i = 0; i < 30; i++) {
    for (const frame of page.frames()) {
      if (
        frame.url().includes('timetracker') ||
        frame.url().includes('everit') ||
        frame.url().includes('jira.timetracker')
      ) {
        await frame.waitForLoadState('domcontentloaded');
        return frame;
      }
    }
    await page.waitForTimeout(500);
  }
  // iframe을 못 찾으면 메인 페이지에서 시도
  console.warn('  ⚠️  Timetracker iframe을 찾지 못했습니다. 메인 페이지에서 시도합니다.');
  return page;
}

// ─── Issue 필드 (검색 자동완성 처리) ────────────────────────
async function fillIssueField(frame, issueKey) {
  const selectors = [
    'input[name="issue"]',
    'input[placeholder*="issue" i]',
    '#issue',
    '[data-field="issue"] input'
  ];

  for (const sel of selectors) {
    const el = await frame.$(sel);
    if (el) {
      await el.click();
      await el.fill('');
      await el.type(issueKey, { delay: 50 });
      await frame.waitForTimeout(1000);

      // 드롭다운 항목 선택
      const option = await frame.$(`li:has-text("${issueKey}"), [data-value="${issueKey}"], .suggestion:has-text("${issueKey}")`);
      if (option) await option.click();
      return;
    }
  }
  console.warn('  ⚠️  Issue 필드를 찾지 못했습니다.');
}

// ─── Worklog Attributes (PI) ────────────────────────────
async function fillWorklogAttribute(frame, value) {
  const selectors = [
    'select[name*="worklog"]',
    'select[name*="attribute"]',
    '[name="worklogAttributeId"]',
    '[id*="worklogAttr"]'
  ];

  for (const sel of selectors) {
    const el = await frame.$(sel);
    if (el) {
      const tag = await el.evaluate(e => e.tagName.toLowerCase());
      if (tag === 'select') {
        await frame.selectOption(sel, { label: value });
      } else {
        await el.fill(value);
      }
      return;
    }
  }

  // 텍스트로 검색
  const inputSel = 'input[placeholder*="attribute" i], input[placeholder*="PI"]';
  const input    = await frame.$(inputSel);
  if (input) {
    await input.fill(value);
    await frame.waitForTimeout(500);
    const opt = await frame.$(`li:has-text("${value}"), option:has-text("${value}")`);
    if (opt) await opt.click();
  }
}

// ─── 일반 필드 채우기 ────────────────────────────────────
async function fillField(frame, selectors, value) {
  for (const sel of selectors) {
    const el = await frame.$(sel);
    if (el) {
      await el.fill('');
      await el.type(value, { delay: 30 });
      return;
    }
  }
  console.warn(`  ⚠️  필드를 찾지 못했습니다: ${selectors[0]} 외`);
}

module.exports = { logWorkToJira };
