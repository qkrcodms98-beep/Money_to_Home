// 목록 (P-06 ⑤ 목록 80%). 담당: 김목산
//
// 지도 화면에 묶이지 않는다. 그릴 요소를 받아 그 안에만 그린다.
// map.html(안세환)은 고치지 않는다. 세환과 맞춘 자리는 id="apt-list" 하나다.
//
//   const el = document.getElementById('apt-list');
//
//   // A-05 응답으로 그리기만 한다. 지도가 이미 A-05를 불렀으면 그 응답을 넘긴다.
//   listView.render(el, result);
//   listView.render(el, result, {
//     where: { gu: '서구', dong: '치평동' },        // 머리의 "서구 치평동 · 23곳"
//     sort: 'category',                              // 지금 정렬. 머리의 "정렬: 구분순"
//     onSort: (sort) => { ... },                     // 정렬을 고름. A-05를 sort로 다시 불러 그린다. 없으면 정렬 버튼이 없다
//     onSelect: (apartment, areaIndex) => { ... },  // 카드를 누름. 80% 아파트 창을 연다 (세환)
//     onClose: () => { ... },                        // 닫기
//     onResetFilters: () => { ... },                 // 결과 없음의 '조건 초기화'. 없으면 버튼이 없다
//     onChangeFilters: () => { ... },                // 결과 없음의 '조건 바꾸기' (조건 창을 연다). 없으면 버튼이 없다
//   });
//
//   // 불러오는 중 (P-05 ⑯, FR-COMMON-10). 회색 자리표시 카드 3장. where가 있으면 머리에 지역 이름, onClose가 있으면 닫기
//   listView.renderLoading(el, { where: { gu: '서구', dong: '치평동' }, onClose: () => { ... } });
//   // 결과가 오면 render나 renderError로 바꿔 그리면 된다
//
//   // 불러오지 못했을 때. message가 없으면 "아파트를 불러오지 못했습니다…", onRetry가 있으면 '다시 시도', onClose가 있으면 닫기
//   listView.renderError(el, { message, onRetry: () => { ... }, onClose: () => { ... } });
//
//   // A-05를 불러 그리고, 받은 응답을 돌려준다. 정렬은 store의 map.sort를 쓰고, 바꾸면 알아서 다시 부른다.
//   const result = await listView.load(el, { gu: '서구', dong: '치평동' }, { onSelect, onClose });
//
// 숫자는 서버(A-05)가 준 것을 그대로 보여 준다. 여기서 계산하지 않는다 (NFR-13).
// 서버에서 온 글자는 textContent로 넣는다. innerHTML을 쓰지 않는다.
// 순서는 서버가 준 순서 그대로다. 정렬은 서버(A-05의 sort)가 한다 (와이어프레임 B1, B2).
// 면적 단위(평)는 아직 없다.

const LIST_GROUPS = [
  { key: 'now', title: '지금 목표할 수 있는 곳', chip: '지금', badge: '지금 가능' },
  { key: 'within', title: '목표 기간 안에 가능한 곳', chip: '기간 내', badge: '기간 내 가능' },
  { key: 'lack', title: '자금이 부족한 곳', chip: '부족', badge: '자금 부족' },
];

// 정렬. 값은 A-05의 sort와 같다
const LIST_SORTS = [
  { key: 'category', label: '구분순' },
  { key: 'price_asc', label: '가격 낮은 순' },
  { key: 'price_desc', label: '가격 높은 순' },
];

const LIST_TEXT = {
  info: '판매 중인 매물이 아니라 최근 1년 실거래 기록입니다. 금액은 가정에 따른 추정치입니다.',
  emptyTitle: '이 지역에 조건에 맞는 아파트가 없습니다.',
  emptyHelp: '면적이나 준공 연도 조건을 넓히거나 다른 동을 살펴보세요.',
  noTargetTitle: '이 동에는 지금 조건으로 목표할 수 있는 아파트가 없습니다.',
  noTargetHelp: '저축액이나 목표 기간을 바꾸거나 다른 동을 살펴보세요.',
  noTargetButton: '조건 수정',
  resetFilters: '조건 초기화',
  changeFilters: '조건 바꾸기',
  loadFail: '아파트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', // 지도 화면과 같은 문장 (와이어프레임 P-04 ⑩)
  retry: '다시 시도',
  loading: '아파트를 불러오는 중', // 와이어프레임 P-05 ⑯의 알림과 같은 말
  noCoord: '위치 없음',
  overCap: '상한 초과',
};

// 실거래 수집 기준일 (A-13). 화면을 연 동안 한 번만 받는다. 받지 못하거나 없으면 null
let listBaseDate = null;
function listTradesBaseDate() {
  if (!listBaseDate) {
    listBaseDate = api.get('/api/data-status')
      .then((status) => status.trades_base_date)
      .catch(() => {
        listBaseDate = null; // 다음에 그릴 때 다시 받아 본다
        return null;
      });
  }
  return listBaseDate;
}

