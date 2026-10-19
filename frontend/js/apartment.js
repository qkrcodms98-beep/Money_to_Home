// 아래 창의 아파트 (P-06 ⑥ 30%, ⑦ 80%). 담당: 안세환
//
// 30%에 보이는 것 (guide_sehwan 4장, 와이어프레임 P-06 ⑥)
//   아파트명, 구분 배지, 이전·다음·닫기, 면적 고르기와 ㎡/평 전환,
//   "최근 1년 실거래 평균 3억 원", "5년 뒤 기준 여유 2,000만 원"
//   대출 없이 계산이면 기준 줄에 "· 대출 없이"를 붙인다 (와이어프레임 "P-06 아파트 30% (대출 없이)").
// 80% 이상에는 탭(아파트 정보, 시나리오)이 보인다.
//   아파트 정보 (P-06 ⑦): 아파트 한 곳 API(A-06, GET /api/apartments/{id})로 채운다.
//     창이 80% 이상이고 아파트 정보 탭이 보일 때 처음 한 번 부른다. 받은 것은 아파트마다 기억해 두고 다시 부르지 않는다.
//     여덟 줄: 지번 주소("농성동 654-34". 복사하면 "전남광주통합특별시 서구 농성동 654-34"), 도로명 주소, 준공 연도, 면적, 실거래 평균가, 최근 1년 거래(집계 기간), 세대수, 가격 범위.
//     순서는 목업 A9(4010:1111), C6(4022:1188)을 따른다. 1차 여섯 줄 뒤에 2차 두 줄을 붙인다.
//     세대수는 "1,234세대 (2026년 8월 기준)", 가격 범위는 "2억 7,000만 ~ 3억 3,000만 원" (FR-APT-15, 16).
//     값을 모르는 줄(도로명 주소, 준공 연도, 세대수가 비어 있음)은 그리지 않는다.
//   로드뷰 (3차, FR-MAP-09, 10, T-MAP-11. 목업 C6 4022:1205, C6b 4022:1356):
//     아파트 정보 탭을 전체로 올렸을 때만, 창 맨 위(손잡이 위)에 둔다. 그때 처음 불러온다.
//     창 폭 전체를 채우고 가로:세로는 황금비 1.618 : 1이다 (시안 ②, sheet.css).
//     그 아파트 둘레 100m 안의 가장 가까운 로드뷰를 카카오맵으로 찾는다 (서버 API 없음. API 명세서 3.5).
//     로드뷰가 없거나, 좌표가 없거나, 카카오맵을 쓸 수 없으면 같은 자리에 기본 이미지(집 그림과 문장)를 둔다.
//     자리(#apt-roadview)는 이 파일이 만들어 창(#sheet)의 손잡이 앞에 넣는다.
//   비슷한 아파트 (3차, FR-APT-17, T-APT-11. 목업 C6 4022:1301): 정보 줄 아래에 김목산의 similar.js가 그린다.
//     이 파일은 자리(#apt-similar)를 만들고 similarView.load를 부르기만 한다. 아파트·면적·조건이 그대로면 다시 부르지 않는다.
//     similar.js가 있으면 정보 줄 위에 "기본 정보" 제목을 붙인다 (C6. 묶음이 둘이 되므로).
//     카드를 누르면 그 아파트로 넘어간다. map-view.js가 넘겨준 handlers.onPickSimilar를 부른다
//     (없으면 지금 지도에 있는 아파트만 ‹ ›와 같이 넘긴다).
//     similar.js를 불러오지 않았으면 아무것도 하지 않는다.
//   주변 시설 (3차, FR-MAP-23, T-MAP-23. 와이어프레임 C6): 기본 정보와 비슷한 아파트 사이에 둔다.
//     지하철역, 학교, 대형마트, 편의점, 병원 다섯 줄(앞에 작은 그림). 학교 줄의 ⌄로 초·중·고·대학교를 펼친다. 줄마다 반경 1km 안에서 가장 가까운 곳의 이름과 직선거리.
//     지하철역은 가장 가까운 출구까지 ("김대중컨벤션센터역 광주1호선 5번 출구까지 330m"), 나머지는 "전남고등학교 130m".
//     1km 안에 없으면 "근처에 없음". 대학교만 5km 안. 병원은 동물병원을 뺀다. 수는 적지 않는다 (2026-10-19 세환 결정).
//     값은 A-06의 facilities다. data/load_facilities.py가 카카오 장소 검색으로 미리 받아 DB에 넣은 것이라 화면은 카카오를 부르지 않는다
//     (NFR-08, 2026-10-19 팀장 결정). 맨 아래에 받은 날을 적는다. 받은 값이 없거나 좌표가 없으면 묶음을 두지 않는다.
//   좌표가 없는 아파트 (P-06 ⑱, 목업 4009:492): 이름과 배지 옆에 "위치 없음"을 붙이고,
//     아파트 정보 탭의 맨 위에 점선 안내를 둔다. 목록에서 열었을 때만 생긴다 (지도에는 표시가 없다).
//   시나리오:    박채은의 scenario.js가 #scenario-panel에 그린다.
//
// 30%의 값은 모두 A-05 응답에 있다. 30%에서는 서버를 다시 부르지 않는다.
// 계산하지 않는다. 배지의 구분과 금액은 서버가 준 값이다 (NFR-13). 글자는 textContent로 넣는다.
// 부족자금(shortage)이 0보다 크면 "부족", 아니면 그 절댓값이 "여유"다 (API 명세서 A-05, list.js와 같은 규칙).
//
// 지도와 이어지는 일은 map-view.js가 init에 넘긴 함수로 한다.
//   aptPanel.init({
//     order(current)     ‹ › 로 넘길 아파트들. 지금 지도에 보이는 아파트를 목록의 순서로 (FR-MAP-16)
//     basis()            "5년 뒤 기준", "지금 기준 · 대출 없이" 같은 기준 줄
//     onMove(apartment)  ‹ › 로 다른 아파트로 넘어감
//     onBackToList()     "← 치평동 목록"
//     onClose()          닫기
//     onUnitChange()     ㎡/평을 바꿈. 지도의 말풍선과 단위 버튼도 함께 바뀐다
//   });
//   aptPanel.show(apartment, areaIndex, { listPlace: '치평동' })   listPlace가 있으면 목록에서 연 것이다

