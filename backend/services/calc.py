"""계산 모듈. 담당: 박채은

계산 규칙 C-01 ~ C-13을 이 파일에만 둔다 (NFR-13).
router와 화면에는 계산식을 쓰지 않고 이 파일의 함수를 부른다.

규칙
- 금액은 원 단위 정수로 받고 돌려준다 (NFR-12).
- 대출금액은 버림, 월 상환액은 반올림, 필요 월 저축액은 올림 (요구사항 명세서 부록 C).
- DB와 요청을 모른다. 숫자를 받아 숫자를 돌려준다. 그래서 DB 없이 테스트할 수 있다.
- 함수마다 tests/test_calc.py에 테스트를 붙인다.

만들 함수는 docs/06_architecture.md 4.3의 표에 있다. 이름과 받는 값은 그 표를 따른다.

    accumulated_saving       C-02       누적 저축액
    own_funds                C-03       목표 시점 자기자금
    loan_amount              C-05, C-13 예상 대출금액
    max_loan_amount          C-06       최대 예상 대출금액
    monthly_payment          C-07       예상 월 상환액
    target_price             C-08, C-13 목표 가능 가격
    category                 C-09       now, within, lack
    shortage                 C-10       부족자금. 음수면 여유자금
    required_monthly_saving  C-11       필요 월 저축액 또는 None
    allowed_growth_rate      C-12       허용 상승률 또는 None
"""
