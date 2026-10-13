// 목록 (P-06 ⑤ 목록 80%). 담당: 김목산
//
// 지도 화면에 묶이지 않는다. 그릴 요소를 받아 그 안에만 그린다.
// map.html(안세환)은 고치지 않는다. 세환과 맞춘 자리는 id="apartment-list" 하나다.
//
//   const el = document.getElementById('apartment-list');
//
//   // A-05 응답으로 그리기만 한다. 지도가 이미 A-05를 불렀으면 그 응답을 넘긴다.
//   listView.render(el, result);
//   listView.render(el, result, {
//     where: { gu: '서구', dong: '치평동' },        // 머리의 "서구 치평동 · 23곳"
//     sort: 'category',                              // 지금 정렬. 머리의 "정렬: 구분순"
//     onSort: (sort) => { ... },                     // 정렬을 고름. A-05를 sort로 다시 불러 그린다. 없으면 정렬 버튼이 없다
//     onSelect: (apartment, areaIndex) => { ... },  // 카드를 누름. 80% 아파트 창을 연다 (세환)
//     onClose: () => { ... },                        // 닫기
//   });
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
  noCoord: '위치 없음',
  overCap: '상한 초과',
};

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

  const draw = () => {
    const area = apartment.areas[index];
    const areaGroup = LIST_GROUPS.find((g) => g.key === area.category);
    body.replaceChildren();

    const head = listEl('div', 'list-card__head');
    head.append(listEl('h3', 'list-card__name', apartment.name));
    head.append(listEl('span', `badge badge--${area.category}`, areaGroup.badge));
    body.append(head);

    const meta = listEl('p', 'list-card__meta', `${format.area(area.supply_area, area.exclusive_area)} · 거래 ${format.comma(area.trade_count)}건`);
    if (apartment.latitude === null || apartment.longitude === null) {
      meta.append(listEl('span', 'list-card__tag', LIST_TEXT.noCoord));
    }
    // 평균가가 상품의 대상 주택 가격 상한을 넘는 면적 (FR-LOAN-14). 알리기만 하고 빼지 않는다
    if (area.over_price_cap) {
      meta.append(listEl('span', 'list-card__tag list-card__tag--cap', LIST_TEXT.overCap));
    }
    body.append(meta);
    body.append(listMoneyLine(area));
    body.setAttribute('aria-label', `${apartment.name}, ${areaGroup.badge}`);
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
      draw();
    });
    page.textContent = `1/${apartment.areas.length}`;
    card.append(next);
  }

  draw();
  card.dataset.category = group.key;
  return card;
}

function listHead(result, options) {
  const head = listEl('header', 'list__head');
  const where = options.where || {};
  const place = [where.gu, where.dong].filter(Boolean).join(' ');
  const count = `${format.comma(result.counts.total)}곳`;
  head.append(listEl('h2', 'list__title', place ? `${place} · ${count}` : count));

  // 안내 아이콘 ( ! ). 누르거나 마우스를 올리면 실거래 기록 안내가 뜬다 (FR-COMMON-02)
  const info = listEl('span', 'list__info-wrap');
  const button = listEl('button', 'list__info', '!');
  button.type = 'button';
  button.setAttribute('aria-label', '안내');
  const tip = listEl('span', 'list__tip', LIST_TEXT.info);
  tip.setAttribute('role', 'tooltip');
  button.addEventListener('click', () => info.classList.toggle('list__info-wrap--open'));
  info.append(button, tip);
  head.append(info);

  if (options.onSort) head.append(listSortMenu(options.sort || 'category', options.onSort));

  const close = listEl('button', 'list__close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', '닫기');
  close.addEventListener('click', () => options.onClose && options.onClose());
  head.append(close);
  return head;
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

function listEmpty(title, help, buttonText, onButton) {
  const box = listEl('div', 'list__empty');
  box.append(listEl('p', 'list__empty-title', title));
  box.append(listEl('p', 'list__empty-help', help));
  if (buttonText) {
    const button = listEl('button', 'link-button list__empty-button', buttonText);
    button.type = 'button';
    button.addEventListener('click', onButton);
    box.append(button);
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
    try {
      const result = await api.post('/api/apartments/search', { conditions: guard.conditions(), where, sort });
      listView.render(container, result, { ...handlers, where, sort, onSort });
      return result;
    } catch (error) {
      container.replaceChildren(listEl('p', 'notice notice--error', error.detail));
      throw error;
    }
  },

  // A-05 응답으로 목록을 그린다. options: { where, sort, onSort, onSelect, onClose } (모두 없어도 된다)
  render(container, result, options = {}) {
    const root = listEl('section', 'list');
    root.append(listHead(result, options));

    // 결과 없음 (P-05 ⑨, FR-APT-07)
    if (result.counts.total === 0) {
      root.append(listEmpty(LIST_TEXT.emptyTitle, LIST_TEXT.emptyHelp));
      container.replaceChildren(root);
      return;
    }

    const chips = listEl('div', 'list__chips');
    LIST_GROUPS.forEach((g) => chips.append(listEl('span', `chip chip--${g.key}`, `${g.chip} ${format.comma(result.counts[g.key])}`)));
    root.append(chips);

    // 아파트는 있지만 목표할 수 있는 곳이 없음 (A6). '조건 수정'은 저축 계획 단계로 간다
    if (result.counts.now === 0 && result.counts.within === 0) {
      root.append(listEmpty(LIST_TEXT.noTargetTitle, LIST_TEXT.noTargetHelp, LIST_TEXT.noTargetButton,
        () => { location.href = 'plan.html'; }));
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
