// P-05 지도 화면. 담당: 안세환
//
// 지금 하는 일
//   - 카카오맵 JavaScript SDK로 지도를 띄운다. 키는 서버의 A-26(GET /api/config)에서 받는다.
//   - 아파트 찾기(A-05) 응답의 아파트를 말풍선으로 지도에 올린다 (카카오맵 CustomOverlay).
//     말풍선의 꼬리 끝이 아파트의 자리다. 좌표가 없는 아파트는 지도에 그리지 않는다 (FR-MAP-07, 목록에만 나온다).
//   - 현재 위치 버튼, 확대·축소 버튼, 축척을 지도에 붙인다 (FR-MAP-24, 25, 26).
//   - 광주 5개 구 경계와 경계 밖 덮개, 고른 지역의 강조는 js/boundary.js가 그린다 (FR-MAP-28). 여기서는 붙이고 고른 지역만 알린다.
//   - 아파트 창 80%의 주변 시설 줄을 누르면 창을 30%로 내리고 그 시설을 지도에 아이콘으로 띄운 뒤,
//     고른 아파트에서 그 시설까지 점선을 잇고 시설 이름 옆에 도보 어림 거리를 띄운다 (showFacilityOnMap, drawFacilityLink. apartment.js가 부른다).
//     시설의 자리는 A-06 facilities의 latitude · longitude다 (data/load_facilities.py가 미리 받아 둔 값. 지하철은 가장 가까운 출구).
//     화면 안의 시설을 모두 띄우는 것과 종류별 체크 칸은 장소 검색을 화면에서 불러야 해서 발표 뒤로 미뤘다 (2026-10-19 팀장 결정, #125 C안).
//
// 자료
//   - 아파트는 A-05(POST /api/apartments/search)에서, 구와 동의 목록과 위치는 A-02(GET /api/regions)에서 받는다.
//   - 보고 있는 지역(구, 동)은 store의 'map' 묶음에 둔다. 새로 고쳐도 그 지역으로 돌아온다.
//   - 구·동 선택 창은 js/region.js(김해원)가 그린다.
//
// 아래 창 (P-06)
//   - 단계는 sheet.js, 아파트 내용은 apartment.js, 목록은 list.js(김목산)가 맡는다.
//       말풍선을 누름 → 아파트 30%      목록 보기 → 목록 80%      목록의 카드 → 아파트 80%
//   - 목록은 A-05 응답을 받을 때마다 #apt-list에 다시 그린다 (renderList). 목록 보기는 창만 연다.
//   - 창은 0.6초 동안 움직인다 (sheet.js, sheet.css). 열 때 올라오고, 닫을 때 내려가고, 단계를 바꿀 때 높이가 바뀐다.
//     움직이는 동안 누른 아파트를 창 위 남을 자리의 가운데로 부드럽게 옮긴다.
//     지도는 창이 커질 때는 다 움직인 뒤에 줄이고, 작아지거나 닫힐 때는 먼저 넓혀 창 뒤로 지도가 드러나게 한다.
//     지도의 크기를 바꿀 때 지도의 그림이 튀지 않게 맞춘다.
//     누른 아파트는 창을 뺀 남은 영역의 가운데에 둔다 (화면 설계서 7.1).
//   - 창에 보이는 값은 지도가 받은 A-05 응답을 그대로 쓴다. 창을 열 때 서버를 다시 부르지 않는다.
//
// 지켜야 할 것 (CLAUDE.md, NFR-08, NFR-23)
//   - 화면에서 주소를 좌표로 바꾸지 않는다. SDK에 services 라이브러리(장소 검색)를 불러오지 않는다.
//     아파트 좌표는 data/geocode.py, 주변 시설 좌표는 data/load_facilities.py가 DB에 넣은 값만 쓴다.
//   - 현재 위치는 브라우저 안에서 지도를 옮기는 데만 쓴다. 저장소(store)에 넣지 않고, 서버로 보내지 않는다.
//   - 계산하지 않는다. 구분(now, within, lack)과 금액은 서버가 준 값을 보여 주기만 한다.
//   - 서버나 DB에서 온 글자는 textContent로 넣는다. innerHTML을 쓰지 않는다.

// ───────── 지도 설정 ─────────
const KAKAO_SDK_URL = 'https://dapi.kakao.com/v2/maps/sdk.js';
const SDK_TIMEOUT_MS = 10000;

// 기본 위치. 현재 위치를 쓸 수 없을 때 지도의 가운데. 서구 치평동(광주 5개 구의 옛 시청 근처)이다.
// 처음 위치와 확대 수준은 명세서에 "정할 것"으로 남아 있다 (요구사항 8.3). 실제 지도를 보며 정한 뒤 고친다.
const DEFAULT_CENTER = { latitude: 35.1600, longitude: 126.8514 };
const DEFAULT_LEVEL = 4; // 카카오맵의 확대 수준. 숫자가 작을수록 가깝다.
// 확대 수준의 단계 (2026-10-15 팀장 직무대행 결정. 지도·부동산 앱에서 흔히 쓰는 틀에 맞췄다. 그 전은 동 6, 구 8)
//   1 ~ 4  단지   아파트 말풍선
//   5 ~ 6  동     동마다 표시 하나 (P-05 ③, FR-MAP-20)
//   7 ~ 9  구·시  구마다 표시 하나 (P-05 ⑪, FR-MAP-31). 9는 광주 5개 구가 한 화면에 들어오는 정도
const DONG_MARKER_LEVEL = 5; // 이 수준부터(더 넓게 보면) 말풍선 대신 동 표시
const GU_MARKER_LEVEL = 7; // 이 수준부터(더 넓게 보면) 동 표시 대신 구 표시
const DONG_LEVEL = 4; // 경계 자료가 없을 때 동 하나를 볼 수준 (말풍선)
const GU_LEVEL = 7; // 경계 자료가 없을 때 구 하나를 볼 수준 (구 표시)
// 구·동을 고르면 그 지역에 맞춰 지도를 옮긴다 (경계 자료, js/boundary.js)
//   동을 고름, 동 표시를 누름 : 그 동 전체가 들어오는 수준(3 ~ 6). 5 ~ 6이어도 그 동의 말풍선을 다 그린다 (동을 고른 사람은 그 동의 매물을 보려는 것이다)
//                            동을 고른 동안은 그 동의 아파트만 보인다. 그 동 안에서 확대하거나 끌어도 이웃 동의 말풍선은 나오지 않는다
//   구를 고름              : 그 구에서 아파트가 있는 동들의 범위가 들어오는 수준(7 ~ 8). 구 표시, 고른 구 강조
//                            구 경계 전체가 아니라 사람이 사는 곳이다. 광산구·북구는 논밭과 산이 넓어 구 전체에 맞추면 단지가 한쪽에 작게 몰린다
//   구 표시를 누름          : 같은 범위를 동 표시로 본다(5 ~ 6). 넓게에서 좁게 내려가며 보는 흐름
//   손으로 확대·축소해 고른 단계를 벗어나거나 고른 동 밖으로 끌면 이 예외는 풀리고 위 단계를 따른다 (mapState.focus, focusHolds)
const FIT_MIN_LEVEL = 3; // 아주 작은 동도 이보다 가까이 가지 않는다 (주변이 보이게)
const FIT_LEVELS = { dong: [FIT_MIN_LEVEL, 6], gu: [GU_MARKER_LEVEL, 8], drill: [DONG_MARKER_LEVEL, 6] };
const DONG_FIT_MAX_LEVEL = FIT_LEVELS.dong[1]; // 고른 동은 여기까지 고른 상태가 이어지고 말풍선이다
const FIT_PAD = 16; // 지역 경계와 화면 가장자리 사이의 여백 (px)
const ALL_GU_NAME = '광주 5개 구 전체'; // 구 표시를 볼 때 지역 버튼의 글자
// 가까이 볼 때 말풍선끼리 이만큼(넓이의 비율) 넘게 겹치면 하나로 묶는다.
const OVERLAP_RATIO = 0.35;
const MARKER_SIZE = { width: 72, height: 57, tipX: 8.5, tipY: 57 }; // 말풍선의 크기와 꼬리 끝의 자리 (map.css)
const ZOOM_MS = 600; // 동 표시를 눌렀을 때 그 동으로 확대되는 시간
// 처음 보는 지역. 고른 적이 없을 때 쓴다. 목업의 지역과 같다.
const DEFAULT_REGION = { gu: '서구', dong: '치평동' };
const MIN_LEVEL = 1;
const TAP_MOVE_PX = 6; // 누른 채 이만큼 넘게 움직였으면 누른 것이 아니라 끈 것이다
const TAP_GUARD_MS = 400; // 말풍선을 누른 뒤 이 안에 오는 지도의 click은 말풍선의 것이다
const MY_LOCATION_LEVEL = 3; // 내 위치로 갈 때의 확대 수준. 아파트 단지 몇 개가 보인다
const MAX_LEVEL = 9; // 광주 5개 구가 한 화면에 들어오는 정도

// 광주 5개 구를 감싼 사각형. 현재 위치가 이 밖이면 지도를 옮기지 않는다 (FR-MAP-24).
// data/geocode.py가 좌표를 검사하는 범위와 같다. 경계선(2차, T-MAP-26)이 생기면 그것으로 바꾼다.
const GWANGJU_BOUNDS = { latMin: 35.0, latMax: 35.3, lngMin: 126.6, lngMax: 127.0 };

const GEO_OPTIONS = { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 };

// 안내 문구. 앞의 셋은 와이어프레임의 문장 그대로다 (P-05 ⑰, ㉑, ⑪).
const MSG = {
  mapFail: '지도를 불러오지 못했습니다. 목록으로 계속 볼 수 있습니다.',
  dataFail: '아파트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', // 와이어프레임 P-04 ⑩의 문장
  geoDenied: '위치 권한이 꺼져 있어 현재 위치로 옮기지 못했습니다. 브라우저 설정에서 위치를 허용해 주세요.',
  geoOutside: '현재 위치가 광주 5개 구 밖입니다. 지도를 옮기지 않았습니다.',
  // 와이어프레임에 없는 경우(위치를 찾지 못함, 위치 기능이 없는 브라우저). 가장 가까운 문장을 따랐다.
  geoFail: '현재 위치를 찾지 못했습니다. 잠시 후 다시 시도해 주세요.',
  planSaved: '바꾼 저축 계획을 저장했습니다.', // 와이어프레임 A3
  planSaveFail: '저장하지 못했습니다.', // 화면 설계서 7장의 4 (다시 계산했을 때의 갱신)
};
const TOAST_MS = 3000;

// 축척 막대. 목업은 64px에 200m다. 확대 수준에 따라 보기 좋은 거리를 고르고 막대 길이를 맞춘다.
const SCALE_BAR_PX = 64;
const SCALE_STEPS = [10, 20, 30, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 20000, 50000];

// 지도에 띄운 주변 시설과 고른 아파트를 둘 다 보이게 맞출 때 가장 넓게 보는 확대 수준 (축척 100m)
const FACILITY_LEVEL = 4;
// 고른 아파트와 누른 시설을 둘 다 보이게 할 때 지도 가장자리에서 띄울 거리(px).
// 위는 검색창, 오른쪽은 지도 버튼, 아래는 축척과 목록 버튼 자리다. 말풍선과 시설 이름의 크기는 따로 잰다.
const FACILITY_LINK_MARGIN = { top: 72, right: 64, bottom: 64, left: 12 };
// 점선 한 칸의 길이와 칸 사이(px). 굵은 칸 하나가 아파트에서 시설 쪽으로 한 칸씩 옮겨 간다
const FACILITY_LINK_DASH = 12;
const FACILITY_LINK_GAP = 9;
const FACILITY_LINK_GROW_MS = 800; // 처음 한 번: 점선이 아파트에서 시설까지 뻗어 가는 시간
const FACILITY_LINK_GROW_PAUSE_MS = 1000; // 처음 한 번: 다 뻗은 뒤 굵은 칸 되풀이로 넘어가기까지 쉬는 시간
const FACILITY_LINK_STEP_MS = 120; // 굵은 칸이 다음 칸으로 넘어가는 간격
const FACILITY_LINK_PAUSE_MS = 600; // 시설에 닿은 뒤 처음부터 다시 할 때까지 쉬는 시간

const CATEGORY_NAMES = { now: '지금 가능', within: '기간 내 가능', lack: '자금 부족' };
const TARGET_YEAR_TEXT = { 0: '지금', 3: '3년 뒤', 5: '5년 뒤', 10: '10년 뒤' };

const mapState = {
  data: null, // A-05 응답. 아래 창(목록, 아파트)도 이 응답을 그대로 쓴다
  regions: [], // A-02 응답의 regions
  region: null, // 보고 있는 지역 { gu, dong }. dong이 null이면 구 전체
  selectedId: null,
  map: null, // kakao.maps.Map
  markers: [], // 아파트 말풍선 (kakao.maps.CustomOverlay)
  myLocation: null, // 내 위치 점 (kakao.maps.CustomOverlay). 저장하지 않는다
  toastTimer: null,
  mode: 'apartment', // 지금 그리는 표시. 'apartment'(말풍선), 'dong'(동 표시), 'gu'(구 표시)
  level: null, // 말풍선을 마지막으로 그렸을 때의 확대 수준. 달라지면 겹침을 다시 본다
  summary: { dong: null, gu: null }, // 동마다, 구마다의 목표할 수 있는 아파트 수 (A-12). 처음 넓게 볼 때 한 번씩 받는다
  groupTurn: {}, // 같은 자리에 겹친 말풍선에서 지금 맨 위에 보이는 차례
  mapHeight: 0, // 카카오맵에 마지막으로 알린 지도의 높이(px). 아래 창이 지도를 줄이고 늘릴 때 쓴다
  loadedBounds: null, // 영역으로 받았을 때 서버에 보낸 영역 (보이는 영역보다 넓다). 이 안에서 움직이면 다시 받지 않는다
  preload: null, // 구·동으로 받은 뒤 주변을 미리 받아 둔 것 { bounds, data, key }. 지도를 끌기 시작하면 바로 쓴다
  byBounds: false, // 아파트를 지도에 보이는 영역으로 받고 있는가 (손으로 지도를 움직인 뒤). 아니면 구·동으로 받는다
  boundsTimer: null, // 움직임이 멈추기를 기다리는 타이머
  quietUntil: 0, // 이때(ms)까지의 확대·축소는 코드가 한 것이다. 영역으로 다시 받지 않는다
  dropOnClose: false, // 아파트 창을 ✕로 닫는 중. 닫힐 때 말풍선을 푼다 (onSheetChange)
  keepSheet: false, // 비슷한 아파트로 다른 동을 받는 중. 받은 자료에 보던 아파트가 없어도 창을 닫지 않는다 (openSimilar)
  tappedAt: 0, // 지도 위 표시를 마지막으로 누른 때 (ms)
  loadSeq: 0, // 아파트를 받는 요청의 번호. 늦게 온 앞의 응답을 버린다
  loadFailed: false, // 마지막으로 아파트를 받다가 실패했는가. 목록 자리에 오류가 그려져 있다
  city: null, // 광주 전체 목록의 A-05 응답 { key, data } (renderCityList)
  citySeq: 0, // 광주 전체를 받는 요청의 번호
  listCity: false, // 목록에 지금 광주 전체가 그려져 있는가
  idleTimer: null, // 확대 · 끌기 뒤 idle을 기다리는 타이머 (watchIdle)
  focus: null, // 구·동을 골라 그 지역에 맞춘 상태 { gu, dong, kind }. kind: 'dong', 'gu', 'drill'(구 표시 누름). 위 FIT_ 설명
  focusLabel: null, // 고른 동의 이름과 아파트 수 (kakao.maps.CustomOverlay). 한 번 만들어 다시 쓴다
  facilities: [], // 지도 위 주변 시설 아이콘 (kakao.maps.CustomOverlay). 아파트 창에서 띄운 시설 하나만 단다
  facilityOpen: null, // 이름을 펼친 시설 아이콘
  facilityOpenId: null, // 이름을 펼친 시설의 id ("kind:이름")
  facilityLink: null, // 고른 아파트 → 펼친 시설의 점선 (kakao.maps.CustomOverlay). 한 번 만들어 다시 쓴다
  facilityLinkDrawn: null, // 점선을 마지막으로 그린 때의 { key, button }. 같으면 다시 그리지 않는다 (굵은 칸이 처음으로 돌아가지 않게)
  facilityPin: null, // 아파트 창의 주변 시설 줄을 눌러 지도에 띄운 시설 { kind, place }. 넓게 보아도 이것만은 남긴다
  facilityFit: false, // 창이 30%로 다 내려오면 고른 아파트와 facilityPin이 둘 다 보이게 지도를 맞춘다
  facilityLinkTimer: null, // 굵은 칸을 다음 칸으로 넘기는 타이머 (처음 뻗은 뒤 쉬는 타이머도)
  facilityLinkFrame: 0, // 처음 한 번 점선이 뻗어 가는 애니메이션 (requestAnimationFrame 번호)
  facilityLinkGrown: null, // 뻗어 가기를 이미 보여 준 '아파트 id:장소 id'. 같은 둘을 다시 그릴 때(확대·축소)는 바로 되풀이로 간다
};

// ───────── 카카오맵 불러오기 ─────────

// 서버에서 JavaScript 키를 받는다 (A-26). REST API 키는 화면에 오지 않는다.
async function loadKakaoKey() {
  const config = await api.get('/api/config');
  if (!config || !config.kakao_js_key) throw new Error('카카오 JavaScript 키가 없습니다.');
  return config.kakao_js_key;
}

