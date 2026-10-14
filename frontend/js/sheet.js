// 아래 창 (P-06). 담당: 안세환
//
// 창의 단계와 열고 닫기만 맡는다. 창 안의 내용은 다른 파일이 그린다.
//   목록 (P-06 ⑤)        : list.js (김목산)가 #apt-list 안에. map-view.js가 A-05 응답을 받을 때마다 다시 그린다
//   아파트 (P-06 ⑥, ⑦)   : apartment.js가 #apartment-panel 안에
//
// 단계 (화면 설계서 7.1, 와이어프레임 2.5, guide_sehwan 4장)
//   '30'   262px. 말풍선을 누름
//   '80'   지도 영역의 80% (390 × 844에서 643). 목록 보기, 목록의 카드, 30%에서 손잡이
//   'full' 내 조건 줄 바로 아래부터. 80%에서 손잡이
//
// 1차에는 손잡이를 누르면 다음 단계로 바뀐다. 30% → 80% → 전체 → 30% (전체에서 누르면 30%. 2026-10-13 세환이 정함).
// 끌어서 키우고 줄이는 것은 2차다 (FR-MAP-17).
// 닫기 버튼과 브라우저의 뒤로 가기로 닫는다. 뒤로 가기는 페이지를 떠나지 않고 창만 닫는다 (화면 설계서 7.1).
//
// 움직임 (0.6초, sheet.css의 --sheet-duration)
//   열 때는 아래에서 올라오고, 닫을 때는 아래로 내려간다.
//   단계가 바뀔 때(30% → 80% → 전체 → 30%)는 창의 높이가 그 시간 동안 바뀐다.
//   움직이는 동안 지도는 둘 가운데 넓은 쪽 크기를 쓴다. 그래야 창이 줄어들며 빈자리가 드러나지 않는다.
//     창이 커질 때: 지도는 그대로 두고, 다 커진 뒤에 줄인다
//     창이 작아질 때(닫을 때도): 지도를 먼저 넓히고 창이 줄어든다
//
// 창의 상태(phase)
//   'closed'   닫힘. 창이 숨어 있다
//   'opening'  올라오는 중
//   'open'     열림 (단계가 바뀌는 중이면 moving이 true)
//   'closing'  내려가는 중
//
// 여기서는 속성만 바꾼다. 모양은 sheet.css가 맡는다.
//   .sheet[data-stage]        창의 높이와 창 안의 내용
//   .map-app[data-sheet]      지도 위 버튼과 검색 줄, 칩 줄 (열 때 바로 바뀌고, 닫을 때 바로 돌아온다)
//   .map-app[data-sheet-map]  지도의 크기 (위의 규칙대로 움직임의 처음이나 끝에 바꾼다)
//
//   sheet.show('30', 'apartment')   닫혀 있으면 열고, 열려 있으면 단계와 내용을 바꾼다
//   sheet.setStage('80')            단계만 바꾼다
//   sheet.close()                   닫는다 (뒤로 가기와 같다)
//   sheet.onChange(() => {})        상태가 바뀔 때마다 부른다. sheet.phase, stage, mode, moving을 읽는다
//   sheet.targetHeight()            지금 단계의 창이 다 움직인 뒤의 높이(px)
//
// 예외 화면. 언제 띄울지는 아는 쪽(map-view.js)이 정해서 부른다. 이 파일은 보여 주기만 한다.
//   sheet.showEmpty()                         결과 없음 (P-05 ⑨). 목록을 30%로 연다.
//                                             빈 화면의 문장과 버튼은 list.js(김목산)가 이미 그려 둔 것을 쓴다
//   sheet.showLoadError({ message, onRetry }) 아파트를 불러오지 못함. 목록 자리에 오류와 '다시 시도'를 그리고 30%로 연다.
//                                             그리기는 list.js의 listView.renderError를 부른다.
//                                             message를 빼면 list.js의 문장 "아파트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."

