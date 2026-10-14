// 저장한 결과 (P-09, 3차). 담당: 박채은
//
//   saved.html        목록 (와이어프레임 C1). A-22 GET /api/saved-results
//   saved.html?id=3   하나 열어 보기 (C3).    A-23 GET /api/saved-results/3
//
// 로그인해야 볼 수 있다. 401이면 로그인 화면으로 보낸다.
// 저장한 그대로 보여 주고 다시 계산하지 않는다. 결과 상자와 값 줄은 시나리오 탭(scenario.js)의 함수로 그린다.
// 글자는 textContent로 넣는다. 금액은 format.won으로 보여 준다.

const SAVED_TEXT = {
  title: '저장한 결과',
  subtitle: '저장했을 때의 조건과 평균가로 계산한 값입니다.',
  empty: '아직 저장한 결과가 없습니다. 시나리오 탭에서 저장할 수 있습니다.',
  failed: '저장한 결과를 불러오지 못했습니다.',
  retry: '다시 시도',
  loading: '불러오는 중',
  detailNote: '저장했을 때의 조건과 평균가로 계산한 값입니다. 지금의 평균가와 다를 수 있습니다.',
  toMap: '지도에서 이 아파트 보기',
};
const SAVED_CATEGORY_NAMES = { now: '지금 가능', within: '기간 내 가능', lack: '자금 부족' };

const saved = {
  main: document.getElementById('saved-main'),

  start() {
    const id = new URLSearchParams(location.search).get('id');
    if (id) {
      document.getElementById('saved-back').href = 'saved.html'; // 열어 보기의 ‹ 는 목록으로
      saved.load(`/api/saved-results/${encodeURIComponent(id)}`, saved.drawOne);
    } else {
      saved.load('/api/saved-results', saved.drawList);
    }
  },

  async load(path, draw) {
    saved.main.replaceChildren(saved.loadingBox());
    try {
      draw(await api.get(path));
    } catch (error) {
      if (error.status === 401) {
        location.href = 'login.html';
        return;
      }
      saved.main.replaceChildren(saved.failBox(error, () => saved.load(path, draw)));
    }
  },

  // ───────── 목록 (C1) ─────────

  drawList({ results }) {
    const parts = [
      saved.make('h1', 'title', SAVED_TEXT.title),
      saved.make('p', 'subtitle', SAVED_TEXT.subtitle),
    ];
    if (results.length === 0) {
      parts.push(saved.make('p', 'saved__empty', SAVED_TEXT.empty));
    } else {
      const list = saved.make('ul', 'saved__list');
      results.forEach((item) => list.append(saved.card(item)));
      parts.push(list);
    }
    saved.main.replaceChildren(...parts);
  },

  // 카드 한 장: 이름과 저장 날짜, 면적과 여유·부족, 저장 당시 조건 한 줄
  card(item) {
    const li = document.createElement('li');
    const link = saved.make('a', 'saved__card');
    link.href = `saved.html?id=${item.id}`;

    const top = saved.make('div', 'saved__card-top');
    top.append(
      saved.make('strong', 'saved__card-name', item.apartment.name),
      saved.make('span', 'saved__card-date', `${saved.day(item.created_at)} 저장`),
    );

    const middle = saved.make('p', 'saved__card-result');
    middle.append(
      document.createTextNode(`${saved.area(item.apartment)} · `),
      saved.make('span', `amount--${item.category}`, saved.gap(item.shortage)),
    );

    link.append(top, middle, saved.make('p', 'saved__card-conditions', saved.conditions(item)));
    li.append(link);
    return li;
  },

  // ───────── 하나 열어 보기 (C3) ─────────

  drawOne(item) {
    const head = saved.make('div', 'saved__head');
    const titleRow = saved.make('div', 'saved__title-row');
    titleRow.append(
      saved.make('h1', 'title saved__name', item.apartment.name),
      saved.make('span', `badge badge--${item.category}`, SAVED_CATEGORY_NAMES[item.category]),
    );
    head.append(titleRow, saved.make('p', 'saved__meta', `${saved.area(item.apartment)} · ${saved.day(item.created_at)}에 저장`));

    const parts = [head, scenarioView.resultBox(item), scenarioView.rows(item)];
    parts.push(saved.make('p', 'saved__note', SAVED_TEXT.detailNote));

    // 원래 아파트가 지워졌으면 지도로 갈 수 없다
    if (item.apartment.id !== null) {
      const toMap = saved.make('button', 'button button--primary saved__to-map', SAVED_TEXT.toMap);
      toMap.type = 'button';
      toMap.addEventListener('click', () => {
        // 지금의 조건으로 그 아파트가 있는 동을 지도에 연다 (C3). 아파트 창을 여는 것은 지도 화면의 일이다
        store.set('map', { gu: item.apartment.gu, dong: item.apartment.dong });
        location.href = 'map.html';
      });
      parts.push(toMap);
    }
    saved.main.replaceChildren(...parts);
  },

  // ───────── 받는 중, 받지 못함 ─────────

  loadingBox() {
    const box = saved.make('div', 'scenario__state');
    box.setAttribute('role', 'status');
    box.append(saved.make('span', 'scenario__spinner'), saved.make('span', '', SAVED_TEXT.loading));
    return box;
  },

  failBox(error, retryFn) {
    const box = saved.make('div', 'notice notice--error saved__fail');
    box.setAttribute('role', 'alert');
    const text = error.status === 404 ? error.detail : SAVED_TEXT.failed;
    const retry = saved.make('button', 'link-button', SAVED_TEXT.retry);
    retry.type = 'button';
    retry.addEventListener('click', retryFn);
    box.append(saved.make('span', '', text));
    if (error.status !== 404) box.append(retry);
    return box;
  },

  // ───────── 작은 도구 ─────────

  day: (createdAt) => createdAt.slice(0, 10), // "2026-10-14T11:20:00" → "2026-10-14"

  area: (apartment) => format.area(apartment.supply_area, apartment.exclusive_area, 'm2'),

  gap: (shortage) => (shortage > 0 ? `부족 ${format.won(shortage)}` : `여유 ${scenarioView.money(-shortage)}`),

  // 카드의 조건 한 줄. "보유 5,000만 · 월 100만 · 5년 · [상품명] 30년" (C1)
  conditions(item) {
    const short = (amount) => (amount === 0 ? '0원' : format.won(amount).replace(/ 원$/, ''));
    const years = item.target_years === 0 ? '지금' : `${item.target_years}년`;
    const loan = item.loan.choice === 'product' ? `${item.loan.product_name} ${item.loan.repayment_years}년` : '대출 없이';
    return `보유 ${short(item.current_assets)} · 월 ${short(item.monthly_saving)} · ${years} · ${loan}`;
  },

  make: (tag, className, text) => scenarioView.make(tag, className, text),
};

saved.start();
