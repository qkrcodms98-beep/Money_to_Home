"""아파트 탐색에 쓰는 DB 함수. 담당: 김목산

routers/apartments.py가 부른다. 저장은 하지 않는다 (읽기만 한다).
요청에 든 값만 쓴다. 로그인 정보와 profiles 표를 읽지 않는다 (NFR-18).
"""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models import Apartment, ApartmentPrice


def _coord(value) -> float | None:
    """좌표 평균(DECIMAL)을 float로. 좌표가 있는 아파트가 없으면 None."""
    return None if value is None else round(float(value), 7)


def regions(db: Session) -> list[dict]:
    """A-02 구와 동의 목록.

    - 평균가가 있는 아파트가 한 곳이라도 있는 구와 동만 낸다.
    - apartment_count는 그 동에서 평균가가 있는 아파트의 수다.
    - 위치는 그 구나 동에 있는 아파트 좌표의 평균이다. 좌표가 있는 아파트가 없으면 None (API 명세서 A-02).
    - 구와 동은 가나다순이다.
    """
    priced = select(ApartmentPrice.apartment_id).distinct()
    rows = db.execute(
        select(
            Apartment.gu,
            Apartment.dong,
            func.count(Apartment.id),
            func.avg(Apartment.latitude),
            func.avg(Apartment.longitude),
        )
        .where(Apartment.id.in_(priced))
        .group_by(Apartment.gu, Apartment.dong)
    ).all()
    gu_rows = db.execute(
        select(Apartment.gu, func.avg(Apartment.latitude), func.avg(Apartment.longitude))
        .where(Apartment.id.in_(priced))
        .group_by(Apartment.gu)
    ).all()

    result = {
        gu: {"gu": gu, "latitude": _coord(lat), "longitude": _coord(lng), "dongs": []}
        for gu, lat, lng in sorted(gu_rows, key=lambda r: r[0])
    }
    for gu, dong, count, lat, lng in sorted(rows, key=lambda r: (r[0], r[1])):
        result[gu]["dongs"].append(
            {"dong": dong, "apartment_count": count, "latitude": _coord(lat), "longitude": _coord(lng)}
        )
    return list(result.values())
