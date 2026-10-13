// 아래 창의 아파트 (P-06 ⑥ 30%, ⑦ 80%). 담당: 안세환
//
// 30%에 보이는 것 (guide_sehwan 4장, 와이어프레임 P-06 ⑥)
//   아파트명, 구분 배지, 이전·다음·닫기, 면적 고르기와 ㎡/평 전환,
//   "최근 1년 실거래 평균 3억 원", "5년 뒤 기준 여유 2,000만 원"
//   대출 없이 계산이면 기준 줄에 "· 대출 없이"를 붙인다 (와이어프레임 "P-06 아파트 30% (대출 없이)").
// 80% 이상에는 탭(아파트 정보, 시나리오)이 보인다. 탭의 내용은 아직 없다.
//   아파트 정보: 아파트 한 곳 API(A-06)를 붙일 때 이 파일이 채운다.
//   시나리오:    박채은의 scenario.js가 #scenario-panel에 그린다.
//
// 값은 모두 A-05 응답에 있다. 서버를 다시 부르지 않는다.
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

const aptPanel = {
  apartment: null,
  areaIndex: 0, // 고른 면적. areas는 평균가가 낮은 순이고 첫째가 처음에 골라져 있다 (FR-APT-05)
  listPlace: null,
  handlers: {},

  init(handlers) {
    aptPanel.handlers = handlers;

    document.getElementById('apt-prev').addEventListener('click', () => aptPanel.move(-1));
    document.getElementById('apt-next').addEventListener('click', () => aptPanel.move(1));
    document.getElementById('apt-close').addEventListener('click', () => handlers.onClose());
    document.getElementById('apt-back').addEventListener('click', () => handlers.onBackToList());

    document.querySelectorAll('.apt__unit-option').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.unit === aptPanel.unit()) return;
        store.set('map', { area_unit: button.dataset.unit });
        handlers.onUnitChange();
        aptPanel.render();
      });
    });

    document.querySelectorAll('.apt__tab').forEach((tab) => {
      tab.addEventListener('click', () => aptPanel.selectTab(tab.id));
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
    document.querySelectorAll('.apt__tab').forEach((tab) => {
      const selected = tab.id === tabId;
      tab.setAttribute('aria-selected', String(selected));
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
    });
  },

  render() {
    const { apartment, areaIndex, listPlace, handlers } = aptPanel;
    if (!apartment) return;
    const area = apartment.areas[areaIndex];
    const unit = aptPanel.unit();

    // 이름과 배지. 목록에서 열었으면 첫 줄에 "← ○○ 목록"을 두고 이름은 다음 줄로 (목업 2038:486)
    const title = document.getElementById('apt-title');
    const back = document.getElementById('apt-back');
    const titleRow = document.getElementById('apt-title-row');
    back.hidden = !listPlace;
    titleRow.hidden = !listPlace;
    if (listPlace) {
      back.textContent = `← ${listPlace} 목록`;
      titleRow.append(title);
    } else {
      document.getElementById('apt-lead').append(title);
    }
    document.getElementById('apt-name').textContent = apartment.name;
    const badge = document.getElementById('apt-badge');
    badge.className = `badge badge--${area.category}`; // 고른 면적의 구분
    badge.textContent = APT_CATEGORY_NAMES[area.category];

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
  },
};