// 요소 하나를 만든다. text는 textContent로 넣는다.
function listEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) el.textContent = text;
  return el;
}

// "평균 3억 원" · "여유 2,000만 원" 또는 "부족 2,500만 원". 부족자금이 음수면 여유다.
function listMoneyLine(area) {
  const line = listEl('p', 'list-card__money');
  line.append(listEl('span', null, `평균 ${format.won(area.avg_price)} · `));
  const gap = area.shortage > 0 ? `부족 ${format.won(area.shortage)}` : `여유 ${format.won(-area.shortage)}`;
  line.append(listEl('strong', `list-card__gap list-card__gap--${area.category}`, gap));
  return line;
}

function listCard(apartment, handlers) {
  const group = LIST_GROUPS.find((g) => g.key === apartment.category);
  const card = listEl('article', `list-card list-card--${apartment.category}`);
  const body = listEl('button', 'list-card__body');
  body.type = 'button';
  card.append(body);

  let index = 0; // 보고 있는 면적. 첫째가 평균가가 가장 낮은 면적이다 (FR-APT-05)

  // 면적마다 한 장. 옆으로 늘어놓고 카드 밖은 가린다. 넘기면 옆으로 밀려 다음 면적이 들어온다 (list.css)
  const track = listEl('div', 'list-card__track');
  body.append(track);
  apartment.areas.forEach((area) => {
    const areaGroup = LIST_GROUPS.find((g) => g.key === area.category);
    const slide = listEl('div', 'list-card__slide');
    const head = listEl('div', 'list-card__head');
    head.append(listEl('h3', 'list-card__name', apartment.name));
    head.append(listEl('span', `badge badge--${area.category}`, areaGroup.badge));
    slide.append(head);

    const meta = listEl('p', 'list-card__meta', `${format.area(area.supply_area, area.exclusive_area)} · 거래 ${format.comma(area.trade_count)}건`);
    if (apartment.latitude === null || apartment.longitude === null) {
      meta.append(listEl('span', 'list-card__tag', LIST_TEXT.noCoord));
    }
    // 평균가가 상품의 대상 주택 가격 상한을 넘는 면적 (FR-LOAN-14). 알리기만 하고 빼지 않는다
    if (area.over_price_cap) {
      meta.append(listEl('span', 'list-card__tag list-card__tag--cap', LIST_TEXT.overCap));
    }
    slide.append(meta);
    slide.append(listMoneyLine(area));
    track.append(slide);
  });

  const show = () => {
    const area = apartment.areas[index];
    const areaGroup = LIST_GROUPS.find((g) => g.key === area.category);
    track.style.transform = `translateX(${-100 * index}%)`;
    body.setAttribute('aria-label', `${apartment.name}, ${format.area(area.supply_area, area.exclusive_area)}, ${areaGroup.badge}`);
  };

  body.addEventListener('click', () => handlers.onSelect && handlers.onSelect(apartment, index));

  if (apartment.areas.length > 1) {
    const next = listEl('button', 'list-card__next');
    next.type = 'button';
    next.setAttribute('aria-label', '다른 면적 보기');
    const arrow = listEl('span', 'list-card__arrow', '›');
    const page = listEl('span', 'list-card__page');
    next.append(arrow, page);
    next.addEventListener('click', () => {
      index = (index + 1) % apartment.areas.length;
      page.textContent = `${index + 1}/${apartment.areas.length}`;
      show();
    });
    page.textContent = `1/${apartment.areas.length}`;
    card.append(next);
  }

  show();
  card.dataset.category = group.key;
  return card;
}

function listHead(result, options) {
  const head = listEl('header', 'list__head');
  const where = options.where || {};
  const place = [where.gu, where.dong].filter(Boolean).join(' ');
  const count = `${format.comma(result.counts.total)}곳`;
  // 자리가 모자라면 지역 이름만 말줄임(…)으로 줄이고 "· 22곳"은 남긴다
  // "· 22곳" 앞의 빈칸은 붙는 빈칸(\u00a0)이다. 보통 빈칸은 flex 안에서 사라진다
  const title = listEl('h2', 'list__title');
  if (place) title.append(listEl('span', 'list__place', place), listEl('span', 'list__count', `\u00a0· ${count}`));
  else title.append(listEl('span', 'list__count', count));
  head.append(title);

  head.append(listInfo());

  if (options.onSort) head.append(listSortMenu(options.sort || 'category', options.onSort));

  head.append(listCloseButton(() => options.onClose && options.onClose()));
  return head;
}