// SDK를 불러온다. 지도 그림만 쓴다. libraries=services(장소 검색, 주소 → 좌표)는 넣지 않는다.
// 주변 시설도 data/load_facilities.py가 미리 받아 둔 것(좌표 포함)을 A-06으로 받는다 (NFR-08).
function loadKakaoSdk(key) {
  if (window.kakao && window.kakao.maps && window.kakao.maps.Map) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('카카오맵을 불러오는 시간이 지났습니다.')), SDK_TIMEOUT_MS);
    const script = document.createElement('script');
    script.src = `${KAKAO_SDK_URL}?appkey=${encodeURIComponent(key)}&autoload=false`;
    script.onload = () => {
      if (!window.kakao || !window.kakao.maps) {
        clearTimeout(timer);
        reject(new Error('카카오맵 스크립트가 비어 있습니다.'));
        return;
      }
      window.kakao.maps.load(() => {
        clearTimeout(timer);
        resolve();
      });
    };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      reject(new Error('카카오맵 스크립트를 받지 못했습니다.'));
    };
    document.head.appendChild(script);
  });
}

const toLatLng = ({ latitude, longitude }) => new kakao.maps.LatLng(latitude, longitude);

function createMap(center) {
  const container = document.getElementById('kakao-map');
  const map = new kakao.maps.Map(container, { center: toLatLng(center), level: DEFAULT_LEVEL });
  map.setMinLevel(MIN_LEVEL);
  map.setMaxLevel(MAX_LEVEL);
  guardWheel(container);
  kakao.maps.event.addListener(map, 'zoom_changed', safely(() => {
    renderScale();
    onZoomChanged();
    drawFacilityLink(); // 확대 수준이 바뀌면 점선의 길이(px)가 바뀐다
    watchIdle(map);
  }));
  // 손으로 끌어 옮기면 보이는 영역의 아파트로 바꾼다 (FR-MAP-22). 코드가 옮길 때는 이 사건이 나지 않는다.
  kakao.maps.event.addListener(map, 'dragstart', adoptPreload); // 끌기 시작하면 미리 받아 둔 주변을 바로 그린다
  // 창을 닫은 뒤 남겨 둔 말풍선(keepOnClose)은 지도를 끌면 푼다
  kakao.maps.event.addListener(map, 'dragstart', () => {
    if (sheet.phase === 'closed' && mapState.selectedId !== null) selectMarker(null);
  });
  kakao.maps.event.addListener(map, 'click', onMapClick);
  kakao.maps.event.addListener(map, 'dragend', safely(() => {
    scheduleBoundsLoad();
    watchIdle(map);
  }));
  kakao.maps.event.addListener(map, 'idle', safely(() => {
    clearTimeout(mapState.idleTimer);
    onMapIdle(map);
  }));
  hideKakaoScale();
  // 경계 (js/boundary.js). 행정동 선은 동 표시가 나오기 전(말풍선 수준)에서만 그린다
  // 경계가 오면 구 표시를 경계 안으로 다시 벌린다 (먼저 그려졌으면 경계 확인 없이 벌려져 있다)
  mapBoundary.attach(map, { dongLevel: DONG_MARKER_LEVEL }).then(() => respreadGuMarkers());
  return map;
}

// 지도가 멈춘 뒤 (idle). 확대 수준이 바뀌면 말풍선끼리 겹치는 정도가 달라진다. 움직임이 끝난 뒤에 다시 묶는다.
function onMapIdle(map) {
  renderScale();
  hideKakaoScale();
  // 빠르게 확대 · 축소하면 앞 수준에서 받던 자료가 늦게 와서 표시가 지금 수준과 어긋난 채 남았다 (9인데 동 표시).
  // 멈춘 뒤 한 번 더 맞춘다
  if (mapState.data && markerMode() !== mapState.mode) onZoomChanged();
  if (mapState.mode === 'apartment' && mapState.level !== map.getLevel()) renderMarkers();
  renderFacilities();
  keepFacilityNameInside(); // 지도가 움직였으면 펼친 이름표가 화면 밖으로 나가지 않게 다시 맞춘다
}

// ───────── 무리한 확대 · 축소 막기 (2026-10-20) ─────────
// 휠을 세게 굴리면 카카오맵이 확대 애니메이션을 끝내지 못하고, 서로 다른 수준의 지도 조각과 경계가 겹친 채 멈췄다.
// 1. 휠은 WHEEL_GAP_MS에 한 번만 카카오맵에 넘긴다 (그 사이의 휠은 버린다).
// 2. 화면을 그리는 코드가 오류를 내도 카카오맵의 사건 처리가 끊기지 않게 잡는다 (safely).
// 3. 확대 · 끌기 뒤 IDLE_WAIT_MS 안에 idle이 오지 않으면 지도를 다시 그리게 하고, idle에서 할 일을 대신 한다.
const WHEEL_GAP_MS = 120;
const IDLE_WAIT_MS = 1200;

function guardWheel(container) {
  let last = 0;
  // 지도 상자의 부모에서 먼저 잡는다 (capture). 카카오맵은 지도 상자와 그 안에서 휠을 받는다
  container.parentElement.addEventListener('wheel', (event) => {
    if (!container.contains(event.target)) return;
    const now = Date.now();
    if (now - last < WHEEL_GAP_MS) {
      event.preventDefault(); // 화면이 대신 스크롤되지 않게
      event.stopPropagation(); // 카카오맵까지 가지 않는다
      return;
    }
    last = now;
  }, { capture: true, passive: false });
}

function safely(handler) {
  return (...args) => {
    try {
      handler(...args);
    } catch (error) {
      console.error('지도 사건 처리 중 오류', error);
    }
  };
}

function watchIdle(map) {
  clearTimeout(mapState.idleTimer);
  mapState.idleTimer = setTimeout(safely(() => {
    map.relayout(); // 멈춘 조각을 지금 수준으로 다시 그린다
    map.setCenter(map.getCenter());
    onMapIdle(map);
  }), IDLE_WAIT_MS);
}

// 지도를 누르면 지도 위의 창을 닫는다. 말풍선을 누른 직후의 click은 말풍선의 것이라 넘긴다 (onTap)
function onMapClick() {
  closeFacilityName();
  if (Date.now() - mapState.tappedAt > TAP_GUARD_MS) closeOverlays();
}

// 카카오맵이 왼쪽 아래에 그리는 축척(막대와 "100m")을 숨긴다. 축척은 목업의 것(.map-scale)을 쓴다.
// 그 옆의 카카오 로고는 이용 약관상 가리지 않는다. 로고는 그대로 둔다.
// 카카오는 이 요소에 이름(class)을 붙이지 않아서, 로고 그림(m_bi)을 찾고 그 앞의 형제(축척)를 숨긴다.
// SDK가 바뀌어 찾지 못하면 아무것도 하지 않는다 (축척이 하나 더 보일 뿐 지도는 그대로 동작한다).
function hideKakaoScale() {
  const logo = document.querySelector('#kakao-map img[src*="m_bi"]');
  const logoBox = logo && logo.parentElement && logo.parentElement.parentElement; // 로고 그림 → 링크 → 로고 상자
  if (!logoBox || !logoBox.parentElement) return;
  // 로고 상자의 형제 가운데 "100m", "1km"처럼 거리로 끝나는 것이 축척이다.
  [...logoBox.parentElement.children].forEach((child) => {
    if (child !== logoBox && /\d\s*k?m$/.test(child.textContent.trim())) child.style.display = 'none';
  });
}

// ───────── 현재 위치 ─────────

const isInsideGwangju = ({ latitude, longitude }) =>
  latitude >= GWANGJU_BOUNDS.latMin && latitude <= GWANGJU_BOUNDS.latMax &&
  longitude >= GWANGJU_BOUNDS.lngMin && longitude <= GWANGJU_BOUNDS.lngMax;

// 브라우저에 현재 위치를 묻는다. 결과: { status: 'ok' | 'outside' | 'denied' | 'fail', position }
function askPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ status: 'fail' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position = { latitude: coords.latitude, longitude: coords.longitude };
        resolve({ status: isInsideGwangju(position) ? 'ok' : 'outside', position });
      },
      (error) => resolve({ status: error.code === error.PERMISSION_DENIED ? 'denied' : 'fail' }),
      GEO_OPTIONS,
    );
  });
}

// 내 위치 점을 지도에 둔다. 위치는 이 점과 지도의 가운데에만 쓰고 어디에도 남기지 않는다.
function showMyLocation(position) {
  if (!mapState.myLocation) {
    const dot = document.createElement('span');
    dot.className = 'my-location';
    dot.setAttribute('aria-label', '내 위치');
    // 점의 가운데를 위치에 맞춘다. .my-location이 translate(-50%, -50%)로 자기 크기의 반만큼 옮긴다.
    mapState.myLocation = new kakao.maps.CustomOverlay({ content: dot, xAnchor: 0, yAnchor: 0, zIndex: 1 });
  }
  mapState.myLocation.setPosition(toLatLng(position));
  mapState.myLocation.setMap(mapState.map);
}

// 현재 위치로 옮긴다. 광주 5개 구 밖이거나 권한이 없으면 옮기지 않고 안내한다 (FR-MAP-24).
//   quiet가 true면 권한 거부와 실패는 안내하지 않는다. 지도를 처음 열 때 쓴다.
//   (사용자가 방금 브라우저의 권한 창에서 거부했으므로 다시 알리지 않는다.)
async function moveToMyLocation({ quiet = false } = {}) {
  const { status, position } = await askPosition();
  if (status === 'ok') {
    showMyLocation(position);
    mapState.focus = null; // 고른 구·동을 떠나 내 주변을 본다
    // 천천히 옮겨 가지 않고 화면이 바뀌듯 한 번에 그 자리로 간다. 아파트가 보이는 수준까지 가까이
    mapState.map.setCenter(toLatLng(position));
    mapState.map.setLevel(MY_LOCATION_LEVEL);
    scheduleBoundsLoad(100); // 그 자리의 아파트를 받는다
    return;
  }
  if (status === 'outside') showToast(MSG.geoOutside);
  else if (!quiet) showToast(status === 'denied' ? MSG.geoDenied : MSG.geoFail);
}

// ───────── 축척 ─────────
// 막대 64px이 지도에서 몇 m인지 재고, 그보다 작은 보기 좋은 거리(200m 같은)를 골라 막대 길이를 맞춘다.
function renderScale() {
  const { map } = mapState;
  if (!map) return;
  const projection = map.getProjection();
  const box = document.getElementById('kakao-map');
  const y = box.clientHeight / 2;
  const x = box.clientWidth / 2;
  const left = projection.coordsFromContainerPoint(new kakao.maps.Point(x, y));
  const right = projection.coordsFromContainerPoint(new kakao.maps.Point(x + SCALE_BAR_PX, y));
  const meters = new kakao.maps.Polyline({ path: [left, right] }).getLength();
  if (!(meters > 0)) return;

  const step = [...SCALE_STEPS].reverse().find((value) => value <= meters) || SCALE_STEPS[0];
  document.getElementById('scale-label').textContent = step < 1000 ? `${step}m` : `${step / 1000}km`;
  document.getElementById('scale-bar').style.width = `${Math.round((SCALE_BAR_PX * step) / meters)}px`;
}

// ───────── 주변 시설 ─────────
// 아파트 창의 주변 시설 줄을 눌러 띄운 시설 하나(facilityPin)만 지도에 아이콘으로 둔다. 아파트 말풍선보다 아래(zIndex 1).
// 누르면 이름이 나오고, 지도를 누르면 접힌다. 자리는 A-06의 좌표다 (장소 검색을 부르지 않는다).
function renderFacilities() {
  if (!mapState.map) return;
  if (mapState.mode !== 'apartment') {
    clearFacilities();
    return;
  }
  ensureFacilityPin();
}

// 시설 아이콘 하나. 44px 누름 자리 가운데에 색 동그라미가 있고, 누르면 위에 이름이 나온다
function createFacility(kind, place) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `facility facility--${kind.code.toLowerCase()}`;
  button.setAttribute('aria-label', `${kind.label} ${place.place_name}`);
  button.setAttribute('aria-expanded', 'false');

  const dot = document.createElement('span');
  dot.className = 'facility__dot';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'facility__icon');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', kind.icon);
  svg.appendChild(path);
  dot.appendChild(svg);

  // 펼치면 위에 나오는 이름표. 아파트를 골라 두었으면 이름 옆에 거리가 붙는다 (drawFacilityLink)
  const name = document.createElement('span');
  name.className = 'facility__name';
  const title = document.createElement('span');
  title.textContent = place.place_name;
  const distance = document.createElement('span');
  distance.className = 'facility__distance';
  distance.hidden = true;
  name.append(title, distance);
  button.append(dot, name);

  const overlay = new kakao.maps.CustomOverlay({
    position: new kakao.maps.LatLng(Number(place.y), Number(place.x)),
    content: button,
    xAnchor: 0.5,
    yAnchor: 0.5,
    zIndex: 1,
    clickable: true, // 아이콘을 눌러도 지도의 click(창 닫기)이 나지 않는다
  });
  button.addEventListener('click', () => {
    const open = mapState.facilityOpen === overlay;
    closeFacilityName();
    if (!open) openFacilityName(overlay, { reveal: true });
  });
  overlay.placeId = place.id;
  overlay.kindCode = kind.code;
  overlay.setMap(mapState.map);
  return overlay;
}

// 아파트 창에서 띄운 시설(facilityPin)을 펼쳐 둔다. 이미 펼쳐 있으면 그대로, 받은 아이콘에 있으면 그것을, 없으면 새로 단다
function ensureFacilityPin() {
  const pin = mapState.facilityPin;
  if (!pin) return;
  const open = mapState.facilityOpen;
  if (open && open.placeId === pin.place.id) return;
  let overlay = mapState.facilities.find((item) => item.placeId === pin.place.id);
  if (!overlay) {
    overlay = createFacility(pin.kind, pin.place);
    mapState.facilities.push(overlay);
  }
  overlay.setMap(mapState.map);
  openFacilityName(overlay);
}

// 이름을 펼친다. reveal이면(손으로 누름) 고른 아파트와 이 시설이 둘 다 보이게 지도를 옮긴다
function openFacilityName(overlay, { reveal = false } = {}) {
  overlay.getContent().setAttribute('aria-expanded', 'true');
  overlay.setZIndex(4); // 이름은 아파트 말풍선(2, 고르면 3) 위에 보이게
  mapState.facilityOpen = overlay;
  mapState.facilityOpenId = overlay.placeId;
  drawFacilityLink();
  keepFacilityNameInside();
  if (reveal) revealFacilityLink();
}

// 펼친 이름표가 지도 왼쪽·오른쪽 밖으로 나가면 안쪽으로 민다. 이름표는 아이콘 가운데 위에 있고, 아이콘이 가장자리에 있으면 잘린다
function keepFacilityNameInside() {
  const overlay = mapState.facilityOpen;
  if (!overlay) return;
  const name = overlay.getContent().querySelector('.facility__name');
  name.style.marginLeft = '';
  const rect = name.getBoundingClientRect();
  if (!rect.width) return;
  const area = document.getElementById('kakao-map').getBoundingClientRect();
  const gap = 8;
  let shift = 0;
  if (rect.left < area.left + gap) shift = area.left + gap - rect.left;
  else if (rect.right > area.right - gap) shift = area.right - gap - rect.right;
  if (shift) name.style.marginLeft = `${Math.round(shift)}px`;
}

function closeFacilityName() {
  const overlay = mapState.facilityOpen;
  if (overlay) {
    const button = overlay.getContent();
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', button.getAttribute('aria-label').split(' · ')[0]); // 붙였던 거리를 뗀다
    button.querySelector('.facility__name').style.marginLeft = '';
    overlay.setZIndex(1);
  }
  mapState.facilityOpen = null;
  mapState.facilityOpenId = null;
  mapState.facilityPin = null;
  drawFacilityLink();
}

// 지도의 시설 아이콘을 모두 뗀다. keepPin이면 아파트 창에서 띄운 시설의 아이콘만은 펼친 채로 둔다
function clearFacilities({ keepOpen = false, keepPin = false } = {}) {
  const open = mapState.facilityOpen;
  const pin = keepPin ? mapState.facilityPin : null;
  const keep = pin && open && open.placeId === pin.place.id ? open : null;
  mapState.facilities.forEach((overlay) => {
    if (overlay !== keep) overlay.setMap(null);
  });
  mapState.facilities = keep ? [keep] : [];
  if (keep) return;
  mapState.facilityOpen = null;
  if (!keepOpen && !pin) closeFacilityName();
}

// ── 아파트 창의 주변 시설 줄 → 지도 ──
// apartment.js가 주변 시설 줄을 누르면 부른다. kind는 A-06 facilities의 kind(학교 종류별이면 elementary 등), item은 그 시설 하나다.
// 자리는 A-06 facilities의 latitude · longitude다 (지하철은 줄에 적힌 출구). 거리는 A-06의 직선거리를 그대로 쓴다 (줄과 같은 숫자가 나오게).
// 창을 30%로 내리고, 다 내려오면 고른 아파트와 그 시설이 둘 다 보이게 지도를 맞춘 뒤 점선을 잇는다.
const FACILITY_SCHOOL_KINDS = ['elementary', 'middle', 'high', 'university'];
function showFacilityOnMap(kindName, item) {
  const base = FACILITY_SCHOOL_KINDS.includes(kindName) ? 'school' : kindName;
  const kind = typeof APT_NEAR_KINDS !== 'undefined' ? APT_NEAR_KINDS.find((entry) => entry.kind === base) : null;
  const apartment = selectedApartment();
  const place = facilityPlace(item);
  if (!mapState.map || !kind || !place || !apartment) return;
  clearFacilities(); // 앞에서 띄운 시설 아이콘은 뗀다. 지도에는 늘 하나만
  mapState.facilityPin = { kind, place };
  if (sheet.stage === '30' && sheet.phase === 'open' && !sheet.moving) {
    mapState.facilityFit = false;
    fitFacilityPin(); // 이미 30%면 바로 맞춘다
    return;
  }
  mapState.facilityFit = true;
  sheet.show('30', 'apartment');
}

