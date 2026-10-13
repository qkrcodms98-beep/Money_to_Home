-- 머니 to 홈 대출 상품 자료 (1차)
-- 실행: HeidiSQL에서 이 파일을 열고 F9. db/schema.sql을 먼저 실행해야 한다.
--
-- 조사(R-01, R-02)한 실제 조건이다. 금리와 한도는 자주 바뀌므로 기준일을 함께 적는다.
--
-- 1. 한국주택금융공사 보금자리론 (기준일 2026-10-01)
--    - 조건: https://www.hf.go.kr/ko/sub01/sub01_01_01.do
--    - 금리: https://www.hf.go.kr/ko/sub01/sub01_01_04.do (2026년 10월 공시, 고정금리)
--      u-보금자리론 만기 10년 5.00 / 15년 5.10 / 20년 5.15 / 30년 5.20 / 40년 5.25 / 50년 5.30 (연 %)
--      대표 금리는 만기 30년의 5.20%로 정했다. 우대금리(최대 1.0%p)는 넣지 않았다.
--    - 최대 한도는 일반 3.6억 원이다. 생애최초 4.2억 원, 다자녀·전세사기피해자 4억 원은 넣지 않았다.
--    - 만기 40, 50년은 공사가 정한 조건을 갖춰야 고를 수 있다.
--
-- 2. 카카오뱅크 주택담보대출 (기준일 2026-09-17)
--    - 금리, 한도: 금융감독원 금융상품한눈에 공시 (2026-09-17, 아파트, 고정금리, 원리금분할상환)
--      https://finlife.fss.or.kr/finlife/ldng/houseMrtg/list.do?menuNo=700007
--      최저 5.42 / 최고 6.07 / 전월 평균 5.22 (연 %). 대표 금리는 최저금리 5.42%로 정했다.
--      최대 한도 10억 원
--    - 상환 기간, 자격 조건: 카카오뱅크 상품 페이지 (2026-10-13 확인)
--      https://www.kakaobank.com/products/mortgageLoan
--      상환 기간은 수도권과 규제지역이 15, 20, 25, 30년, 그 외 지역이 15, 25, 35, 40년이다.
--      광주 5개 구는 그 외 지역이므로 15, 25, 35, 40년을 넣었다.
--      자격 조건은 이 서비스가 다루는 주택구입자금의 것만 넣었다 (생활안정자금은 넣지 않음).
--    - 대출 비율 70%는 상품 공시가 아니라 비규제지역 주택담보대출의 일반 LTV 상한이다.
--      광주 5개 구는 비규제지역이다. 생애최초(80%)는 넣지 않았다.
--    - 대상 주택 가격 상한은 없다 (NULL).
--
-- 여러 번 실행해도 된다. 같은 번호의 줄은 이 파일의 값으로 덮어쓴다.

USE money_to_home;

INSERT INTO loan_products
  (id, name, institution, max_limit, ltv_ratio, annual_rate_pct,
   repayment_years_options, max_house_price,
   eligibility_summary, eligibility_text, base_date, source_url)
VALUES
  (1, '보금자리론', '한국주택금융공사', 360000000, 0.700, 5.200,
   '10,15,20,30,40,50', 600000000,
   '무주택 또는 1주택, 부부합산 연소득 7천만원 이하, 6억원 이하 주택',
   '민법상 성년인 대한민국 국민(재외국민, 외국국적동포 포함)
본건 담보주택을 제외하고 무주택 또는 1주택(일시적 2주택은 기존 주택을 3년 안에 처분하는 조건)
부부합산 연소득 7천만원 이하(신혼부부 8,500만원, 미성년 자녀 1명 9천만원, 다자녀 가구 1억원 이하)
대출승인일 현재 6억원 이하의 공부상 주택(구입용도는 시세, 감정가, 매매가 중 하나라도 6억원을 넘으면 불가)
NICE 신용평가 CB점수 271점 이상
LTV 최대 70%, DTI 최대 60%
대출 한도 최대 3.6억원(생애최초 4.2억원, 다자녀·전세사기피해자 4억원)
만기 40년, 50년은 별도 조건을 갖춰야 선택 가능',
   '2026-10-01', 'https://www.hf.go.kr/ko/sub01/sub01_01_01.do'),
  (2, '주택담보대출', '카카오뱅크', 1000000000, 0.700, 5.420,
   '15,25,35,40', NULL,
   '1개월 이상 재직 근로소득자 또는 소득 입증이 되는 사업소득자, 무주택 또는 1주택 세대',
   '현재 직장에서 1개월 이상 재직 중인 근로소득자
소득금액증명원으로 소득 입증이 가능한 사업소득자
(세대합산) 무주택 또는 1주택 세대
구입 예정 주택에 대한 매매계약을 체결하고 소유권이전이 완료되지 않은 경우 신청 가능
무주택세대라도 주택담보대출을 보유한 경우 신청 불가',
   '2026-09-17', 'https://www.kakaobank.com/products/mortgageLoan')
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