function listCloseButton(onClose) {
  const close = listEl('button', 'list__close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', '닫기');
  close.addEventListener('click', onClose);
  return close;
}

// 안내 아이콘 ( ! ). 누르거나 마우스를 올리면 실거래 기록 안내가 뜨고, 바깥을 누르면 닫힌다 (FR-COMMON-02, B5).
// 문구 끝에 실거래 수집 기준일을 적는다 (FR-DATA-05). 기준일이 없으면 그 문장만 뺀다
function listInfo() {
  const info = listEl('span', 'list__info-wrap');
  const button = listEl('button', 'list__info', '!');
  button.type = 'button';
  button.setAttribute('aria-label', '안내');
  const tip = listEl('span', 'list__tip', LIST_TEXT.info);
  tip.setAttribute('role', 'tooltip');
  listTradesBaseDate().then((date) => {
    if (date) tip.textContent = `${LIST_TEXT.info} 실거래 ${date} 기준.`;
  });
  button.addEventListener('click', () => info.classList.toggle('list__info-wrap--open'));
  const onOutside = (event) => {
    if (!info.isConnected) document.removeEventListener('click', onOutside); // 목록을 다시 그렸으면 치운다
    else if (!info.contains(event.target)) info.classList.remove('list__info-wrap--open');
  };
  document.addEventListener('click', onOutside);
  info.append(button, tip);
  return info;
}

// "정렬: 구분순" 글자 버튼과 작은 선택 창 (B1). 고르면 창을 닫고 onSort(sort)를 부른다
function listSortMenu(current, onSort) {
  const wrap = listEl('div', 'list__sort');
  const now = LIST_SORTS.find((s) => s.key === current) || LIST_SORTS[0];
  const button = listEl('button', 'list__sort-button', `정렬: ${now.label}`);
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');

  const menu = listEl('ul', 'list__sort-menu');
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;

  const setOpen = (open) => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };
  // 창 밖을 누르면 닫는다
  const onOutside = (event) => {
    if (!wrap.isConnected) document.removeEventListener('click', onOutside); // 목록을 다시 그렸으면 치운다
    else if (!wrap.contains(event.target)) setOpen(false);
  };
  document.addEventListener('click', onOutside);
  wrap.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      button.focus();
    }
  });

  LIST_SORTS.forEach((s) => {
    const item = listEl('li');
    const option = listEl('button', 'list__sort-option', s.label);
    option.type = 'button';
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(s.key === now.key));
    if (s.key === now.key) option.append(listEl('span', 'list__sort-check', '✓'));
    option.addEventListener('click', () => {
      setOpen(false);
      if (s.key !== now.key) onSort(s.key);
    });
    item.append(option);
    menu.append(item);
  });

  button.addEventListener('click', () => setOpen(menu.hidden));
  wrap.append(button, menu);
  return wrap;
}

// buttons: [{ text, onClick }]. onClick이 없는 버튼은 그리지 않는다
function listEmpty(title, help, buttons = []) {
  const box = listEl('div', 'list__empty');
  box.append(listEl('p', 'list__empty-title', title));
  box.append(listEl('p', 'list__empty-help', help));
  const shown = buttons.filter((b) => b.onClick);
  if (shown.length > 0) {
    const row = listEl('div', 'list__empty-buttons');
    shown.forEach((b) => {
      const button = listEl('button', 'link-button list__empty-button', b.text);
      button.type = 'button';
      button.addEventListener('click', b.onClick);
      row.append(button);
    });
    box.append(row);
  }
  return box;
}

