/**
 * GitHub Actions에서 실행되는 단독 스크립트
 * 환경변수(GitHub Secrets)에서 계정 정보를 읽어 자동화 실행
 */

const path = require('path');
const fs   = require('fs');

const { getPljekAttendance } = require('./automation/pljec');
const { logWorkToJira }      = require('./automation/jira');

// data 폴더 생성 (디버그 스크린샷 저장용)
if (!fs.existsSync('data')) fs.mkdirSync('data');

async function main() {
  const pljecCreds = {
    email:    process.env.PLJEC_EMAIL,
    password: process.env.PLJEC_PASSWORD
  };
  const jiraCreds = {
    email:    process.env.JIRA_EMAIL,
    password: process.env.JIRA_PASSWORD
  };
  const issue            = process.env.JIRA_ISSUE         || 'SLSIXPU-1';
  const worklogAttribute = process.env.WORKLOG_ATTRIBUTE  || 'PI';

  // 필수값 확인
  if (!pljecCreds.email || !pljecCreds.password) {
    console.error('❌ PLJEC_EMAIL 또는 PLJEC_PASSWORD 환경변수가 없습니다.');
    process.exit(1);
  }
  if (!jiraCreds.email || !jiraCreds.password) {
    console.error('❌ JIRA_EMAIL 또는 JIRA_PASSWORD 환경변수가 없습니다.');
    process.exit(1);
  }

  console.log('🔄 근태 자동화 시작...');
  console.log(`📅 날짜: ${new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}`);

  try {
    // STEP 1: PLJEC에서 출퇴근 시간 가져오기
    console.log('\n📍 PLJEC에서 출퇴근 시간 가져오는 중...');
    const attendance = await getPljekAttendance(pljecCreds);
    console.log(`✅ 출근: ${attendance.clockIn} / 퇴근: ${attendance.clockOut}`);

    // STEP 2: Jira Timetracker에 Log Work 입력
    console.log('\n📝 Jira에 worklog 입력 중...');
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); // YYYY-MM-DD

    await logWorkToJira(jiraCreds, {
      date:             today,
      startTime:        attendance.clockIn,
      endTime:          attendance.clockOut,
      issue,
      worklogAttribute
    });

    console.log('\n✅ 완료!');
    console.log(`   이슈: ${issue}`);
    console.log(`   출근: ${attendance.clockIn} → 퇴근: ${attendance.clockOut}`);
    process.exit(0);

  } catch (err) {
    console.error('\n❌ 오류 발생:', err.message);
    // 스크린샷이 있으면 경로 출력
    if (fs.existsSync('data/debug_pljec.png'))  console.error('   📸 data/debug_pljec.png 확인');
    if (fs.existsSync('data/debug_jira.png'))   console.error('   📸 data/debug_jira.png 확인');
    process.exit(1);
  }
}

main();
