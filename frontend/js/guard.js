// 입력이 빠졌으면 빠진 첫 단계로 보낸다 (FR-RESULT-10).
//
// 계산에 필요한 값이 하나라도 없으면 지도 화면은 계산하지 않는다.
// 지도 화면의 맨 처음에 guard.requireInput()을 부른다.

const STEP_PAGES = { finance: 'profile.html', loan: 'loan.html', plan: 'plan.html' };
const MAP_PAGE = 'map.html';

const isEmpty = (value) => value === undefined || value === null;

const guard = {
  // 빠진 첫 단계의 이름. 다 있으면 null. 'finance', 'loan', 'plan' 중 하나.
  missingStep() {
    const input = store.get('input');

    if (isEmpty(input.age) || isEmpty(input.annual_income) || isEmpty(input.current_assets)) {
      return 'finance';
    }
    if (isEmpty(input.loan_choice)) return 'loan';
    if (input.loan_choice === 'product' && (isEmpty(input.loan_product_id) || isEmpty(input.repayment_years))) {
      return 'loan';
    }
    if (isEmpty(input.monthly_saving) || isEmpty(input.target_years)) return 'plan';
    return null;
  },

  // 이어서 할 화면. 빠진 첫 단계의 화면이고, 다 넣었으면 지도다.
  // 시작 화면의 "시작하기"가 쓴다. 이 탭에서 입력하던 값이 있으면 보던 자리로 간다 (FR-PROFILE-11).
  resumePage() {
    const step = guard.missingStep();
    return step === null ? MAP_PAGE : STEP_PAGES[step];
  },

  // 빠진 단계가 있으면 그 화면으로 보내고 false를 돌려준다.
  requireInput() {
    const step = guard.missingStep();
    if (step === null) return true;
    location.replace(STEP_PAGES[step]);
    return false;
  },

  // 계산과 탐색 API에 보내는 conditions 묶음 (API 명세서 2.2).
  conditions() {
    const input = store.get('input');
    const withProduct = input.loan_choice === 'product';
    return {
      current_assets: input.current_assets,
      monthly_saving: input.monthly_saving,
      target_years: input.target_years,
      loan_choice: input.loan_choice,
      loan_product_id: withProduct ? input.loan_product_id : null,
      repayment_years: withProduct ? input.repayment_years : null,
    };
  },
};
