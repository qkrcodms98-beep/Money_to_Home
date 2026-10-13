// P-05 지도 화면. 담당: 안세환
//
// 지금 하는 일
//   - 카카오맵 JavaScript SDK로 지도를 띄운다. 키는 서버의 A-26(GET /api/config)에서 받는다.
//   - 아파트 찾기(A-05) 응답의 아파트를 말풍선으로 지도에 올린다 (카카오맵 CustomOverlay).
//     말풍선의 꼬리 끝이 아파트의 자리다. 좌표가 없는 아파트는 지도에 그리지 않는다 (FR-MAP-07, 목록에만 나온다).
//   - 현재 위치 버튼, 확대·축소 버튼, 축척을 지도에 붙인다 (FR-MAP-24, 25, 26).
//
// 자료
//   - 아파트는 A-05(POST /api/apartments/search)에서, 구와 동의 목록과 위치는 A-02(GET /api/regions)에서 받는다.
//   - 보고 있는 지역(구, 동)은 store의 'map' 묶음에 둔다. 새로 고쳐도 그 지역으로 돌아온다.
//   - 구·동 선택 창은 js/region.js(김해원)가 그린다.
//
// 지켜야 할 것 (CLAUDE.md, NFR-08, NFR-23)
//   - 화면에서 주소를 좌표로 바꾸지 않는다. SDK에 services 라이브러리를 불러오지 않는다.
//     좌표는 data/geocode.py가 DB에 넣은 값만 쓴다.
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
const DONG_LEVEL = 5; // 동 하나를 볼 때
const GU_LEVEL = 7; // 구 전체를 볼 때
// 이 수준부터(더 넓게 보면) 아파트 말풍선 대신 동마다 표시 하나를 그린다 (P-05 ③, FR-MAP-20).
// 와이어프레임에 "미정"으로 남아 있던 값이다. 동 하나(5)는 말풍선, 구 전체(7)는 동 표시가 되게 6으로 정했다.
const DONG_MARKER_LEVEL = 6;
const ZOOM_MS = 900; // 동 표시를 눌렀을 때 그 동으로 확대되는 시간
// 처음 보는 지역. 고른 적이 없을 때 쓴다. 목업의 지역과 같다.
const DEFAULT_REGION = { gu: '서구', dong: '치평동' };
const MIN_LEVEL = 1;
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
};
const TOAST_MS = 3000;

// 축척 막대. 목업은 64px에 200m다. 확대 수준에 따라 보기 좋은 거리를 고르고 막대 길이를 맞춘다.
const SCALE_BAR_PX = 64;
const SCALE_STEPS = [10, 20, 30, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 20000, 50000];

const CATEGORY_NAMES = { now: '지금 가능', within: '기간 내 가능', lack: '자금 부족' };
const TARGET_YEAR_TEXT = { 0: '지금', 3: '3년 뒤', 5: '5년 뒤', 10: '10년 뒤' };

const mapState = {
  data: null, // A-05 응답
  regions: [], // A-02 응답의 regions
  region: null, // 보고 있는 지역 { gu, dong }. dong이 null이면 구 전체
  selectedId: null,
  map: null, // kakao.maps.Map
  markers: [], // 아파트 말풍선 (kakao.maps.CustomOverlay)
  myLocation: null, // 내 위치 점 (kakao.maps.CustomOverlay). 저장하지 않는다
  toastTimer: null,
  wide: false, // 지금 동 표시를 그리고 있는가
};

// ───────── 카카오맵 불러오기 ─────────

// 서버에서 JavaScript 키를 받는다 (A-26). REST API 키는 화면에 오지 않는다.
async function loadKakaoKey() {
  const config = await api.get('/api/config');
  if (!config || !config.kakao_js_key) throw new Error('카카오 JavaScript 키가 없습니다.');
  return config.kakao_js_key;
}

