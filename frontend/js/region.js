// 지역 선택 (P-05 ⑬). 담당: 김해원
//
// 구와 동을 골라 지도를 그 지역으로 옮긴다 (FR-APT-02). 선택지는 거래 자료가 있는 구와 동만 나온다 (A-02).
// 지도 화면에 묶이지 않는다. 그릴 요소와 구·동 목록을 받아 그 안에만 그린다.
//
//   regionPicker.open(요소, regions, { gu: '서구', dong: '치평동' }, (picked) => { ... });
//     regions : GET /api/regions 의 regions
//     지금 고른 지역 : dong이 null이면 구 전체
//     picked  : { gu, dong, latitude, longitude }. "이 지역으로 이동"을 눌렀을 때 한 번 부른다.
//               위치는 그 동(또는 구)의 아파트 좌표 평균이다. 좌표가 없으면 null이다.
//   regionPicker.close();
//
// 서버에서 온 글자는 textContent로 넣는다. innerHTML을 쓰지 않는다.

const regionPicker = (() => {
  let container = null;
  let regions = [];
  let picked = { gu: null, dong: null };
  let onPick = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const findGu = (gu) => regions.find((region) => region.gu === gu) || null;

  function option(text, selected, className, onClick) {
    const button = el('button', className, text);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(selected));
    button.addEventListener('click', onClick);
    return button;
  }

  function render() {
    const region = findGu(picked.gu);
    const sheet = el('div', 'region-sheet__inner');

    const head = el('header', 'region-sheet__head');
    head.append(el('h2', 'region-sheet__title', '지역 선택'));
    const close = el('button', 'region-sheet__close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', '닫기');
    close.addEventListener('click', api.close);
    head.append(close);

    // 구: 한 줄로 붙인 선택지
    const guRow = el('div', 'region-sheet__gu');
    for (const item of regions) {
      guRow.append(option(item.gu, item.gu === picked.gu, 'region-sheet__gu-option', () => {
        picked = { gu: item.gu, dong: null }; // 구를 바꾸면 동은 "전체"로 돌아간다
        render();
      }));
    }

    // 동: "○○구 전체" 한 줄과 동 이름 격자
    const dongs = el('div', 'region-sheet__dongs');
    if (region) {
      dongs.append(option(`${region.gu} 전체`, picked.dong === null, 'region-sheet__dong region-sheet__dong--all', () => {
        picked = { gu: region.gu, dong: null };
        render();
      }));
      for (const item of region.dongs) {
        dongs.append(option(item.dong, item.dong === picked.dong, 'region-sheet__dong', () => {
          picked = { gu: region.gu, dong: item.dong };
          render();
        }));
      }
    }

    const go = el('button', 'button button--primary', '이 지역으로 이동');
    go.type = 'button';
    go.disabled = region === null;
    go.addEventListener('click', () => {
      const dong = region.dongs.find((item) => item.dong === picked.dong) || null;
      const place = dong || region;
      const result = { gu: region.gu, dong: dong ? dong.dong : null, latitude: place.latitude, longitude: place.longitude };
      const callback = onPick;
      api.close();
      if (callback) callback(result);
    });

    const body = el('div', 'region-sheet__body');
    body.append(el('p', 'region-sheet__label', '구'), guRow, el('p', 'region-sheet__label', '동'), dongs);
    const foot = el('div', 'region-sheet__foot');
    foot.append(el('p', 'region-sheet__note', '최근 1년 거래가 있는 구와 동만 나옵니다.'), go);

    sheet.append(el('div', 'region-sheet__handle'), head, body, foot);
    container.replaceChildren(sheet);
  }

  const api = {
    open(target, regionList, current, callback) {
      container = target;
      regions = regionList || [];
      const gu = findGu(current && current.gu) ? current.gu : regions[0] ? regions[0].gu : null;
      const region = findGu(gu);
      const dong = region && current && region.dongs.some((item) => item.dong === current.dong) ? current.dong : null;
      picked = { gu, dong };
      onPick = callback;
      render();
      container.hidden = false;
    },

    close() {
      if (!container) return;
      container.hidden = true;
      container.replaceChildren();
      onPick = null;
    },

    isOpen: () => Boolean(container) && !container.hidden,
  };
  return api;
})();
