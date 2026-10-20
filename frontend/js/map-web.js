// 지도 화면의 웹 배치 (가로 1200px 이상). 담당: 박채은 (2026-10-20 팀장 결정: 웹 지도 시안 2 "두 패널")
// 모양은 css/map-web.css. 이 파일은 웹에서만 아래 창(sheet.js)의 동작을 왼쪽 패널에 맞게 바꾼다.
// sheet.js, map-view.js, apartment.js(안세환)는 고치지 않고, 그 객체의 함수를 웹일 때만 감싸 바꾼다.
// 그래서 map.html에서 이 파일은 맨 마지막(map-view.js 다음)에 불러온다. 1199px 이하에서는 원래 함수 그대로 동작한다.
//
// 웹에서 바뀌는 것
//   - 단계가 없다. 창은 늘 30% 단계로 연다 (지도가 보이는 단계. 주변 시설 줄을 누르면 지도에 점선을 잇는 것도 이 단계에서 된다).
//     모양은 map-web.css가 단계와 상관없이 왼쪽 패널로 그린다. 손잡이를 누르거나 끌어도 바뀌지 않는다.
//   - 목록은 늘 열려 있다. 아파트 창을 닫으면(✕, 뒤로 가기, 다른 지역 고르기) 창을 닫지 않고 목록만 남긴다. 목록의 스크롤 자리는 그대로 둔다.
//   - 지도는 창에 가리지 않으므로 고른 아파트는 지도의 가운데에 둔다. 패널 폭이 바뀌면 카카오맵에 알린다 (relayout).
//   - 목록 패널을 접고 펼 수 있다 (store의 map.web_fold).
//   - 로드뷰는 아파트 패널 맨 위에 늘 보인다 (아파트 정보 탭 · 시나리오 탭 모두, 2026-10-20 팀장 결정).
//     모바일은 창 맨 위(손잡이 앞)에 두고 전체 단계에서만 보이지만, 웹에는 단계가 없으므로 자리를 아파트 패널 안으로 옮긴다.
//
// html에 다는 표시 (map-web.css가 쓴다)
//   data-map-web-panel = "list" | "apartment"   패널에 지금 보이는 것. 창이 닫혀 있으면 없다
//   data-map-web-fold                           목록 패널을 접었다

const MAP_WEB_QUERY = window.matchMedia('(min-width: 1200px)'); // common.css의 웹 배치와 같은 폭
const MAP_WEB_STAGE = '30';

