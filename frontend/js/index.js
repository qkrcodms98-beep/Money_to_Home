// P-01 시작 화면. 담당: 김해원
//
// 로그인 상태에 따라 다섯 가지 중 하나를 보여 준다 (와이어프레임 P-01 ① ~ ⑤).
//   ① 로그인하지 않음            "로그인 없이 시작하기", "로그인 | 회원가입"
//   ② 로그인, 저장한 정보 있음    저장한 값 일곱 줄, "이어서 하기", "처음부터 다시 입력 | 수정하기"
//   ③ 로그인, 저장한 정보 없음    "○○님, 반갑습니다", "시작하기"
//   ④ 저장한 정보를 불러오지 못함  "다시 시도", "새로 입력하기"
//   ⑤ 로그인 시간이 끝남         ①과 같고 로고 자리에 안내. account.js가 표시를 남기고 이 화면으로 보낸다
//
// "로그인 없이 시작하기"와 "시작하기"는 이 탭에서 입력하던 값이 있으면 보던 자리로 보낸다 (FR-PROFILE-11).
//   값이 없으면 재무정보, 재무정보만 있으면 대출상품, 대출 선택까지 있으면 저축 계획, 다 있으면 지도.
// "이어서 하기"는 저장한 값을 이 탭에 채우고 바로 지도로 간다 (덜 채운 단계가 있으면 그 단계로).
// "수정하기"는 저장한 값을 채우고 입력 요약(summary.html)으로 간다. 제목이 "수정할 정보가 있으신가요?"로 바뀐다.
// (2026-10-15 회의에서 정함. 예전에는 이어서 하기가 재무정보의 확인 화면으로 갔다)
// 값은 탭을 닫으면 사라진다. 서버에서 온 글자는 textContent로 넣는다.