// A-06의 시설 하나를 지도에 쓸 장소 { id, place_name, x(경도), y(위도), distance }로 바꾼다. 좌표가 없으면 null
// 지하철은 줄에 적힌 출구의 자리이므로 이름에 출구를 붙인다 ("김대중컨벤션센터역 광주1호선 5번 출구")
function facilityPlace(item) {
  if (!item || !item.place_name || item.latitude === null || item.latitude === undefined) return null;
  const exit = item.kind === 'subway' && item.exit_no !== null && item.exit_no !== undefined ? ` ${item.exit_no}번 출구` : '';
  return {
    id: `${item.kind}:${item.place_name}${exit}`,
    place_name: `${item.place_name}${exit}`,
    x: Number(item.longitude),
    y: Number(item.latitude),
    distance: Number(item.distance),
  };
}

// 창이 다 내려온 뒤 한 번 (onSheetChange). 맞출 것이 있으면 맞추고 true
function takeFacilityFit() {
  if (!mapState.facilityFit || sheet.stage !== '30' || sheet.mode !== 'apartment') return false;
  mapState.facilityFit = false;
  fitFacilityPin();
  return true;
}

// 고른 아파트와 facilityPin이 지도의 남은 자리(검색창, 버튼, 아래 창이 덮지 않은 곳)에 둘 다 들어오게 확대 수준과 가운데를 정한다.
// 50m(수준 3)부터 보아 둘이 들어가는 가장 가까운 수준을 고른다. 말풍선과 아이콘이 보이는 수준(4)보다 넓히지 않는다.
// 4에서도 다 들어가지 않으면(멀리 있는 대학교 등) 아파트를 화면 가장자리 쪽에 두고, 점선이 시설 쪽으로 화면 밖까지 이어진다.
function fitFacilityPin() {
  const { map, facilityPin } = mapState;
  const apartment = selectedApartment();
  if (!map || !facilityPin || !apartment) return;
  const from = toLatLng(apartment);
  const to = new kakao.maps.LatLng(Number(facilityPin.place.y), Number(facilityPin.place.x));
  const box = document.getElementById('kakao-map');
  const width = box.clientWidth;
  const height = box.clientHeight;
  const m = FACILITY_LINK_MARGIN;
  const room = { x: m.left, y: m.top, width: width - m.left - m.right, height: height - m.top - m.bottom };
  // 아파트 자리(말풍선 꼬리 끝)를 (0, 0)으로 둔 px. 말풍선은 꼬리에서 왼쪽 9, 오른쪽 63, 위 70px,
  // 시설은 아이콘과 이름표로 좌우 22, 위 50, 아래 22px를 차지한다 (이름표가 넓으면 keepFacilityNameInside가 안쪽으로 민다)
  const projection = map.getProjection();
  const a0 = projection.containerPointFromCoords(from);
  const b0 = projection.containerPointFromCoords(to);
  const level0 = map.getLevel();
  const extent = (level) => {
    const scale = 2 ** (level0 - level);
    const x = (b0.x - a0.x) * scale;
    const y = (b0.y - a0.y) * scale;
    return { x, y, left: Math.min(-9, x - 22), right: Math.max(63, x + 22), top: Math.min(-70, y - 50), bottom: Math.max(0, y + 22) };
  };
  let level = FACILITY_LEVEL;
  for (let candidate = Math.min(3, FACILITY_LEVEL); candidate <= FACILITY_LEVEL; candidate += 1) {
    const e = extent(candidate);
    if (e.right - e.left <= room.width && e.bottom - e.top <= room.height) {
      level = candidate;
      break;
    }
  }
  const e = extent(level);
  // 아파트가 화면에서 올 자리. 둘이 들어가면 남은 자리의 가운데에, 넘치면 아파트 쪽 끝을 남은 자리의 가장자리에 붙인다
  const spot = (low, high, start, size, toward) => {
    if (high - low <= size) return start + (size - (high - low)) / 2 - low;
    return toward >= 0 ? start - low : start + size - high;
  };
  const ax = spot(e.left, e.right, room.x, room.width, e.x);
  const ay = spot(e.top, e.bottom, room.y, room.height, e.y);
  map.setLevel(level);
  const a = map.getProjection().containerPointFromCoords(from);
  const center = new kakao.maps.Point(width / 2 + (a.x - ax), height / 2 + (a.y - ay));
  map.setCenter(map.getProjection().coordsFromContainerPoint(center));
  ensureFacilityPin();
  drawFacilityLink();
}

// ── 고른 아파트 → 펼친 시설의 점선과 거리 ──
// 처음 한 번: 아파트 자리(말풍선 꼬리 끝)에서 시설 아이콘 가운데까지 진한 점선이 0.8초 동안 뻗어 간다.
//   닿으면 시설 아이콘이 한 번 커졌다 돌아오고 (map.css), 1초 쉰다.
// 그다음부터: 점선은 흐리게 다 그려져 있고, 그 위로 굵은 칸 하나가 아파트 쪽 첫 칸에서 시설 쪽으로 한 칸씩(0.12초마다) 옮겨 간다.
//   마지막 칸에 닿으면 아이콘이 한 번 커지고, 잠깐 쉰 뒤 첫 칸부터 다시 한다. 펼쳐 둔 동안 되풀이한다.
// 점선이 사라졌다가(다른 시설, 창을 올림 등) 다시 나오면 처음 한 번부터 다시 한다. 확대·축소로 다시 그릴 때는 바로 되풀이로 간다.
// 동작 줄이기를 켠 사람에게는 굵은 칸 없이 진한 점선만 그린다.
// 거리는 선 위가 아니라 시설 이름표의 이름 옆에 따로 띄운다: "약 670m · 도보 약 10분".
// 걷는 거리와 시간은 직선거리로 어림한 값이다 (apartment.js의 aptWalk, 아파트 정보 탭과 같은 값. 길찾기는 외부 API라 쓰지 않는다).
// 선은 아파트 자리에 단 CustomOverlay 안의 SVG다. 확대 수준이 바뀌면 두 점 사이의 px가 바뀌므로 다시 그린다.
function drawFacilityLink() {
  const { map, facilityOpen } = mapState;
  // 아파트 창이 30%로 열려 있을 때만 잇는다. 80% 이상이면 지도가 거의 가려져 있고, 닫혀 있으면 이름만 보인다
  const linkable = sheet.mode === 'apartment' && sheet.stage === '30' && (sheet.phase === 'open' || sheet.phase === 'opening');
  const apartment = linkable ? selectedApartment() : null;
  if (facilityOpen) {
    const distance = facilityOpen.getContent().querySelector('.facility__distance');
    if (distance) distance.hidden = !apartment;
  }
  if (!map || !facilityOpen || !apartment) {
    clearTimeout(mapState.facilityLinkTimer);
    cancelAnimationFrame(mapState.facilityLinkFrame);
    if (mapState.facilityLink) mapState.facilityLink.setMap(null);
    mapState.facilityLinkDrawn = null;
    mapState.facilityLinkGrown = null; // 다시 나오면 처음 한 번부터
    return;
  }
  // 같은 아파트, 같은 시설, 같은 확대 수준으로 이미 그려 두었으면 그대로 둔다 (창이 움직일 때마다 불려도 굵은 칸이 처음으로 돌아가지 않게)
  const key = `${apartment.id}:${facilityOpen.placeId}:${map.getLevel()}`;
  const drawn = mapState.facilityLinkDrawn;
  if (drawn && drawn.key === key && drawn.button === facilityOpen.getContent() && mapState.facilityLink.getMap()) return;
  mapState.facilityLinkDrawn = { key, button: facilityOpen.getContent() };
  clearTimeout(mapState.facilityLinkTimer);
  cancelAnimationFrame(mapState.facilityLinkFrame);
  const from = toLatLng(apartment);
  const to = facilityOpen.getPosition();
  const projection = map.getProjection();
  const a = projection.containerPointFromCoords(from);
  const b = projection.containerPointFromCoords(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // 아파트 창에서 띄운 시설이면 그 줄과 같은 직선거리(카카오가 아파트에서 잰 값)로 어림한다. 줄과 숫자가 다르지 않게
  const pin = mapState.facilityPin;
  const listed = pin && pin.place.id === facilityOpen.placeId && Number(pin.place.distance) > 0 ? Number(pin.place.distance) : null;
  const meters = listed !== null ? listed : Math.round(new kakao.maps.Polyline({ path: [from, to] }).getLength());
  const button = facilityOpen.getContent();
  const color = getComputedStyle(button).getPropertyValue('--facility-color');

  const text = typeof aptWalkText === 'function' ? aptWalkText(meters) : `${meters}m`; // "약 670m · 도보 약 10분" (apartment.js)
  button.querySelector('.facility__distance').textContent = text;
  button.setAttribute('aria-label', `${button.getAttribute('aria-label').split(' · ')[0]} · 고른 아파트에서 ${text}`);

  const box = document.createElement('div');
  // 색은 아이콘과 같은 이름(.facility--sw8 등)으로 정한다. 방금 단 아이콘은 아직 화면에 붙기 전이라 색을 읽을 수 없을 때가 있다
  box.className = `facility-link facility--${String(facilityOpen.kindCode || '').toLowerCase()}`;
  if (color) box.style.setProperty('--facility-color', color);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'facility-link__svg');
  svg.setAttribute('aria-hidden', 'true');
  // 늘 다 그려져 있는 점선과, 그 위에서 한 칸씩 옮겨 가는 굵은 칸. 굵은 칸은 칸 하나 뒤로 긴 빈칸을 두어 한 칸만 보이게 한다
  const length = Math.hypot(dx, dy);
  const period = FACILITY_LINK_DASH + FACILITY_LINK_GAP;
  const makeLine = (className, dash) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', className);
    line.setAttribute('x1', '0');
    line.setAttribute('y1', '0');
    line.setAttribute('x2', String(dx));
    line.setAttribute('y2', String(dy));
    line.setAttribute('stroke-dasharray', dash);
    svg.appendChild(line);
    return line;
  };
  const base = makeLine('facility-link__line', `${FACILITY_LINK_DASH} ${FACILITY_LINK_GAP}`);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  box.classList.toggle('facility-link--still', reduce);
  const lead = reduce ? null : makeLine('facility-link__lead', `${FACILITY_LINK_DASH} ${Math.ceil(length) + period}`);
  box.appendChild(svg);

  if (!mapState.facilityLink) {
    mapState.facilityLink = new kakao.maps.CustomOverlay({ xAnchor: 0, yAnchor: 0, zIndex: 1, clickable: false });
  }
  mapState.facilityLink.setContent(box);
  mapState.facilityLink.setPosition(from);
  mapState.facilityLink.setMap(map);
  if (!lead) return;

  // 굵은 칸을 index번째 칸에 둔다. 마지막 칸에 닿으면 아이콘을 키우고, 쉰 뒤 첫 칸부터 다시
  const cells = Math.max(1, Math.ceil(length / period));
  const step = (index) => {
    lead.setAttribute('stroke-dashoffset', String(-index * period));
    if (index === 0) button.classList.remove('facility--arrived');
    if (index < cells - 1) {
      mapState.facilityLinkTimer = setTimeout(() => step(index + 1), FACILITY_LINK_STEP_MS);
      return;
    }
    button.classList.add('facility--arrived');
    mapState.facilityLinkTimer = setTimeout(() => step(0), FACILITY_LINK_STEP_MS + FACILITY_LINK_PAUSE_MS);
  };

  // 이 아파트와 시설을 처음 잇는 것이면 먼저 점선이 뻗어 간다. 아니면 바로 굵은 칸 되풀이
  const pair = `${apartment.id}:${facilityOpen.placeId}`;
  if (mapState.facilityLinkGrown === pair) {
    step(0);
    return;
  }
  mapState.facilityLinkGrown = pair;
  box.classList.add('facility-link--grow'); // 뻗는 동안은 진한 점선만, 굵은 칸은 숨긴다 (map.css)
  button.classList.remove('facility--arrived');
  const reach = (t) => {
    base.setAttribute('x2', String(dx * t));
    base.setAttribute('y2', String(dy * t));
  };
  const start = performance.now();
  const grow = (now) => {
    const t = Math.min((now - start) / FACILITY_LINK_GROW_MS, 1);
    reach(1 - (1 - t) ** 3); // 처음에 빠르고 도착할 때 느려진다
    if (t < 1) {
      mapState.facilityLinkFrame = requestAnimationFrame(grow);
      return;
    }
    button.classList.add('facility--arrived');
    mapState.facilityLinkTimer = setTimeout(() => {
      box.classList.remove('facility-link--grow'); // 점선이 흐려지고 굵은 칸이 나온다
      step(0);
    }, FACILITY_LINK_GROW_PAUSE_MS);
  };
  reach(0);
  mapState.facilityLinkFrame = requestAnimationFrame(grow);
}

// 고른 아파트와 펼친 시설이 지도 가장자리(검색창, 버튼, 아래 창이 덮지 않은 곳) 안에 둘 다 들어오게 옮긴다.
// 아파트는 말풍선 전체, 시설은 아이콘과 펼친 이름 전체가 들어오게 잰다 (이름이 화면 밖으로 잘리지 않게).
// 지도는 아래 창을 뺀 높이라 지도 상자 안이 보이는 곳이다. 확대 수준은 바꾸지 않는다 (넓히면 시설 아이콘이 사라진다).
// 둘이 한 화면에 다 들어가지 않을 만큼 멀면 가운데를 화면 가운데로 둔다.
function revealFacilityLink() {
  const { map, facilityOpen } = mapState;
  const apartment = selectedApartment();
  if (!map || !facilityOpen || !apartment || !mapState.facilityLinkDrawn) return; // 점선을 그리지 않았으면(창이 30%가 아님) 옮기지 않는다
  const box = document.getElementById('kakao-map');
  const area = box.getBoundingClientRect();
  const marker = mapState.markers.find((overlay) => overlay.apartmentId === apartment.id);
  const rects = [facilityOpen.getContent(), facilityOpen.getContent().querySelector('.facility__name')];
  if (marker && marker.getContent()) rects.push(marker.getContent());
  const shown = rects.map((element) => element.getBoundingClientRect()).filter((rect) => rect.width > 0);
  const m = FACILITY_LINK_MARGIN;
  const left = Math.min(...shown.map((r) => r.left)) - area.left;
  const right = Math.max(...shown.map((r) => r.right)) - area.left;
  const top = Math.min(...shown.map((r) => r.top)) - area.top;
  const bottom = Math.max(...shown.map((r) => r.bottom)) - area.top;
  const fit = (low, high, min, max) => {
    if (high - low > max - min) return (low + high) / 2 - (min + max) / 2; // 다 안 들어가면 가운데로
    if (low < min) return low - min;
    if (high > max) return high - max;
    return 0;
  };
  const moveX = fit(left, right, m.left, box.clientWidth - m.right);
  const moveY = fit(top, bottom, m.top, box.clientHeight - m.bottom);
  if (moveX || moveY) map.panBy(Math.round(moveX), Math.round(moveY));
}

// ───────── 알림 ─────────
function showToast(message) {
  const toast = document.getElementById('map-toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(mapState.toastTimer);
  mapState.toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, TOAST_MS);
}

function setMapMessage(text, { retry = false } = {}) {
  const box = document.getElementById('map-message');
  box.hidden = text === null;
  if (text !== null) document.getElementById('map-message-text').textContent = text;
  document.getElementById('map-retry').hidden = !retry;
}

// ───────── 보여 주는 글자 ─────────
// 말풍선은 좁아서 format.won, format.area보다 짧게 적는다.

// 지도에 먼저 보이는 면적. 조건에 맞는 면적 가운데 평균가가 가장 낮은 것이 areas의 첫째다 (API 명세서 A-05).
const firstArea = (apartment) => apartment.areas[0];

// 말풍선 위 띠. "111㎡", 공급면적을 모르면 "전용 49㎡". 평이면 "34평", "전용 15평"
function markerAreaText(area, unit) {
  const known = area.supply_area !== null && area.supply_area !== undefined;
  const value = known ? area.supply_area : area.exclusive_area;
  // ㎡일 때 공급면적은 반올림, 전용면적은 버림이다 (format.js의 area와 같다)
  const squareMeter = known ? `${Math.round(value)}㎡` : format.exclusive(value);
  const text = unit === 'pyeong' ? `${format.pyeong(value)}평` : squareMeter;
  return known ? text : `전용 ${text}`;
}

// 말풍선 아래 줄. "실 3.0억". 금액 표기는 format.short를 쓴다.
const markerPriceText = (won) => `실 ${format.short(won)}`;

// 내 조건 줄. "5년 뒤 목표 가능 가격 3억 6,667만 원까지"
function conditionSentence(targetYears, targetPrice) {
  const when = TARGET_YEAR_TEXT[targetYears] ?? `${targetYears}년 뒤`;
  return `${when} 목표 가능 가격 ${format.won(targetPrice)}까지`;
}

