-- 머니 to 홈 대출 상품 예시 자료 (1차)
-- 실행: HeidiSQL에서 이 파일을 열고 F9. db/schema.sql을 먼저 실행해야 한다.
--
-- ※ 아래 숫자는 전부 개발용 예시다. 실제 상품의 조건이 아니다.
--    조사(R-01, R-02)가 끝나면 담당자가 실제 값으로 바꾼다.
--    첫째 줄은 문서의 예시 계산(한도 3억 6,000만 원, 70%, 연 4.0%)과 같은 값이다.
--
-- 여러 번 실행해도 된다. 같은 번호의 줄은 이 파일의 값으로 덮어쓴다.

USE money_to_home;

INSERT INTO loan_products
  (id, name, institution, max_limit, ltv_ratio, annual_rate_pct,
   repayment_years_options, max_house_price,
   eligibility_summary, eligibility_text, base_date, source_url)
VALUES
  (1, '[예시] 첫째 상품', '한국주택금융공사', 360000000, 0.700, 4.000,
   '10,15,20,30', 600000000,
   '[예시] 자격 조건 요약', '[예시] 자격 조건 문구. 조사한 뒤 실제 문구로 바꾼다.',
   '2026-10-01', 'https://www.hf.go.kr'),
  (2, '[예시] 둘째 상품', '카카오뱅크', 500000000, 0.800, 4.500,
   '10,20,30,40', NULL,
   '[예시] 자격 조건 요약', '[예시] 자격 조건 문구. 조사한 뒤 실제 문구로 바꾼다.',
   '2026-10-01', 'https://www.kakaobank.com')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  institution = VALUES(institution),
  max_limit = VALUES(max_limit),
  ltv_ratio = VALUES(ltv_ratio),
  annual_rate_pct = VALUES(annual_rate_pct),
  repayment_years_options = VALUES(repayment_years_options),
  max_house_price = VALUES(max_house_price),
  eligibility_summary = VALUES(eligibility_summary),
  eligibility_text = VALUES(eligibility_text),
  base_date = VALUES(base_date),
  source_url = VALUES(source_url);
