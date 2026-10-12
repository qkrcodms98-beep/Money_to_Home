// 금액과 면적의 표기. 화면에 숫자를 보여 줄 때는 이 파일의 함수를 쓴다.
//
// 여기 있는 것은 표기뿐이다. 대출금액 같은 계산은 서버가 한다 (NFR-13).

const PYEONG = 3.3058; // 1평 = 3.3058㎡

const format = {
  // 원 → "3억 2,500만 원", "8,500만 원". 만원 단위로 반올림한다 (FR-COMMON-11).
  won(amount) {
    const man = Math.round(Math.abs(amount) / 10000);
    const eok = Math.floor(man / 10000);
    const rest = man % 10000;
    const sign = amount < 0 && man > 0 ? '-' : '';

    let text;
    if (eok > 0 && rest > 0) text = `${eok.toLocaleString('ko-KR')}억 ${rest.toLocaleString('ko-KR')}만 원`;
    else if (eok > 0) text = `${eok.toLocaleString('ko-KR')}억 원`;
    else text = `${rest.toLocaleString('ko-KR')}만 원`;
    return sign + text;
  },

  // 입력란의 만원 값 → 원. 서버에 보낼 때 쓴다.
  manToWon: (man) => man * 10000,

  // 원 → 만원. 입력란을 채울 때 쓴다.
  wonToMan: (won) => Math.round(won / 10000),

  // 숫자에 천 단위 쉼표. 12000 → "12,000"
  comma: (number) => number.toLocaleString('ko-KR'),

  // ㎡ → 평. 반올림한 정수 (요구사항 명세서 부록 C).
  pyeong: (squareMeter) => Math.round(squareMeter / PYEONG),

  // 면적 표기 (FR-APT-13, 14).
  //   공급면적이 있으면 "111㎡ (전용 84㎡)", 없으면 "전용 59㎡"
  //   unit이 'pyeong'이면 "34평 (전용 25평)", "전용 18평"
  area(supplyArea, exclusiveArea, unit = 'm2') {
    const show = (value) => (unit === 'pyeong' ? `${format.pyeong(value)}평` : `${Math.round(value)}㎡`);
    if (supplyArea === null || supplyArea === undefined) return `전용 ${show(exclusiveArea)}`;
    return `${show(supplyArea)} (전용 ${show(exclusiveArea)})`;
  },
};