// ───────── 그리기 ─────────
function renderCondition() {
  const input = store.get('input');
  const sentence = document.getElementById('condition-sentence');
  sentence.textContent = mapState.data ? conditionSentence(input.target_years, mapState.data.target_price) : '';
}

// 아래 창 30%의 기준 줄. "5년 뒤 기준", 목표 기간이 '지금'이면 "지금 기준".
// 대출 없이 계산이면 "5년 뒤 기준 · 대출 없이" (와이어프레임 "P-06 아파트 30% (대출 없이)")
function basisText() {
  const input = store.get('input');
  const when = TARGET_YEAR_TEXT[input.target_years] ?? `${input.target_years}년 뒤`;
  return input.loan_choice === 'none' ? `${when} 기준 · 대출 없이` : `${when} 기준`;
}

// 지역 버튼의 글자. "서구 치평동", 구 전체면 "서구 전체"
function renderRegionName() {
  const { gu, dong } = mapState.region;
  // 구 표시 수준이어도 구를 골라 그 구 전체에 맞춘 것이면 그 구를 그대로 보여 준다
  const allGu = mapState.mode === 'gu' && !(mapState.focus && mapState.focus.gu === gu && !mapState.focus.dong);
  const name = allGu ? ALL_GU_NAME : dong ? `${gu} ${dong}` : `${gu} 전체`;
  document.getElementById('region-name').textContent = name;
  // 경계 강조는 구·동을 골라 그 지역에 맞춰 옮겼을 때만 (mapState.focus). 손으로 옮기며 볼 때는 경계 선만 보인다
  const picked = mapState.focus && mapState.focus.gu === gu && (mapState.focus.dong || null) === (dong || null);
  mapBoundary.select(!allGu && picked ? { gu, dong } : null);
}

// 말풍선 B의 모양. Figma 부품 "말풍선 (아파트 표시)" 모양=B 단색의 벡터 경로(2034:40)를 그대로 옮겼다.
// 72 × 57. 몸통은 72 × 49(모서리 10), 꼬리 끝은 (8.5, 57)이고 그곳이 아파트의 자리다.
// 꼬리는 몸통 왼쪽 변이 꺾이지 않고 곡선으로 그대로 이어져 내려간다 (2026-10-19. 전에는 왼쪽 아래 모서리에서 한 번 꺾인 뒤 꼬리가 시작해 홈이 생겼다)
const MARKER_PATH =
  'M 10 0 L 62 0 C 67.523 0 72 4.477 72 10 L 72 39 C 72 44.523 67.523 49 62 49 ' +
  'L 19 49 C 14 49 10.5 51.5 8.5 57 C 6.5 51 0 49.5 0 42 L 0 10 C 0 4.477 4.477 0 10 0 Z';
const SVG_NS = 'http://www.w3.org/2000/svg';

function createMarkerShape() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'marker__shape');
  svg.setAttribute('width', '72');
  svg.setAttribute('height', '57');
  svg.setAttribute('viewBox', '0 0 72 57');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', MARKER_PATH);
  svg.append(path);
  return svg;
}

// 지도 위 표시(말풍선, 동·구 표시)를 눌렀을 때만 handler를 부른다.
// 표시 위를 잡고 끌면 지도가 움직이고(clickable: false), 손을 뗄 때 나는 click은 끈 것이라 넘긴다.
function onTap(element, handler) {
  let start = null;
  const tap = (event) => {
    mapState.tappedAt = Date.now();
    handler(event);
  };
  // 손가락·마우스: 누른 자리에서 떼면 누름. 지도가 터치를 가져가 click이 안 나는 휴대폰도 있어 pointerup으로 본다
  element.addEventListener('pointerdown', (event) => { start = { x: event.clientX, y: event.clientY }; });
  element.addEventListener('pointerup', (event) => {
    const moved = !start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_MOVE_PX;
    start = null;
    if (!moved) tap(event);
  });
  // 키보드(Enter, Space)로 누름. 이때는 detail이 0이다
  element.addEventListener('click', (event) => { if (event.detail === 0) tap(event); });
}

// 말풍선 하나 (button). 모양은 map.css의 .marker. 꼬리 끝이 아파트의 자리가 되도록 CSS가 옮긴다.
function createMarkerElement(apartment, unit, group = [apartment]) {
  const area = firstArea(apartment);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `marker marker--${apartment.category}`;
  button.dataset.id = apartment.id;

  const areaLabel = markerAreaText(area, unit);
  const priceLabel = markerPriceText(area.avg_price);
  button.setAttribute('aria-label', `${apartment.name}, ${areaLabel}, ${priceLabel}, ${CATEGORY_NAMES[apartment.category]}`);
  if (apartment.id === mapState.selectedId) button.classList.add('marker--selected');

  const areaText = document.createElement('span');
  areaText.className = 'marker__area';
  areaText.textContent = areaLabel;
  const priceText = document.createElement('span');
  priceText.className = 'marker__price';
  priceText.textContent = priceLabel;

  button.append(createMarkerShape(), areaText, priceText);
  if (group.length > 1) {
    // 이 말풍선 뒤에 가려진 아파트의 수
    const more = document.createElement('span');
    more.className = 'marker__more';
    more.textContent = `+${group.length - 1}`;
    button.append(more);
    button.setAttribute('aria-label', `${button.getAttribute('aria-label')}, 겹친 아파트 ${group.length - 1}곳 더`);
    onTap(button, () => openGroup(group));
    return button;
  }
  onTap(button, () => openApartment(apartment));
  return button;
}

const hasCoord = (apartment) =>
  apartment.latitude !== null && apartment.latitude !== undefined &&
  apartment.longitude !== null && apartment.longitude !== undefined;

// 아파트 말풍선을 지도에 올린다. 좌표가 없는 아파트는 건너뛴다 (FR-MAP-07, 목록에만 나온다).
function renderMarkers() {
  const { map, data } = mapState;
  if (!map || !data) return;
  mapState.markers.forEach((overlay) => overlay.setMap(null));
  mapState.markers = [];
  mapState.mode = markerMode();
  mapState.level = map.getLevel();
  renderRegionName();
  if ((mapState.mode === 'gu') !== Boolean(mapState.listCity)) renderList(); // 구 표시 수준을 드나들면 목록을 광주 전체 ↔ 지역으로
  if (mapState.mode === 'gu') {
    renderAreaMarkers('gu');
    return;
  }
  if (mapState.mode === 'dong') {
    renderAreaMarkers('dong');
    return;
  }

  const unit = store.get('map').area_unit || 'm2';
  mapState.markers = groupOverlapping(shownApartments()).map((group) => {
    const apartment = shownOf(group);
    const element = createMarkerElement(apartment, unit, group);
    // xAnchor, yAnchor를 0으로 두면 말풍선의 왼쪽 위가 아파트의 자리에 온다.
    // .marker의 transform이 꼬리 끝만큼 되돌려서, 꼬리 끝이 아파트의 자리에 온다.
    const overlay = new kakao.maps.CustomOverlay({
      position: toLatLng(apartment),
      content: element,
      xAnchor: 0,
      yAnchor: 0,
      zIndex: apartment.id === mapState.selectedId ? 3 : 2,
      clickable: false, // 말풍선 위를 잡고 끌어도 지도가 움직인다. 누름은 onTap이 가린다
    });
    overlay.setMap(map);
    overlay.apartmentId = apartment.id;
    return overlay;
  });
}

// ───────── 고른 동의 아파트 수 ─────────
// 지금은 화면에 달지 않는다 (2026-10-15 결정). 나중에 다시 쓰려고 함수와 모양(map.css의 .dong-label)을 남겨 둔다.
// 다시 쓸 때는 renderMarkers의 처음(`if (!map || !data) return;` 다음)에 renderFocusLabel()을 부른다.
// 숫자(focus.counts)는 loadData가 지금도 담아 둔다.
// 동을 골라 그 동에 맞춰 옮기면, 동 경계의 위쪽 가운데에 "치평동 / 9곳 가능 · 전체 12곳"을 단다 (말풍선을 가리지 않게).
// 숫자는 그 동으로 받은 A-05의 counts다 (가능 = 지금 가능 + 기간 내 가능, 동 표시의 숫자와 같다. 전체는 자금 부족도 센다).
// 고른 상태가 이어지는 동안(6 이하, 그 동 안) 달려 있고, 손으로 7 이상으로 넓히거나 다른 동으로 끌면 뗀다.
// 말풍선보다 아래(zIndex 1)에 둔다.
function renderFocusLabel() {
  const { focus, map } = mapState;
  // 숫자는 그 동으로 받은 때의 것(focus.counts)을 쓴다. 고른 동 안에서 더 확대해 영역으로 받아도 동의 숫자는 그대로다.
  // 조건이나 거르기가 바뀌었는데 아직 그 동으로 다시 받지 않았으면 숫자가 맞지 않으므로 달지 않는다.
  const show = focus && focus.kind === 'dong' && focus.counts && focus.countsKey === countsKey() &&
    markerMode() === 'apartment';
  const area = show ? mapBoundary.boundsOf(focus.gu, focus.dong) : null;
  if (!area) {
    if (mapState.focusLabel) mapState.focusLabel.setMap(null);
    return;
  }
  const { now, within, total } = focus.counts;
  const label = document.createElement('div');
  label.className = 'dong-label';
  label.setAttribute('role', 'status');
  const name = document.createElement('span');
  name.className = 'dong-label__name';
  name.textContent = focus.dong;
  const count = document.createElement('span');
  count.className = 'dong-label__count';
  count.textContent = `${format.comma(now + within)}곳 가능 · 전체 ${format.comma(total)}곳`;
  label.append(name, count);
  if (!mapState.focusLabel) {
    mapState.focusLabel = new kakao.maps.CustomOverlay({ xAnchor: 0.5, yAnchor: 1, zIndex: 1, clickable: false });
  }
  mapState.focusLabel.setContent(label);
  mapState.focusLabel.setPosition(new kakao.maps.LatLng(area.north, (area.west + area.east) / 2));
  mapState.focusLabel.setMap(map);
}

// ───────── 가까이 볼 때: 겹치는 말풍선 묶기 ─────────
// 말풍선끼리 많이 겹치면 맨 앞의 하나만 그리고 "+3"처럼 가려진 수를 적는다.
//   - 앞에 오는 순서는 서버가 준 순서다 (지금 가능 → 기간 내 가능 → 자금 부족). 고른 아파트는 늘 앞에 온다.
//   - 묶인 말풍선을 누르면 한 단계 확대해 풀어 준다.
//   - 같은 번지라 좌표가 똑같은 아파트는 확대해도 풀리지 않는다. 이때는 누를 때마다 다음 아파트를 앞으로 꺼낸다.

// 지도에 그릴 아파트. 좌표가 없으면 빼고, 자금 부족 표시를 껐으면 자금이 부족한 곳도 뺀다.
function shownApartments() {
  const showLack = store.get('map').show_lack === true;
  const list = mapState.data.apartments.filter(hasCoord).filter((a) => showLack || a.category !== 'lack');
  const selected = list.findIndex((a) => a.id === mapState.selectedId);
  if (selected > 0) list.unshift(...list.splice(selected, 1));
  return list;
}

// 꼬리 끝이 point에 있는 말풍선의 네모
const markerBox = (point) => ({
  left: point.x - MARKER_SIZE.tipX,
  top: point.y - MARKER_SIZE.tipY,
  right: point.x - MARKER_SIZE.tipX + MARKER_SIZE.width,
  bottom: point.y,
});

function overlapRatio(a, b) {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (width <= 0 || height <= 0) return 0;
  return (width * height) / (MARKER_SIZE.width * MARKER_SIZE.height);
}

// 화면에서 겹치는 아파트끼리 묶는다. [[아파트, 아파트, ...], ...]. 각 묶음의 첫째가 앞에 보이는 아파트다.
function groupOverlapping(apartments) {
  const projection = mapState.map.getProjection();
  const groups = [];
  for (const apartment of apartments) {
    const box = markerBox(projection.containerPointFromCoords(toLatLng(apartment)));
    const near = groups.find((group) => overlapRatio(group.box, box) > OVERLAP_RATIO);
    if (near) near.members.push(apartment);
    else groups.push({ box, members: [apartment] });
  }
  return groups.map((group) => group.members);
}

// 묶음 안의 차례는 아파트 번호 순으로 센다. 고른 아파트가 앞으로 와서 묶음의 순서가 바뀌어도 차례는 흔들리지 않는다.
const byId = (group) => [...group].sort((a, b) => a.id - b.id);
const groupKey = (group) => byId(group).map((a) => a.id).join(',');

// 묶음에서 앞에 보일 아파트. 누른 적이 없으면 첫째(서버가 준 순서의 맨 앞), 눌렀으면 그 차례의 아파트
function shownOf(group) {
  const turn = mapState.groupTurn[groupKey(group)];
  return turn === undefined ? group[0] : byId(group)[turn % group.length];
}

// 좌표가 모두 같은 묶음인가. 확대해도 풀리지 않는다.
const sameSpot = (group) =>
  group.every((a) => a.latitude === group[0].latitude && a.longitude === group[0].longitude);

// 묶인 말풍선을 눌렀을 때
function openGroup(group) {
  const { map } = mapState;
  const shown = shownOf(group);
  if (sameSpot(group) || map.getLevel() <= MIN_LEVEL) {
    // 더 풀 수 없으면 다음 아파트를 앞으로 꺼낸다. 끝까지 가면 처음으로 돌아온다.
    const ordered = byId(group);
    const next = (ordered.indexOf(shown) + 1) % ordered.length;
    mapState.groupTurn[groupKey(group)] = next;
    mapState.selectedId = ordered[next].id;
    renderMarkers();
    openApartment(ordered[next]); // 앞으로 나온 아파트의 아래 창 30%
    return;
  }
  mapState.selectedId = shown.id;
  quietZoom(700);
  map.setLevel(map.getLevel() - 1, { anchor: toLatLng(shown), animate: { duration: 300 } });
}

// ───────── 넓게 볼 때: 동 표시 (P-05 ③) ─────────
// 지도를 축소하면 말풍선이 서로 가려서, 동마다 표시 하나로 묶는다. "치평동 / 9곳"
// 숫자는 그 동에서 목표할 수 있는 아파트 수(지금 가능 + 기간 내 가능)다. 0곳이면 점선 테두리로 그린다.

// 확대 수준에 따라 그릴 표시. 가까이 보면 말풍선, 넓게 보면 동 표시, 더 넓게 보면 구 표시
// 고른 지역의 예외가 이 확대 수준에서도 이어지는가
//   동: 6 이하(말풍선)   구: 7 이상(구 표시)   구 표시 누름: 5 ~ 6(동 표시)
function focusHolds(level) {
  const { kind } = mapState.focus || {};
  if (kind === 'dong') return level <= DONG_FIT_MAX_LEVEL;
  if (kind === 'gu') return level >= GU_MARKER_LEVEL;
  if (kind === 'drill') return level >= DONG_MARKER_LEVEL && level < GU_MARKER_LEVEL;
  return false;
}

// 동을 골라 그 동만 보는 중인가 (확대 수준과 상관없이. 고른 상태는 focusHolds와 centerInFocus가 푼다)
const focusDong = () => Boolean(mapState.focus && mapState.focus.kind === 'dong');

// 고른 동의 아파트로 다시 받는다 (영역으로 받은 자료를 갖고 있을 때)
function reloadFocusDong() {
  const { focus } = mapState;
  useRegion();
  mapState.region = { gu: focus.gu, dong: focus.dong };
  store.set('map', { ...mapState.region });
  loadData();
}

// 지도 가운데가 고른 동의 경계 안인가. 경계를 모르면 안으로 본다
function centerInFocus() {
  const { focus, map } = mapState;
  if (!focus || !focus.dong) return true;
  const center = map.getCenter();
  const inside = mapBoundary.contains(focus.gu, focus.dong, center.getLat(), center.getLng());
  return inside !== false; // 경계를 모르면(null) 안으로 본다
}

// 고른 동의 예외(5 ~ 6에 그 동의 수만)가 풀렸을 때, 지도 가운데의 구 전체를 받아 동 표시로 그린다.
// 말풍선이 사라지므로 열린 아파트 창은 닫는다 (onZoomChanged와 같다)
function leaveToDongMarkers() {
  if (sheet.mode === 'apartment') {
    selectMarker(null);
    sheet.close();
  }
  const near = nearestDong();
  useRegion();
  mapState.region = { gu: near ? near.gu : mapState.region.gu, dong: null };
  store.set('map', { ...mapState.region });
  loadData();
}

function markerMode() {
  const level = mapState.map ? mapState.map.getLevel() : DONG_LEVEL;
  // 고른 동 전체에 맞춰 6까지 줄였으면 그 동의 말풍선을 그대로 보여 준다
  const { focus } = mapState;
  if (focus && focus.kind === 'dong' && level <= DONG_FIT_MAX_LEVEL) return 'apartment';
  if (level >= GU_MARKER_LEVEL) return 'gu';
  return level >= DONG_MARKER_LEVEL ? 'dong' : 'apartment';
}

// 동 표시와 구 표시의 요소. 동그라미 안에 이름과 숫자
function createAreaMarkerElement(group, name, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `${className}${group.target === 0 ? ' dong-marker--empty' : ''}`;
  button.setAttribute('aria-label', `${name}, 목표할 수 있는 아파트 ${group.target}곳`);
  const nameText = document.createElement('span');
  nameText.className = 'dong-marker__name';
  nameText.textContent = name;
  const count = document.createElement('span');
  count.className = 'dong-marker__count';
  count.textContent = format.comma(group.target); // 숫자만 크게 적는다. "곳"은 읽어 주는 글(aria-label)에만 둔다
  button.append(nameText, count);
  onTap(button, onClick);
  return button;
}