const mapWeb = {
  isOn: () => MAP_WEB_QUERY.matches,

  // 감싸기 전의 원래 함수
  base: {
    show: sheet.show,
    hide: sheet.hide,
    apply: sheet.apply,
    setStage: sheet.setStage,
    startDrag: sheet.startDrag,
    moveDrag: sheet.moveDrag,
    endDrag: sheet.endDrag,
    targetHeight: sheet.targetHeight,
    infoVisible: aptPanel.infoVisible,
    roadviewVisible: aptPanel.roadviewVisible,
    roadviewBox: aptPanel.roadviewBox,
  },

  wasOn: false, // 마지막으로 맞춘 배치가 웹이었는가 (창 폭이 1200px을 넘나드는 것을 알아챈다)
  mapWidth: 0, // 지도의 폭. 바뀌었을 때만 relayout 한다 (높이가 바뀌는 것은 map-view.js의 fitMapToSheet가 맞춘다)

  init() {
    mapWeb.wrapSheet();
    mapWeb.initFold();
    mapWeb.watchMapSize();

    // 처음 열 때: 웹이면 목록을 바로 연다 (map-view.js의 initMap 다음에 부른다)
    document.addEventListener('DOMContentLoaded', () => {
      if (mapWeb.isOn()) mapWeb.openList();
    });

    // 창 폭이 1200px을 넘나들 때. 미디어 쿼리의 change만으로는 놓치는 브라우저가 있어 resize에서도 확인한다.
    // 앞의 상태(mapWeb.wasOn)와 다를 때만 바꾼다
    mapWeb.wasOn = mapWeb.isOn();
    const onModeChange = () => {
      const on = mapWeb.isOn();
      if (on === mapWeb.wasOn) return;
      mapWeb.wasOn = on;
      if (on) {
        if (sheet.isShown()) sheet.show(MAP_WEB_STAGE, sheet.mode); // 모바일 단계에서 웹 단계로
        else mapWeb.openList();
      } else if (sheet.isShown() && sheet.mode === 'list') {
        mapWeb.base.hide(); // 웹에서만 늘 열어 두던 목록은 닫는다. 모바일은 지도만 보이는 처음 모양에서 시작한다
      } else if (sheet.isShown()) {
        mapWeb.base.show(MAP_WEB_STAGE, sheet.mode); // 아파트를 보던 중이면 모바일 30%로 둔다
      }
      sheet.apply(); // 표시를 다시 단다 (모바일이면 sheet.js의 원래 표시로 돌아간다)
      mapWeb.placeRoadview();
      aptPanel.renderRoadview();
    };
    MAP_WEB_QUERY.addEventListener('change', onModeChange);
    window.addEventListener('resize', onModeChange);
  },

  // ───────── 아래 창을 왼쪽 패널로 ─────────
  wrapSheet() {
    const { base } = mapWeb;

    sheet.show = (stage, mode) => base.show(mapWeb.isOn() ? MAP_WEB_STAGE : stage, mode);

    sheet.setStage = (stage) => {
      if (!mapWeb.isOn()) base.setStage(stage);
    };

    // 끌기: 웹에서는 높이를 바꾸지 않는다
    sheet.startDrag = () => {
      if (!mapWeb.isOn()) base.startDrag();
    };
    sheet.moveDrag = (height) => {
      if (!mapWeb.isOn()) base.moveDrag(height);
    };
    sheet.endDrag = (height, speed) => {
      if (!mapWeb.isOn()) {
        base.endDrag(height, speed);
        return;
      }
      sheet.dragging = false;
      sheet.moving = false;
    };

    // 지도는 창에 가리지 않는다. 고른 아파트를 남은 자리가 아니라 지도의 가운데에 둔다 (map-view.js의 panToRemaining)
    sheet.targetHeight = () => (mapWeb.isOn() ? 0 : base.targetHeight());

    // 닫기: 아파트 창이면 목록으로 돌아가고, 목록이면 닫지 않는다
    sheet.hide = () => {
      if (!mapWeb.isOn()) {
        base.hide();
        return;
      }
      if (sheet.mode === 'apartment') mapWeb.backToList();
    };

    // 모바일의 단계 표시(.map-app의 data-sheet, data-sheet-map)를 떼어 sheet.css의 단계별 규칙
    // (검색 줄 · 버튼 숨기기, 지도 줄이기)이 걸리지 않게 하고, 웹 표시를 단다
    sheet.apply = () => {
      // 웹에서는 목록이 늘 옆에 보이므로 보던 자리를 그대로 둔다 (2026-10-20 팀장 결정).
      // sheet.js는 보이는 칸이 바뀌면(아파트 → 목록) 목록을 맨 위로 보내므로, 그 전 자리를 기억했다가 되돌린다
      const list = document.getElementById('apt-list');
      const keep = mapWeb.isOn() ? list.scrollTop : null;
      base.apply();
      if (keep !== null && mapWeb.isOn()) list.scrollTop = keep;
      const app = document.querySelector('.map-app');
      const root = document.documentElement;
      if (!mapWeb.isOn()) {
        delete root.dataset.mapWebPanel;
        return;
      }
      delete app.dataset.sheet;
      delete app.dataset.sheetMap;
      if (sheet.isShown()) root.dataset.mapWebPanel = sheet.mode;
      else delete root.dataset.mapWebPanel;
    };

    // 로드뷰: 웹에서는 아파트 패널이 열려 있으면 늘 보인다 (단계와 상관없이)
    aptPanel.roadviewVisible = () => {
      if (!mapWeb.isOn()) return base.roadviewVisible();
      return sheet.isShown() && sheet.mode === 'apartment';
    };
    // 로드뷰 자리를 만들 때와 웹 ↔ 모바일이 바뀔 때 알맞은 곳에 둔다
    aptPanel.roadviewBox = () => {
      const box = base.roadviewBox();
      mapWeb.placeRoadview(box);
      return box;
    };

    // 아파트 정보 탭은 원래 80% 이상에서만 그린다. 웹에서는 단계와 상관없이 늘 보인다
    aptPanel.infoVisible = () => {
      if (!mapWeb.isOn()) return base.infoVisible();
      return sheet.isShown() && sheet.mode === 'apartment' &&
        document.getElementById('apt-tab-info').getAttribute('aria-selected') === 'true';
    };
  },

  // 로드뷰 자리를 옮긴다. 웹: 아파트 패널 맨 위(이름 줄 위). 모바일: 창 맨 위(손잡이 앞, apartment.js가 처음 둔 곳)
  // 옮긴 뒤에는 카카오 로드뷰에 새 크기를 알린다 (relayout)
  placeRoadview(box = document.getElementById('apt-roadview')) {
    if (!box) return;
    const panel = document.getElementById('apartment-panel');
    const handle = document.getElementById('sheet-handle');
    if (mapWeb.isOn()) {
      if (box.parentElement === panel && panel.firstElementChild === box) return;
      panel.prepend(box);
    } else {
      if (box.nextElementSibling === handle) return;
      handle.parentElement.insertBefore(box, handle);
    }
    if (aptPanel.roadview) requestAnimationFrame(() => aptPanel.roadview.relayout());
  },

  // 목록을 연다. 기록(history)을 남기지 않는다: 늘 열려 있는 목록이라 뒤로 가기는 앞 화면으로 가야 한다.
  // sheet.show는 닫기가 끝나기를 기다리는 중(backPending)에는 기록을 더하지 않으므로, 그 표시를 잠깐 빌린다.
  openList() {
    if (sheet.isShown()) return;
    const pending = sheet.backPending;
    sheet.backPending = true;
    sheet.show(MAP_WEB_STAGE, 'list');
    sheet.backPending = pending;
    sheet.reopened = false;
  },

  // 아파트 창 → 목록. 창은 닫지 않고 보이는 것만 바꾼다 (map-view.js의 backToList와 같이 말풍선을 푼다).
  // 목록은 늘 옆에 보이던 것이라 보던 자리를 그대로 둔다 (모바일은 맨 위부터)
  backToList() {
    selectMarker(null);
    sheet.mode = 'list';
    sheet.apply();
  },

  // ───────── 목록 패널 접기 ─────────
  initFold() {
    const button = document.getElementById('map-web-fold');
    if (!button) return;
    const render = () => {
      const folded = store.get('map').web_fold === true;
      document.documentElement.toggleAttribute('data-map-web-fold', folded);
      button.setAttribute('aria-expanded', String(!folded));
      button.setAttribute('aria-label', folded ? '목록 펴기' : '목록 접기');
      button.querySelector('.map-web-fold__icon').textContent = folded ? '›' : '‹';
    };
    button.addEventListener('click', () => {
      store.set('map', { web_fold: store.get('map').web_fold !== true });
      render();
    });
    render();
  },

  // ───────── 패널 폭이 바뀌면 지도에 알린다 ─────────
  // 카카오맵은 상자의 크기가 바뀐 것을 모른다. relayout()을 불러야 새 크기로 그린다.
  // 아파트 패널이 열리고 닫히거나 목록을 접으면 지도의 폭이 바뀐다. 고른 아파트가 있으면 줄어든 지도의 가운데로 옮긴다.
  watchMapSize() {
    const box = document.getElementById('kakao-map');
    if (!box || typeof ResizeObserver === 'undefined') return;
    new ResizeObserver(() => {
      if (!mapState.map || box.clientWidth === mapWeb.mapWidth) return;
      mapWeb.mapWidth = box.clientWidth;
      mapState.map.relayout();
      mapState.mapHeight = box.clientHeight;
      if (mapWeb.isOn()) centerSelected();
    }).observe(box);
  },
};

mapWeb.init();