// SDK를 불러온다. 지도 그림만 쓴다. libraries=services(주소 → 좌표)는 넣지 않는다.
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
  kakao.maps.event.addListener(map, 'zoom_changed', () => {
    renderScale();
    onZoomChanged();
  });
  kakao.maps.event.addListener(map, 'idle', () => {
    renderScale();
    hideKakaoScale();
  });
  hideKakaoScale();
  return map;
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
    mapState.map.panTo(toLatLng(position));
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
  const text = unit === 'pyeong' ? `${format.pyeong(value)}평` : `${Math.round(value)}㎡`;
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

// 지역 버튼의 글자. "서구 치평동", 구 전체면 "서구 전체"
function renderRegionName() {
  const { gu, dong } = mapState.region;
  document.getElementById('region-name').textContent = dong ? `${gu} ${dong}` : `${gu} 전체`;
}

// 말풍선 B의 모양. Figma 부품 "말풍선 (아파트 표시)" 모양=B 단색의 벡터 경로(2034:40)를 그대로 옮겼다.
// 72 × 57. 몸통은 72 × 49(모서리 10, 왼쪽 아래만 2), 꼬리 끝은 (8.5, 57)이고 그곳이 아파트의 자리다.
const MARKER_PATH =
  'M 10 0 L 62 0 C 67.523 0 72 4.477 72 10 L 72 39 C 72 44.523 67.523 49 62 49 ' +
  'L 15 49 L 8.5 57 L 2 49 C 0.895 49 0 48.105 0 47 L 0 10 C 0 4.477 4.477 0 10 0 Z';
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

// 말풍선 하나 (button). 모양은 map.css의 .marker. 꼬리 끝이 아파트의 자리가 되도록 CSS가 옮긴다.
function createMarkerElement(apartment, unit) {
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
  button.addEventListener('click', () => selectMarker(apartment.id));
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
  mapState.wide = isWide();
  if (mapState.wide) {
    renderDongMarkers();
    return;
  }

  const unit = store.get('map').area_unit || 'm2';
  mapState.markers = data.apartments.filter(hasCoord).map((apartment) => {
    // xAnchor, yAnchor를 0으로 두면 말풍선의 왼쪽 위가 아파트의 자리에 온다.
    // .marker의 transform이 꼬리 끝만큼 되돌려서, 꼬리 끝이 아파트의 자리에 온다.
    const overlay = new kakao.maps.CustomOverlay({
      position: toLatLng(apartment),
      content: createMarkerElement(apartment, unit),
      xAnchor: 0,
      yAnchor: 0,
      zIndex: apartment.id === mapState.selectedId ? 3 : 2,
      clickable: true, // 말풍선을 눌러도 지도가 클릭으로 받지 않는다
    });
    overlay.setMap(map);
    overlay.apartmentId = apartment.id;
    return overlay;
  });
}

// ───────── 넓게 볼 때: 동 표시 (P-05 ③) ─────────
// 지도를 축소하면 말풍선이 서로 가려서, 동마다 표시 하나로 묶는다. "치평동 / 9곳"
// 숫자는 그 동에서 목표할 수 있는 아파트 수(지금 가능 + 기간 내 가능)다. 0곳이면 점선 테두리로 그린다.

const isWide = () => Boolean(mapState.map) && mapState.map.getLevel() >= DONG_MARKER_LEVEL;

// 받은 아파트를 동으로 묶는다. [{ gu, dong, target, total, latitude, longitude }]
function groupByDong() {
  const groups = new Map();
  for (const apartment of mapState.data.apartments) {
    const key = `${apartment.gu} ${apartment.dong}`;
    if (!groups.has(key)) groups.set(key, { gu: apartment.gu, dong: apartment.dong, target: 0, total: 0, points: [] });
    const group = groups.get(key);
    group.total += 1;
    if (apartment.category !== 'lack') group.target += 1;
    if (hasCoord(apartment)) group.points.push(apartment);
  }
  return [...groups.values()].map((group) => {
    // 자리는 A-02가 준 그 동의 위치다. 없으면 받은 아파트 좌표의 평균으로 한다.
    const center = regionCenter(group) || (group.points.length ? {
      latitude: group.points.reduce((sum, a) => sum + a.latitude, 0) / group.points.length,
      longitude: group.points.reduce((sum, a) => sum + a.longitude, 0) / group.points.length,
    } : null);
    return { ...group, ...center };
  });
}