// ───────── 동 표시와 구 표시의 수 (A-12) ─────────
// 동마다, 구마다의 수는 구별·동별 개수 API(A-12)가 준다. 자리도 함께 온다 (A-02와 같은 자리).
//   - 동 표시: 5개 구의 모든 동을 한 번에 받는다. 지도를 옆 구로 옮겨도 동 표시가 보인다.
//   - 구 표시: 구 5개를 한 번에 받는다.
//   - 입력한 값과 조건 창의 조건이 같은 동안에는 한 번 받은 것을 다시 받지 않는다. 바뀌면 resetSummary로 비운다.
// mapState.summary[level]: null(아직 안 받음), 'loading'(받는 중), 배열(받음)

// A-12의 한 줄을 표시가 쓰는 모양으로. { gu, dong, target, total, latitude, longitude }
const toAreaGroup = (region) => ({
  gu: region.gu,
  dong: region.dong,
  target: region.target_count,
  total: region.counts.total,
  latitude: region.latitude,
  longitude: region.longitude,
});

// 입력한 값이나 조건 창의 조건이 바뀌면 받아 둔 수를 버린다. 다음에 넓게 볼 때 다시 받는다.
function resetSummary() {
  mapState.summary = { dong: null, gu: null };
}

// level('dong' 또는 'gu')의 수를 받아 둔다. 받는 동안에는 표시가 없다가, 오면 그린다.
async function loadSummary(level) {
  mapState.summary[level] = 'loading';
  try {
    const data = await api.post('/api/regions/summary', withFilters({ conditions: guard.conditions(), level }));
    mapState.summary[level] = data.regions.map(toAreaGroup);
  } catch (error) {
    mapState.summary[level] = null; // 다음에 넓게 볼 때 다시 받는다
    showToast(error.status === 422 ? error.detail : MSG.dataFail);
    return;
  }
  if (mapState.mode === level) renderMarkers();
}

// 동 표시(level 'dong')나 구 표시(level 'gu')를 그린다. 누르면 그 지역으로 확대한다 (FR-MAP-21).
// 동 표시는 확대한 뒤 그 동의 목록을 30%로 올린다 (P-06 ④).
function renderAreaMarkers(level) {
  const groups = mapState.summary[level];
  if (groups === null) loadSummary(level);
  if (!Array.isArray(groups)) return;
  const gu = level === 'gu';
  const shown = groups.filter(hasCoord);
  const places = gu ? spreadGuMarkers(shown) : null; // 구 표시는 고정 자리 (GU_MARKER_PLACES)
  mapState.markers = shown.map((group, i) => {
    const overlay = new kakao.maps.CustomOverlay({
      position: places ? places[i] : toLatLng(group),
      content: createAreaMarkerElement(
        group,
        gu ? group.gu : group.dong,
        gu ? 'dong-marker dong-marker--gu' : 'dong-marker',
        () => (gu ? zoomToRegion({ gu: group.gu, dong: null }) : openDong({ gu: group.gu, dong: group.dong })),
      ),
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: 2,
      clickable: false, // 말풍선과 같다 (onTap)
    });
    overlay.setMap(mapState.map);
    overlay.group = group;
    return overlay;
  });
}

// 구 표시의 자리는 고정 좌표다 (2026-10-20 팀장 결정). 데이터 · 조건 · 화면 크기 · 불러오는 순서와 상관없이 늘 같은 자리에 뜬다.
// 예전에는 열 때마다 아파트 좌표 평균에서 시작해 경계 안에서 서로 벌려 정했는데, 경계 자료가 오기 전과 후,
// 지역 목록(A-02)이 오기 전과 후에 결과가 달라 구 표시가 매번 다른 자리에 떴다.
// 아래 좌표는 그 벌리기 계산을 경계 자료가 다 온 뒤 수준 9(가장 넓게)에서 돌린 결과다 (남구 보정 포함).
//   - 다섯 곳 모두 자기 구의 경계 안이다
//   - 수준 9에서 원(56 × 56) 사이가 76px 이상이라 겹치지 않는다. 더 가까이 보면(8, 7) 사이가 2배, 4배로 넓어진다
// 자리를 바꾸려면 이 좌표만 고친다. 표에 없는 구는 받은 구 표시의 좌표에 둔다
const GU_MARKER_FAR_LEVEL = 9; // 이 수준부터 원을 56 × 56으로 줄인다 (new-style.css의 .map--far)
const GU_MARKER_PLACES = {
  광산구: { latitude: 35.177639, longitude: 126.816271 },
  남구: { latitude: 35.109735, longitude: 126.902413 },
  동구: { latitude: 35.14193, longitude: 126.938803 },
  북구: { latitude: 35.186966, longitude: 126.898463 },
  서구: { latitude: 35.149398, longitude: 126.86313 },
};

function spreadGuMarkers(groups) {
  const far = mapState.map.getLevel() >= GU_MARKER_FAR_LEVEL;
  document.getElementById('kakao-map').classList.toggle('map--far', far);
  return groups.map((g) => toLatLng(GU_MARKER_PLACES[g.gu] || g));
}

// 구 표시를 보는 채로 확대·축소하면 원 크기(.map--far)를 다시 맞춘다. 자리는 고정이라 그대로다
function respreadGuMarkers() {
  if (mapState.mode !== 'gu' || !mapState.markers.length || !mapState.markers[0].group) return;
  const places = spreadGuMarkers(mapState.markers.map((overlay) => overlay.group));
  mapState.markers.forEach((overlay, i) => overlay.setPosition(places[i]));
}

// ───────── 더 넓게 볼 때: 구 표시 (P-05 ⑪) ─────────
// 동 표시도 서로 겹칠 만큼 넓게 보면 구마다 표시 하나로 묶는다. "광산구 / 216"
// 숫자는 그 구에서 목표할 수 있는 아파트 수(지금 가능 + 기간 내 가능)다. 누르면 동 표시와 똑같이 그 구로 확대한다.

// 지도 가운데에서 가장 가까운 구. 구 표시를 보다가 손으로 확대했을 때 어느 구를 보여 줄지 정한다.
function nearestGu() {
  const center = mapState.map.getCenter();
  let best = null;
  for (const region of mapState.regions.filter(hasCoord)) {
    const distance = (region.latitude - center.getLat()) ** 2 + (region.longitude - center.getLng()) ** 2;
    if (best === null || distance < best.distance) best = { gu: region.gu, distance };
  }
  return best ? best.gu : mapState.region.gu;
}

// 확대 수준이 바뀌어 그릴 표시(말풍선, 동, 구)가 달라질 때 다시 그린다.
function onZoomChanged() {
  if (!mapState.data) return;
  // 손으로 확대·축소했는가. 코드가 한 것(지역 이동, 동 표시 누름, 묶음 풀기)은 스스로 자료를 받는다.
  const byHand = Date.now() >= mapState.quietUntil;
  // 손으로 확대·축소해 고른 단계를 벗어나면 예외를 풀고 원래 규칙으로 그린다.
  // 고른 단계 안에서 움직이면(동을 고른 뒤 더 확대 등) 그대로 둔다. 그래야 동을 고른 뒤 확대해도 동 표시로 바뀌지 않는다
  if (byHand && mapState.focus && !focusHolds(mapState.map.getLevel())) mapState.focus = null;
  const next = markerMode();
  const before = mapState.mode;
  if (next === before) {
    // 말풍선을 보는 채로 확대·축소하면 보이는 영역이 달라진다
    if (next === 'apartment' && byHand) scheduleBoundsLoad();
    if (next === 'gu') respreadGuMarkers(); // 구 표시끼리의 화면 거리가 달라진다
    return;
  }

  // 동 표시나 구 표시를 보다가 손으로 확대해 말풍선 수준이 되면, 보이는 영역의 아파트를 받는다.
  if (next === 'apartment' && byHand) {
    renderMarkers();
    scheduleBoundsLoad();
    return;
  }

  // 말풍선이 사라지는 수준으로 넓게 보면 열려 있는 아파트 창을 닫는다 (고른 말풍선이 없어진다). 목록은 그대로 둔다.
  if (next !== 'apartment' && sheet.mode === 'apartment') {
    selectMarker(null);
    sheet.close();
  }

  // 구 표시를 보다가 손으로 가까이 가면, 지도 가운데에서 가장 가까운 구의 아파트를 받아 보여 준다.
  // 코드가 옮긴 것(구·동 선택, 구 표시 누름)은 고른 지역이 있으므로 바꾸지 않는다.
  if (before === 'gu' && byHand) {
    const gu = nearestGu();
    if (gu !== mapState.region.gu || mapState.region.dong !== null) {
      mapState.byBounds = false;
      mapState.region = { gu, dong: null };
      store.set('map', { ...mapState.region });
      mapState.mode = next;
      loadData();
      return;
    }
  }
  // 동 하나를 보다가 넓게 보면 그 구 전체의 아파트를 받아 동 표시를 그린다. 지역 버튼도 "○○구 전체"로 바뀐다.
  if (next !== 'apartment' && mapState.region.dong !== null) {
    mapState.byBounds = false; // 넓게 볼 때는 구 단위로 받는다
    mapState.region = { gu: mapState.region.gu, dong: null };
    store.set('map', { ...mapState.region });
    if (next === 'dong') {
      mapState.mode = next;
      loadData();
      return;
    }
  }
  renderMarkers();
}

// 고른 말풍선은 1.2배로 커지고 다른 말풍선 위로 올라온다. id가 null이면 고른 것을 푼다.
// 말풍선을 누르면 openApartment가 이것을 부르고 아래 창 30%(P-06 ⑥)를 연다.
function selectMarker(id) {
  mapState.selectedId = id;
  // 고른 아파트가 묶음 뒤에 가려져 있으면 다시 그려 앞으로 꺼낸다 (shownApartments가 고른 아파트를 앞에 둔다)
  const hidden = id !== null && mapState.mode === 'apartment' && !mapState.markers.some((overlay) => overlay.apartmentId === id);
  if (hidden && mapState.data && mapState.data.apartments.some((a) => a.id === id && hasCoord(a))) renderMarkers();
  // 카카오맵은 화면 밖의 말풍선을 문서에서 떼어 둔다. 문서에서 찾지 않고 말풍선마다 바꿔야
  // 화면 밖의 아파트를 고른 뒤 그리로 옮겼을 때도 골라진 모양으로 나온다 (비슷한 아파트, ‹ ›)
  mapState.markers.forEach((overlay) => {
    const element = overlay.getContent();
    if (element && element.classList.contains('marker')) element.classList.toggle('marker--selected', overlay.apartmentId === id);
    overlay.setZIndex(overlay.apartmentId === id ? 3 : 2);
  });
  drawFacilityLink(); // 고른 아파트가 바뀌거나 풀리면 점선도 바뀐다
}

// ───────── 아래 창 ─────────

// 지금 지도에 말풍선이 보이는 아파트인가. 좌표가 있고, 자금 부족 표시가 꺼져 있으면 자금 부족이 아닌 것.
// shownApartments()와 같은 기준이다 (말풍선의 구분 = apartment.category).
const isOnMap = (apartment) =>
  hasCoord(apartment) && (store.get('map').show_lack === true || apartment.category !== 'lack');

// ‹ › 로 넘길 아파트. 지금 지도에 보이는 아파트를 목록의 기본 순서(A-05 응답의 순서)로 (FR-MAP-16).
// 지금 보고 있는 아파트가 지도에 없으면(좌표 없음 등) 그 자리에 끼워 둔다. 그래야 앞뒤로 넘어갈 수 있다.
const sheetOrder = (current) =>
  mapState.data ? mapState.data.apartments.filter((apartment) => apartment === current || isOnMap(apartment)) : [];

// 목록의 머리와 "← ○○ 목록"에 쓰는 지역 이름. 동을 보고 있으면 동, 구 전체면 구
const listPlace = () => {
  if (mapState.byBounds) return '보이는 곳';
  return mapState.region ? mapState.region.dong || mapState.region.gu : '';
};

// 목록 (P-06 ⑤). 그리기는 김목산의 list.js. A-05 응답을 받을 때마다 부른다.
function renderList() {
  if (!mapState.data) return;
  mapState.listCity = mapState.mode === 'gu';
  if (mapState.listCity) {
    renderCityList();
    return;
  }
  listView.render(document.getElementById('apt-list'), visibleData(), {
    where: mapState.byBounds ? { gu: BOUNDS_NAME } : mapState.region, // 머리의 이름. "지도에 보이는 곳 · 31곳"
    sort: currentSort(),
    onSort: changeSort,
    onSelect: openApartmentFromList,
    onClose: () => sheet.close(),
    ...(currentFilters() ? { onResetFilters: () => applyFilters(null), onChangeFilters: () => openFilters() } : {}),
  });
}

// ───────── 구 표시 수준의 목록: 광주 전체 (2026-10-20) ─────────
// 지도를 구 표시 수준으로 넓게 보면 목록에 광주 5개 구 전체의 아파트를 보인다 (A-05 where.all).
// 지도의 표시와 자료(mapState.data)는 그대로 두고 목록만 따로 받는다. 같은 조건 · 정렬이면 받아 둔 것을 쓴다.
// 목록에서 아파트를 고르면 이름 검색에서 고른 것처럼 그 동으로 옮겨 연다 (onSearchPick).
const CITY_NAME = '광주 전체';

async function renderCityList() {
  const list = document.getElementById('apt-list');
  const key = requestKey();
  const options = {
    where: { gu: CITY_NAME },
    sort: currentSort(),
    onSort: changeSort,
    onSelect: (apartment) => onSearchPick(apartment),
    onClose: () => sheet.close(),
    ...(currentFilters() ? { onResetFilters: () => applyFilters(null), onChangeFilters: () => openFilters() } : {}),
  };
  if (mapState.city && mapState.city.key === key) {
    listView.render(list, mapState.city.data, options);
    return;
  }
  const mine = ++mapState.citySeq;
  listView.renderLoading(list, { where: options.where, onClose: options.onClose });
  let data;
  try {
    data = await api.post('/api/apartments/search', withFilters({ conditions: guard.conditions(), where: { all: true }, sort: currentSort() }));
  } catch (error) {
    if (mine !== mapState.citySeq || !mapState.listCity) return;
    listView.renderError(list, { message: error.status === 422 ? error.detail : MSG.dataFail, onRetry: renderCityList, onClose: options.onClose });
    return;
  }
  if (mine !== mapState.citySeq || !mapState.listCity) return; // 그사이 다시 받았거나 구 표시 수준을 벗어났다
  mapState.city = { key, data };
  listView.render(list, data, options);
}

// ───────── 조건 창 (P-05 ②) ─────────
// 창은 김목산의 filter.js가 그린다. 여기서는 열고, 고른 조건을 보관하고, 그 조건으로 다시 받는다.

// 칩 줄. '조건 ▾' 버튼 하나와, 넣은 조건만 "면적 59~84㎡ ✕"처럼 칩으로 (2026-10-14 팀에서 정함).
// 칩의 글자를 누르면 그 항목으로 내려간 조건 창이 열리고, ✕를 누르면 그 조건만 푼다.
const FILTER_KEYS = { area: ['area_min', 'area_max'], price: ['price_min', 'price_max'], year: ['built_year_min', 'built_year_max'] };
const LACK_TAG = '자금 부족 표시';

function renderChips() {
  const filters = currentFilters();
  const unit = store.get('map').area_unit || 'm2';
  const showLack = store.get('map').show_lack === true;
  const tags = [];
  Object.keys(FILTER_KEYS).forEach((key) => {
    const label = filters ? filterSheet.label(filters, key, unit) : null;
    if (label) tags.push(filterTag(label, () => openFilters(key), () => removeFilter(key)));
  });
  if (showLack) tags.push(filterTag(LACK_TAG, () => openFilters('lack'), () => applyFilters(currentFilters(), { showLack: false })));
  document.getElementById('filter-tags').replaceChildren(...tags);
  document.getElementById('filter-open').classList.toggle('filter-chip--on', tags.length > 0);
}

// 넣은 조건 칩 하나. 글자 버튼과 ✕ 버튼
function filterTag(text, onOpen, onRemove) {
  const tag = document.createElement('span');
  tag.className = 'filter-chip filter-chip--on filter-tag';
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'filter-tag__text';
  open.textContent = text;
  open.addEventListener('click', onOpen);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'filter-tag__remove';
  remove.textContent = '✕';
  remove.setAttribute('aria-label', `${text} 조건 풀기`);
  remove.addEventListener('click', onRemove);
  tag.append(open, remove);
  return tag;
}

// 한 항목의 조건만 푼다
function removeFilter(key) {
  const next = { ...(currentFilters() || {}) };
  FILTER_KEYS[key].forEach((name) => { next[name] = null; });
  applyFilters(next);
}

// 조건 창을 연다. focus는 그 항목으로 내려가 열릴 칩('area', 'price', 'year', 'lack'). 지역 선택 창이 열려 있으면 닫는다.
// 조건 창 맨 위에 지역(구·동)도 있다 (2026-10-18 새 스타일). 지역을 바꾸고 '적용'을 누르면 그 지역으로 옮긴다
function openFilters(focus) {
  regionPicker.close();
  const options = { showLack: store.get('map').show_lack === true, regions: mapState.regions, region: mapState.region };
  if (focus) options.focus = focus;
  filterSheet.open(document.getElementById('filter-sheet'), currentFilters(), applyFilters, options);
}