const APT_CATEGORY_NAMES = { now: '지금 가능', within: '기간 내 가능', lack: '자금 부족' };
// 불러오지 못했을 때. 지도 화면의 문장과 같다 (와이어프레임 P-04 ⑩). 아래에 "다시 시도"를 둔다 (P-05 ⑰과 같은 모양)
const APT_INFO_FAIL = '아파트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
// 좌표가 없는 아파트 (와이어프레임 P-06 ⑱의 문장 그대로)
const APT_NO_COORD = '위치 없음';
const APT_NO_COORD_NOTICE = '이 아파트는 위치 정보가 없어 지도에 표시하지 못했습니다. 지도는 그대로 두었습니다.';
// 로드뷰 (목업 C6, C6b)
const APT_ROADVIEW_RADIUS = 100; // 아파트 좌표에서 이 거리(m) 안의 가장 가까운 로드뷰를 쓴다
const APT_ROADVIEW_TILT = -20; // 처음 볼 때 위아래 각도. 카카오 로드뷰는 음수가 위다 (-90 ~ 90)
const APT_ROADVIEW_ZOOM = -3; // 처음 볼 때 확대. -3이 가장 넓게 보인다 (-3 ~ 3)
const APT_NO_ROADVIEW = '기본 이미지 (이 위치에는 로드뷰가 없습니다)'; // 목업 C6b의 문장 그대로
const APT_HOUSE_ICON = 'img/icon-house.svg'; // 목업 C6b의 "집 모양" (4022:1430)을 내보낸 것
const APT_INFO_TITLE = '기본 정보'; // 목업 C6 (4022:1279). 비슷한 아파트가 아래에 붙을 때만 둔다

// 주변 시설 (FR-MAP-23, 와이어프레임 C6). kind는 A-06 facilities의 kind
const APT_NEAR_TITLE = '주변 시설';
// icon: 줄 앞의 작은 그림 (24 × 24 SVG path. 직접 그린 단순한 모양)
const APT_NEAR_KINDS = [
  { kind: 'subway', label: '지하철역', icon: 'M8 2h8a4 4 0 0 1 4 4v9a3 3 0 0 1-3 3l2 3h-2.4l-2-3H9.4l-2 3H5l2-3a3 3 0 0 1-3-3V6a4 4 0 0 1 4-4zM6 6v4h12V6H6zm2 7.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z' },
  { kind: 'school', label: '학교', icon: 'M12 3l10 5-10 5L2 8l10-5zM6 11.2l6 3 6-3V16c0 1.9-2.7 4-6 4s-6-2.1-6-4v-4.8zM20 9.5h1.5V15H20V9.5z' },
  { kind: 'mart', label: '대형마트', icon: 'M2 3h3.2l.7 3H21l-2 8.5a2 2 0 0 1-2 1.5H9a2 2 0 0 1-2-1.5L4.2 5H2V3zm7 15a1.75 1.75 0 1 0 0 3.5A1.75 1.75 0 0 0 9 18zm8 0a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5z' },
  { kind: 'convenience', label: '편의점', icon: 'M4 3h16l1.5 5a3 3 0 0 1-2.5 3.2V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8.8A3 3 0 0 1 2.5 8L4 3zm3 10v6h4v-4h2v4h4v-6H7zm-1.2-8L4.6 8.4a1 1 0 0 0 1 1.1h12.8a1 1 0 0 0 1-1.1L18.2 5H5.8z' },
  { kind: 'hospital', label: '병원', icon: 'M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm4.5 4v3.5H7v3h3.5V17h3v-3.5H17v-3h-3.5V7h-3z' },
];
// 학교 줄의 ⌄를 누르면 펼치는 종류별 학교
const APT_NEAR_SCHOOLS = [
  { kind: 'elementary', label: '초등학교' },
  { kind: 'middle', label: '중학교' },
  { kind: 'high', label: '고등학교' },
  { kind: 'university', label: '대학교' },
];
const APT_NEAR_MORE = '학교 종류별로 보기';
const APT_NEAR_LESS = '학교 종류별 접기';
const APT_NEAR_NONE = '근처에 없음'; // 반경 안에 없을 때
const APT_NEAR_SOURCE = '카카오 장소 정보'; // 맨 아래 출처. 뒤에 받은 날과 "직선거리"를 붙인다