function createDongMarkerElement(group) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `dong-marker${group.target === 0 ? ' dong-marker--empty' : ''}`;
  button.setAttribute('aria-label', `${group.dong}, 목표할 수 있는 아파트 ${group.target}곳`);
  const name = document.createElement('span');
  name.className = 'dong-marker__name';
  name.textContent = group.dong;
  const count = document.createElement('span');
  count.className = 'dong-marker__count';
  count.textContent = `${format.comma(group.target)}곳`;
  button.append(name, count);
  // 누르면 그 동으로 확대한다 (FR-MAP-21). 30% 창은 아래 창을 만들 때 붙인다.
  button.addEventListener('click', () => zoomToDong({ gu: group.gu, dong: group.dong }));
  return button;
}

function renderDongMarkers() {
  mapState.markers = groupByDong().filter(hasCoord).map((group) => {
    const overlay = new kakao.maps.CustomOverlay({
      position: toLatLng(group),
      content: createDongMarkerElement(group),
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: 2,
      clickable: true,
    });
    overlay.setMap(mapState.map);
    return overlay;
  });
}

// 확대 수준이 바뀌어 말풍선과 동 표시가 서로 바뀔 때 다시 그린다.
// 동 하나를 보다가 넓게 보면 그 구 전체의 아파트를 받아 동 표시를 그린다. 지역 버튼도 "○○구 전체"로 바뀐다.
function onZoomChanged() {
  if (!mapState.data || isWide() === mapState.wide) return;
  if (isWide() && mapState.region.dong !== null) {
    mapState.region = { gu: mapState.region.gu, dong: null };
    store.set('map', { ...mapState.region });
    renderRegionName();
    loadData();
    return;
  }
  renderMarkers();
}

// 말풍선을 누르면 1.2배로 커지고 다른 말풍선 위로 올라온다. 30% 창(P-06 ⑥)은 아래 창을 만들 때 붙인다.
function selectMarker(id) {
  mapState.selectedId = id;
  document.querySelectorAll('#kakao-map .marker').forEach((el) => {
    el.classList.toggle('marker--selected', Number(el.dataset.id) === id);
  });
  mapState.markers.forEach((overlay) => overlay.setZIndex(overlay.apartmentId === id ? 3 : 2));
}

function renderUnitButton() {
  const pyeong = store.get('map').area_unit === 'pyeong';
  document.getElementById('unit-main').textContent = pyeong ? '평' : '㎡';
  document.getElementById('unit-sub').textContent = pyeong ? '㎡' : '평';
}

function renderLackSwitch() {
  const show = store.get('map').show_lack !== false; // 처음에는 켜 둔다
  document.getElementById('lack-switch').setAttribute('aria-checked', String(show));
  document.getElementById('map').classList.toggle('map--hide-lack', !show);
}

function renderLegend() {
  const open = store.get('map').legend_open !== false; // 처음부터 펼쳐 둔다
  document.getElementById('legend-toggle').setAttribute('aria-expanded', String(open));
  document.getElementById('legend-list').hidden = !open;
}