// 조건을 적용한다 (null이면 초기화). 새로 고쳐도 남도록 store에 둔다.
// 면적·가격·준공 연도가 바뀌었으면 아파트와 동·구의 수를 다시 받는다.
// extra.showLack이 있으면 자금 부족 표시도 바꾼다. 서버에 보내는 조건이 아니라 다시 받지 않고 다시 그리기만 한다.
function applyFilters(filters, extra = {}) {
  const before = JSON.stringify(currentFilters());
  store.set('map', { filters: filters && !filterSheet.isEmpty(filters) ? filters : null });
  if (typeof extra.showLack === 'boolean' && extra.showLack !== (store.get('map').show_lack === true)) {
    store.set('map', { show_lack: extra.showLack });
    renderLackSwitch();
    renderMarkers(); // 보이는 아파트가 달라져 겹침도 달라진다
    aptPanel.render(); // ‹ › 로 넘길 아파트가 바뀐다
  }
  renderChips();
  if (extra.region) {
    // 지역을 바꿨으면 옮기면서 새 조건으로 한 번만 받는다
    if (JSON.stringify(currentFilters()) !== before) resetSummary();
    moveToRegion(extra.region);
    return;
  }
  if (JSON.stringify(currentFilters()) === before) return;
  resetSummary();
  loadData();
}

// ───────── 시나리오의 "다시 계산" (FR-RESULT-06, 와이어프레임 A3) ─────────
// 시나리오 탭(박채은의 scenario.js)에서 월 저축액이나 목표 기간을 바꿔 다시 계산하면 'mth:plan-changed'로 알려 준다.
// 바꾼 값을 입력(저축 계획)에 반영하고, 지도와 목록의 구분, 내 조건 줄, 동·구의 수를 다시 받는다.
// 로그인했으면 바꾼 저축 계획을 DB에도 저장하고 알린다. 로그인하지 않았으면 알림 없이 브라우저에만 둔다 (와이어프레임 A3).
// 저장은 화면을 바꾼 뒤에 하고, 실패해도 화면을 되돌리지 않는다 (화면 설계서 7장의 4).
async function onPlanChanged(event) {
  const { monthly_saving: saving, target_years: years } = event.detail || {};
  if (!Number.isInteger(saving) || !Number.isInteger(years)) return;
  store.set('input', { monthly_saving: saving, target_years: years });
  resetSummary();
  await loadData();
  try {
    const saved = await account.save('/api/profile/plan', { monthly_saving: saving, target_years: years });
    if (saved) showToast(MSG.planSaved);
  } catch (error) {
    showToast(error.status === 422 ? error.detail : MSG.planSaveFail);
  }
}

// 내 조건 줄의 "로그인" (P-05 ①). 로그인했으면 "로그아웃"이 되고, 누르면 로그아웃한다.
async function renderLoginLink() {
  const link = document.getElementById('login-link');
  const loginId = await account.me();
  link.textContent = loginId ? '로그아웃' : '로그인';
  link.dataset.loggedIn = String(Boolean(loginId));
}

async function onLoginLink(event) {
  if (event.currentTarget.dataset.loggedIn !== 'true') return; // 로그인 화면으로 간다 (href)
  event.preventDefault();
  await account.logout();
  renderLoginLink();
}

// 목록에서 정렬을 고름. 서버가 그 순서로 다시 준다 (FR-APT-07). 새로 고쳐도 고른 정렬이 남는다.
// 말풍선이 겹칠 때 앞에 오는 것과 ‹ › 로 넘어가는 순서도 이 순서를 따른다.
function changeSort(sort) {
  store.set('map', { sort });
  loadData();
}

// 동 표시를 누름 → 그 동으로 확대한다. 목록은 저절로 올리지 않는다 (2026-10-14에 정함).
// 확대가 끝난 뒤에 창을 올린다. 그사이 다른 곳으로 옮겼거나 다시 넓게 보고 있으면 올리지 않는다.
async function openDong({ gu, dong }) {
  const started = Date.now();
  await zoomToRegion({ gu, dong });
  const left = ZOOM_MS + 150 - (Date.now() - started);
  if (left > 0) await new Promise((resolve) => setTimeout(resolve, left));
  const same = mapState.region.gu === gu && mapState.region.dong === dong;
  if (!same || mapState.mode !== 'apartment' || !mapState.data) return;
  selectMarker(null); // 목록은 저절로 올리지 않는다. "목록" 버튼으로 연다
}

// 말풍선을 누름 → 아파트 30% (P-06 ⑥). 지도의 표시를 누르면 늘 30%로 연다 (화면 설계서 7.1).
function openApartment(apartment) {
  aptPanel.show(apartment, 0);
  selectMarker(apartment.id);
  sheet.show('30', 'apartment');
}

// 이름 검색의 결과를 누름 (P-05 ⑭, FR-MAP-08). apartment는 A-05 응답의 아파트 하나다.
//   - 보고 있는 지역을 그 아파트의 구·동으로 바꾸고 지도를 옮긴다. 그래야 그 아파트의 말풍선이 지도에 있다.
//   - 자금이 부족한 아파트면 자금 부족 표시를 켠다. 꺼 두면 찾은 아파트의 말풍선이 보이지 않는다.
//   - 그 아파트의 창을 30%로 연다. 좌표가 없으면 지도는 그대로 두고 창만 연다 (P-06 ⑱).
//   - 조건 창의 조건 때문에 그 아파트가 지도에 없으면(검색은 조건을 보지 않는다) 말풍선 없이 창만 연다.
async function onSearchPick(apartment) {
  regionPicker.close();
  filterSheet.close();
  if (apartment.category === 'lack' && store.get('map').show_lack !== true) {
    store.set('map', { show_lack: true });
    renderLackSwitch();
  }
  await moveToRegion({ gu: apartment.gu, dong: apartment.dong });
  const found = mapState.data && mapState.data.apartments.find((item) => item.id === apartment.id);
  if (found && hasCoord(found)) {
    openApartment(found);
    return;
  }
  aptPanel.show(found || apartment, 0);
  selectMarker(null);
  sheet.show('30', 'apartment');
}

// 비슷한 아파트의 카드를 누름 (apartment.js의 pickSimilar). 같은 동이든 다른 동이든 여기서 처리한다.
// apartment는 A-24 응답의 아파트, areaBand는 카드에 보이던 면적대다.
//   - 창은 닫지 않고 보던 단계 그대로 두고 그 아파트로 바꿔 보여 준다.
//   - 다른 동이면 그 동의 자료를 받는다. 동의 가운데로 먼저 옮기지 않는다 (지도가 두 번 움직이지 않게).
//     말풍선이 보이지 않을 만큼 넓게 보고 있을 때만 동을 보는 수준으로 맞춘다.
//   - 지도는 자료를 받은 뒤 한 번만 setCenter로 옮긴다 (창이 닫혔다 다시 열리지 않으므로 창 크기도 그대로다).
//   - 자금이 부족한 아파트면 자금 부족 표시를 켠다 (onSearchPick과 같다).
async function openSimilar(apartment, areaBand) {
  regionPicker.close();
  filterSheet.close();
  if (apartment.category === 'lack' && store.get('map').show_lack !== true) {
    store.set('map', { show_lack: true });
    renderLackSwitch();
  }
  const findIn = () => mapState.data && mapState.data.apartments.find((item) => item.id === apartment.id);
  let loaded = false;
  if (!findIn()) {
    useRegion();
    mapState.region = { gu: apartment.gu, dong: apartment.dong };
    store.set('map', { gu: apartment.gu, dong: apartment.dong });
    renderRegionName();
    if (markerMode() !== 'apartment') {
      quietZoom(500);
      mapState.map.setLevel(DONG_LEVEL);
    }
    mapState.keepSheet = true;
    try {
      await loadData();
    } finally {
      mapState.keepSheet = false;
    }
    loaded = true;
  }
  // 받는 사이에 창을 닫았으면 그대로 둔다
  if (sheet.mode !== 'apartment' || sheet.phase === 'closing' || sheet.phase === 'closed') return;
  const found = findIn();
  const shown = found || apartment;
  const areaIndex = Math.max(shown.areas.findIndex((area) => area.area_band === areaBand), 0);
  aptPanel.show(shown, areaIndex, { listPlace: aptPanel.listPlace ? listPlace() : aptPanel.listPlace });
  document.querySelector('.apt__panels').scrollTop = 0;
  const onMap = Boolean(found && hasCoord(found));
  selectMarker(onMap ? found.id : null);
  if (onMap) centerSelected(); // 한 번에 옮긴다 (setCenter)
  else if (loaded && regionCenter(mapState.region)) mapState.map.setCenter(toLatLng(regionCenter(mapState.region))); // 좌표가 없으면 그 동의 가운데
}

// 목록 보기 → 목록 80% (P-06 ⑤). 목록은 이미 그려 두었으므로 창만 연다.
function openList() {
  if (!mapState.data && !mapState.loadFailed) return; // 받지 못했으면 목록 자리에 오류와 "다시 시도"가 있다
  selectMarker(null);
  scrollListTop();
  sheet.show('80', 'list');
}

// 목록은 열 때마다 맨 위(첫 무리)부터 보여 준다 (2026-10-19). 앞에서 내려 둔 자리가 남지 않게
// 아파트 창에서 넘어올 때는 목록이 아직 숨겨져 있어 스크롤이 먹지 않으므로 보이게 된 다음 그림에서 한 번 더 한다
function scrollListTop() {
  const reset = () => {
    const list = document.getElementById('apt-list');
    if (list) list.scrollTop = 0;
  };
  reset();
  requestAnimationFrame(reset);
}

// 목록의 카드 → 아파트 80% (P-06 ⑦). 카드에서 보던 면적으로 연다.
// 좌표가 없는 아파트는 창만 열고 지도는 그대로 둔다 (P-06 ⑱).
function openApartmentFromList(apartment, areaIndex) {
  aptPanel.show(apartment, areaIndex, { listPlace: listPlace() });
  selectMarker(hasCoord(apartment) ? apartment.id : null);
  sheet.show('80', 'apartment');
}

// "← 치평동 목록". 목록은 이미 그려 두었으므로 다시 그리지 않는다. 목록 버튼과 같이 맨 위부터 보여 준다
function backToList() {
  selectMarker(null);
  scrollListTop();
  sheet.show('80', 'list');
}

// ‹ › 로 다른 아파트로 넘어감. 말풍선을 고르고 가운데로 부드럽게 옮긴다.
function moveToApartment(apartment) {
  selectMarker(hasCoord(apartment) ? apartment.id : null);
  centerSelected({ smooth: true });
}

// 고른 아파트 (좌표가 있을 때만). 없으면 null
function selectedApartment() {
  const { data, selectedId } = mapState;
  if (!data || selectedId === null) return null;
  const apartment = data.apartments.find((item) => item.id === selectedId);
  return apartment && hasCoord(apartment) ? apartment : null;
}

// 고른 아파트를 지도의 가운데에 둔다. 옮겼으면 true. 전체 단계에서는 지도가 가려지므로 하지 않는다.
function centerSelected({ smooth = false } = {}) {
  const apartment = selectedApartment();
  if (!mapState.map || !apartment) return false; // 전체 단계에서도 창 뒤의 지도 가운데에 둔다. 닫으면 그 자리가 보인다
  if (smooth) mapState.map.panTo(toLatLng(apartment));
  else mapState.map.setCenter(toLatLng(apartment));
  return true;
}

// 창이 움직이는 동안(올라오기, 단계 바꾸기): 고른 아파트를 창이 다 움직인 뒤 남을 자리의 가운데로 부드럽게 옮긴다.
// 이때 지도는 움직임 전후 가운데 넓은 쪽 크기라서, 그 자리가 지도 안에 있다 (sheet.js).
// 전체 단계로 가면 지도가 가려지므로 옮기지 않는다.
function panToRemaining() {
  const { map } = mapState;
  const apartment = selectedApartment();
  if (!map || !apartment) return;
  const box = document.getElementById('kakao-map');
  const areaHeight = document.querySelector('.map-area').clientHeight;
  // 전체 단계면 지도가 창 뒤에 다 있으므로 지도의 가운데. 그 밖에는 창을 뺀 남은 영역의 가운데
  const targetY = sheet.stage === 'full' ? box.clientHeight / 2 : (areaHeight - sheet.targetHeight()) / 2;
  const point = map.getProjection().containerPointFromCoords(toLatLng(apartment));
  map.panBy(point.x - box.clientWidth / 2, point.y - targetY);
}

// 지도의 크기가 바뀌었으면(sheet.css) 카카오맵에 알린다. 바뀌었으면 true.
// 창이 다 움직였으면 고른 아파트를 가운데에 둔다 (이미 그 자리에 와 있어서 튀지 않는다).
// 그 밖에는 지도의 그림이 화면에서 움직이지 않게 둔다.
// (카카오맵은 relayout()을 해도 왼쪽 위가 그대로 있어서 그림이 움직이지 않는다. 2026-10-15에 실제 지도로 확인.
//  예전에는 가운데가 그대로라고 보고 크기 차이의 절반만큼 되돌렸는데, 그 때문에 창을 닫을 때마다 지도가 위로 튀었다.)
function fitMapToSheet() {
  const { map } = mapState;
  if (!map) return false;
  const box = document.getElementById('kakao-map');
  const before = mapState.mapHeight || box.clientHeight;
  const after = box.clientHeight;
  if (after === before) return false;
  map.relayout();
  mapState.mapHeight = after;
  const settled = sheet.phase === 'open' && !sheet.moving;
  if (settled) centerSelected();
  renderScale();
  return true;
}

// 닫기 시작한 창이 80%나 전체의 아파트 창이고 고른 말풍선이 있는가.
// 30%에서 닫을 때는 지도가 보이던 그대로라서 지금처럼 푼다. 지도를 눌러 닫으면 closeOverlays가 먼저 푼다.
function keepOnClose() {
  return sheet.mode === 'apartment' && (sheet.stage === '80' || sheet.stage === 'full') && selectedApartment() !== null;
}

// 아래 창의 상태가 바뀔 때 (sheet.js가 움직임의 처음과 끝에 부른다)
//   지도의 크기가 바뀌었으면 맞추고, 움직이는 중이면 고른 아파트를 남을 자리의 가운데로 옮긴다.
//   크기도 그대로이고 움직이지도 않으면(열린 채 다른 말풍선을 누름) 그 아파트로 부드럽게 옮긴다.
//   닫기 시작하면 고른 말풍선을 푼다. 다만 아파트 창을 80%나 전체로 보다가 닫으면
//   그 아파트를 지도의 가운데로 옮기고 골라진 채로 둔다 (keepOnClose). 그때는 지도가 거의 가려져 있어서
//   닫은 뒤에야 지도를 보므로, 어느 말풍선을 보고 있었는지 알 수 있게 한다. 지도를 누르거나 끌면 풀린다.
function onSheetChange() {
  if (sheet.phase === 'closed') return;
  if (sheet.phase === 'closing') {
    const keep = keepOnClose();
    const drop = !keep || mapState.dropOnClose; // ✕로 닫았으면 옮긴 뒤 푼다
    mapState.dropOnClose = false;
    fitMapToSheet(); // 닫히는 동안 지도는 화면을 다 쓴다
    if (keep) centerSelected(); // 바로 옮긴다. 실제 카카오맵의 panTo는 이미 화면 안에 있는 곳으로는 움직이지 않았다 (2026-10-15 확인)
    if (drop) selectMarker(null);
    mapState.facilityFit = false;
    drawFacilityLink(); // 닫히면 점선을 뗀다
    return;
  }
  const resized = fitMapToSheet();
  if (sheet.moving) panToRemaining();
  else if (takeFacilityFit()) {
    // 주변 시설 줄을 눌러 30%로 내려왔다. 아파트와 그 시설이 둘 다 보이게 맞췄다
  } else if (!resized) centerSelected({ smooth: true });
  drawFacilityLink(); // 30%가 되면 잇고, 80% 이상이 되면 뗀다
}

// A-05를 새로 받은 뒤 열려 있는 아파트 창을 새 응답에 맞춘다.
// 새 응답에 같은 아파트가 있으면 그것으로 바꿔 보여 주고, 없으면(다른 지역으로 옮김) 창을 닫는다.
function syncApartmentSheet() {
  // 닫히는 중이면 건드리지 않는다. 다시 고르면 닫힌 뒤에도 말풍선이 고른 채로 남는다.
  if (sheet.mode !== 'apartment' || sheet.phase === 'closing' || !aptPanel.apartment) return;
  const same = mapState.data.apartments.find((item) => item.id === aptPanel.apartment.id);
  if (!same) {
    // 지도를 움직여 보던 아파트가 화면 밖으로 나갔으면 창은 그대로 둔다. 다른 지역을 고른 것이면 닫는다.
    if (!mapState.byBounds && !mapState.keepSheet) sheet.close();
    return;
  }
  // aptPanel.show는 아파트 정보 탭으로 돌아간다. 보던 탭에 머물도록 값만 바꿔 다시 그린다.
  aptPanel.apartment = same;
  if (aptPanel.areaIndex >= same.areas.length) aptPanel.areaIndex = 0;
  if (aptPanel.listPlace) aptPanel.listPlace = listPlace();
  aptPanel.render();
  selectMarker(hasCoord(same) ? same.id : null);
}

function renderUnitButton() {
  const pyeong = store.get('map').area_unit === 'pyeong';
  document.getElementById('unit-main').textContent = pyeong ? '평' : '㎡';
  document.getElementById('unit-sub').textContent = pyeong ? '㎡' : '평';
}

