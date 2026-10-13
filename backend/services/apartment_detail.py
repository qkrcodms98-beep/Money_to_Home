"""아파트 한 곳을 읽는 함수. 담당: 안세환

- 아파트는 db.get(Apartment, 번호)로 읽는다.
- 면적대별 평균가는 apartment_prices 표에서 평균가가 낮은 순으로 읽는다 (같으면 면적대가 작은 순).
- 세대수의 기준일은 data_collections 표에서 세대수 자료(households)의 가장 최근 기준일이다.
여기서 commit하지 않는다. 읽기만 한다.
"""
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.errors import ApiError
from backend.models import Apartment, ApartmentPrice, DataCollection

MSG_NOT_FOUND = "아파트를 찾을 수 없습니다."  # API 명세서 3.1 A-06


def find(db: Session, apartment_id: int) -> Apartment:
    """아파트 한 곳. 없는 번호면 404"""
    apartment = db.get(Apartment, apartment_id)
    if apartment is None:
        raise ApiError(404, MSG_NOT_FOUND)
    return apartment


def areas(db: Session, apartment_id: int) -> list[ApartmentPrice]:
    """면적대별 평균가. 평균가가 낮은 순"""
    query = (
        select(ApartmentPrice)
        .where(ApartmentPrice.apartment_id == apartment_id)
        .order_by(ApartmentPrice.avg_price, ApartmentPrice.area_band)
    )
    return list(db.scalars(query))


def households_base_date(db: Session) -> date | None:
    """세대수 자료의 가장 최근 기준일. 기록이 없으면 None"""
    query = (
        select(DataCollection.base_date)
        .where(DataCollection.dataset == "households")
        .order_by(DataCollection.base_date.desc())
        .limit(1)
    )
    return db.scalars(query).first()
