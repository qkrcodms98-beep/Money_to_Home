// 비슷한 아파트 (FR-APT-17, 3차). 담당: 김목산
//
// 아파트 정보 탭의 기본 정보 아래(와이어프레임 C6)에 고른 아파트와 가격이 비슷한 아파트를 세 곳씩 보여 준다.
// 아파트 창에 묶이지 않는다. 그릴 요소를 받아 그 안에만 그린다. 카드 모양은 목록의 것(list.css의 .list-card)을 같이 쓴다.
//
//   <div id="apt-similar"></div>   (아파트 정보 탭. 기본 정보 아래)
//
//   similarView.load(요소, { apartmentId, areaBand }, { onPick });
//     apartmentId : 고른 아파트 번호
//     areaBand    : 고른 면적대. 이 면적의 평균가가 기준 가격이다
//     onPick      : 카드를 누르면 부른다. (apartment, areaBand) — apartment는 A-24 응답의 아파트 하나 그대로이고,
//                   areaBand는 카드에 보이던 면적대다. 그 아파트로 옮겨 가는 데 쓴다
//   similarView.clear(요소);   그린 것을 지운다 (다른 아파트로 옮겨 갈 때)
//
// A-24 POST /api/apartments/{id}/similar 를 부른다. 조건은 guard.conditions()가 만든다.
// 순서는 서버가 정한다: 같은 동 먼저, 그다음 같은 구의 다른 동. 그 안에서 기준 가격에 가까운 순.
// '다른 곳 보기'를 누르면 다음 세 곳(next_offset)을 부르고, 끝까지 보면 처음 세 곳으로 돌아간다.
// 후보가 세 곳 이하면 '다른 곳 보기'를 두지 않는다.
// 서버에서 온 글자는 textContent로 넣는다. innerHTML을 쓰지 않는다.

const SIMILAR_TEXT = {
  title: '내 조건과 비슷한 아파트',
  help: '같은 동부터, 고른 면적의 평균가와 가까운 순입니다.',
  more: '다른 곳 보기',
  sortCondition: '조건순',
  sortPrice: '가격순',
  empty: '같은 구에 비교할 아파트가 없습니다.',
  loadFail: '비슷한 아파트를 불러오지 못했습니다.',
  retry: '다시 시도',
  noCoord: '위치 없음',
  overCap: '상한 초과',
};

const SIMILAR_BADGE = { now: '지금 가능', within: '기간 내 가능', lack: '자금 부족' };