function renderLackSwitch() {
  const show = store.get('map').show_lack === true; // 처음에는 꺼 둔다 (2026-10-13에 정함). 켜야 자금이 부족한 아파트가 보인다
  document.getElementById('map').classList.toggle('map--hide-lack', !show);
  renderChips(); // 켜져 있으면 "자금 부족 표시 ✕" 칩이 뜬다. 켜고 끄는 곳은 조건 창이다
}

function renderLegend() {
  const open = store.get('map').legend_open !== false; // 처음부터 펼쳐 둔다
  document.getElementById('legend-toggle').setAttribute('aria-expanded', String(open));
  document.getElementById('legend-list').hidden = !open;
}

// ───────── 동작 ─────────
function bindEvents() {
  // ㎡/평 전환 (2차). 표시, 목록, 아파트 창에 함께 적용된다.
  document.getElementById('unit-button').addEventListener('click', () => {
    const next = store.get('map').area_unit === 'pyeong' ? 'm2' : 'pyeong';
    store.set('map', { area_unit: next });
    renderUnitButton();
    renderMarkers();
    renderChips(); // 면적 조건의 글자가 ㎡와 평으로 바뀐다
    aptPanel.render();
  });

  // 범례 접고 펴기
  document.getElementById('legend-toggle').addEventListener('click', () => {
    store.set('map', { legend_open: store.get('map').legend_open === false });
    renderLegend();
  });

  // 현재 위치 (FR-MAP-24). 지도가 뜬 뒤에만 동작한다.
  document.getElementById('locate-button').addEventListener('click', () => {
    if (mapState.map) moveToMyLocation();
  });

  // 확대·축소 (FR-MAP-25)
  document.getElementById('zoom-in').addEventListener('click', () => {
    if (mapState.map) mapState.map.setLevel(mapState.map.getLevel() - 1, { animate: true });
  });
  document.getElementById('zoom-out').addEventListener('click', () => {
    if (mapState.map) mapState.map.setLevel(mapState.map.getLevel() + 1, { animate: true });
  });

  // 지도를 불러오지 못했을 때 다시 시도
  document.getElementById('map-retry').addEventListener('click', startKakaoMap);

  // 안내 아이콘. 누르면 뜨고 바깥을 누르면 닫힌다. PC에서는 마우스를 올려도 뜬다 (와이어프레임 B5).
  const infoButton = document.getElementById('info-button');
  const infoText = document.getElementById('info-text');
  const setInfo = (open) => {
    infoText.hidden = !open;
    infoButton.setAttribute('aria-expanded', String(open));
  };
  // 누르면 늘 연다. 휴대폰은 누를 때 mouseenter, mouseleave도 흉내 내어 일으키므로
  // 마우스를 올렸을 때의 동작은 진짜 마우스(pointerType 'mouse')일 때만 한다.
  infoButton.addEventListener('click', (event) => {
    event.stopPropagation();
    setInfo(true);
  });
  infoButton.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') setInfo(true);
  });
  infoButton.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') setInfo(false);
  });
  document.addEventListener('click', (event) => {
    if (!infoText.hidden && !infoText.contains(event.target)) setInfo(false);
  });

  // 검색창 오른쪽의 조건 아이콘 → 조건 창 (P-05 ②). 구·동 선택(P-05 ⑬)도 이 창 맨 위에 있다 (2026-10-18 새 스타일).
  // 열려 있으면 닫는다. 넣은 조건 칩의 동작은 renderChips()에 있다
  document.getElementById('filter-open').addEventListener('click', () => {
    if (filterSheet.isOpen()) filterSheet.close();
    else openFilters();
  });

  // 아파트 이름 검색 (P-05 ⑭). 결과는 js/search.js가 #search-results에 그린다.
  searchView.open(document.getElementById('search-results'), onSearchPick);

  // 지도 위에 뜬 창(아래 창, 조건, 지역 선택)은 그 밖을 누르면 닫힌다. 닫기를 누르지 않아도 된다.
  //   지도를 누름: 카카오맵의 click (끌기 뒤에는 나지 않고, 말풍선을 누를 때도 나지 않는다)
  //   그 밖의 빈 곳을 누름: 버튼, 링크, 입력란, 창 안을 누른 것은 빼고
  document.addEventListener('click', (event) => {
    if (event.target.closest('button, a, input, label, #kakao-map, #sheet, #filter-sheet, #region-sheet, #search-results')) return;
    closeOverlays();
  });

  // 내 조건 줄의 로그인·로그아웃
  document.getElementById('login-link').addEventListener('click', onLoginLink);

  // 시나리오 탭의 "다시 계산"
  document.addEventListener('mth:plan-changed', onPlanChanged);

  // 목록 보기 → 아래 창 80%에 목록 (P-06 ⑤)
  document.getElementById('list-button').addEventListener('click', openList);

  // 아래 창
  sheet.onChange(onSheetChange);
  aptPanel.init({
    order: sheetOrder,
    basis: basisText,
    onMove: moveToApartment,
    onPickSimilar: openSimilar, // 비슷한 아파트의 카드 (similar.js). 지도에 없는 아파트면 그 구·동의 자료를 받아 보던 단계 그대로 연다
    onBackToList: backToList,
    // ✕로 닫으면 지도는 그 아파트로 옮기되 말풍선은 푼다 (onSheetChange). 뒤로 가기·끌어 내리기로 닫으면 골라진 채로 둔다
    onClose: () => {
      mapState.dropOnClose = true;
      sheet.close();
    },
    onUnitChange: () => {
      renderUnitButton();
      renderMarkers();
    },
  });
}

// ───────── 자료 ─────────

// 보관해 둔 지역. 없거나 목록에 없는 지역이면 처음 지역(없으면 목록의 첫 구)으로 한다.
function restoreRegion() {
  const saved = store.get('map');
  const candidates = [{ gu: saved.gu, dong: saved.dong ?? null }, DEFAULT_REGION];
  for (const { gu, dong } of candidates) {
    const region = mapState.regions.find((item) => item.gu === gu);
    if (!region) continue;
    if (dong === null) return { gu, dong: null };
    if (region.dongs.some((item) => item.dong === dong)) return { gu, dong };
  }
  const first = mapState.regions[0];
  return first ? { gu: first.gu, dong: null } : { ...DEFAULT_REGION };
}

// 지역의 위치 (그 동이나 구의 아파트 좌표 평균, A-02). 좌표가 없으면 null
function regionCenter({ gu, dong }) {
  const region = mapState.regions.find((item) => item.gu === gu);
  const place = (region && dong && region.dongs.find((item) => item.dong === dong)) || region;
  return place && hasCoord(place) ? { latitude: place.latitude, longitude: place.longitude } : null;
}

// 목록의 정렬 (A-05의 sort). store의 map.sort에 둔다. 모르는 값이면 구분순이다.
const SORTS = ['category', 'price_asc', 'price_desc', 'area_desc', 'households_desc', 'newest'];
const currentSort = () => (SORTS.includes(store.get('map').sort) ? store.get('map').sort : 'category');

// 조건 창에서 고른 조건 (A-05, A-12의 filters). store의 map.filters에 둔다. 조건이 하나도 없으면 null
function currentFilters() {
  const filters = store.get('map').filters;
  return filters && !filterSheet.isEmpty(filters) ? filters : null;
}

// 서버에 보낼 조건. 없으면 filters를 아예 넣지 않는다.
const withFilters = (body) => (currentFilters() ? { ...body, filters: currentFilters() } : body);

// 지금 지역의 아파트를 받는다 (A-05). 조건은 입력한 값 그대로 보내고, 목록에서 고른 정렬과 조건 창의 조건을 함께 보낸다.
// 범위는 구·동이거나 지도에 보이는 영역이다 (currentWhere). 실패하면 앞의 자료를 그대로 두고 알린다.
// ───────── 지도를 움직이면 보이는 영역으로 다시 받기 (FR-MAP-22, A-05 bounds) ─────────
// 아파트를 받는 범위는 둘 중 하나다.
//   구·동        : 처음 열 때, 구·동을 골랐을 때, 동 표시나 구 표시를 눌렀을 때, 이름 검색에서 골랐을 때
//   보이는 영역  : 손으로 지도를 끌거나 확대·축소했을 때, 내 위치로 옮겼을 때 (mapState.byBounds)
// 영역으로 받는 것은 말풍선이 보이는 수준에서만 한다. 넓게 볼 때의 동·구 표시는 A-12가 따로 준다.
//
// 미리 받기: 서버에는 보이는 영역보다 넓게(위아래·좌우로 한 화면씩 더) 보낸다. 그래서 지도를 끌면 주변의 말풍선이 이미 있다.
//   - 보이는 영역이 받아 둔 영역 안에 여유 있게 있으면 다시 받지 않는다. 가장자리에 가까워지면 그때 새로 받는다.
//   - 구·동으로 받은 뒤에도 주변을 뒤에서 미리 받아 둔다 (mapState.preload). 처음 끌기 시작할 때 바로 그린다.
//   - 목록과 개수는 보이는 영역의 아파트만 센다 (visibleData). 말풍선은 받아 둔 것을 모두 그린다.
// 움직임이 멈추고 0.3초 뒤에 한 번만 받는다. 끄는 동안 계속 부르지 않는다.

const BOUNDS_WAIT = 300;
const BOUNDS_PAD = 1; // 보이는 영역의 위아래·좌우로 이만큼(화면의 배수) 더 받는다
const BOUNDS_MARGIN = 0.5; // 받아 둔 영역의 가장자리까지 이만큼(화면의 배수)도 남지 않으면 새로 받는다
const PRELOAD_WAIT = 1100; // 구·동으로 옮긴 뒤 지도의 움직임이 끝나기를 기다렸다가 주변을 미리 받는다
const BOUNDS_NAME = '지도에 보이는 곳'; // 영역으로 받았을 때 목록의 머리에 적는 이름

// 지도에 보이는 영역 { south, west, north, east }. 지도가 가려져 크기가 없으면 null
function mapBounds() {
  const { map } = mapState;
  if (!map) return null;
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const area = { south: sw.getLat(), west: sw.getLng(), north: ne.getLat(), east: ne.getLng() };
  return area.south < area.north && area.west < area.east ? area : null;
}

// 영역을 위아래·좌우로 넓힌다. ratio는 그 영역 크기의 배수
function growBounds(area, ratio) {
  const height = (area.north - area.south) * ratio;
  const width = (area.east - area.west) * ratio;
  return { south: area.south - height, west: area.west - width, north: area.north + height, east: area.east + width };
}

const containsBounds = (outer, inner) =>
  inner.south >= outer.south && inner.north <= outer.north && inner.west >= outer.west && inner.east <= outer.east;

const insideBounds = (area, apartment) =>
  hasCoord(apartment) && apartment.latitude >= area.south && apartment.latitude <= area.north &&
  apartment.longitude >= area.west && apartment.longitude <= area.east;

// 받아 둔 자료가 지금의 입력, 조건, 정렬로 받은 것인지 견주는 글자
const requestKey = () => JSON.stringify([guard.conditions(), currentFilters(), currentSort()]);
// 고른 동의 숫자가 달라지는 것(조건과 거르기). 정렬은 숫자를 바꾸지 않는다
const countsKey = () => JSON.stringify([guard.conditions(), currentFilters()]);

// 목록에 그릴 자료. 영역으로 받았으면 보이는 영역 안의 아파트만 남기고 개수를 다시 센다. 순서는 서버가 준 그대로다.
function visibleData() {
  const { data } = mapState;
  const view = mapState.byBounds ? mapBounds() : null;
  if (!data || !view) return data;
  const apartments = data.apartments.filter((apartment) => insideBounds(view, apartment));
  const counts = { now: 0, within: 0, lack: 0, total: apartments.length };
  apartments.forEach((apartment) => { counts[apartment.category] += 1; });
  return { ...data, apartments, counts };
}

// A-05의 where. 영역으로 받는 중이면 보이는 영역을 넓힌 것, 아니면 구·동 (영역을 알 수 없을 때도 구·동)
function currentWhere() {
  const view = mapState.byBounds ? mapBounds() : null;
  if (view) return { bounds: growBounds(view, BOUNDS_PAD) };
  const { gu, dong } = mapState.region;
  return dong ? { gu, dong } : { gu };
}

// 지도 가운데에서 가장 가까운 동 { gu, dong }. 지역 버튼의 글자에 쓴다 (화면 설계서 6.2). 없으면 null
function nearestDong() {
  const center = mapState.map.getCenter();
  let best = null;
  for (const region of mapState.regions) {
    for (const item of region.dongs.filter(hasCoord)) {
      const distance = (item.latitude - center.getLat()) ** 2 + (item.longitude - center.getLng()) ** 2;
      if (best === null || distance < best.distance) best = { gu: region.gu, dong: item.dong, distance };
    }
  }
  return best ? { gu: best.gu, dong: best.dong } : null;
}

// 지금부터 ms 동안의 확대·축소는 코드가 한 것으로 본다.
function quietZoom(ms) {
  mapState.quietUntil = Date.now() + ms;
}

// 구·동으로 받는 쪽으로 돌아간다. 기다리던 영역 받기는 그만둔다.
function useRegion() {
  mapState.byBounds = false;
  mapState.loadedBounds = null;
  mapState.preload = null;
  clearTimeout(mapState.boundsTimer);
}

// 구·동으로 받은 뒤, 지금 보이는 곳의 주변을 뒤에서 미리 받아 둔다. 실패해도 알리지 않는다 (끌 때 다시 받는다).
function preloadAround() {
  const mine = mapState.loadSeq;
  setTimeout(async () => {
    const view = mapBounds();
    if (mine !== mapState.loadSeq || mapState.byBounds || markerMode() !== 'apartment' || !view) return;
    const bounds = growBounds(view, BOUNDS_PAD);
    const key = requestKey();
    try {
      const data = await api.post('/api/apartments/search', withFilters({ conditions: guard.conditions(), where: { bounds }, sort: currentSort() }));
      if (mine === mapState.loadSeq && !mapState.byBounds) mapState.preload = { bounds, data, key };
    } catch (error) {
      // 미리 받기는 없어도 된다
    }
  }, PRELOAD_WAIT);
}

// 지도를 끌기 시작할 때: 미리 받아 둔 주변이 있으면 바로 그린다. 고른 아파트는 그대로 둔다.
function adoptPreload() {
  const { preload } = mapState;
  if (focusDong() || mapState.byBounds || !preload || markerMode() !== 'apartment' || preload.key !== requestKey()) return;
  const selected = mapState.selectedId;
  mapState.byBounds = true;
  mapState.data = preload.data;
  mapState.loadedBounds = preload.bounds;
  mapState.preload = null;
  mapState.selectedId = preload.data.apartments.some((apartment) => apartment.id === selected) ? selected : null;
  renderMarkers();
}

// 움직임이 멈추면 보이는 영역의 아파트를 받는다.
function scheduleBoundsLoad(wait = BOUNDS_WAIT) {
  clearTimeout(mapState.boundsTimer);
  mapState.boundsTimer = setTimeout(loadByBounds, wait);
}

// 보이는 영역의 아파트를 받는다. 지역 버튼은 지도 가운데의 동 이름으로 바뀐다. 새로 고치면 그 동으로 돌아온다.
// 받아 둔 영역 안에 여유 있게 있으면 다시 받지 않고 목록만 보이는 곳에 맞춘다.
function loadByBounds() {
  const view = mapBounds();
  if (!mapState.map || !view) return;
  const { focus } = mapState;
  if (focus && focus.kind === 'dong' && !centerInFocus()) {
    // 고른 동 밖으로 끌었다. 고른 상태를 풀고 원래 규칙(5 ~ 6은 동 표시)으로 돌아간다
    mapState.focus = null;
    if (markerMode() !== 'apartment') {
      leaveToDongMarkers();
      return;
    }
  }
  // 말풍선 수준이 아니면(동·구 표시, 고른 동의 수만) 영역으로 받지 않는다
  if (markerMode() !== 'apartment') return;
  // 동을 고른 동안은 그 동 안에서 끌고 확대해도 그 동의 아파트만 보여 준다 (2026-10-15 결정).
  // 보이는 영역으로 받지 않는다. 받으면 이웃 동의 말풍선까지 나온다
  if (focusDong()) {
    if (mapState.byBounds) reloadFocusDong();
    return;
  }
  const near = nearestDong();
  if (near) {
    mapState.region = near;
    store.set('map', { ...near });
  }
  renderRegionName();
  const loaded = mapState.byBounds ? mapState.loadedBounds : null;
  if (loaded && containsBounds(loaded, growBounds(view, BOUNDS_MARGIN))) {
    renderList();
    return;
  }
  mapState.byBounds = true;
  loadData();
}