const listView = {
  // A-05를 불러 그리고, 받은 결과를 돌려준다. 조건은 guard.conditions()가 만든다.
  async load(container, where, handlers = {}) {
    const sort = store.get('map').sort || 'category';
    const onSort = (next) => {
      store.set('map', { sort: next });
      listView.load(container, where, handlers).catch(() => {}); // 실패하면 load가 오류 문구를 그린다
    };
    listView.renderLoading(container, { where, onClose: handlers.onClose });
    try {
      const result = await api.post('/api/apartments/search', { conditions: guard.conditions(), where, sort });
      listView.render(container, result, { ...handlers, where, sort, onSort });
      return result;
    } catch (error) {
      // 서버가 값을 거부했으면(422) 그 문장을, 아니면 불러오지 못했다는 문장을 보여 준다 (지도 화면과 같다)
      listView.renderError(container, {
        message: error.status === 422 ? error.detail : LIST_TEXT.loadFail,
        onRetry: () => listView.load(container, where, handlers).catch(() => {}),
        onClose: handlers.onClose,
      });
      throw error;
    }
  },

  // 불러오는 중. 머리(지역 이름, 닫기)와 회색 자리표시 카드 3장 (P-05 ⑯, FR-COMMON-10).
  // 받는 동안 빈 화면이나 앞의 목록이 보이지 않게 한다. 화면 읽기 프로그램에는 '불러오는 중'으로 알린다
  renderLoading(container, { where, onClose } = {}) {
    const root = listEl('section', 'list list--loading');
    root.setAttribute('aria-busy', 'true');
    const head = listEl('header', 'list__head');
    const place = [where && where.gu, where && where.dong].filter(Boolean).join(' ');
    const title = listEl('h2', 'list__title');
    if (place) title.append(listEl('span', 'list__place', place));
    title.append(listEl('span', 'list__skeleton list__skeleton--count'));
    head.append(title);
    if (onClose) head.append(listCloseButton(onClose));
    root.append(head);
    const status = listEl('p', 'list__loading-text', LIST_TEXT.loading);
    status.setAttribute('role', 'status');
    root.append(status);

    const group = listEl('div', 'list__group');
    group.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i += 1) {
      const card = listEl('div', 'list-card list-card--skeleton');
      const body = listEl('div', 'list-card__skeleton-body');
      const headLine = listEl('div', 'list-card__head');
      headLine.append(listEl('span', 'list__skeleton list__skeleton--name'), listEl('span', 'list__skeleton list__skeleton--badge'));
      body.append(headLine, listEl('span', 'list__skeleton list__skeleton--meta'), listEl('span', 'list__skeleton list__skeleton--money'));
      card.append(body);
      group.append(card);
    }
    root.append(group);
    container.replaceChildren(root);
  },

  // 불러오지 못함. 빨간 테두리 상자에 문장과 '다시 시도' (P-05 ⑰, 아파트 정보 탭과 같은 모양)
  renderError(container, { message = LIST_TEXT.loadFail, onRetry, onClose } = {}) {
    const box = listEl('div', 'notice notice--error list__fail');
    box.setAttribute('role', 'alert');
    box.append(listEl('p', 'list__fail-text', message));
    if (onRetry) {
      const retry = listEl('button', 'link-button list__fail-retry', LIST_TEXT.retry);
      retry.type = 'button';
      retry.addEventListener('click', onRetry);
      box.append(retry);
    }
    const root = listEl('section', 'list');
    if (onClose) {
      const head = listEl('header', 'list__head');
      head.append(listCloseButton(onClose));
      root.append(head);
    }
    root.append(box);
    container.replaceChildren(root);
  },

  // A-05 응답으로 목록을 그린다. options: { where, sort, onSort, onSelect, onClose } (모두 없어도 된다)
  render(container, result, options = {}) {
    const root = listEl('section', 'list');
    root.append(listHead(result, options));

    // 결과 없음 (P-05 ⑨, FR-APT-07). '조건 초기화', '조건 바꾸기'는 부르는 쪽이 넘겼을 때만
    if (result.counts.total === 0) {
      root.append(listEmpty(LIST_TEXT.emptyTitle, LIST_TEXT.emptyHelp, [
        { text: LIST_TEXT.resetFilters, onClick: options.onResetFilters },
        { text: LIST_TEXT.changeFilters, onClick: options.onChangeFilters },
      ]));
      container.replaceChildren(root);
      return;
    }

    const chips = listEl('div', 'list__chips');
    LIST_GROUPS.forEach((g) => chips.append(listEl('span', `chip chip--${g.key}`, `${g.chip} ${format.comma(result.counts[g.key])}`)));
    root.append(chips);

    // 아파트는 있지만 목표할 수 있는 곳이 없음 (A6). '조건 수정'은 저축 계획 단계로 간다
    if (result.counts.now === 0 && result.counts.within === 0) {
      root.append(listEmpty(LIST_TEXT.noTargetTitle, LIST_TEXT.noTargetHelp,
        [{ text: LIST_TEXT.noTargetButton, onClick: () => { location.href = 'plan.html'; } }]));
    }

    // 가격순이면 구분별 제목 없이 서버가 준 순서로 잇는다. 구분은 카드의 배지로만 보인다 (B2)
    if (options.sort === 'price_asc' || options.sort === 'price_desc') {
      const section = listEl('div', 'list__group');
      result.apartments.forEach((a) => section.append(listCard(a, options)));
      root.append(section);
      container.replaceChildren(root);
      return;
    }

    LIST_GROUPS.forEach((g) => {
      const apartments = result.apartments.filter((a) => a.category === g.key);
      if (apartments.length === 0) return;
      const section = listEl('div', 'list__group');
      section.append(listEl('h3', 'list__group-title', `${g.title} · ${format.comma(apartments.length)}`));
      apartments.forEach((a) => section.append(listCard(a, options)));
      root.append(section);
    });
    container.replaceChildren(root);
  },
};
