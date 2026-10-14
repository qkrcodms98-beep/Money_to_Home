// P-04 ⑤ 입력 요약 (3차, T-PROFILE-09). 담당: 김해원
//
// 저축 계획의 "확인" 뒤, 지도 앞에 한 번 나온다. 이 탭에 보관한 입력을 세 묶음으로 보여 준다.
//   재무정보 : 만 나이, 연 소득, 현재 보유자산
//   대출상품 : 상품, 상환 기간, 예상 최대 대출금액 (A-03). 대출 없이 계산이면 "대출 없이 계산" 한 줄
//   저축 계획: 월 저축 가능액, 목표 기간, ○년 뒤 자기자금 (A-04)
// 금액은 서버가 계산한 값만 쓴다 (NFR-13). 받지 못하면 그 줄만 "-"로 둔다. 서버에서 온 글자는 textContent로 넣는다.

(() => {
  if (!guard.requireInput()) return;
  const input = store.get('input');
  const $ = (id) => document.getElementById(id);
  const yearsText = (years) => (years === 0 ? '지금' : `${years}년`);

  function fill(id, rows) {
    $(id).replaceChildren(...rows.map(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'summary-card__row';
      const name = document.createElement('dt');
      name.textContent = label;
      const text = document.createElement('dd');
      text.textContent = value;
      row.append(name, text);
      return row;
    }));
  }

  fill('rows-finance', [
    ['만 나이', `${input.age}세`],
    ['연 소득', format.won(input.annual_income)],
    ['현재 보유자산', format.won(input.current_assets)],
  ]);

  const ownLabel = input.target_years === 0 ? '지금 자기자금' : `${input.target_years}년 뒤 자기자금`;
  const planRows = (own) => [
    ['월 저축 가능액', format.won(input.monthly_saving)],
    ['목표 기간', yearsText(input.target_years)],
    [ownLabel, own],
  ];
  fill('rows-plan', planRows('-'));
  api.post('/api/calc/plan', {
    current_assets: input.current_assets, monthly_saving: input.monthly_saving, target_years: input.target_years,
  }).then((data) => fill('rows-plan', planRows(format.won(data.own_funds)))).catch(() => {});

  if (input.loan_choice === 'none') {
    fill('rows-loan', [['대출', '대출 없이 계산']]);
    return;
  }
  const loanRows = (name, max) => [
    ['상품', name],
    ['상환 기간', `${input.repayment_years}년`],
    ['예상 최대 대출금액', max],
  ];
  fill('rows-loan', loanRows('-', '-'));
  Promise.all([
    api.get('/api/loan-products').catch(() => null),
    api.post('/api/calc/loan', {
      current_assets: input.current_assets, loan_product_id: input.loan_product_id, repayment_years: input.repayment_years,
    }).catch(() => null),
  ]).then(([products, loan]) => {
    const list = products && (products.products || products);
    const product = Array.isArray(list) ? list.find((item) => item.id === input.loan_product_id) : null;
    fill('rows-loan', loanRows(product ? product.name : '-', loan ? format.won(loan.max_loan_amount) : '-'));
  });
})();