// ───────── 동작 ─────────
function bindEvents() {
  // 자금 부족 표시 끄고 켜기
  document.getElementById('lack-switch').addEventListener('click', () => {
    store.set('map', { show_lack: store.get('map').show_lack === false });
    renderLackSwitch();
  });

  // ㎡/평 전환 (2차). 표시, 목록, 아파트 창에 함께 적용된다.
  document.getElementById('unit-button').addEventListener('click', () => {
    const next = store.get('map').area_unit === 'pyeong' ? 'm2' : 'pyeong';
    store.set('map', { area_unit: next });
    renderUnitButton();
    renderMarkers();
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

  // 구·동 선택 (P-05 ⑬). 창은 js/region.js가 그린다.
  document.getElementById('region-button').addEventListener('click', () => {
    const sheet = document.getElementById('region-sheet');
    if (regionPicker.isOpen()) regionPicker.close();
    else regionPicker.open(sheet, mapState.regions, mapState.region, moveToRegion);
  });

  // 아직 만들지 않은 동작. 만들 때 여기에 붙인다.
  //   search-box     아파트 이름 검색, 2차 (P-05 ⑭)
  //   filter-chip    조건 창, 2차 (P-05 ②)
  //   list-button    아래 창의 목록 80% (P-06 ⑤)
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

// 지금 지역의 아파트를 받는다 (A-05). 조건은 입력한 값 그대로 보낸다. 1차에는 filters와 sort를 보내지 않는다.
// 실패하면 앞의 자료를 그대로 두고 알린다.
async function loadData() {
  const { gu, dong } = mapState.region;
  const where = dong ? { gu, dong } : { gu };
  try {
    mapState.data = await api.post('/api/apartments/search', { conditions: guard.conditions(), where });
    mapState.selectedId = null;
  } catch (error) {
    // 서버가 값을 거부했으면(422) 그 문장을, 아니면 불러오지 못했다는 문장을 보여 준다.
    showToast(error.status === 422 ? error.detail : MSG.dataFail);
  }
  renderCondition();
  renderMarkers();
}

// 지도를 그 지역으로 옮긴다. 좌표가 없는 지역이면 옮기지 않는다.
function panToRegion() {
  const center = regionCenter(mapState.region);
  if (!mapState.map || !center) return;
  mapState.map.setLevel(mapState.region.dong ? DONG_LEVEL : GU_LEVEL);
  mapState.map.setCenter(toLatLng(center));
}

// 구·동 선택에서 "이 지역으로 이동"을 눌렀을 때 (FR-APT-02)
async function moveToRegion({ gu, dong }) {
  mapState.region = { gu, dong };
  store.set('map', { gu, dong });
  renderRegionName();
  panToRegion();
  await loadData();
}

// 동 표시를 눌렀을 때: 그 동으로 천천히 확대한다 (FR-MAP-21).
// 누른 동의 자리를 붙잡고 확대한 뒤, 그 자리가 화면 가운데로 오도록 부드럽게 옮긴다.
// 확대가 끝나면 zoom_changed가 말풍선으로 바꿔 그린다. 아파트는 확대하는 동안 받아 둔다.
async function zoomToDong({ gu, dong }) {
  const center = regionCenter({ gu, dong });
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!center || still) {
    await moveToRegion({ gu, dong }); // 자리를 모르거나 움직임을 줄이도록 설정했으면 바로 옮긴다
    return;
  }
  mapState.region = { gu, dong };
  store.set('map', { gu, dong });
  renderRegionName();
  const target = toLatLng(center);
  mapState.map.setLevel(DONG_LEVEL, { anchor: target, animate: { duration: ZOOM_MS } });
  setTimeout(() => mapState.map.panTo(target), ZOOM_MS + 50);
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
  } catch (error) {
    console.error('[map]', error.message); // 키 값은 찍지 않는다
    setMapMessage(MSG.mapFail, { retry: true });
    return;
  }
  setMapMessage(null);
  panToRegion();
  renderMarkers();
  renderScale();
}

async function initMap() {
  // 계산에 필요한 입력이 빠졌으면 그 단계로 보낸다 (FR-RESULT-10).
  if (!guard.requireInput()) return;

  renderUnitButton();
  renderLackSwitch();
  renderLegend();
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
