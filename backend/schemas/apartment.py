"""아파트 탐색 API의 요청과 응답 모양. 담당: 김목산

- A-02 구와 동의 목록: RegionsOut
- A-05 아파트 찾기: SearchIn, SearchOut
- Conditions는 API 명세서 2.2의 조건 묶음이다. A-07(시나리오) 등도 같은 모양으로 받는다.
"""
from typing import Literal

from pydantic import BaseModel, StrictInt, field_validator

from backend.schemas.common import check_asset, check_monthly_saving, check_target_years

Category = Literal["now", "within", "lack"]

MSG_CHOOSE_LOAN = "대출 상품과 상환 기간을 골라 주세요."


# ------------------------------------------------------------------
# A-02 구와 동의 목록
# ------------------------------------------------------------------
class Dong(BaseModel):
    dong: str
    apartment_count: int  # 평균가가 있는 아파트의 수
    latitude: float | None  # 그 동 아파트 좌표의 평균. 좌표가 없으면 null
    longitude: float | None


class Region(BaseModel):
    gu: str
    latitude: float | None  # 그 구 아파트 좌표의 평균. 좌표가 없으면 null
    longitude: float | None
    dongs: list[Dong]


class RegionsOut(BaseModel):
    """A-02 응답"""

    regions: list[Region]


# ------------------------------------------------------------------
# 조건 묶음 (API 명세서 2.2)
# ------------------------------------------------------------------
class Conditions(BaseModel):
    current_assets: StrictInt  # 현재 보유자산. 원
    monthly_saving: StrictInt  # 월 저축 가능액. 원
    target_years: StrictInt  # 0, 3, 5, 10. 0은 "지금"
    loan_choice: str  # "product"(상품을 고름) 또는 "none"(대출 없이 계산)
    loan_product_id: StrictInt | None = None
    repayment_years: StrictInt | None = None

    _assets = field_validator("current_assets")(check_asset)
    _saving = field_validator("monthly_saving")(check_monthly_saving)
    _years = field_validator("target_years")(check_target_years)

    @field_validator("loan_choice")
    @classmethod
    def check_loan_choice(cls, value: str) -> str:
        # 다른 값이면 명세서 5장의 문장을 낸다 (Literal의 일반 문구가 아니라)
        if value not in ("product", "none"):
            raise ValueError(MSG_CHOOSE_LOAN)
        return value

    # loan_choice와 상품, 상환 기간의 조합은 services/apartment.py가 상품을 읽으며 함께 검사한다.
    # 여기서 검사하면 오류의 field가 "conditions"가 되어 화면이 어느 값인지 알 수 없다.


# ------------------------------------------------------------------
# A-05 아파트 찾기
# ------------------------------------------------------------------
class Where(BaseModel):
    """찾을 범위. 1차는 구와 동. dong을 빼면 구 전체. bounds와 keyword는 2차."""

    gu: str
    dong: str | None = None


class Filters(BaseModel):
    """면적대(㎡), 평균가(원), 준공 연도의 최소와 최대. 2차에 쓴다. 1차는 받기만 한다."""

    area_min: int | None = None
    area_max: int | None = None
    price_min: int | None = None
    price_max: int | None = None
    built_year_min: int | None = None
    built_year_max: int | None = None


class SearchIn(BaseModel):
    """A-05 요청"""

    conditions: Conditions
    where: Where
    filters: Filters | None = None  # 2차
    sort: Literal["category", "price_asc", "price_desc"] = "category"  # 1차는 category로 고정


class Area(BaseModel):
    area_band: int  # 면적대. ㎡
    exclusive_area: float  # 대표 전용면적. ㎡
    supply_area: float | None  # 공급면적. 없으면 null
    avg_price: int  # 평균가. 원
    trade_count: int
    category: Category
    shortage: int  # 부족자금 (C-10). 음수면 그 절댓값이 여유자금
    loan_amount: int  # 예상 대출금액 (C-05). 대출 없이 계산이면 0
    over_price_cap: bool  # 평균가가 상품의 대상 주택 가격 상한을 넘으면 true


class ApartmentItem(BaseModel):
    id: int
    name: str
    gu: str
    dong: str
    latitude: float | None  # 좌표가 없으면 null. 화면은 목록에만 "위치 없음"으로 보여 준다
    longitude: float | None
    built_year: int | None
    households: int | None  # 세대수. 아직 없어서 null
    category: Category  # areas의 첫째(평균가가 가장 낮은 면적)의 구분
    areas: list[Area]  # 평균가가 낮은 순. 첫째가 지도와 카드에 먼저 보이는 면적


class Counts(BaseModel):
    now: int
    within: int
    lack: int
    total: int


class SearchOut(BaseModel):
    """A-05 응답"""

    target_price: int  # 목표 가능 가격 (C-08)
    own_funds: int  # 목표 시점 자기자금 (C-03)
    counts: Counts  # 아파트 단위로 센다
    apartments: list[ApartmentItem]
