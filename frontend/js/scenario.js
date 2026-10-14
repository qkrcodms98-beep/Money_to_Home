// 시나리오 탭 (P-06 ⑧). 담당: 박채은
//
// 아파트 창의 시나리오 탭에 계산 결과를 그린다. 아파트 한 곳의 시나리오 API(A-07)를 부른다.
//   POST /api/apartments/{id}/scenario   { conditions, area_band }
//
// 부르는 쪽 (안세환의 apartment.js): 시나리오 탭을 열 때, 면적이나 아파트를 바꿀 때
//   scenarioView.render(요소, { apartment, area, conditions })
//     apartment   A-05의 아파트 한 곳 (id를 쓴다)
//     area        고른 면적 (area_band를 쓴다)
//     conditions  조건 묶음 (API 명세서 2.2). guard.conditions()의 값
//
// 그리는 것 (와이어프레임 P-06 ⑧, ⑳, 대출 없이, A1 ~ A4)
//   결과 상자: "5년 뒤 이 아파트를 목표로 하면", 부족자금 또는 여유자금(가장 크게), 식 한 줄,
//             부족하면 필요 월 저축액
//   값 줄: 현재 보유자산, 월 저축 가능액, 목표 기간, 누적 저축액, 대출 상품 · 상환 기간,
//          예상 대출금액, 예상 월 상환액, 목표 부동산 가격, 허용 상승률
//          대출 없이 계산이면 대출 세 줄 대신 "대출 / 대출 없이 계산" 한 줄 (FR-RESULT-05)
//   목표 기간이 "지금"이면 필요 월 저축액과 허용 상승률 대신 회색 안내 (A1)
//   평균가가 상품의 대상 주택 가격 상한을 넘으면 안내 (FR-LOAN-14, P-06 ⑲의 문장)
//   조건 바꿔 보기: 월 저축액, 목표 기간, "다시 계산" (A2 ~ A4)
//   결과 저장 (3차, C2): A-21. 저장하면 "저장됨 ✓", 아래 알림에 "저장한 결과 보기"
//     로그인하지 않았으면(401) 저장할 값을 store의 place.pending_save에 남기고 로그인 화면으로 보낸다 (P-07 ③).
//     로그인한 뒤 지도 화면으로 돌아오면 남긴 값을 저장하고 알린다 (resumePendingSave).
//   안내 문구: 추정치, 실거래 기록, 적용한 가정 (FR-COMMON-01, 02, 08)
//
// 계산하지 않는다. 숫자는 모두 서버가 준 값이다 (NFR-13). 글자는 textContent로 넣는다.
// "다시 계산"은 이 탭의 결과를 바꾸고, 바꾼 값 { monthly_saving, target_years }를
// document의 'mth:plan-changed' 알림으로 내보낸다. 지도 쪽은 팀장이 이 알림을 받아 붙인다 (2026-10-14 팀장 답).
// 저장한 입력(store의 input)은 여기서 바꾸지 않는다.

const SCENARIO_YEARS = [
  { value: 0, label: '지금' },
  { value: 3, label: '3년' },
  { value: 5, label: '5년' },
  { value: 10, label: '10년' },
];
const SCENARIO_MAX_SAVING_MAN = 100000; // 월 저축액 상한 10억 원 = 100,000만 원 (API 명세서 5장)

