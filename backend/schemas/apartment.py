"""아파트 탐색 API의 요청과 응답 모양. 담당: 김목산

- A-02 구와 동의 목록: RegionsOut
- A-05 아파트 찾기: SearchIn, SearchOut
- A-12 구별·동별 개수: SummaryIn, SummaryOut
- A-13 수집 기준일: DataStatusOut
- Conditions는 API 명세서 2.2의 조건 묶음이다. A-07(시나리오) 등도 같은 모양으로 받는다.
"""
from datetime import date
from typing import Literal

from pydantic import BaseModel, StrictFloat, StrictInt, field_validator, model_validator

from backend.errors import MSG_INVALID, MSG_MISSING
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
MSG_BOUNDS = "지도 영역을 다시 확인해 주세요."


class Bounds(BaseModel):
    """지도에 보이는 영역 (위도와 경도). 남쪽이 북쪽보다, 서쪽이 동쪽보다 작아야 한다 (명세서 5장)."""

    south: StrictFloat
    west: StrictFloat
    north: StrictFloat
    east: StrictFloat

    @model_validator(mode="after")
    def check_order(self):
        if not (self.south < self.north and self.west < self.east):
            raise ValueError(MSG_BOUNDS)
        return self


class Where(BaseModel):
    """찾을 범위. 셋 중 하나만 보낸다.

    - { "gu": "서구", "dong": "치평동" } 구와 동. dong을 빼면 구 전체
    - { "bounds": { "south": 35.14, "west": 126.83, "north": 35.16, "east": 126.86 } } 지도에 보이는 영역
    - { "keyword": "호반" } 아파트 이름에 이 글자가 든 곳. 광주 5개 구 전체에서 찾는다 (FR-MAP-08)
    """

    gu: str | None = None
    dong: str | None = None
    bounds: Bounds | None = None
    keyword: str | None = None

    @field_validator("keyword")
    @classmethod
    def strip_keyword(cls, value: str | None) -> str | None:
        # 앞뒤 빈칸은 뺀다. 빈칸만 있으면 거부한다
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError(MSG_INVALID)
        return value

    @model_validator(mode="after")
    def check_one_kind(self):
        kinds = sum(value is not None for value in (self.gu, self.bounds, self.keyword))
        if kinds == 0:
            raise ValueError(MSG_MISSING)
        if kinds > 1 or (self.dong is not None and self.gu is None):
            raise ValueError(MSG_INVALID)  # 둘 이상을 함께 보내면 어느 쪽으로 찾을지 알 수 없다
        return self


MSG_FILTER_RANGE = "조건의 최소와 최대를 다시 확인해 주세요."


class Filters(BaseModel):
    """면적대(㎡, 전용면적의 소수점 아래를 버린 값), 평균가(원), 준공 연도의 최소와 최대.
    빼거나 null이면 그 조건이 없다. 최소와 최대는 그 값을 포함한다."""

    area_min: StrictInt | None = None
    area_max: StrictInt | None = None
    price_min: StrictInt | None = None
    price_max: StrictInt | None = None
    built_year_min: StrictInt | None = None
    built_year_max: StrictInt | None = None

    @model_validator(mode="after")
    def check_range(self):
        # 최소가 최대보다 크면 거부한다 (명세서 5장, field는 filters)
        for low, high in (
            (self.area_min, self.area_max),
            (self.price_min, self.price_max),
            (self.built_year_min, self.built_year_max),
        ):
            if low is not None and high is not None and low > high:
                raise ValueError(MSG_FILTER_RANGE)
        return self


class SearchIn(BaseModel):
    """A-05 요청"""

    conditions: Conditions
    where: Where
    filters: Filters | None = None
    # category: 구분순(기본). price_asc, price_desc: 첫째 면적(카드에 먼저 보이는 면적)의 평균가 순
    sort: Literal["category", "price_asc", "price_desc"] = "category"


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


# ------------------------------------------------------------------
# A-12 구별·동별 개수
# ------------------------------------------------------------------
class SummaryIn(BaseModel):
    """A-12 요청"""

    conditions: Conditions
    level: Literal["gu", "dong"]  # gu: 구마다 하나, dong: 동마다 하나
    gu: str | None = None  # level이 dong일 때 어느 구의 동을 볼지. 빼면 5개 구의 모든 동
    filters: Filters | None = None  # A-05와 같다


class RegionSummary(BaseModel):
    gu: str
    dong: str | None  # level이 gu면 null
    latitude: float | None  # 그 지역 아파트 좌표의 평균 (A-02와 같다). 좌표가 없으면 null
    longitude: float | None
    target_count: int  # 목표할 수 있는 아파트 수. 지금 가능 + 기간 내 가능
    counts: Counts  # 아파트 단위로 센다


class SummaryOut(BaseModel):
    """A-12 응답"""

    target_price: int
    level: Literal["gu", "dong"]
    regions: list[RegionSummary]


# A-13 수집 기준일
# ------------------------------------------------------------------
class DataStatusOut(BaseModel):
    """A-13 응답. 날짜는 "2026-10-12" 모양. 남긴 기록이 없으면 null"""

    trades_base_date: date | None  # 실거래를 받은 날
    households_base_date: date | None  # 세대수 자료의 기준 시점. 아직 없어 null
