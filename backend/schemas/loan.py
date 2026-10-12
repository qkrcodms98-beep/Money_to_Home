"""대출 상품 API의 요청과 응답 모양.

A-01(상품 목록)의 응답이 들어 있다.
A-03(대출 계산)의 요청과 응답은 담당자가 이 파일에 이어서 적는다.
"""
from datetime import date

from pydantic import BaseModel


class LoanProduct(BaseModel):
    id: int
    name: str
    institution: str
    max_limit: int  # 최대 한도. 원
    ltv_ratio: float  # 대출 비율. 70%면 0.7
    annual_rate_pct: float  # 대표 금리. 연 4.0%면 4.0
    repayment_years_options: list[int]
    max_house_price: int | None  # 대상 주택 가격 상한. 없으면 null
    eligibility_summary: str
    eligibility_text: str
    base_date: date
    source_url: str


class LoanProductsOut(BaseModel):
    """A-01 응답"""

    products: list[LoanProduct]