(() => {
  const $ = (id) => document.getElementById(id);
  const startButton = $('start-button');

  // 화면의 부품을 보이고 숨긴다. names에 있는 것만 보인다.
  const PARTS = ['start-logo', 'start-saved', 'start-error', 'start-steps', 'start-notice', 'start-button',
    'start-retry', 'start-restart', 'start-edit-divider', 'start-edit', 'start-auth', 'start-hint'];
  function showOnly(names) {
    PARTS.forEach((id) => { $(id).hidden = !names.includes(id); });
  }

  // 제목. "home2026님," 다음 줄에 문장을 둔다
  function setTitle(lines) {
    const title = $('start-title');
    title.replaceChildren();
    lines.forEach((line, i) => {
      if (i > 0) title.append(document.createElement('br'));
      title.append(document.createTextNode(line));
    });
  }

  // 저장한 값 일곱 줄 (P-01 ②). 아직 마치지 않은 단계의 값(null)은 줄을 빼고, 대출 없이 계산이면 상환 기간을 뺀다.
  function savedRows(profile) {
    const none = profile.loan_choice === 'none';
    const has = (value) => value !== null && value !== undefined;
    const rows = [
      ['만 나이', has(profile.age) ? `${profile.age}세` : null],
      ['연 소득', has(profile.annual_income) ? format.won(profile.annual_income) : null],
      ['현재 보유자산', has(profile.current_assets) ? format.won(profile.current_assets) : null],
      ['대출 상품', none ? '대출 없이 계산' : profile.loan_product_name],
      ['상환 기간', !none && has(profile.repayment_years) ? `${profile.repayment_years}년` : null],
      ['월 저축 가능액', has(profile.monthly_saving) ? format.won(profile.monthly_saving) : null],
      ['목표 기간', has(profile.target_years) ? (profile.target_years === 0 ? '지금' : `${profile.target_years}년`) : null],
    ];
    const box = $('start-saved');
    box.replaceChildren();
    rows.filter(([, value]) => has(value)).forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'saved-box__row';
      const name = document.createElement('dt');
      name.textContent = label;
      const text = document.createElement('dd');
      text.textContent = value;
      row.append(name, text);
      box.append(row);
    });
  }

  // 저장한 값을 이 탭에 채운다. 값이 없는 단계는 비워 두어 그 단계부터 이어 가게 한다 (API 명세서 A-08).
  function fillInput(profile) {
    const keys = ['age', 'annual_income', 'current_assets', 'loan_choice', 'loan_product_id', 'repayment_years',
      'monthly_saving', 'target_years'];
    const input = {};
    keys.forEach((key) => {
      if (profile[key] !== null && profile[key] !== undefined) input[key] = profile[key];
    });
    store.clear('input');
    store.set('input', input);
    store.set('place', { restart: false });
  }

  // 처음부터 다시: 이 탭의 값을 지우고 재무정보의 첫 질문부터. 저장한 값은 새 값을 저장할 때 바뀐다.
  function restart() {
    store.clear('input');
    store.clear('map');
    store.set('place', { restart: true, profile_step: null, summary_edit: false });
    location.href = 'profile.html';
  }

  // ① 로그인하지 않음 (⑤면 로고 자리에 안내)
  function showGuest(expired) {
    showOnly(['start-logo', 'start-steps', 'start-notice', 'start-button', 'start-auth', 'start-hint']);
    $('start-expired').hidden = !expired;
    $('start-logo').hidden = expired;
    startButton.textContent = '로그인 없이 시작하기';
    startButton.href = guard.resumePage();
    startButton.onclick = null;
  }

  // ② 저장한 정보 있음
  function showSaved(loginId, profile) {
    showOnly(['start-saved', 'start-button', 'start-restart', 'start-edit-divider', 'start-edit']);
    $('start-expired').hidden = true;
    setTitle([`${loginId}님,`, '저장한 정보가 있습니다']);
    $('start-subtitle').textContent = '이어서 하면 저장한 값이 채워진 상태로 시작합니다.';
    savedRows(profile);
    startButton.textContent = '이어서 하기';
    // 이어서 하기: 값을 채운 뒤 갈 곳을 다시 정한다. 다 있으면 지도, 덜 채운 단계가 있으면 그 단계
    startButton.href = 'map.html';
    startButton.onclick = () => {
      fillInput(profile);
      store.set('place', { summary_edit: false });
      startButton.href = guard.resumePage();
    };
    $('start-restart').textContent = '처음부터 다시 입력';
    // 수정하기: 값을 채우고 입력 요약에서 고칠 것만 고친다
    $('start-edit').onclick = () => {
      fillInput(profile);
      store.set('place', { summary_edit: true });
      location.href = 'summary.html';
    };
  }

  // ③ 저장한 정보 없음
  function showWelcome(loginId) {
    showOnly(['start-steps', 'start-button']);
    $('start-expired').hidden = true;
    setTitle([`${loginId}님,`, '반갑습니다']);
    $('start-subtitle').textContent = '아직 저장한 정보가 없습니다. 입력을 마치면 다음부터 이어서 볼 수 있습니다.';
    startButton.textContent = '시작하기';
    startButton.href = guard.resumePage();
    startButton.onclick = null;
  }

  // ④ 불러오지 못함
  function showLoadFail() {
    showOnly(['start-error', 'start-retry', 'start-restart']);
    $('start-expired').hidden = true;
    setTitle(['저장한 정보를 불러오지 못했습니다']);
    $('start-subtitle').textContent = '';
    $('start-restart').textContent = '새로 입력하기';
  }

  async function showMember(loginId) {
    let profile;
    try {
      profile = (await api.get('/api/profile')).profile;
    } catch (error) {
      if (error.status === 401) {
        showGuest(false); // 그사이 로그인이 풀렸다
        return;
      }
      showLoadFail();
      return;
    }
    if (profile) showSaved(loginId, profile);
    else showWelcome(loginId);
  }

  async function start() {
    const expired = account.takeExpired();
    showGuest(expired); // 물어보는 동안에는 기본 화면을 둔다
    const loginId = await account.me();
    if (loginId) await showMember(loginId);
    else showGuest(expired || account.takeExpired());
  }

  $('start-retry').addEventListener('click', () => start());
  $('start-restart').addEventListener('click', restart);
  start();
})();