const SCENARIO_TEXT = {
  loading: '계산하는 중',
  failed: '계산하지 못했습니다.',
  retry: '다시 시도',
  recalcFailed: '다시 계산하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  // 목표 기간이 "지금"일 때 (와이어프레임 A1)
  goalNow: "목표 기간이 '지금'이라 필요한 월 저축액과 허용 상승률은 나오지 않습니다. 아래에서 기간을 바꾸면 볼 수 있습니다.",
  // 월 저축액 입력 오류 (API 명세서 5장)
  savingNotNumber: '0 이상의 숫자만 입력할 수 있습니다.',
  savingTooBig: '10억 원(100,000만 원)까지 입력할 수 있습니다.',
  // 안내 문구 (FR-COMMON-01, 02, 08). 대출 없이 계산이면 대출 심사와 대출에 관한 가정을 뺀다
  estimateLoan: '가정에 따른 추정치이며 실제 대출 여부와 한도는 금융기관 심사로 결정됩니다. 판매 중인 매물이 아니라 실거래 기록입니다.',
  estimateNone: '가정에 따른 추정치입니다. 판매 중인 매물이 아니라 실거래 기록입니다.',
  assumeLoan: '적용한 가정: 무주택, 자격 충족, 현재 가치 기준, 대표 금리, 기존 대출 없음',
  assumeNone: '적용한 가정: 무주택, 현재 가치 기준, 대출 없이 계산',
  // 결과 저장 (와이어프레임 C2)
  save: '결과 저장',
  saving: '저장하는 중',
  saved: '저장됨 ✓',
  savedToast: '결과를 저장했습니다.',
  savedLink: '저장한 결과 보기',
  saveFailed: '결과를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
};
const SCENARIO_LOGIN_PAGE = 'login.html';
const SCENARIO_SAVED_PAGE = 'saved.html';

