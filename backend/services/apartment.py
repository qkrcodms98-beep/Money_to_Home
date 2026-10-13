"""아파트 탐색에 쓰는 DB 함수. 담당: 김목산

routers/apartments.py가 부른다. 저장은 하지 않는다 (읽기만 한다).
요청에 든 값만 쓴다. 로그인 정보와 profiles 표를 읽지 않는다 (NFR-18).
"""
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from backend.errors import ApiError
from backend.models import Apartment, ApartmentPrice
from backend.services import calc, loan_product

MSG_CHOOSE_LOAN = "대출 상품과 상환 기간을 골라 주세요."
MSG_CHOOSE_YEARS = "상환 기간을 다시 골라 주세요."
CATEGORY_ORDER = {calc.NOW: 0, calc.WITHIN: 1, calc.LACK: 2}


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


def _product_for(db: Session, conditions) -> dict | None:
    """조건의 대출 상품을 계산 모듈에 넘길 모양으로. 대출 없이 계산이면 None.

    API 명세서 2.2의 조합(product면 상품과 기간이 다 있고, none이면 둘 다 없다)이 아니거나,
    없는 상품이면 "대출 상품과 상환 기간을 골라 주세요."(field loan_product_id),
    그 상품에 없는 상환 기간이면 "상환 기간을 다시 골라 주세요."(field repayment_years). 모두 422 (명세서 5장).
    """
    has_product = conditions.loan_product_id is not None and conditions.repayment_years is not None
    has_nothing = conditions.loan_product_id is None and conditions.repayment_years is None
    if conditions.loan_choice == "none":
        if not has_nothing:
            raise ApiError(422, MSG_CHOOSE_LOAN, "loan_product_id")
        return None
    if not has_product:
        raise ApiError(422, MSG_CHOOSE_LOAN, "loan_product_id")
    product = loan_product.find_by_id(db, conditions.loan_product_id)
    if product is None:
        raise ApiError(422, MSG_CHOOSE_LOAN, "loan_product_id")
    if conditions.repayment_years not in product.repayment_years_list:
        raise ApiError(422, MSG_CHOOSE_YEARS, "repayment_years")
    return loan_product.for_calc(product)


def search(db: Session, conditions, gu: str, dong: str | None) -> dict:
    """A-05 아파트 찾기. 계산은 services/calc.py의 함수만 부른다 (NFR-13).

    - 평균가가 있는 아파트만 낸다. 좌표가 없는 아파트도 빼지 않는다.
    - areas는 평균가가 낮은 순이고, 아파트의 구분은 첫째 면적의 구분이다.
    - 순서: 지금 가능 → 기간 내 가능 → 자금 부족. 같은 구분 안에서는 평균가가 목표 가능 가격에 가까운 순.
    - counts는 아파트 단위로 센다. 자금이 부족한 아파트도 항상 준다.
    """
    product = _product_for(db, conditions)
    current = conditions.current_assets
    years = conditions.target_years
    own = calc.own_funds(current, calc.accumulated_saving(conditions.monthly_saving, years))
    target = calc.target_price(own, product)

    query = select(Apartment).where(Apartment.gu == gu).options(selectinload(Apartment.prices))
    if dong:
        query = query.where(Apartment.dong == dong)

    items = []
    for apt in db.scalars(query).all():
        areas = []
        for price in sorted(apt.prices, key=lambda p: (p.avg_price, p.area_band)):
            loan = calc.loan_amount(price.avg_price, product)
            cap = product["max_house_price"] if product else None
            areas.append({
                "area_band": price.area_band,
                "exclusive_area": float(price.exclusive_area),
                "supply_area": None if price.supply_area is None else float(price.supply_area),
                "avg_price": price.avg_price,
                "trade_count": price.trade_count,
                "category": calc.category(current, own, loan, price.avg_price, years),
                "shortage": calc.shortage(price.avg_price, own, loan),
                "loan_amount": loan,
                "over_price_cap": cap is not None and price.avg_price > cap,
            })
        if not areas:
            continue
        items.append({
            "id": apt.id,
            "name": apt.name,
            "gu": apt.gu,
            "dong": apt.dong,
            "latitude": _coord(apt.latitude),
            "longitude": _coord(apt.longitude),
            "built_year": apt.built_year,
            "households": apt.households,
            "category": areas[0]["category"],
            "areas": areas,
        })

    items.sort(key=lambda a: (CATEGORY_ORDER[a["category"]], abs(a["areas"][0]["avg_price"] - target), a["id"]))
    counts = {key: sum(1 for a in items if a["category"] == key) for key in CATEGORY_ORDER}
    counts["total"] = len(items)
    return {"target_price": target, "own_funds": own, "counts": counts, "apartments": items}