// 주변 시설 줄 앞의 작은 그림. 글자와 같은 색을 쓰고 화면 읽기에서는 건너뛴다
function aptNearIcon(path) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'apt-near__icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const shape = document.createElementNS(NS, 'path');
  shape.setAttribute('d', path);
  shape.setAttribute('fill-rule', 'evenodd');
  svg.append(shape);
  return svg;
}

// 직선거리(m)를 "383m", 1km부터는 "4.5km"로
function aptNearDistance(meters) {
  const value = Number(meters);
  return value < 1000 ? `${format.comma(value)}m` : `${(Math.round(value / 100) / 10).toLocaleString('ko-KR')}km`;
}

// "기본 정보" 제목 (목업 C6)
const aptInfoTitle = () => {
  const title = document.createElement('h3');
  title.className = 'apt-info__title';
  title.textContent = APT_INFO_TITLE;
  return title;
};

const aptHasCoord = (apartment) =>
  apartment.latitude !== null && apartment.latitude !== undefined &&
  apartment.longitude !== null && apartment.longitude !== undefined;

const aptPanel = {
  apartment: null,
  scenarioKey: null, // 시나리오 탭에 마지막으로 그린 아파트와 면적 ("번호:면적대")
  areaIndex: 0, // 고른 면적. areas는 평균가가 낮은 순이고 첫째가 처음에 골라져 있다 (FR-APT-05)
  listPlace: null,
  handlers: {},
  details: new Map(), // 아파트 번호 → A-06 응답. 받은 것만 둔다
  loading: new Set(), // 받는 중인 아파트 번호
  failed: new Set(), // 받지 못한 아파트 번호 ("다시 시도"를 누르면 지운다)
  roadview: null, // 카카오 로드뷰 (처음 보일 때 한 번 만든다)
  roadviewFor: null, // 로드뷰 자리에 마지막으로 그린 아파트 번호
  similarKey: null, // 비슷한 아파트를 마지막으로 부른 것 (아파트 번호, 면적대, 조건)

  init(handlers) {
    aptPanel.handlers = handlers;

    document.getElementById('apt-prev').addEventListener('click', () => aptPanel.move(-1));
    document.getElementById('apt-next').addEventListener('click', () => aptPanel.move(1));
    document.getElementById('apt-close').addEventListener('click', () => handlers.onClose());
    document.getElementById('apt-back').addEventListener('click', () => handlers.onBackToList());
    // 공유 아이콘 (FR-APT-18, 김목산의 share.js). 닫기 ✕ 앞에 두어 30% · 80% · 전체 어디서나 보인다
    if (typeof shareView !== 'undefined') {
      document.getElementById('apt-close').before(shareView.shareButton(() => {
        const { apartment } = aptPanel;
        const area = apartment.areas[aptPanel.areaIndex];
        return { id: apartment.id, name: apartment.name, area_band: area.area_band,
          supply_area: area.supply_area, exclusive_area: area.exclusive_area };
      }));
    }

    document.querySelectorAll('.apt__unit-option').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.unit === aptPanel.unit()) return;
        store.set('map', { area_unit: button.dataset.unit });
        handlers.onUnitChange();
        aptPanel.render();
      });
    });

    document.querySelectorAll('.apt__tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        aptPanel.selectTab(tab.id);
        aptPanel.renderInfo();
        aptPanel.renderRoadview();
      });
    });

    // 창이 80% 이상으로 커지면 아파트 정보 탭이 보인다. 그때 처음 부른다. 전체가 되면 로드뷰를 부른다.
    sheet.onChange(() => {
      aptPanel.renderInfo();
      aptPanel.renderRoadview();
    });
  },

  unit: () => (store.get('map').area_unit === 'pyeong' ? 'pyeong' : 'm2'),

  // 아파트를 보여 준다. 면적은 넘겨받은 것(목록 카드에서 보던 면적)을, 없으면 첫째를 고른다.
  show(apartment, areaIndex = 0, { listPlace = null } = {}) {
    aptPanel.apartment = apartment;
    aptPanel.areaIndex = areaIndex < apartment.areas.length ? areaIndex : 0;
    aptPanel.listPlace = listPlace;
    aptPanel.selectTab('apt-tab-info');
    aptPanel.render();
    aptPanel.scrollTop(); // 다른 아파트(또는 다시 연 아파트)는 늘 맨 위의 기본 상태에서 시작한다 (2026-10-19)
  },

  // 아파트 창의 내용을 맨 위로. 앞 아파트에서 내려 둔 자리가 다음 아파트에 남지 않게 한다
  // 창이 숨겨져 있거나 높이가 없으면(30%) 스크롤이 먹지 않는다. 그때는 sheet가 보이게 된 때 한다
  scrollTop() {
    sheet.scrollToTop(document.querySelector('.apt__panels'));
  },

  // ‹ › : 지도에 보이는 아파트를 목록의 순서로 넘긴다. 처음과 끝에서는 그 방향 버튼을 끈다.
  move(step) {
    const order = aptPanel.handlers.order(aptPanel.apartment);
    const next = order[order.indexOf(aptPanel.apartment) + step];
    if (!next) return;
    aptPanel.show(next, 0, { listPlace: aptPanel.listPlace });
    aptPanel.handlers.onMove(next);
  },

  selectTab(tabId) {
    // 탭을 바꾸면 그 탭의 맨 위부터 보여 준다 (아파트 정보 ↔ 시나리오)
    const changed = document.getElementById(tabId).getAttribute('aria-selected') !== 'true';
    if (changed) aptPanel.scrollTop();
    document.querySelectorAll('.apt__tab').forEach((tab) => {
      const selected = tab.id === tabId;
      tab.setAttribute('aria-selected', String(selected));
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
    });
    aptPanel.renderScenario();
  },

  // ───────── 시나리오 탭 (P-06 ⑧) ─────────
  // 내용은 박채은의 scenario.js가 그린다. 여기서는 그릴 때를 알려 주기만 한다.
  //   시나리오 탭을 열 때, 그 탭이 열린 채 면적이나 아파트를 바꿀 때 부른다.
  //   같은 아파트의 같은 면적이면 다시 부르지 않는다 (탭을 오가도 "다시 계산"한 결과가 남는다).
  //   scenario.js가 없으면 아무것도 하지 않는다.
  renderScenario() {
    const { apartment, areaIndex } = aptPanel;
    if (!apartment || typeof scenarioView === 'undefined') return;
    if (document.getElementById('apt-tab-scenario').getAttribute('aria-selected') !== 'true') return;
    const area = apartment.areas[areaIndex];
    const key = `${apartment.id}:${area.area_band}`;
    if (aptPanel.scenarioKey === key) return;
    aptPanel.scenarioKey = key;
    scenarioView.render(document.getElementById('scenario-panel'), { apartment, area, conditions: guard.conditions() });
  },

  render() {
    const { apartment, areaIndex, listPlace, handlers } = aptPanel;
    if (!apartment) return;
    const area = apartment.areas[areaIndex];
    const unit = aptPanel.unit();

    // 이름과 배지는 늘 둘째 줄 (2026-10-19). 첫 줄은 "← ○○ 목록"(목록에서 열었을 때만)과 오른쪽의 공유 · ✕.
    // 이름이 ✕와 한 줄에 있으면 길 때 잘려서, 둘째 줄에서 줄을 바꿔 다 보여 준다. 배지는 이름 오른쪽
    const title = document.getElementById('apt-title');
    const back = document.getElementById('apt-back');
    const titleRow = document.getElementById('apt-title-row');
    back.hidden = !listPlace;
    titleRow.hidden = false;
    if (listPlace) back.textContent = `← ${listPlace} 목록`;
    if (title.parentElement !== titleRow) titleRow.append(title);
    format.keepWords(document.getElementById('apt-name'), apartment.name); // 띄어쓰기에서만 줄바꿈
    const badge = document.getElementById('apt-badge');
    badge.className = `badge badge--${area.category}`; // 고른 면적의 구분
    badge.textContent = APT_CATEGORY_NAMES[area.category];
    aptPanel.renderNoCoordTag();

    // 이전·다음
    const order = handlers.order(apartment);
    const index = order.indexOf(apartment);
    document.getElementById('apt-prev').disabled = index <= 0;
    document.getElementById('apt-next').disabled = index < 0 || index >= order.length - 1;

    // 면적 칩. "111㎡ (전용 84㎡)", 공급면적을 모르면 "전용 49㎡"
    const areaList = document.getElementById('apt-areas');
    areaList.replaceChildren(...apartment.areas.map((item, i) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'apt__area';
      chip.textContent = format.area(item.supply_area, item.exclusive_area, unit);
      chip.setAttribute('aria-pressed', String(i === areaIndex));
      chip.addEventListener('click', () => {
        aptPanel.areaIndex = i;
        aptPanel.render();
      });
      return chip;
    }));

    document.querySelectorAll('.apt__unit-option').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.unit === unit));
    });

    // 평균가와 여유자금 (또는 부족자금)
    document.getElementById('apt-price').textContent = format.won(area.avg_price);
    document.getElementById('apt-basis').textContent = handlers.basis();
    const gap = document.getElementById('apt-gap');
    gap.className = `apt__value amount--${area.category}`;
    gap.textContent = area.shortage > 0 ? `부족 ${format.won(area.shortage)}` : `여유 ${format.won(-area.shortage)}`;

    aptPanel.renderInfo();
    aptPanel.renderScenario();
    aptPanel.renderRoadview();
  },

  // ───────── 좌표가 없는 아파트 (P-06 ⑱) ─────────

  // 이름과 배지 옆의 "위치 없음". 처음 쓸 때 한 번 만들어 이름 줄에 붙이고, 아파트마다 보이고 숨긴다.
  renderNoCoordTag() {
    let tag = document.getElementById('apt-no-coord');
    if (!tag) {
      tag = document.createElement('span');
      tag.id = 'apt-no-coord';
      tag.className = 'apt__tag';
      tag.textContent = APT_NO_COORD;
      document.getElementById('apt-title').append(tag);
    }
    tag.hidden = aptHasCoord(aptPanel.apartment);
  },

  // 아파트 정보 탭 맨 위의 점선 안내. 좌표가 있으면 null
  noCoordNotice() {
    if (aptHasCoord(aptPanel.apartment)) return null;
    const box = document.createElement('p');
    box.className = 'apt-info__notice';
    box.textContent = APT_NO_COORD_NOTICE;
    return box;
  },

  // ───────── 로드뷰 (3차, 목업 C6, C6b) ─────────

  // 로드뷰 자리가 보이는가. 전체 단계이고 아파트 창일 때 (C6). 탭은 가리지 않는다:
  // 아파트 정보 탭과 시나리오 탭 모두 전체가 되면 위에 로드뷰가 보인다 (2026-10-18, 예전에는 아파트 정보 탭만)
  roadviewVisible() {
    return (sheet.phase === 'opening' || sheet.phase === 'open') && sheet.mode === 'apartment' &&
      sheet.stage === 'full';
  },

  // 로드뷰 자리. 처음 쓸 때 한 번 만들어 창의 손잡이 앞(창 맨 위)에 넣는다.
  //   .apt-roadview__view   카카오 로드뷰가 그려지는 곳
  //   .apt-roadview__empty  기본 이미지 (집 그림과 문장)
  roadviewBox() {
    let box = document.getElementById('apt-roadview');
    if (box) return box;
    box = document.createElement('div');
    box.id = 'apt-roadview';
    box.className = 'apt-roadview';
    box.hidden = true;
    const view = document.createElement('div');
    view.className = 'apt-roadview__view';
    view.hidden = true;
    const empty = document.createElement('div');
    empty.className = 'apt-roadview__empty';
    empty.hidden = true;
    const icon = document.createElement('img');
    icon.className = 'apt-roadview__icon';
    icon.src = APT_HOUSE_ICON;
    icon.alt = '';
    const text = document.createElement('p');
    text.className = 'apt-roadview__text';
    text.textContent = APT_NO_ROADVIEW;
    empty.append(icon, text);
    box.append(view, empty);
    const handle = document.getElementById('sheet-handle');
    handle.parentElement.insertBefore(box, handle);
    return box;
  },

  // 'view' 로드뷰, 'empty' 기본 이미지, null 아무것도 (찾는 중)
  roadviewShow(which) {
    const box = aptPanel.roadviewBox();
    box.querySelector('.apt-roadview__view').hidden = which !== 'view';
    box.querySelector('.apt-roadview__empty').hidden = which !== 'empty';
  },

  // 보일 때만 그린다. 같은 아파트면 다시 찾지 않는다 (창이 움직임을 마치면 크기만 맞춘다).
  // 아파트를 열면(30%부터) 미리 찾아 그려 둔다 (2026-10-18). 전체가 아닐 때는 같은 크기로 창 뒤에 숨겨 두고
  // (.apt-roadview--parked), 전체가 되면 그 자리에서 창과 함께 올라온다. 그래서 전체가 된 뒤 기다리지 않는다
  renderRoadview() {
    const { apartment } = aptPanel;
    const box = aptPanel.roadviewBox();
    const visible = Boolean(apartment) && aptPanel.roadviewVisible();
    const open = Boolean(apartment) && (sheet.phase === 'opening' || sheet.phase === 'open') && sheet.mode === 'apartment';
    box.hidden = !open;
    box.classList.toggle('apt-roadview--parked', open && !visible);
    if (!open) return;
    if (aptPanel.roadviewFor === apartment.id) {
      if (visible && aptPanel.roadview && !sheet.moving) aptPanel.roadview.relayout();
      return;
    }
    aptPanel.roadviewFor = apartment.id;
    const kakaoReady = typeof kakao !== 'undefined' && kakao.maps && typeof kakao.maps.RoadviewClient === 'function';
    if (!aptHasCoord(apartment) || !kakaoReady) {
      aptPanel.roadviewShow('empty');
      return;
    }
    aptPanel.roadviewShow(null);
    const id = apartment.id;
    const position = new kakao.maps.LatLng(Number(apartment.latitude), Number(apartment.longitude));
    try {
      new kakao.maps.RoadviewClient().getNearestPanoId(position, APT_ROADVIEW_RADIUS, (panoId) => {
        if (aptPanel.roadviewFor !== id) return; // 찾는 사이에 다른 아파트로 넘겼다
        if (panoId === null || panoId === undefined) {
          aptPanel.roadviewShow('empty');
          return;
        }
        aptPanel.roadviewShow('view');
        const view = aptPanel.roadviewBox().querySelector('.apt-roadview__view');
        if (!aptPanel.roadview) {
          aptPanel.roadview = new kakao.maps.Roadview(view);
          // 촬영 지점이 정해지면(처음, 그리고 다른 지점으로 바뀔 때마다) 아파트 쪽을 바라보게 돌린다
          kakao.maps.event.addListener(aptPanel.roadview, 'init', aptPanel.aimRoadview);
          kakao.maps.event.addListener(aptPanel.roadview, 'panoid_changed', aptPanel.aimRoadview);
        }
        aptPanel.roadviewTarget = position;
        aptPanel.roadview.setPanoId(panoId, position);
        aptPanel.roadview.relayout();
      });
    } catch (error) {
      aptPanel.roadviewShow('empty'); // 카카오맵이 로드뷰를 주지 못하면 기본 이미지
    }
  },

  // 로드뷰가 아파트를 바라보게 한다 (2026-10-18). 카카오는 바라보는 방향을 정해 주지 않아 길 방향으로 열린다.
  // 촬영 지점(로드뷰의 자리)에서 아파트 좌표로 가는 방위각(북쪽 0도, 시계 방향)을 구해 시점의 좌우 각도(pan)로 둔다.
  // 위아래(tilt)는 살짝 위(-20도, 카카오는 음수가 위), 확대(zoom)는 가장 넓게(-3). 아파트 건물이 위층까지 들어온다
  roadviewTarget: null,
  aimRoadview() {
    const rv = aptPanel.roadview;
    const target = aptPanel.roadviewTarget;
    if (!rv || !target) return;
    const from = rv.getPosition();
    if (!from) return;
    const rad = Math.PI / 180;
    const lat1 = from.getLat() * rad;
    const lat2 = target.getLat() * rad;
    const dLng = (target.getLng() - from.getLng()) * rad;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const pan = (Math.atan2(y, x) / rad + 360) % 360;
    rv.setViewpoint(new kakao.maps.Viewpoint(pan, APT_ROADVIEW_TILT, APT_ROADVIEW_ZOOM));
  },

  // ───────── 비슷한 아파트 (3차, 목업 C6, 김목산의 similar.js) ─────────

  similarReady: () => typeof similarView !== 'undefined' && typeof similarView.load === 'function',

  // 자리. similar.js가 없으면 null (자리를 만들지 않는다)
  similarBox() {
    if (!aptPanel.similarReady()) return null;
    let box = document.getElementById('apt-similar');
    if (!box) {
      box = document.createElement('div');
      box.id = 'apt-similar';
    }
    return box;
  },

  // 아파트 정보 탭이 보일 때 부른다. 아파트, 면적, 조건이 지난번과 같으면 다시 부르지 않는다
  renderSimilar() {
    const { apartment } = aptPanel;
    const box = aptPanel.similarBox();
    if (!box || !apartment || !aptPanel.infoVisible()) return;
    const area = apartment.areas[aptPanel.areaIndex];
    const key = JSON.stringify([apartment.id, area.area_band, guard.conditions()]);
    if (key === aptPanel.similarKey) return;
    aptPanel.similarKey = key;
    similarView.load(box, { apartmentId: apartment.id, areaBand: area.area_band }, { onPick: aptPanel.pickSimilar });
  },

  // ───────── 주변 시설 (3차, FR-MAP-23, 와이어프레임 C6) ─────────

  // 주변 시설 자리. 제목, 다섯 줄(이름 칸과 값 칸), 학교 종류별 네 줄, 출처를 한 번만 만든다
  nearBox() {
    let box = document.getElementById('apt-near');
    if (box) return box;
    box = document.createElement('section');
    box.id = 'apt-near';
    box.className = 'apt-near';
    const title = document.createElement('h3');
    title.className = 'apt-near__title';
    title.textContent = APT_NEAR_TITLE;
    const list = document.createElement('dl');
    list.className = 'apt-near__list';
    const makeRow = (label, kind, icon) => {
      const row = document.createElement('div');
      row.className = 'apt-near__row';
      const term = document.createElement('dt');
      term.className = 'apt-near__label';
      if (icon) term.append(aptNearIcon(icon));
      term.append(document.createTextNode(label));
      const desc = document.createElement('dd');
      desc.className = 'apt-near__value';
      desc.dataset.kind = kind;
      row.append(term, desc);
      return row;
    };
    APT_NEAR_KINDS.forEach(({ kind, label, icon }) => {
      const row = makeRow(label, kind, icon);
      list.append(row);
      if (kind === 'school') {
        // 학교: 오른쪽 ⌄로 초·중·고·대학교를 펼친다. 처음에는 접어 두고 가장 가까운 학교만 보인다
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'apt-near__toggle';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', APT_NEAR_MORE);
        toggle.append(aptNearIcon('M6.4 8.6L12 14.2l5.6-5.6L19 10l-7 7-7-7 1.4-1.4z'));
        toggle.addEventListener('click', () => aptPanel.toggleSchools());
        row.append(toggle);
        const sub = document.createElement('div');
        sub.className = 'apt-near__sub';
        sub.id = 'apt-near-schools';
        sub.hidden = true;
        APT_NEAR_SCHOOLS.forEach((school) => {
          const subRow = makeRow(school.label, school.kind);
          subRow.classList.add('apt-near__row--sub');
          sub.append(subRow);
        });
        toggle.setAttribute('aria-controls', sub.id);
        list.append(sub);
      }
    });
    const source = document.createElement('p');
    source.className = 'apt-near__source';
    box.append(title, list, source);
    return box;
  },

  // 학교 줄의 ⌄. 값은 이미 채워 두었으므로 펼치고 접기만 한다. open을 주면 그 상태로
  toggleSchools(open) {
    const box = document.getElementById('apt-near');
    if (!box) return;
    const toggle = box.querySelector('.apt-near__toggle');
    const next = open === undefined ? toggle.getAttribute('aria-expanded') !== 'true' : open;
    toggle.setAttribute('aria-expanded', String(next));
    toggle.setAttribute('aria-label', next ? APT_NEAR_LESS : APT_NEAR_MORE);
    box.querySelector('.apt-near__sub').hidden = !next;
  },

  // A-06의 facilities로 주변 시설을 채운다. 받은 값이 없거나 좌표가 없으면 묶음을 숨긴다
  renderNear(detail) {
    const { apartment } = aptPanel;
    const box = aptPanel.nearBox();
    const items = (detail && detail.facilities) || [];
    box.hidden = !apartment || !aptHasCoord(apartment) || !items.length;
    if (box.hidden) return;
    if (box.dataset.apartmentId !== String(apartment.id)) aptPanel.toggleSchools(false); // 다른 아파트로 바뀌면 학교 종류별 묶음은 접는다
    box.dataset.apartmentId = String(apartment.id);
    const byKind = new Map(items.map((item) => [item.kind, item]));
    box.querySelectorAll('.apt-near__value').forEach((cell) => {
      const item = byKind.get(cell.dataset.kind);
      aptPanel.nearFill(cell, item ? aptPanel.nearValue(item) : APT_NEAR_NONE);
    });
    const [year, month, day] = (detail.facilities_base_date || '').split('-');
    box.querySelector('.apt-near__source').textContent = year
      ? `${APT_NEAR_SOURCE} · ${year}년 ${Number(month)}월 ${Number(day)}일 기준 · 직선거리`
      : '';
  },

  // 한 줄의 값. "전남고등학교 130m". 지하철역은 { before, exit, after } (출구 번호를 노란 상자로)
  // 출구를 못 찾은 역은 "상무역 광주1호선까지 718m"
  nearValue(item) {
    if (!item.place_name) return APT_NEAR_NONE;
    const distance = aptNearDistance(item.distance);
    if (item.kind !== 'subway') return `${item.place_name} ${distance}`;
    if (item.exit_no === null || item.exit_no === undefined) return `${item.place_name}까지 ${distance}`;
    return { before: `${item.place_name} `, exit: String(item.exit_no), after: `번 출구까지 ${distance}` };
  },

  // 한 칸을 채운다. 글자이면 그대로, 출구이면 번호를 지하철 출구 표지처럼 작은 노란 상자로 (sheet.css .apt-near__exit)
  nearFill(cell, value) {
    if (typeof value === 'string') {
      cell.textContent = value;
      return;
    }
    const badge = document.createElement('span');
    badge.className = 'apt-near__exit';
    badge.textContent = value.exit;
    const keep = document.createElement('span'); // "[5]번 출구까지 383m"는 늘 다음 줄에 한 덩어리로 (sheet.css)
    keep.className = 'apt-near__keep';
    keep.append(badge, value.after);
    cell.replaceChildren(document.createTextNode(value.before), keep);
  },

  // 비슷한 아파트의 카드를 누름. apartment는 A-24 응답의 아파트, areaBand는 카드에 보이던 면적대
  //   map-view.js의 onPickSimilar에 맡긴다. 같은 동이든 다른 동이든 지도를 한 번에(setCenter) 옮긴다.
  //   (‹ ›의 onMove는 panTo로 부드럽게 옮기는데, 실제 카카오맵의 panTo는 80%의 좁은 지도에서 가운데에 멈추지 않을 때가 있었다)
  //   onPickSimilar가 없으면 지금 지도에 있는 아파트만 ‹ ›와 같이 넘긴다 (그 면적을 고르고, 아파트 정보 탭 맨 위로)
  pickSimilar(apartment, areaBand) {
    const { handlers } = aptPanel;
    if (typeof handlers.onPickSimilar === 'function') {
      handlers.onPickSimilar(apartment, areaBand);
      return;
    }
    const order = handlers.order ? handlers.order(aptPanel.apartment) : [];
    const known = order.find((item) => item.id === apartment.id);
    if (known) {
      const areaIndex = Math.max(known.areas.findIndex((area) => area.area_band === areaBand), 0);
      aptPanel.show(known, areaIndex, { listPlace: aptPanel.listPlace });
      handlers.onMove(known);
      document.querySelector('.apt__panels').scrollTop = 0;
    }
  },

  // ───────── 아파트 정보 탭 (P-06 ⑦, A-06) ─────────

  // 아파트 정보 탭이 지금 보이는가. 80% 이상이고, 아파트 창이고, 그 탭이 골라져 있을 때
  infoVisible() {
    return (sheet.phase === 'opening' || sheet.phase === 'open') && sheet.mode === 'apartment' &&
      (sheet.stage === '80' || sheet.stage === 'full') &&
      document.getElementById('apt-tab-info').getAttribute('aria-selected') === 'true';
  },

  // 보일 때만 그린다. 받은 것이 없으면 받으러 간다.
  renderInfo() {
    const { apartment } = aptPanel;
    if (!apartment || !aptPanel.infoVisible()) return;
    const panel = document.getElementById('apartment-info');
    const notice = aptPanel.noCoordNotice(); // 좌표가 없으면 맨 위에 (받는 중에도 보인다)
    const similar = aptPanel.similarBox(); // 비슷한 아파트 자리. 같은 요소를 다시 붙이므로 그려 둔 카드가 남는다
    const near = aptPanel.nearBox(); // 주변 시설 자리. 같은 요소를 다시 붙인다
    // rows: 정보 줄을 그릴 때만 "기본 정보" 제목과 주변 시설을 붙인다 (제목은 비슷한 아파트가 있을 때만)
    const show = (content, rows = false) => {
      const title = rows && similar ? aptInfoTitle() : null;
      panel.replaceChildren(...[notice, title, content, rows ? near : null, similar].filter(Boolean));
      if (rows) aptPanel.renderNear(aptPanel.details.get(apartment.id));
      aptPanel.renderSimilar();
    };
    const detail = aptPanel.details.get(apartment.id);
    if (detail) {
      show(aptPanel.infoRows(detail), true);
      return;
    }
    if (aptPanel.failed.has(apartment.id)) {
      show(aptPanel.infoFail(apartment.id));
      return;
    }
    show(null); // 받는 동안은 안내만 두고 비워 둔다
    aptPanel.loadDetail(apartment.id);
  },

  async loadDetail(id) {
    if (aptPanel.loading.has(id)) return;
    aptPanel.loading.add(id);
    try {
      aptPanel.details.set(id, await api.get(`/api/apartments/${id}`));
    } catch (error) {
      aptPanel.failed.add(id);
    } finally {
      aptPanel.loading.delete(id);
    }
    // 받는 동안 다른 아파트로 넘어갔으면 그 아파트를 그린다. 같은 아파트면 지금 받은 것으로 그린다
    aptPanel.renderInfo();
  },

  // 정보 여덟 줄. 면적, 평균가, 가격 범위, 거래 건수는 지금 고른 면적의 것이다.
  // 세대수를 모르는 아파트는 세대수 줄을 그리지 않는다 (FR-APT-15).
  infoRows(detail) {
    const picked = aptPanel.apartment.areas[aptPanel.areaIndex];
    const area = detail.areas.find((item) => item.area_band === picked.area_band) || picked;
    const rows = [
      ['지번 주소', `${detail.dong} ${detail.jibun}`],
      ['도로명 주소', detail.road_address],
      ['준공 연도', detail.built_year === null ? null : `${detail.built_year}년`],
      ['면적', format.area(area.supply_area, area.exclusive_area, aptPanel.unit())],
      ['실거래 평균가', format.won(area.avg_price)],
      ['최근 1년 거래', aptPanel.tradeText(area)],
      ['세대수', aptPanel.householdsText(detail)],
      ['가격 범위', aptPanel.priceRangeText(area)],
    ];
    const list = document.createElement('dl');
    list.className = 'apt-info';
    rows.filter(([, value]) => value !== null && value !== undefined && value !== '').forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'apt-info__row';
      const term = document.createElement('dt');
      term.className = 'apt-info__label';
      term.textContent = label;
      const desc = document.createElement('dd');
      desc.className = 'apt-info__value';
      desc.textContent = value;
      // 주소 옆 복사 아이콘 (FR-APT-18, share.js). 누르면 바로 클립보드에 넣는다
      if ((label === '지번 주소' || label === '도로명 주소') && typeof shareView !== 'undefined') {
        desc.append(shareView.copyButton(() => format.fullAddress(detail.gu, value), `${label} 복사`)); // 복사는 시도와 구까지
      }
      row.append(term, desc);
      list.append(row);
    });
    return list;
  },

  // 세대수 "1,234세대 (2026년 8월 기준)". 세대수를 모르면 null (줄을 그리지 않는다). 기준일을 모르면 괄호를 뺀다
  householdsText(detail) {
    if (detail.households === null || detail.households === undefined) return null;
    const count = `${format.comma(detail.households)}세대`;
    if (!detail.households_base_date) return count;
    const [year, month] = detail.households_base_date.split('-');
    return `${count} (${year}년 ${Number(month)}월 기준)`;
  },

  // 최근 1년 거래 "14건 (2025년 10월 ~ 2026년 9월)". 괄호는 집계 기간(A-06의 period_start ~ period_end)이다.
  // 줄을 늘리지 않고 이 줄에 붙인다 (와이어프레임의 여덟 줄 그대로). 기간을 모르면 괄호를 뺀다
  tradeText(area) {
    const count = `${format.comma(area.trade_count)}건`;
    if (!area.period_start || !area.period_end) return count;
    const month = (text) => {
      const [year, mm] = text.split('-');
      return `${year}년 ${Number(mm)}월`;
    };
    return `${count} (${month(area.period_start)} ~ ${month(area.period_end)})`;
  },

  // 가격 범위 "2억 7,000만 ~ 3억 3,000만 원" (목업 2038:566). 앞 금액의 "원"은 뺀다
  priceRangeText(area) {
    if (area.min_price === null || area.min_price === undefined || area.max_price === null || area.max_price === undefined) return null;
    return `${format.won(area.min_price).replace(/ 원$/, '')} ~ ${format.won(area.max_price)}`;
  },

  infoFail(id) {
    const box = document.createElement('div');
    box.className = 'apt-info__fail';
    const text = document.createElement('p');
    text.className = 'apt-info__fail-text';
    text.textContent = APT_INFO_FAIL;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'link-button';
    retry.textContent = '다시 시도';
    retry.addEventListener('click', () => {
      aptPanel.failed.delete(id);
      aptPanel.renderInfo();
    });
    box.append(text, retry);
    return box;
  },
};