const similarView = (() => {
  // 요소마다 지금 부르는 요청의 번호. 늦게 온 앞의 응답이 뒤의 결과를 덮지 않게 한다
  const seqs = new WeakMap();

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  // 보이는 세 곳과 정렬. 조건순은 서버가 준 순서(같은 동 먼저, 기준 가격에 가까운 순), 가격순은 평균가가 낮은 순
  const lists = new WeakMap(); // 요소 → { apartments, onPick }
  const sorts = new WeakMap(); // 요소 → 'condition' | 'price'

  function paintList(container) {
    const data = lists.get(container);
    const body = container.querySelector('.similar__body');
    if (!data || !body) return;
    const shown = sorts.get(container) === 'price'
      ? [...data.apartments].sort((a, b) => a.areas[0].avg_price - b.areas[0].avg_price)
      : data.apartments;
    const list = el('ul', 'similar__list');
    list.setAttribute('aria-label', SIMILAR_TEXT.title);
    shown.forEach((apartment) => list.append(card(apartment, data.onPick)));
    body.replaceChildren(list);
  }

  // 조건순 | 가격순. '다른 곳 보기'(↻)는 load()가 이 뒤에 붙인다
  function sortButtons(container) {
    const box = el('div', 'similar__sort');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', '정렬');
    const now = sorts.get(container) || 'condition';
    [['condition', SIMILAR_TEXT.sortCondition], ['price', SIMILAR_TEXT.sortPrice]].forEach(([value, text]) => {
      const button = el('button', 'similar__sort-option', text);
      button.type = 'button';
      button.dataset.sort = value;
      button.setAttribute('aria-pressed', String(value === now));
      button.addEventListener('click', () => {
        sorts.set(container, value);
        box.querySelectorAll('.similar__sort-option').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sort === value)));
        paintList(container);
      });
      box.append(button);
    });
    return box;
  }

  // "평균 3억 원 · 여유 2,000만 원" 또는 "부족 2,500만 원". 부족자금이 음수면 여유다 (목록 카드와 같다)
  function moneyLine(area) {
    const line = el('p', 'list-card__money');
    line.append(el('span', null, `평균 ${format.won(area.avg_price)} · `));
    const gap = area.shortage > 0 ? `부족 ${format.won(area.shortage)}` : `여유 ${format.won(-area.shortage)}`;
    line.append(el('strong', `list-card__gap list-card__gap--${area.category}`, gap));
    return line;
  }

  // 카드 한 장. "109㎡ (전용 84㎡) · 서구 치평동" (와이어프레임 C6)
  function card(apartment, onPick) {
    const area = apartment.areas[0];
    const item = el('li', `list-card list-card--${area.category} similar__card`);
    const body = el('button', 'list-card__body');
    body.type = 'button';

    const head = el('div', 'list-card__head');
    head.append(el('h4', 'list-card__name', apartment.name));
    head.append(el('span', `badge badge--${area.category}`, SIMILAR_BADGE[area.category]));
    body.append(head);

    const meta = el('p', 'list-card__meta', `${apartment.gu} ${apartment.dong} · ${format.area(area.supply_area, area.exclusive_area)}`);
    if (apartment.latitude === null || apartment.longitude === null) {
      meta.append(el('span', 'list-card__tag', SIMILAR_TEXT.noCoord));
    }
    if (area.over_price_cap) {
      meta.append(el('span', 'list-card__tag list-card__tag--cap', SIMILAR_TEXT.overCap));
    }
    body.append(meta, moneyLine(area));
    body.setAttribute('aria-label', `${apartment.name}, ${apartment.gu} ${apartment.dong}, ${SIMILAR_BADGE[area.category]}`);
    body.addEventListener('click', () => onPick && onPick(apartment, area.area_band));
    item.append(body);
    return item;
  }

  function load(container, target, handlers = {}, offset = 0) {
    const mine = (seqs.get(container) || 0) + 1;
    seqs.set(container, mine);
    container.classList.add('similar');

    // 머리는 처음 한 번만 그린다. 다시 부를 때는 '다른 곳 보기'만 잠깐 끈다
    let head = container.querySelector('.similar__head');
    if (!head) {
      head = el('div', 'similar__head');
      head.append(el('h3', 'similar__title', SIMILAR_TEXT.title), sortButtons(container));
      container.replaceChildren(head, el('p', 'similar__help', SIMILAR_TEXT.help), el('div', 'similar__body'));
    }
    const more = head.querySelector('.similar__more');
    if (more) more.disabled = true;
    const body = container.querySelector('.similar__body');
    container.setAttribute('aria-busy', 'true');

    api.post(`/api/apartments/${target.apartmentId}/similar`, {
      conditions: guard.conditions(),
      area_band: target.areaBand,
      offset,
    }).then((result) => {
      if (seqs.get(container) !== mine) return;
      container.removeAttribute('aria-busy');

      // 후보가 세 곳보다 많을 때만 '다른 곳 보기'
      let button = head.querySelector('.similar__more');
      if (result.total > result.apartments.length) {
        if (!button) {
          button = el('button', 'similar__more');
          button.type = 'button';
          button.setAttribute('aria-label', SIMILAR_TEXT.more);
          button.title = SIMILAR_TEXT.more;
          button.append(el('span', 'similar__more-icon', '↻'));
          head.querySelector('.similar__sort').append(button);
        }
        button.disabled = false;
        button.onclick = () => load(container, target, handlers, Number(button.dataset.next));
        button.dataset.next = String(result.next_offset);
      } else if (button) {
        button.remove();
      }

      if (result.apartments.length === 0) {
        body.replaceChildren(el('p', 'similar__empty', SIMILAR_TEXT.empty));
        return;
      }
      lists.set(container, { apartments: result.apartments, onPick: handlers.onPick });
      paintList(container);
    }).catch(() => {
      if (seqs.get(container) !== mine) return;
      container.removeAttribute('aria-busy');
      const box = el('div', 'similar__error');
      box.setAttribute('role', 'alert');
      const retry = el('button', 'similar__retry', SIMILAR_TEXT.retry);
      retry.type = 'button';
      retry.addEventListener('click', () => load(container, target, handlers, offset));
      box.append(el('p', 'similar__error-text', SIMILAR_TEXT.loadFail), retry);
      body.replaceChildren(box);
      const button = head.querySelector('.similar__more');
      if (button) button.disabled = false;
    });
  }

  return {
    load: (container, target, handlers) => load(container, target, handlers, 0),
    clear(container) {
      seqs.set(container, (seqs.get(container) || 0) + 1);
      lists.delete(container);
      container.replaceChildren();
      container.removeAttribute('aria-busy');
    },
  };
})();
