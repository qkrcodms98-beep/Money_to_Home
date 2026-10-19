// 시나리오 탭의 그래프 두 개 (2026-10-18). 담당: 김해원
//
// "조건 바꿔 보기" 위에 "숫자로 보는 이 아파트" 묶음을 둔다. scenario.js의 draw()가 부른다.
//   scenarioCharts.section({ apartmentId, areaBand, result, place })  → <section> (그릴 자리)
//     result  A-07 응답. 선(평균가, 쓸 수 있는 자금, 지금 보유자산)에 쓴다. "다시 계산"하면 새 값으로 다시 그린다
//     place   { gu, dong }. 둘째 그래프의 제목
//
//   ① 최근 1년 실거래: 그 면적의 거래를 점으로 (해제된 거래는 빈 점). 평균가 · 쓸 수 있는 자금 · 지금 보유자산 선
//   ② 같은 동 같은 면적 안에서의 위치: 같은 구·동, 같은 면적대 아파트의 평균가 막대. 이 아파트만 파랑
//
// 모양 (2026-10-19): 판 없이 탭 폭 전체를 쓴다. 점선 격자, 오른쪽 축, 선 끝의 알약 이름표 (주식·금융 앱의 흔한 모양).
// 글자가 줄어들지 않게 그릴 때의 실제 폭(px)으로 그린다. 창 폭이 바뀌면 다시 그린다.
// 자료는 A-27 GET /api/apartments/{id}/price-history?area_band= (DB 값 그대로). 아파트·면적마다 한 번만 받는다.
// 숫자는 서버가 준 값만 쓴다 (NFR-13). 그래프의 좌표만 여기서 정한다. 글자는 textContent로 넣는다.
// 앞으로의 집값은 그리지 않는다. 묶음 제목 옆 (?)는 다른 용어 설명과 같은 말풍선이다 (glossary.js).

const SCENARIO_CHART_TEXT = {
  title: '숫자로 보는 이 아파트',
  help: '최근 1년 실거래 기록과 입력한 값으로만 그립니다. 앞으로의 집값은 예측하지 않습니다.',
  trades: '최근 1년 실거래',
  neighbors: (dong, area) => `${dong} 같은 면적 (전용 ${area}㎡대) 안에서의 위치`,
  source: '국토교통부 실거래가 · 계약일 기준',
  neighborSource: '각 아파트의 최근 1년 실거래 평균가',
  loading: '그래프를 불러오는 중입니다.',
  failed: '그래프를 불러오지 못했습니다.',
};

// (?) 말풍선의 문장. glossary.js의 용어 목록에 더한다
if (typeof GLOSSARY_TERMS !== 'undefined') {
  GLOSSARY_TERMS.charts = { title: '그래프', text: SCENARIO_CHART_TEXT.help };
}

// 그래프는 글 폭보다 이만큼 넓게 그린다 (new-style.css의 .scenario-chart margin: 왼쪽 16 + 오른쪽 12)
const SCENARIO_CHART_BLEED = 28;