const SHEET_NEXT_STAGE = { 30: '80', 80: 'full', full: '30' };
const SHEET_HISTORY_KEY = 'sheet'; // history.state에 남기는 표시. 창이 열려 있다는 뜻이다
// 단계마다 지도가 쓰는 자리의 크기 순서. 클수록 지도가 넓다. 전체 단계에서는 지도를 줄이지 않는다 (창에 다 가려진다).
const SHEET_MAP_ROOM = { 80: 1, 30: 2, full: 3 };
const SHEET_RATIO_80 = 0.8; // sheet.css의 80% 높이와 같은 값

const sheet = {
  stage: null, // '30' | '80' | 'full' | null
  mode: null, // 'list' | 'apartment' | null
  phase: 'closed', // 'closed' | 'opening' | 'open' | 'closing'
  moving: false, // 올라오거나 높이가 바뀌는 중인가
  mapStage: null, // 지도가 지금 맞춰져 있는 단계. null이면 지도가 화면을 다 쓴다
  timer: null,
  listeners: [],

  init() {
    document.getElementById('sheet-handle').addEventListener('click', () => {
      if (sheet.stage) sheet.setStage(SHEET_NEXT_STAGE[sheet.stage]);
    });

    // 브라우저의 뒤로 가기. 창을 열 때 남긴 기록에서 빠져나오면 창을 닫는다.
    window.addEventListener('popstate', () => {
      if (sheet.isShown() && !sheet.isOwnHistory()) sheet.hide();
    });

    // 창이 열린 채로 새로 고치면 기록에 표시가 남아 있다. 창은 닫힌 채로 시작하므로 표시를 지운다.
    if (sheet.isOwnHistory()) history.replaceState(null, '');
    sheet.apply();
  },

  isOwnHistory: () => Boolean(history.state && history.state[SHEET_HISTORY_KEY]),
  isShown: () => sheet.phase === 'opening' || sheet.phase === 'open',

  // 움직이는 시간(ms). sheet.css의 --sheet-duration을 읽는다.
  // 움직임을 줄이도록 설정했으면 0이다 (바로 열리고, 바로 바뀌고, 바로 닫힌다).
  duration() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
    const value = getComputedStyle(document.body).getPropertyValue('--sheet-duration').trim();
    const number = parseFloat(value);
    if (!(number >= 0)) return 0;
    return value.endsWith('ms') ? number : number * 1000;
  },

  // 지금 단계의 창이 다 움직인 뒤의 높이(px). 움직이는 동안의 높이가 아니다.
  targetHeight() {
    const area = document.querySelector('.map-area').clientHeight;
    if (sheet.stage === '30') return parseFloat(getComputedStyle(document.body).getPropertyValue('--sheet-height-30'));
    if (sheet.stage === '80') return area * SHEET_RATIO_80;
    return area;
  },

  // 닫혀 있으면(내려가는 중도) 아래에서 올라오게 연다. 열려 있으면 단계와 내용을 바꾼다.
  // 기록은 열 때 하나만 남긴다. 그래서 몇 번을 바꿔도 뒤로 가기 한 번이면 창이 닫힌다.
  show(stage, mode) {
    if (!sheet.isOwnHistory()) history.pushState({ [SHEET_HISTORY_KEY]: true }, '');
    if (sheet.isShown()) {
      sheet.mode = mode;
      if (sheet.stage === stage) sheet.apply();
      else sheet.changeStage(stage);
      return;
    }
    sheet.stage = stage;
    sheet.mode = mode;
    sheet.phase = 'opening';
    sheet.mapStage = null; // 올라오는 동안 지도는 화면을 다 쓴다
    sheet.run('sheet--opening', () => {
      sheet.phase = 'open';
      sheet.mapStage = sheet.stage;
    });
  },

  setStage(stage) {
    if (!sheet.isShown() || sheet.stage === stage) return;
    sheet.changeStage(stage);
  },

  // 단계를 바꾼다. 창의 높이는 CSS의 transition이 0.6초 동안 바꾼다.
  // 지도가 넓어지는 쪽이면 바로 넓히고, 좁아지는 쪽이면 창이 다 커진 뒤에 줄인다.
  changeStage(stage) {
    sheet.stage = stage;
    if (sheet.phase === 'opening') {
      sheet.apply(); // 올라오는 중이면 높이만 바꾼다. 다 올라오면 그 단계로 지도를 맞춘다
      return;
    }
    const current = sheet.mapStage || 'full';
    if (SHEET_MAP_ROOM[stage] >= SHEET_MAP_ROOM[current]) sheet.mapStage = stage;
    sheet.run(null, () => {
      sheet.mapStage = sheet.stage;
    });
  },

  // 닫기 버튼. 열 때 남긴 기록을 되돌려(뒤로 가기) 닫는다. 기록이 어긋나 있으면 바로 닫는다.
  close() {
    if (!sheet.isShown()) return;
    if (sheet.isOwnHistory()) history.back(); // popstate에서 hide()가 불린다
    else sheet.hide();
  },

  // 아래로 내려가게 닫는다. 지도는 먼저 화면을 다 쓰게 되돌린다. 다 내려가면 숨기고 비운다.
  hide() {
    if (!sheet.isShown()) return;
    sheet.phase = 'closing';
    sheet.mapStage = null;
    sheet.run('sheet--closing', () => {
      sheet.phase = 'closed';
      sheet.stage = null;
      sheet.mode = null;
    });
  },

  // 움직임을 시작하고(className이 있으면 그 움직임을 붙인다), 끝나면 done을 부른 뒤 다시 그린다.
  // 움직이는 도중에 다시 부르면 앞의 것은 버린다 (내려가다가 다른 말풍선을 누른 경우, 손잡이를 빨리 두 번 누른 경우 등).
  run(className, done) {
    const box = document.getElementById('sheet');
    clearTimeout(sheet.timer);
    box.classList.remove('sheet--opening', 'sheet--closing');
    const ms = sheet.duration();
    sheet.moving = sheet.phase !== 'closing' && ms > 0;
    sheet.apply();
    const finish = () => {
      if (className) box.classList.remove(className);
      sheet.moving = false;
      done();
      sheet.apply();
    };
    if (ms === 0) {
      finish();
      return;
    }
    if (className) {
      void box.offsetWidth; // 같은 움직임을 처음부터 다시 하게 한다
      box.classList.add(className);
    }
    sheet.timer = setTimeout(finish, ms);
  },

  onChange(listener) {
    sheet.listeners.push(listener);
  },

  // ───────── 예외 화면 ─────────

  // 결과 없음 (P-05 ⑨). 목록 30%. 목록은 받은 응답(0곳)으로 list.js가 이미 그려 두었다.
  showEmpty() {
    sheet.show('30', 'list');
  },

  // 아파트를 불러오지 못함. 목록 자리에 오류 문장과 '다시 시도'를 그리고 목록 30%로 연다.
  // list.js를 불러오지 않았으면 아무것도 하지 않는다.
  showLoadError({ message, onRetry } = {}) {
    if (typeof listView === 'undefined' || typeof listView.renderError !== 'function') return;
    listView.renderError(document.getElementById('apt-list'), {
      message, // undefined면 list.js의 문장
      onRetry,
      onClose: () => sheet.close(),
    });
    sheet.show('30', 'list');
  },

  apply() {
    const app = document.querySelector('.map-app');
    const box = document.getElementById('sheet');
    const { stage, mode, phase, mapStage } = sheet;

    box.hidden = phase === 'closed';
    if (phase === 'closed') delete box.dataset.stage;
    else box.dataset.stage = stage;

    if (sheet.isShown()) {
      app.dataset.sheet = stage;
      app.dataset.sheetMode = mode;
    } else {
      delete app.dataset.sheet;
      delete app.dataset.sheetMode;
    }
    if (mapStage) app.dataset.sheetMap = mapStage;
    else delete app.dataset.sheetMap;

    document.getElementById('apt-list').hidden = mode !== 'list';
    document.getElementById('apartment-panel').hidden = mode !== 'apartment';
    document.getElementById('sheet-handle').setAttribute('aria-label', stage === 'full' ? '창 줄이기' : '창 키우기');

    sheet.listeners.forEach((listener) => listener());
  },
};