const scenarioView = {
  root: null, // 그리는 자리 (#scenario-panel)
  apartmentId: null,
  area: null,
  conditions: null, // 부르는 쪽이 준 조건
  changed: null, // "다시 계산"으로 바꾼 값 { monthly_saving, target_years }. 아파트를 바꾸면 지운다
  draft: { saving: '', years: null }, // 조건 바꿔 보기 칸에 지금 들어 있는 값 (만원 글자, 연수)
  fieldError: '',
  status: 'loading', // 'loading', 'done', 'failed', 'recalc'
  result: null, // 마지막으로 받은 A-07 응답
  errorText: '',
  seq: 0, // 늦게 온 앞의 응답을 버리려고 요청마다 번호를 붙인다
  toastTimer: null,
  savedKeys: new Set(), // 이번에 저장한 것 ("아파트:면적대:조건"). 같은 것을 두 번 저장하지 않게 버튼을 끈다
  saving: false,

  // ───────── 부르는 쪽이 쓰는 함수 ─────────

  render(root, { apartment, area, conditions }) {
    const sameApartment = scenarioView.apartmentId === apartment.id;
    scenarioView.root = root;
    scenarioView.area = area;
    scenarioView.conditions = conditions;
    if (!sameApartment) {
      scenarioView.apartmentId = apartment.id;
      scenarioView.changed = null;
      scenarioView.result = null;
      const bar = document.getElementById('scenario-toast');
      if (bar) bar.hidden = true; // 앞 아파트의 알림은 지운다
    }
    const used = scenarioView.usedConditions();
    scenarioView.draft = { saving: String(format.wonToMan(used.monthly_saving)), years: used.target_years };
    scenarioView.fieldError = '';
    scenarioView.load();
  },

  // ───────── 서버 부르기 ─────────

  // 이번 계산에 쓰는 조건. 부르는 쪽의 조건에 "다시 계산"으로 바꾼 값을 덮는다.
  usedConditions() {
    return { ...scenarioView.conditions, ...(scenarioView.changed || {}) };
  },

  request(conditions) {
    return api.post(`/api/apartments/${scenarioView.apartmentId}/scenario`, {
      conditions,
      area_band: scenarioView.area.area_band,
    });
  },

  // 처음 그릴 때와 "다시 시도". 받는 동안은 "계산하는 중"을 보여 준다.
  async load() {
    const seq = ++scenarioView.seq;
    scenarioView.status = 'loading';
    scenarioView.draw();
    try {
      const result = await scenarioView.request(scenarioView.usedConditions());
      if (seq !== scenarioView.seq) return; // 그사이 다른 아파트나 면적으로 바뀌었다
      scenarioView.result = result;
      scenarioView.status = 'done';
    } catch (error) {
      if (seq !== scenarioView.seq) return;
      scenarioView.status = 'failed';
      // 서버가 준 문장이 있으면 그것을 쓴다 (없는 아파트, 입력 오류). 연결 문제면 기본 문장
      scenarioView.errorText = error.status >= 400 && error.status < 500 ? error.detail : SCENARIO_TEXT.failed;
    }
    scenarioView.draw();
  },

  // "다시 계산" (A2 ~ A4). 받는 동안은 앞의 결과를 흐리게 두고 버튼을 끈다.
  // 실패하면 결과는 앞의 것 그대로, 입력한 값도 지우지 않고 아래에 알린다.
  async recalc() {
    const saving = scenarioView.draft.saving.trim();
    if (!/^\d+$/.test(saving)) {
      scenarioView.fieldError = SCENARIO_TEXT.savingNotNumber;
      scenarioView.draw();
      return;
    }
    if (Number(saving) > SCENARIO_MAX_SAVING_MAN) {
      scenarioView.fieldError = SCENARIO_TEXT.savingTooBig;
      scenarioView.draw();
      return;
    }
    scenarioView.fieldError = '';

    const changed = { monthly_saving: format.manToWon(Number(saving)), target_years: scenarioView.draft.years };
    const seq = ++scenarioView.seq;
    scenarioView.status = 'recalc';
    scenarioView.draw();
    try {
      const result = await scenarioView.request({ ...scenarioView.conditions, ...changed });
      if (seq !== scenarioView.seq) return;
      scenarioView.changed = changed;
      scenarioView.result = result;
      scenarioView.status = 'done';
      // 바뀐 저축 계획을 알린다. 지도·목록·내 조건 줄은 팀장의 map-view.js가 이 알림을 받아 바꾼다
      document.dispatchEvent(new CustomEvent('mth:plan-changed', { detail: changed }));
    } catch (error) {
      if (seq !== scenarioView.seq) return;
      scenarioView.status = 'done'; // 앞의 결과로 돌아간다
      if (error.status === 422 && error.field === 'monthly_saving') {
        scenarioView.fieldError = error.detail;
      } else {
        scenarioView.toast(SCENARIO_TEXT.recalcFailed);
      }
    }
    scenarioView.draw();
  },

  // ───────── 그리기 ─────────

  draw() {
    const { root, status, result } = scenarioView;
    if (!root) return;

    if (status === 'loading') {
      root.replaceChildren(scenarioView.loadingBox());
      return;
    }
    if (status === 'failed') {
      root.replaceChildren(scenarioView.failBox());
      return;
    }

    const loan = result.loan;
    const parts = [scenarioView.resultBox(result)];
    if (loan.choice === 'product' && loan.over_price_cap) parts.push(scenarioView.capNotice(loan));
    parts.push(scenarioView.rows(result));
    if (result.target_years === 0) parts.push(scenarioView.note(SCENARIO_TEXT.goalNow, 'scenario__goal-now'));
    parts.push(scenarioView.changeBox());
    parts.push(scenarioView.saveButton());
    parts.push(scenarioView.guide(loan.choice === 'product'));
    root.replaceChildren(...parts);
  },

  // 결과 상자. 부족자금 또는 여유자금을 가장 크게, 그 아래에 식 한 줄
  resultBox(result) {
    const { target_years: years, shortage, loan } = result;
    const box = scenarioView.make('section', 'scenario__result');
    if (scenarioView.status === 'recalc') box.classList.add('scenario__result--busy');

    const when = years === 0 ? '지금' : `${years}년 뒤`;
    box.append(scenarioView.make('p', 'scenario__lead', `${when} 이 아파트를 목표로 하면`));

    const lack = shortage > 0;
    const gap = scenarioView.make(
      'p',
      `scenario__gap amount--${result.category}`,
      lack ? `부족자금 ${scenarioView.money(shortage)}` : `여유자금 ${scenarioView.money(-shortage)}`,
    );
    box.append(gap);

    // 식. 목표 기간이 "지금"이면 자기자금이 곧 현재 보유자산이라 그 이름으로 적는다 (A1)
    const own = `${years === 0 ? '현재 보유자산' : '자기자금'} ${scenarioView.money(result.own_funds)}`;
    const price = `집값 ${scenarioView.money(result.price)}`;
    const borrowed = loan.choice === 'product' ? `예상 대출 ${scenarioView.money(loan.amount)}` : null;
    const formula = lack
      ? [price, own, borrowed].filter(Boolean).join(' − ')
      : `${[own, borrowed].filter(Boolean).join(' + ')} − ${price}`;
    box.append(scenarioView.make('p', 'scenario__formula', formula));

    // 부족하면 필요 월 저축액 (P-06 ⑳). "지금"이거나 여유가 있으면 서버가 null을 준다
    if (result.required_monthly_saving !== null) {
      const need = scenarioView.make('div', 'scenario__need');
      need.append(
        scenarioView.make('span', 'scenario__need-label', '필요 월 저축액'),
        scenarioView.make('span', 'scenario__need-value', scenarioView.money(result.required_monthly_saving)),
      );
      box.append(need);
    }
    return box;
  },

  // 값 줄. 모양은 아파트 정보 탭의 줄(apt-info)과 같다
  rows(result) {
    const { loan } = result;
    const lines = [
      ['현재 보유자산', scenarioView.money(result.current_assets)],
      ['월 저축 가능액', scenarioView.money(result.monthly_saving)],
      ['목표 기간', result.target_years === 0 ? '지금' : `${result.target_years}년`],
      ['누적 저축액', scenarioView.money(result.accumulated_saving)],
    ];
    if (loan.choice === 'product') {
      lines.push(
        ['대출 상품 · 상환 기간', `${loan.product_name} · ${loan.repayment_years}년`],
        ['예상 대출금액', scenarioView.money(loan.amount)],
        ['예상 월 상환액', scenarioView.money(loan.monthly_payment)],
      );
    } else {
      lines.push(['대출', '대출 없이 계산']);
    }
    lines.push(['목표 부동산 가격', scenarioView.money(result.price)]);

    const list = scenarioView.make('dl', 'apt-info scenario__rows');
    if (scenarioView.status === 'recalc') list.classList.add('scenario__rows--busy');
    lines.forEach(([label, value]) => list.append(scenarioView.row(label, value)));

    // 허용 상승률 (C-12). 서버가 null을 주면(음수, "지금") 줄을 그리지 않는다 (P-06 ⑳, A1)
    if (result.allowed_growth_rate !== null) {
      const rate = result.allowed_growth_rate.toFixed(1);
      const row = scenarioView.row('허용 상승률', `연 ${rate}%까지`);
      row.append(scenarioView.make('p', 'scenario__growth-help', `집값이 연 ${rate}% 넘게 오르지 않으면 목표할 수 있습니다.`));
      list.append(row);
    }
    return list;
  },

  row(label, value) {
    const row = scenarioView.make('div', 'apt-info__row');
    row.append(scenarioView.make('dt', 'apt-info__label', label), scenarioView.make('dd', 'apt-info__value', value));
    return row;
  },

  // 대상 주택 가격 상한 초과 (FR-LOAN-14). 문장은 와이어프레임 P-06 ⑲와 같다. 계산에서는 빼지 않는다
  capNotice(loan) {
    const text = `평균가가 선택한 상품의 대상 주택 가격 상한(${scenarioView.money(loan.max_house_price)})을 넘습니다. 계산에는 그대로 포함했습니다.`;
    return scenarioView.note(text, 'scenario__cap');
  },

  // 조건 바꿔 보기 (월 저축액, 목표 기간, 다시 계산)
  changeBox() {
    const busy = scenarioView.status === 'recalc';
    const box = scenarioView.make('section', 'scenario__change');
    box.append(scenarioView.make('h3', 'scenario__change-title', '조건 바꿔 보기'));

    // 월 저축액 (만원)
    const field = scenarioView.make('div', 'scenario__field');
    if (scenarioView.fieldError) field.classList.add('scenario__field--error');
    const label = scenarioView.make('label', 'scenario__field-label', '월 저축액');
    label.htmlFor = 'scenario-saving';
    const inputRow = scenarioView.make('div', 'scenario__input-row');
    const input = document.createElement('input');
    input.id = 'scenario-saving';
    input.className = 'scenario__input';
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.value = scenarioView.draft.saving;
    input.disabled = busy;
    input.addEventListener('input', () => {
      scenarioView.draft.saving = input.value;
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') scenarioView.recalc();
    });
    inputRow.append(input, scenarioView.make('span', 'scenario__unit', '만 원'));
    field.append(label, inputRow);
    box.append(field);
    if (scenarioView.fieldError) {
      box.append(scenarioView.make('p', 'scenario__field-error', scenarioView.fieldError));
    }

    // 목표 기간
    const years = scenarioView.make('div', 'scenario__years');
    years.setAttribute('role', 'group');
    years.setAttribute('aria-label', '목표 기간');
    SCENARIO_YEARS.forEach(({ value, label: text }) => {
      const button = scenarioView.make('button', 'scenario__year', text);
      button.type = 'button';
      button.disabled = busy;
      button.setAttribute('aria-pressed', String(value === scenarioView.draft.years));
      button.addEventListener('click', () => {
        scenarioView.draft.years = value;
        years.querySelectorAll('.scenario__year').forEach((item) => {
          item.setAttribute('aria-pressed', String(item === button));
        });
      });
      years.append(button);
    });
    box.append(years);

    // 다시 계산. 계산하는 동안은 누를 수 없다 (A2)
    const submit = scenarioView.make('button', 'button button--primary scenario__submit');
    submit.type = 'button';
    submit.disabled = busy;
    if (busy) {
      submit.append(scenarioView.make('span', 'scenario__spinner'), document.createTextNode(SCENARIO_TEXT.loading));
    } else {
      submit.textContent = '다시 계산';
    }
    submit.addEventListener('click', () => scenarioView.recalc());
    box.append(submit);
    return box;
  },

  // ───────── 결과 저장 (3차, A-21) ─────────

  // 저장할 값. 화면의 계산 결과는 보내지 않는다. 서버가 다시 계산해서 저장한다 (API 명세서 3.5)
  saveBody() {
    return {
      conditions: scenarioView.usedConditions(),
      apartment_id: scenarioView.apartmentId,
      area_band: scenarioView.area.area_band,
    };
  },

  saveKey: (body) => `${body.apartment_id}:${body.area_band}:${JSON.stringify(body.conditions)}`,

  saveButton() {
    const button = scenarioView.make('button', 'button scenario__save');
    button.type = 'button';
    const done = scenarioView.savedKeys.has(scenarioView.saveKey(scenarioView.saveBody()));
    button.disabled = done || scenarioView.saving || scenarioView.status === 'recalc';
    button.textContent = done ? SCENARIO_TEXT.saved : (scenarioView.saving ? SCENARIO_TEXT.saving : SCENARIO_TEXT.save);
    button.addEventListener('click', () => scenarioView.save());
    return button;
  },

  async save() {
    const body = scenarioView.saveBody();
    scenarioView.saving = true;
    scenarioView.draw();
    try {
      await api.post('/api/saved-results', body);
      scenarioView.savedKeys.add(scenarioView.saveKey(body));
      scenarioView.toast(SCENARIO_TEXT.savedToast, { text: SCENARIO_TEXT.savedLink, href: SCENARIO_SAVED_PAGE });
    } catch (error) {
      if (error.status === 401) {
        // 로그인하지 않았다. 저장할 값을 남기고 로그인 화면으로 (P-07 ③). 입력한 값은 그대로 둔다
        store.set('place', { pending_save: body });
        location.href = SCENARIO_LOGIN_PAGE;
        return;
      }
      scenarioView.toast(error.status >= 400 && error.status < 500 ? error.detail : SCENARIO_TEXT.saveFailed);
    } finally {
      scenarioView.saving = false;
    }
    scenarioView.draw();
  },

  // 로그인하고 지도 화면으로 돌아왔을 때, 로그인 전에 누른 "결과 저장"을 이어서 한다 (P-07 ③)
  async resumePendingSave() {
    const body = store.get('place').pending_save;
    if (!body) return;
    try {
      await api.post('/api/saved-results', body);
      store.set('place', { pending_save: null });
      scenarioView.savedKeys.add(scenarioView.saveKey(body));
      scenarioView.toast(SCENARIO_TEXT.savedToast, { text: SCENARIO_TEXT.savedLink, href: SCENARIO_SAVED_PAGE });
      if (scenarioView.root && scenarioView.result) scenarioView.draw();
    } catch (error) {
      if (error.status === 401) return; // 아직 로그인하지 않았다. 남겨 둔다
      store.set('place', { pending_save: null });
      scenarioView.toast(SCENARIO_TEXT.saveFailed);
    }
  },

  // 안내 문구 (FR-COMMON-01, 02, 08)
  guide(withLoan) {
    const box = scenarioView.make('div', 'notice scenario__guide');
    box.append(
      scenarioView.make('p', 'scenario__guide-line', withLoan ? SCENARIO_TEXT.estimateLoan : SCENARIO_TEXT.estimateNone),
      scenarioView.make('p', 'scenario__guide-line', withLoan ? SCENARIO_TEXT.assumeLoan : SCENARIO_TEXT.assumeNone),
    );
    return box;
  },

  // 처음 받는 중
  loadingBox() {
    const box = scenarioView.make('div', 'scenario__state');
    box.setAttribute('role', 'status');
    box.append(scenarioView.make('span', 'scenario__spinner'), scenarioView.make('span', '', SCENARIO_TEXT.loading));
    return box;
  },

  // 받지 못함. 모양은 대출상품 화면의 "계산하지 못했습니다" 상자와 같다 (P-03 ⑨)
  failBox() {
    const box = scenarioView.make('div', 'notice notice--error scenario__fail');
    box.setAttribute('role', 'alert');
    const retry = scenarioView.make('button', 'link-button', SCENARIO_TEXT.retry);
    retry.type = 'button';
    retry.addEventListener('click', () => scenarioView.load());
    box.append(scenarioView.make('span', '', scenarioView.errorText), retry);
    return box;
  },

  note(text, className) {
    return scenarioView.make('p', `notice ${className}`, text);
  },

  // 화면 아래 검은 알림. 4초 뒤 사라진다 (A4). link가 있으면 오른쪽에 글자 링크를 둔다 (C2)
  toast(text, link = null) {
    let bar = document.getElementById('scenario-toast');
    if (!bar) {
      bar = scenarioView.make('p', 'snackbar scenario__toast');
      bar.id = 'scenario-toast';
      bar.setAttribute('role', 'alert');
      document.body.append(bar);
    }
    bar.replaceChildren(scenarioView.make('span', 'scenario__toast-text', text));
    if (link) {
      const anchor = scenarioView.make('a', 'scenario__toast-link', link.text);
      anchor.href = link.href;
      bar.append(anchor);
    }
    bar.hidden = false;
    clearTimeout(scenarioView.toastTimer);
    scenarioView.toastTimer = setTimeout(() => {
      bar.hidden = true;
    }, 4000);
  },

  // ───────── 작은 도구 ─────────

  // 금액. 0원은 "0만 원" 대신 "0원"으로 적는다 (A1의 누적 저축액)
  money: (amount) => (amount === 0 ? '0원' : format.won(amount)),

  make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  },
};

// 지도 화면(시나리오 탭이 있는 화면)이 열리면 로그인 전에 누른 "결과 저장"을 이어서 한다.
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('scenario-panel')) scenarioView.resumePendingSave();
});