const scenarioCharts = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const cache = new Map(); // '아파트:면적대' → Promise(A-27 응답)
  const FONT = 11; // 그래프 글자 크기(px)

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };
  const svgEl = (tag, attrs, text) => {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const color = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();
  const short = (won) => format.won(won).replace(/ ?원$/, ''); // "2억 634만"
  // 축 글자는 더 짧게: "2.1억", "8,500만"
  const axis = (won) => (won >= 100_000_000 ? `${(won / 100_000_000).toFixed(won % 100_000_000 === 0 ? 0 : 1)}억` : `${format.comma(Math.round(won / 10_000))}만`);

  function load(apartmentId, areaBand) {
    const key = `${apartmentId}:${areaBand}`;
    if (!cache.has(key)) {
      const promise = api.get(`/api/apartments/${apartmentId}/price-history?area_band=${areaBand}`);
      promise.catch(() => cache.delete(key)); // 실패하면 다음에 다시 받는다
      cache.set(key, promise);
    }
    return cache.get(key);
  }

  // 선의 이름과 값. 목표 기간이 "지금"이면 지금 보유자산 선은 겹치므로 뺀다
  function lines(result) {
    const when = result.target_years === 0 ? '지금' : `${result.target_years}년 뒤`;
    const loan = result.loan && result.loan.choice === 'product';
    const funds = result.price - result.shortage; // 쓸 수 있는 자금 = 집값 − 부족자금 (서버 값)
    const out = [{ key: 'funds', value: funds, label: `${when} ${loan ? '쓸 수 있는 자금' : '자기자금'}`, color: color('--color-within'), ink: color('--color-within-text') }];
    if (result.target_years !== 0) out.push({ key: 'now', value: result.current_assets, label: '지금 보유자산', color: color('--color-text-hint'), ink: color('--color-text-sub') });
    return out;
  }

  // 축 눈금: 범위를 3 ~ 4칸으로 나눈 깔끔한 값
  function ticks(lo, hi) {
    const span = hi - lo;
    const steps = [10_000_000, 20_000_000, 25_000_000, 50_000_000, 100_000_000, 200_000_000, 250_000_000, 500_000_000, 1_000_000_000];
    const step = steps.find((s) => span / s <= 4) || steps[steps.length - 1];
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
    return out;
  }

  // 알약 이름표. 글자 폭은 대략 (한글 1글자 ≈ 글자 크기)
  function pill(svg, x, y, text, fill, ink, anchor = 'end') {
    const w = Math.round(text.length * FONT * 0.82) + 12;
    const h = 18;
    const left = anchor === 'end' ? x - w : x;
    svg.append(svgEl('rect', { x: left, y: y - h / 2, width: w, height: h, rx: h / 2, fill }));
    svg.append(svgEl('text', { x: left + w / 2, y: y + 4, 'text-anchor': 'middle', 'font-size': FONT - 1, 'font-weight': 700, fill: ink }, text));
    return { top: y - h / 2, bottom: y + h / 2 };
  }

  // 그래프 하나의 틀: 번호 · 제목, 한 줄 설명, 그래프, 범례·출처
  function block(no, title, say) {
    const wrap = el('div', 'scenario-chart-block');
    const head = el('h4', 'scenario-chart__title');
    head.append(el('span', 'scenario-chart__no', no), document.createTextNode(title));
    const box = el('div', 'scenario-chart');
    wrap.append(head, say, box);
    return { wrap, box };
  }

  // ① 최근 1년 실거래
  function tradesChart(data, result, W) {
    const done = data.trades.filter((t) => !t.is_canceled);
    const say = el('p', 'scenario-chart__say');
    say.append(document.createTextNode(`이 면적은 최근 1년에 ${format.comma(done.length)}번 거래됐고, `), el('b', null, `평균 ${format.won(data.avg_price)}`), document.createTextNode('입니다.'));
    const { wrap, box } = block('1', SCENARIO_CHART_TEXT.trades, say);

    const H = 230; const L = 4; const R = W - 44; const T = 16; const B = H - 26; // 오른쪽 44px는 축 글자
    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `최근 1년 거래 ${done.length}건, 평균 ${format.won(data.avg_price)}` });
    const prices = data.trades.map((t) => t.price);
    const marks = lines(result);
    // 선이 거래보다 아주 멀면(1.6배 넘게) 축에 넣지 않고 위·아래 끝에 이름표만 둔다 (점이 한쪽에 몰리지 않게)
    const pMin = Math.min(...prices, data.avg_price);
    const pMax = Math.max(...prices, data.avg_price);
    const inRange = marks.filter((m) => m.value <= pMax * 1.6 && m.value >= pMin / 1.6);
    const lo0 = Math.min(pMin, ...inRange.map((m) => m.value));
    const hi0 = Math.max(pMax, ...inRange.map((m) => m.value));
    const pad = (hi0 - lo0) * 0.14 || hi0 * 0.1;
    const lo = Math.max(0, lo0 - pad); const hi = hi0 + pad;
    const t0 = new Date(data.period_start).getTime(); const t1 = new Date(data.period_end).getTime();
    const span = Math.max(t1 - t0, 1);
    const X = (d) => L + 10 + (new Date(d).getTime() - t0) / span * (R - L - 20);
    const Y = (v) => B - (v - lo) / (hi - lo) * (B - T);
    const sub = color('--color-text-hint');

    // 격자 (점선)와 오른쪽 축
    ticks(lo, hi).forEach((v) => {
      svg.append(svgEl('line', { x1: L, x2: R, y1: Y(v), y2: Y(v), stroke: color('--color-line'), 'stroke-dasharray': '3 4' }));
      svg.append(svgEl('text', { x: W - 2, y: Y(v) + 4, 'text-anchor': 'end', 'font-size': FONT - 1, fill: sub }, axis(v)));
    });
    svg.append(svgEl('line', { x1: L, x2: R, y1: B, y2: B, stroke: color('--color-line-strong') }));
    // 가로축: 처음 · 가운데 · 끝 달
    [t0, (t0 + t1) / 2, t1].forEach((t, i) => {
      const d = new Date(t);
      svg.append(svgEl('text', { x: X(d), y: B + 17, 'text-anchor': i === 0 ? 'start' : i === 2 ? 'end' : 'middle', 'font-size': FONT - 1, fill: sub },
        `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`));
    });

    // 평균가 위쪽을 아주 옅게 칠해 "여기보다 비싸게 팔린 곳"을 드러낸다
    const avgY = Y(data.avg_price);
    svg.append(svgEl('rect', { x: L, y: T, width: R - L, height: Math.max(avgY - T, 0), fill: color('--color-primary'), opacity: 0.04 }));

    // 선과 이름표. 이름표끼리 겹치면 위아래로 비킨다
    const used = [];
    const place = (y) => {
      let at = y;
      used.forEach((u) => { if (Math.abs(at - u) < 20) at = u + (at < u ? -20 : 20); });
      used.push(at);
      return at;
    };
    const hline = (v, stroke, dash, label, fill, ink) => {
      svg.append(svgEl('line', { x1: L, x2: R, y1: Y(v), y2: Y(v), stroke, 'stroke-width': 1.5, 'stroke-dasharray': dash }));
      pill(svg, R, place(Y(v)), label, fill, ink);
    };
    hline(data.avg_price, color('--color-primary'), '5 4', `평균 ${short(data.avg_price)}`, color('--color-primary'), '#fff');
    inRange.forEach((m) => hline(m.value, m.color, '', `${m.label} ${short(m.value)}`, m.key === 'funds' ? m.color : color('--color-line'), m.key === 'funds' ? '#fff' : m.ink));
    // 범위 밖의 선: 위·아래 끝에 화살표 이름표
    marks.filter((m) => !inRange.includes(m)).forEach((m) => {
      const up = m.value > hi;
      pill(svg, R, up ? T + 2 : B - 12, `${up ? '↑' : '↓'} ${m.label} ${short(m.value)}`, m.key === 'funds' ? m.color : color('--color-line'), m.key === 'funds' ? '#fff' : m.ink);
    });

    // 점. 같은 날 같은 값이 겹치면 해제된 거래를 조금 옆으로
    data.trades.forEach((t) => {
      const off = t.is_canceled ? 7 : 0;
      svg.append(svgEl('circle', {
        cx: X(t.contract_date) + off, cy: Y(t.price), r: 5.5,
        fill: t.is_canceled ? color('--color-bg') : color('--color-primary'),
        stroke: t.is_canceled ? sub : color('--color-bg'), 'stroke-width': 2,
        opacity: t.is_canceled ? 1 : 0.9,
      }));
    });
    box.append(svg);

    const foot = el('div', 'scenario-chart__foot');
    const legend = el('div', 'scenario-chart__legend');
    const item = (cls, style, text) => {
      const span = el('span');
      const mark = el('i', cls);
      Object.assign(mark.style, style);
      span.append(mark, document.createTextNode(text));
      legend.append(span);
    };
    item('scenario-chart__dot', { background: color('--color-primary') }, '거래');
    if (data.trades.some((t) => t.is_canceled)) item('scenario-chart__dot', { background: color('--color-bg'), boxShadow: `inset 0 0 0 2px ${sub}` }, '해제된 거래');
    foot.append(legend, el('p', 'scenario-chart__src', `${SCENARIO_CHART_TEXT.source} · ${data.period_start.slice(0, 7).replace('-', '.')} ~ ${data.period_end.slice(0, 7).replace('-', '.')}`));
    box.append(foot);
    return wrap;
  }

  // ② 같은 동 같은 면적 안에서의 위치. 한 곳뿐이면 그리지 않는다. 많으면 이 아파트 둘레 12곳만
  function neighborsChart(data, result, place, W) {
    const all = data.neighbors;
    if (all.length < 2) return null;
    const me = all.findIndex((n) => n.is_self);
    const rank = me + 1;
    let rows = all;
    if (all.length > 12) {
      const start = Math.min(Math.max(me - 5, 0), all.length - 12);
      rows = all.slice(start, start + 12);
    }
    const say = el('p', 'scenario-chart__say');
    const where = rank === 1 ? '가장 싼 곳' : rank === all.length ? '가장 비싼 곳' : `${rank}번째로 싼 곳`;
    say.append(document.createTextNode(`같은 동 같은 면적 ${format.comma(all.length)}곳 가운데 `), el('b', null, where), document.createTextNode('입니다.'));
    const { wrap, box } = block('2', SCENARIO_CHART_TEXT.neighbors(place.dong, data.area_band), say);

    // 줄마다: 왼쪽 이름, 가운데 둥근 트랙 위 막대, 오른쪽 금액
    const rowH = 30; const nameW = 92; const valueW = 74; const T = 22;
    const L = nameW; const R = W - valueW;
    const funds = lines(result)[0];
    const vmax = Math.max(...rows.map((n) => n.avg_price));
    const showFunds = funds.value <= vmax * 1.3; // 너무 멀면 선을 빼고 글로만
    const top = Math.max(vmax, showFunds ? funds.value : 0) * 1.04;
    const X = (v) => L + v / top * (R - L);
    const H = T + rows.length * rowH + 4;
    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `같은 동 같은 면적 ${all.length}곳 가운데 ${where}` });
    const track = color('--color-bg-sub');
    rows.forEach((n, i) => {
      const y = T + i * rowH;
      const self = n.is_self;
      if (self) svg.append(svgEl('rect', { x: 0, y: y - 2, width: W, height: rowH - 2, rx: 8, fill: color('--color-primary-soft') }));
      const name = n.name.length > 8 ? `${n.name.slice(0, 7)}…` : n.name;
      svg.append(svgEl('text', { x: 8, y: y + rowH / 2 + 2, 'font-size': FONT + 1, 'font-weight': self ? 700 : 400, fill: self ? color('--color-text') : color('--color-text-sub') }, name));
      svg.append(svgEl('rect', { x: L, y: y + rowH / 2 - 7, width: R - L, height: 10, rx: 5, fill: self ? color('--color-bg') : track }));
      svg.append(svgEl('rect', { x: L, y: y + rowH / 2 - 7, width: Math.max(X(n.avg_price) - L, 6), height: 10, rx: 5, fill: self ? color('--color-primary') : color('--color-line-strong') }));
      svg.append(svgEl('text', { x: W - 8, y: y + rowH / 2 + 2, 'text-anchor': 'end', 'font-size': FONT, 'font-weight': self ? 700 : 400, fill: self ? color('--color-primary') : color('--color-text-sub') }, short(n.avg_price)));
    });
    if (showFunds) {
      const x = X(funds.value);
      svg.append(svgEl('line', { x1: x, x2: x, y1: T - 4, y2: H - 4, stroke: funds.color, 'stroke-width': 2, 'stroke-dasharray': '4 3' }));
      // 이름표는 위쪽에. 오른쪽으로 넘치면 왼쪽으로 붙인다
      const text = `${funds.label} ${short(funds.value)}`;
      const w = Math.round(text.length * FONT * 0.82) + 12;
      pill(svg, Math.min(Math.max(x - w / 2, 0), W - w), 10, text, funds.color, '#fff', 'start');
    }
    box.append(svg);
    const foot = el('div', 'scenario-chart__foot');
    const src = all.length > rows.length ? `${SCENARIO_CHART_TEXT.neighborSource} · ${all.length}곳 가운데 이 아파트 둘레 ${rows.length}곳` : SCENARIO_CHART_TEXT.neighborSource;
    foot.append(el('p', 'scenario-chart__src', showFunds ? src : `${src} · ${funds.label} ${short(funds.value)}`));
    box.append(foot);
    return wrap;
  }

  function fill(section, data, result, place) {
    const body = section.querySelector('.scenario-charts__body');
    const W = Math.max(Math.round(body.getBoundingClientRect().width) + SCENARIO_CHART_BLEED, 280);
    const parts = [tradesChart(data, result, W)];
    const second = neighborsChart(data, result, place, W);
    if (second) parts.push(second);
    body.replaceChildren(...parts);
    section.dataset.width = String(W);
  }

  return {
    section({ apartmentId, areaBand, result, place }) {
      const section = el('section', 'scenario-charts');
      const title = el('h3', 'scenario-charts__title', SCENARIO_CHART_TEXT.title);
      if (typeof glossary !== 'undefined' && GLOSSARY_TERMS.charts) title.append(glossary.button('charts'));
      section.append(title);
      const body = el('div', 'scenario-charts__body');
      body.append(el('p', 'scenario-charts__wait', SCENARIO_CHART_TEXT.loading));
      section.append(body);
      load(apartmentId, areaBand).then((data) => {
        if (!section.parentNode) return; // 그사이 다시 그렸다
        if (!data.trades.length) { section.hidden = true; return; }
        fill(section, data, result, place);
        // 창 폭이 바뀌면(PC에서 창 크기를 바꿈) 그 폭으로 다시 그린다
        if (typeof ResizeObserver !== 'undefined') {
          const watch = new ResizeObserver(() => {
            if (!section.isConnected) { watch.disconnect(); return; }
            const w = Math.round(body.getBoundingClientRect().width) + SCENARIO_CHART_BLEED;
            if (w > 0 && Math.abs(w - Number(section.dataset.width)) > 4) fill(section, data, result, place);
          });
          watch.observe(body);
        }
      }).catch(() => {
        body.replaceChildren(el('p', 'scenario-charts__wait', SCENARIO_CHART_TEXT.failed));
      });
      return section;
    },
  };
})();