async function loadData() {
  const where = currentWhere();
  const mine = ++mapState.loadSeq;
  // 구·동을 새로 받을 때는 목록 자리에 불러오는 중 화면을 먼저 그린다 (김목산의 listView.renderLoading).
  // 지도를 끌어 영역으로 다시 받을 때는 그리지 않는다. 끌 때마다 목록이 깜빡이지 않게
  if (!mapState.byBounds || !mapState.data) {
    listView.renderLoading(document.getElementById('apt-list'), {
      where: mapState.byBounds ? { gu: BOUNDS_NAME } : mapState.region,
      onClose: () => sheet.close(),
    });
  }
  try {
    const data = await api.post('/api/apartments/search', withFilters({ conditions: guard.conditions(), where, sort: currentSort() }));
    if (mine !== mapState.loadSeq) return; // 그사이 다시 받기 시작했다. 늦게 온 이 응답은 버린다
    mapState.data = data;
    mapState.selectedId = null;
    mapState.loadFailed = false;
    mapState.loadedBounds = where.bounds || null;
    mapState.preload = null;
    const { focus } = mapState;
    if (focus && focus.kind === 'dong' && where.dong === focus.dong && where.gu === focus.gu) {
      focus.counts = data.counts; // 고른 동의 아파트 수 (renderFocusLabel)
      focus.countsKey = countsKey();
    }
    if (!where.bounds && !focusDong()) preloadAround(); // 고른 동은 이웃을 미리 받지 않는다
  } catch (error) {
    if (mine !== mapState.loadSeq) return;
    // 서버가 값을 거부했으면(422) 그 문장을, 아니면 불러오지 못했다는 문장을 보여 준다.
    const message = error.status === 422 ? error.detail : MSG.dataFail;
    showToast(message);
    // 목록 자리에는 오류와 "다시 시도"를 둔다 (김목산의 listView.renderError).
    // 앞의 자료로 목록을 다시 그리면 머리의 지역 이름과 아파트가 어긋난다. 지도의 말풍선은 앞의 것을 그대로 둔다.
    mapState.loadFailed = true;
    listView.renderError(document.getElementById('apt-list'), {
      message,
      onRetry: loadData,
      onClose: () => sheet.close(),
    });
    renderCondition();
    renderMarkers();
    return;
  }
  renderCondition();
  renderMarkers();
  // 아래 창: 목록은 받은 응답으로 다시 그리고, 열려 있는 아파트 창은 새 응답에 맞춘다.
  renderList();
  syncApartmentSheet();
}

// ───────── 고른 지역 전체를 한 화면에 (2026-10-15) ─────────

// 지도 위에 떠 있는 것(검색 줄, 조건 칩)에 가리지 않는 지도의 영역 { top, right, bottom, left } (px, #kakao-map 기준)
function viewPadding() {
  const box = document.getElementById('kakao-map').getBoundingClientRect();
  const chips = document.querySelector('.chip-row');
  const top = chips ? Math.max(0, chips.getBoundingClientRect().bottom - box.top) : 0;
  return { top: top + FIT_PAD, right: FIT_PAD, bottom: FIT_PAD, left: FIT_PAD };
}

// 그 지역 전체가 들어오는 확대 수준과, 경계의 가운데 { center, level, focus }. 경계 자료가 없으면 null.
//   focus: 지역의 가운데가 와야 할 화면의 점 (가려진 위쪽을 뺀 영역의 가운데)
//   maxLevel: 이보다 넓게 보지 않는다
// 맞출 범위 { south, west, north, east }. 동은 그 동의 경계, 구는 그 구에서 아파트가 있는 동들의 경계를 합친 범위
// (구·동 목록 A-02에 나오는 동만 아파트가 있다). 경계 자료가 없으면 null
function regionArea({ gu, dong }) {
  if (dong) return mapBoundary.boundsOf(gu, dong);
  const region = mapState.regions.find((item) => item.gu === gu);
  const boxes = (region ? region.dongs : []).map((item) => mapBoundary.boundsOf(gu, item.dong)).filter(Boolean);
  if (boxes.length === 0) return mapBoundary.boundsOf(gu, null); // 법정동이 아직 안 왔으면 구 경계 전체
  return {
    south: Math.min(...boxes.map((b) => b.south)),
    west: Math.min(...boxes.map((b) => b.west)),
    north: Math.max(...boxes.map((b) => b.north)),
    east: Math.max(...boxes.map((b) => b.east)),
  };
}

// 그 범위가 들어오는 확대 수준(levels 안에서)과 범위의 가운데 { center, level, focus }. 경계 자료가 없으면 null.
//   focus: 범위의 가운데가 와야 할 화면의 점 (가려진 위쪽을 뺀 영역의 가운데)
//   drill: 구 표시를 눌렀다 (구의 범위를 동 표시로 본다)
function regionFit(region, drill = false) {
  const area = regionArea(region);
  const { map } = mapState;
  if (!area || !map) return null;
  const [minLevel, maxLevel] = region.dong ? FIT_LEVELS.dong : drill ? FIT_LEVELS.drill : FIT_LEVELS.gu;
  const box = document.getElementById('kakao-map');
  const pad = viewPadding();
  const width = box.clientWidth - pad.left - pad.right;
  const height = box.clientHeight - pad.top - pad.bottom;
  if (width <= 0 || height <= 0) return null;
  const projection = map.getProjection();
  const sw = projection.containerPointFromCoords(new kakao.maps.LatLng(area.south, area.west));
  const ne = projection.containerPointFromCoords(new kakao.maps.LatLng(area.north, area.east));
  // 지금 수준에서의 범위 크기(px)가 쓸 수 있는 영역의 몇 배인가. 수준이 하나 올라가면 반으로 준다
  const ratio = Math.max(Math.abs(ne.x - sw.x) / width, Math.abs(sw.y - ne.y) / height);
  const needed = map.getLevel() + Math.ceil(Math.log2(Math.max(ratio, 1e-6)) - 1e-9);
  const level = Math.min(Math.max(needed, minLevel, MIN_LEVEL), maxLevel, MAX_LEVEL);
  const center = new kakao.maps.LatLng((area.south + area.north) / 2, (area.west + area.east) / 2);
  return { center, level, focus: { x: pad.left + width / 2, y: pad.top + height / 2 } };
}

// 지금 수준에서, 지역의 가운데(center)가 화면의 focus 점에 오게 하려면 지도 가운데에 둘 좌표
function centerFor(center, focus) {
  const { map } = mapState;
  const box = document.getElementById('kakao-map');
  const point = map.getProjection().containerPointFromCoords(center);
  return map.getProjection().coordsFromContainerPoint(
    new kakao.maps.Point(point.x - focus.x + box.clientWidth / 2, point.y - focus.y + box.clientHeight / 2),
  );
}

// 지도를 그 지역으로 옮긴다. 경계 자료가 있으면 그 지역 전체가 들어오게, 없으면 아파트 좌표의 평균으로 (예전과 같다).
// 구를 보는 화면 (구 표시를 누름, 조건 창에서 구 전체를 고름). 2026-10-18
// 구 경계 전체에 맞추면 산과 빈 땅까지 넣느라 동 표시가 듬성듬성하고 이웃 구의 동(남구 → 서구 풍암동)까지 들어온다.
// 그래서 동 표시 수준(FIT_LEVELS.drill의 넓은 쪽, 6)에서 한 화면에 그 구의 동이 가장 많이 들어오는 자리를 찾아,
// 그 동들의 가운데를 화면 가운데에 둔다. 수가 같으면 아파트가 더 많은 쪽. 동 좌표는 A-02의 동 아파트 좌표 평균이다.
// 돌려주는 모양은 regionFit과 같다 { center, level, focus }. 동 좌표가 없으면 null
const DENSE_MARGIN = 30; // 화면 가장자리에서 동 표시(원)가 잘리지 않게 이만큼 안쪽에만 둔다

function denseFit(gu) {
  const { map } = mapState;
  const region = mapState.regions.find((item) => item.gu === gu);
  const dongs = region ? region.dongs.filter(hasCoord) : [];
  if (!map || dongs.length === 0) return null;
  const level = FIT_LEVELS.drill[1];
  const box = document.getElementById('kakao-map');
  const pad = viewPadding();
  const areaWidth = box.clientWidth - pad.left - pad.right;
  const areaHeight = box.clientHeight - pad.top - pad.bottom;
  const width = areaWidth - DENSE_MARGIN * 2;
  const height = areaHeight - DENSE_MARGIN * 2;
  if (width <= 0 || height <= 0) return null;

  // 지금 수준의 화면 좌표를 그 수준(level)의 크기로 늘린다. 수준이 하나 내려가면 두 배다
  const projection = map.getProjection();
  const scale = 2 ** (map.getLevel() - level);
  const points = dongs.map((d) => {
    const p = projection.containerPointFromCoords(new kakao.maps.LatLng(d.latitude, d.longitude));
    return { x: p.x * scale, y: p.y * scale, count: d.apartment_count || 0 };
  });

  // 화면 크기의 창을 동 하나의 x(왼쪽 끝)와 동 하나의 y(위쪽 끝)에 맞춰 놓아 보며 가장 많이 담는 자리를 고른다
  let best = null;
  for (const left of points) {
    for (const top of points) {
      const inside = points.filter((p) => p.x >= left.x && p.x <= left.x + width && p.y >= top.y && p.y <= top.y + height);
      const apartments = inside.reduce((sum, p) => sum + p.count, 0);
      if (!best || inside.length > best.inside.length || (inside.length === best.inside.length && apartments > best.apartments)) {
        best = { inside, apartments };
      }
    }
  }
  const xs = best.inside.map((p) => p.x);
  const ys = best.inside.map((p) => p.y);
  const middle = new kakao.maps.Point(
    (Math.min(...xs) + Math.max(...xs)) / 2 / scale,
    (Math.min(...ys) + Math.max(...ys)) / 2 / scale,
  );
  return {
    center: projection.coordsFromContainerPoint(middle),
    level,
    focus: { x: pad.left + areaWidth / 2, y: pad.top + areaHeight / 2 },
  };
}

function panToRegion() {
  const { map } = mapState;
  if (!map) return;
  const { gu, dong } = mapState.region;
  // 구 전체면 그 구의 동이 한 화면에 가장 많이 들어오는 자리로 (denseFit). 고른 지역(목록, 경계 강조)은 구 전체 그대로다
  const fit = (!dong && denseFit(gu)) || regionFit(mapState.region);
  quietZoom(500);
  if (fit) {
    mapState.focus = { ...mapState.region, kind: dong ? 'dong' : 'gu' };
    map.setCenter(fit.center); // 가운데를 먼저 옮긴 뒤 확대 수준을 바꾼다 (바뀌는 동안에도 그 지역을 보고 있게)
    map.setLevel(fit.level);
    map.setCenter(centerFor(fit.center, fit.focus));
    return;
  }
  // 경계로 맞추지 못했으면 동의 예외는 풀고 원래 규칙으로. 구는 고른 구로 둔다 (지역 이름 "북구 전체")
  mapState.focus = dong ? null : { ...mapState.region, kind: 'gu' };
  const center = regionCenter(mapState.region);
  if (!center) return;
  map.setLevel(dong ? DONG_LEVEL : GU_LEVEL);
  map.setCenter(toLatLng(center));
}

// 구·동 선택에서 "이 지역으로 이동"을 눌렀을 때 (FR-APT-02)
async function moveToRegion({ gu, dong }) {
  useRegion();
  mapState.region = { gu, dong };
  store.set('map', { gu, dong });
  renderRegionName();
  panToRegion();
  await loadData();
}

// 지도 위에 뜬 창을 모두 닫는다 (지도나 빈 곳을 눌렀을 때)
function closeOverlays() {
  if (sheet.phase !== 'closed') {
    selectMarker(null);
    sheet.close();
  } else if (mapState.selectedId !== null) selectMarker(null); // 창을 닫은 뒤 남겨 둔 말풍선 (keepOnClose)
  filterSheet.close();
  regionPicker.close();
}

// 동 표시나 구 표시를 눌렀을 때: 그 지역이 화면 가운데로 오면서 함께 확대된다 (FR-MAP-21).
// 동이면 말풍선이 보이는 수준(5), 구면 동 표시가 보이는 수준(7)까지 간다.
// 확대가 끝나면 zoom_changed가 표시를 바꿔 그린다. 아파트는 확대하는 동안 받아 둔다.
async function zoomToRegion({ gu, dong }) {
  const drill = !dong; // 구 표시를 눌렀다
  // 구 표시를 누르면 그 구의 동이 한 화면에 가장 많이 들어오는 자리로 (denseFit). 동 좌표가 없으면 구 경계에 맞춘다
  const fit = (drill && denseFit(gu)) || regionFit({ gu, dong }, drill);
  const center = fit ? null : regionCenter({ gu, dong });
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ((!fit && !center) || still || (fit && fit.level >= mapState.map.getLevel())) {
    // 자리를 모르거나, 움직임을 줄이도록 설정했거나, 더 넓게 봐야 하면(확대가 아님) 바로 옮긴다
    if (fit && drill) {
      // 구 표시를 눌렀을 때는 동 표시(5 ~ 6)로 본다. moveToRegion은 구 표시(7 ~ 8)로 맞추므로 여기서 맞춘다
      useRegion();
      mapState.region = { gu, dong };
      store.set('map', { gu, dong });
      renderRegionName();
      quietZoom(500);
      mapState.focus = { gu, dong, kind: 'drill' };
      mapState.map.setCenter(fit.center);
      mapState.map.setLevel(fit.level);
      mapState.map.setCenter(centerFor(fit.center, fit.focus));
      await loadData();
      return;
    }
    await moveToRegion({ gu, dong });
    return;
  }
  useRegion();
  mapState.region = { gu, dong };
  store.set('map', { gu, dong });
  mapState.focus = fit ? { gu, dong, kind: dong ? 'dong' : 'drill' } : null;
  quietZoom(ZOOM_MS + 400);
  const { map } = mapState;
  const target = fit ? fit.center : toLatLng(center);
  // 경계가 없을 때: 동 표시를 누르면 말풍선(4), 구 표시를 누르면 동 표시(6)로 내려가 본다
  const level = fit ? fit.level : dong ? DONG_LEVEL : GU_MARKER_LEVEL - 1;
  const box = document.getElementById('kakao-map');
  // 지역이 와야 할 화면의 점. 경계로 맞출 때는 가려진 위쪽을 뺀 영역의 가운데, 아니면 화면 가운데
  const middle = fit ? fit.focus : { x: box.clientWidth / 2, y: box.clientHeight / 2 };
  const scale = 2 ** (map.getLevel() - level); // 확대되는 배율. 수준이 하나 내려가면 두 배다
  if (scale <= 1) {
    map.panTo(fit ? centerFor(target, middle) : target); // 이미 그 수준이면 옮기기만 한다
  } else {
    // 카카오맵은 "한 점을 붙잡고 확대"만 할 수 있다. 그래서 붙잡을 점을 계산한다.
    // 화면의 점 a를 붙잡고 scale배 확대하면, 화면의 점 p는 a + scale × (p − a)로 간다.
    // 그 지역(p)이 화면의 점 c로 가려면 a = (scale × p − c) ÷ (scale − 1)을 붙잡으면 된다.
    const projection = map.getProjection();
    const point = projection.containerPointFromCoords(target);
    const anchor = projection.coordsFromContainerPoint(
      new kakao.maps.Point((scale * point.x - middle.x) / (scale - 1), (scale * point.y - middle.y) / (scale - 1)),
    );
    map.setLevel(level, { anchor, animate: { duration: ZOOM_MS } });
    // 계산의 반올림으로 조금 어긋난 것을 끝난 뒤에 맞춘다.
    setTimeout(() => {
      if (mapState.region.gu === gu && mapState.region.dong === dong) map.panTo(fit ? centerFor(target, middle) : target);
    }, ZOOM_MS + 80);
  }
  await loadData();
}

// ───────── 시작 ─────────

// 카카오맵을 띄우고 보고 있는 지역으로 옮긴다.
// 실패하면 지도 자리에 안내와 "다시 시도"를 둔다 (P-05 ⑰). 목록을 전체 화면으로 바꾸는 것은 목록이 생긴 뒤에 한다.
async function startKakaoMap() {
  setMapMessage('지도를 불러오는 중입니다.');
  try {
    const key = await loadKakaoKey();
    await loadKakaoSdk(key);
    if (!mapState.map) mapState.map = createMap(regionCenter(mapState.region) || DEFAULT_CENTER);
    mapState.mapHeight = document.getElementById('kakao-map').clientHeight;
  } catch (error) {
    console.error('[map]', error.message); // 키 값은 찍지 않는다
    setMapMessage(MSG.mapFail, { retry: true });
    return;
  }
  setMapMessage(null);
  panToRegion();
  renderMarkers();
  renderScale();
  refitWhenBdongArrives();
}

// 새로 고쳤을 때 보관된 동이 있으면, 법정동 경계는 뒤에서 오므로 처음에는 예전 방식(아파트 좌표, 4)으로 옮겨진다.
// 법정동이 오면 그 동 전체에 다시 맞춘다. 그사이 사용자가 지도를 움직였거나 다른 지역을 골랐으면 그대로 둔다.
function refitWhenBdongArrives() {
  const { map, region } = mapState;
  if (!map || !region.dong || mapState.focus) return;
  const level = map.getLevel();
  const center = map.getCenter();
  mapBoundary.bdongReady().then((ok) => {
    const now = map.getCenter();
    const still = map.getLevel() === level && now.getLat() === center.getLat() && now.getLng() === center.getLng();
    if (!ok || !still || mapState.focus || mapState.region.gu !== region.gu || mapState.region.dong !== region.dong) return;
    panToRegion();
    renderMarkers();
  });
}

async function initMap() {
  // 계산에 필요한 입력이 빠졌으면 그 단계로 보낸다 (FR-RESULT-10).
  if (!guard.requireInput()) return;

  renderUnitButton();
  renderLackSwitch();
  renderChips();
  renderLoginLink();
  renderLegend();
  sheet.init();
  bindEvents();

  // 구와 동의 목록 (A-02). 못 받아도 처음 지역으로 아파트는 받아 본다.
  try {
    mapState.regions = (await api.get('/api/regions')).regions;
  } catch (error) {
    mapState.regions = [];
  }
  mapState.region = restoreRegion();
  renderRegionName();

  // 지도와 아파트를 함께 받는다. 어느 쪽이 먼저 와도 말풍선이 그려진다.
  startKakaoMap();
  loadData();
}

document.addEventListener('DOMContentLoaded', initMap);
