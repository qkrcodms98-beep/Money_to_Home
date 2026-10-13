"""아파트 탐색. A-02 구와 동의 목록."""
from datetime import date

import pytest

from backend import models


def _apartment(id, gu, dong, name, lat=None, lng=None, priced=True):
    apt = models.Apartment(id=id, name=name, gu=gu, dong=dong, jibun=str(id), latitude=lat, longitude=lng)
    if priced:
        apt.prices.append(models.ApartmentPrice(
            area_band=84, exclusive_area="84.9400", avg_price=300_000_000, min_price=290_000_000,
            max_price=310_000_000, trade_count=3, period_start=date(2025, 10, 1), period_end=date(2026, 9, 30),
        ))
    return apt


@pytest.fixture
def apartments(db):
    """서구 치평동 2곳(좌표 있음), 서구 광천동 1곳(좌표 없음), 북구 운암동 1곳,
    평균가가 없는 남구 봉선동 1곳과 서구 치평동 1곳."""
    db.add_all([
        _apartment(1, "서구", "치평동", "가아파트", "35.1500000", "126.8500000"),
        _apartment(2, "서구", "치평동", "나아파트", "35.1480000", "126.8400000"),
        _apartment(3, "서구", "광천동", "다아파트"),
        _apartment(4, "북구", "운암동", "라아파트", "35.1800000", "126.8800000"),
        _apartment(5, "남구", "봉선동", "마아파트", "35.1300000", "126.9000000", priced=False),
        _apartment(6, "서구", "치평동", "바아파트", "35.0000000", "126.0000000", priced=False),
    ])
    db.commit()


def test_only_regions_with_prices(client, apartments):
    regions = client.get("/api/regions").json()["regions"]
    assert [r["gu"] for r in regions] == ["북구", "서구"]  # 평균가가 없는 남구는 나오지 않는다


def test_gu_and_dong_in_korean_order(client, apartments):
    seo = client.get("/api/regions").json()["regions"][1]
    assert [d["dong"] for d in seo["dongs"]] == ["광천동", "치평동"]


def test_apartment_count_counts_priced_apartments(client, apartments):
    seo = client.get("/api/regions").json()["regions"][1]
    chipyeong = seo["dongs"][1]
    assert chipyeong["apartment_count"] == 2  # 평균가가 없는 바아파트는 세지 않는다


def test_location_is_average_of_apartments(client, apartments):
    seo = client.get("/api/regions").json()["regions"][1]
    chipyeong = seo["dongs"][1]
    assert chipyeong["latitude"] == pytest.approx(35.149)
    assert chipyeong["longitude"] == pytest.approx(126.845)
    # 구의 위치는 좌표가 있는 아파트(가, 나)의 평균. 좌표가 없는 다아파트와 평균가가 없는 바아파트는 빠진다
    assert seo["latitude"] == pytest.approx(35.149)


def test_location_is_null_without_coordinates(client, apartments):
    seo = client.get("/api/regions").json()["regions"][1]
    gwangcheon = seo["dongs"][0]
    assert gwangcheon["latitude"] is None
    assert gwangcheon["longitude"] is None


def test_empty_db_gives_empty_list(client):
    assert client.get("/api/regions").json() == {"regions": []}


# ------------------------------------------------------------------
# A-05 아파트 찾기
# ------------------------------------------------------------------
def _priced(id, dong, name, bands, lat=None, lng=None, built_year=None):
    """bands: [(면적대, 평균가), ...]"""
    apt = models.Apartment(id=id, name=name, gu="서구", dong=dong, jibun=str(id), latitude=lat, longitude=lng,
                           built_year=built_year)
    for band, price in bands:
        apt.prices.append(models.ApartmentPrice(
            area_band=band, exclusive_area=f"{band}.9400", supply_area=f"{band + 27}.00", avg_price=price,
            min_price=price, max_price=price, trade_count=5,
            period_start=date(2025, 10, 1), period_end=date(2026, 9, 30),
        ))
    return apt


@pytest.fixture
def chipyeong(db, products):
    """서구 치평동. 예시 조건(보유 5,000만, 월 100만, 5년, 첫째 상품 30년)으로 구분이 정해져 있다."""
    db.add_all([
        _priced(11, "치평동", "가아파트", [(114, 390_000_000), (84, 300_000_000)], "35.1490000", "126.8450000", 2005),
        _priced(12, "치평동", "나아파트", [(59, 150_000_000)], built_year=1995),  # 좌표 없음
        _priced(13, "치평동", "다아파트", [(84, 450_000_000)], "35.1500000", "126.8500000", 2015),
        _priced(14, "치평동", "라아파트", [(84, 700_000_000)], "35.1510000", "126.8510000", 2020),
        _priced(15, "치평동", "마아파트", [(84, 360_000_000)], "35.1520000", "126.8520000"),  # 준공 연도 모름
        _priced(16, "광천동", "바아파트", [(84, 200_000_000)]),
        _priced(17, "치평동", "사아파트", []),  # 평균가가 없다
    ])
    db.commit()


EXAMPLE = {
    "current_assets": 50_000_000, "monthly_saving": 1_000_000, "target_years": 5,
    "loan_choice": "product", "loan_product_id": 1, "repayment_years": 30,
}


def _search(client, where=None, filters=None, sort=None, **changes):
    body = {"conditions": {**EXAMPLE, **changes}, "where": {"gu": "서구", "dong": "치평동"} if where is None else where}
    if filters is not None:
        body["filters"] = filters
    if sort is not None:
        body["sort"] = sort
    return client.post("/api/apartments/search", json=body)


def test_target_price_and_own_funds(client, chipyeong):
    body = _search(client).json()
    assert body["target_price"] == 366_666_666
    assert body["own_funds"] == 110_000_000


def test_order_is_category_then_closeness_to_target(client, chipyeong):
    body = _search(client).json()
    # 지금 가능(나) → 기간 내 가능(마 3.6억이 가 3억보다 목표 3.67억에 가깝다) → 자금 부족(다 4.5억, 라 7억)
    assert [a["id"] for a in body["apartments"]] == [12, 15, 11, 13, 14]
    assert [a["category"] for a in body["apartments"]] == ["now", "within", "within", "lack", "lack"]


def test_counts_are_per_apartment(client, chipyeong):
    body = _search(client).json()
    assert body["counts"] == {"now": 1, "within": 2, "lack": 2, "total": 5}
    assert body["counts"]["total"] == len(body["apartments"])  # 평균가가 없는 사아파트는 빠진다


def test_areas_cheapest_first_with_example_values(client, chipyeong):
    ga = next(a for a in _search(client).json()["apartments"] if a["id"] == 11)
    assert [area["area_band"] for area in ga["areas"]] == [84, 114]
    first, second = ga["areas"]
    assert first == {
        "area_band": 84, "exclusive_area": 84.94, "supply_area": 111.0, "avg_price": 300_000_000, "trade_count": 5,
        "category": "within", "shortage": -20_000_000, "loan_amount": 210_000_000, "over_price_cap": False,
    }
    assert (second["category"], second["shortage"], second["loan_amount"]) == ("lack", 7_000_000, 273_000_000)
    assert ga["category"] == "within"  # 첫째 면적의 구분


def test_apartment_without_coordinates_is_kept(client, chipyeong):
    na = next(a for a in _search(client).json()["apartments"] if a["id"] == 12)
    assert na["latitude"] is None and na["longitude"] is None
    assert na["households"] is None


def test_over_price_cap(client, chipyeong):
    ra = next(a for a in _search(client).json()["apartments"] if a["id"] == 14)
    assert ra["areas"][0]["over_price_cap"] is True  # 7억 > 첫째 상품 상한 6억
    ra2 = next(a for a in _search(client, loan_product_id=2, repayment_years=30).json()["apartments"] if a["id"] == 14)
    assert ra2["areas"][0]["over_price_cap"] is False  # 둘째 상품은 상한이 없다


def test_now_has_no_within(client, chipyeong):
    body = _search(client, target_years=0).json()
    assert body["own_funds"] == 50_000_000
    assert body["counts"]["within"] == 0
    assert all(a["category"] != "within" for a in body["apartments"])


def test_without_loan(client, chipyeong):
    body = _search(client, loan_choice="none", loan_product_id=None, repayment_years=None).json()
    assert body["target_price"] == body["own_funds"] == 110_000_000
    assert all(area["loan_amount"] == 0 and area["over_price_cap"] is False
               for a in body["apartments"] for area in a["areas"])


def test_whole_gu_without_dong(client, chipyeong):
    body = _search(client, where={"gu": "서구"}).json()
    assert body["counts"]["total"] == 6  # 광천동 바아파트까지


def test_unknown_dong_gives_empty_list(client, chipyeong):
    res = _search(client, where={"gu": "서구", "dong": "없는동"})
    assert res.status_code == 200
    assert res.json()["apartments"] == []
    assert res.json()["counts"] == {"now": 0, "within": 0, "lack": 0, "total": 0}


@pytest.mark.parametrize("changes, field, detail", [
    ({"loan_product_id": 999}, "loan_product_id", "대출 상품과 상환 기간을 골라 주세요."),
    ({"repayment_years": 25}, "repayment_years", "상환 기간을 다시 골라 주세요."),
    ({"target_years": 7}, "target_years", "목표 기간을 다시 골라 주세요."),
    ({"current_assets": -1}, "current_assets", "0 이상의 숫자만 입력할 수 있습니다."),
])
def test_invalid_conditions(client, chipyeong, changes, field, detail):
    res = _search(client, **changes)
    assert res.status_code == 422
    assert res.json() == {"detail": detail, "field": field}


@pytest.mark.parametrize("changes", [
    {"loan_choice": "none"},                                   # 대출 없이인데 상품이 있다
    {"loan_product_id": None},                                 # 상품인데 번호가 없다
    {"repayment_years": None},                                 # 상품인데 기간이 없다
    {"loan_choice": "none", "loan_product_id": None},          # 대출 없이인데 기간이 남았다
])
def test_loan_combination_is_rejected(client, chipyeong, changes):
    res = _search(client, **changes)
    assert res.status_code == 422
    assert res.json() == {"detail": "대출 상품과 상환 기간을 골라 주세요.", "field": "loan_product_id"}


def test_unknown_loan_choice_uses_spec_message(client, chipyeong):
    res = _search(client, loan_choice="maybe")
    assert res.status_code == 422
    assert res.json() == {"detail": "대출 상품과 상환 기간을 골라 주세요.", "field": "loan_choice"}


# ------------------------------------------------------------------
# A-05 조건 (filters, 2차)
# ------------------------------------------------------------------
def _ids(client, filters):
    return [a["id"] for a in _search(client, filters=filters).json()["apartments"]]


def test_empty_or_null_filters_change_nothing(client, chipyeong):
    assert _ids(client, {}) == _ids(client, {"area_min": None, "price_max": None}) == [12, 15, 11, 13, 14]


def test_area_filter_keeps_matching_areas_only(client, chipyeong):
    body = _search(client, filters={"area_min": 100, "area_max": 114}).json()
    assert [a["id"] for a in body["apartments"]] == [11]  # 114㎡가 있는 가아파트만
    ga = body["apartments"][0]
    assert [area["area_band"] for area in ga["areas"]] == [114]
    assert ga["category"] == "lack"  # 남은 면적(3.9억)의 구분
    assert body["counts"] == {"now": 0, "within": 0, "lack": 1, "total": 1}


def test_area_filter_includes_both_ends(client, chipyeong):
    assert _ids(client, {"area_min": 59, "area_max": 59}) == [12]


def test_price_filter(client, chipyeong):
    # 3억 ~ 4.5억: 마(3.6억), 가(3억, 3.9억), 다(4.5억). 나(1.5억)와 라(7억)는 빠진다
    assert _ids(client, {"price_min": 300_000_000, "price_max": 450_000_000}) == [15, 11, 13]


def test_built_year_filter_drops_unknown_year(client, chipyeong):
    assert _ids(client, {"built_year_min": 2000, "built_year_max": 2015}) == [11, 13]  # 마는 준공 연도를 모른다
    assert _ids(client, {"built_year_max": 2000}) == [12]


def test_filters_together_can_give_empty_list(client, chipyeong):
    res = _search(client, filters={"area_min": 59, "area_max": 59, "built_year_min": 2000})
    assert res.status_code == 200
    assert res.json()["counts"]["total"] == 0


@pytest.mark.parametrize("filters", [
    {"area_min": 85, "area_max": 84},
    {"price_min": 300_000_001, "price_max": 300_000_000},
    {"built_year_min": 2021, "built_year_max": 2020},
])
def test_min_greater_than_max_is_rejected(client, chipyeong, filters):
    res = _search(client, filters=filters)
    assert res.status_code == 422
    assert res.json() == {"detail": "조건의 최소와 최대를 다시 확인해 주세요.", "field": "filters"}


@pytest.mark.parametrize("filters, field, detail", [
    ({"price_min": 1.5}, "price_min", "소수는 입력할 수 없습니다. 만 원 단위의 정수로 입력해 주세요."),
    ({"area_max": "84"}, "area_max", "숫자만 입력할 수 있습니다."),
    ({"built_year_min": True}, "built_year_min", "숫자만 입력할 수 있습니다."),
])
def test_filter_values_must_be_integers(client, chipyeong, filters, field, detail):
    res = _search(client, filters=filters)
    assert res.status_code == 422
    assert res.json() == {"detail": detail, "field": field}


# ------------------------------------------------------------------
# A-05 정렬 (sort, 2차)
# ------------------------------------------------------------------
def _sorted_ids(client, sort, **kw):
    return [a["id"] for a in _search(client, sort=sort, **kw).json()["apartments"]]


def test_sort_category_is_default(client, chipyeong):
    assert _sorted_ids(client, "category") == _sorted_ids(client, None) == [12, 15, 11, 13, 14]


def test_sort_price_asc_by_first_area(client, chipyeong):
    # 첫째 면적의 평균가: 나 1.5억, 가 3억(84㎡), 마 3.6억, 다 4.5억, 라 7억
    assert _sorted_ids(client, "price_asc") == [12, 11, 15, 13, 14]


def test_sort_price_desc(client, chipyeong):
    assert _sorted_ids(client, "price_desc") == [14, 13, 15, 11, 12]


def test_sort_keeps_areas_and_counts(client, chipyeong):
    by_category = _search(client).json()
    by_price = _search(client, sort="price_desc").json()
    assert by_price["counts"] == by_category["counts"]
    ga = next(a for a in by_price["apartments"] if a["id"] == 11)
    assert [area["area_band"] for area in ga["areas"]] == [84, 114]  # 면적은 그대로 평균가 낮은 순


def test_sort_with_filters_uses_remaining_first_area(client, chipyeong):
    # 3.1억 이상만 남기면 가아파트의 첫째 면적은 114㎡(3.9억)가 되어 마(3.6억) 뒤로 간다
    assert _sorted_ids(client, "price_asc", filters={"price_min": 310_000_000}) == [15, 11, 13, 14]


def test_unknown_sort_is_rejected(client, chipyeong):
    res = _search(client, sort="name")
    assert res.status_code == 422
    assert res.json()["field"] == "sort"


# ------------------------------------------------------------------
# A-05 이름 검색 (where.keyword, 2차)
# ------------------------------------------------------------------
@pytest.fixture
def named(db, chipyeong):
    """치평동 다섯 곳과 광천동 한 곳에 더해, 북구에 이름이 비슷한 두 곳."""
    hoban = _priced(21, "운암동", "호반가아파트", [(84, 250_000_000)])
    hoban.gu = "북구"
    percent = _priced(22, "운암동", "100%아파트", [(59, 120_000_000)])
    percent.gu = "북구"
    db.add_all([hoban, percent])
    db.commit()


def _keyword(client, keyword, **kw):
    return _search(client, where={"keyword": keyword}, **kw)


def test_keyword_searches_all_gu(client, named):
    body = _keyword(client, "가아파트").json()
    assert sorted((a["gu"], a["name"]) for a in body["apartments"]) == [("북구", "호반가아파트"), ("서구", "가아파트")]


def test_keyword_strips_spaces_and_keeps_rules(client, named):
    body = _keyword(client, "  아파트 ").json()
    assert body["counts"]["total"] == 8  # 평균가가 없는 사아파트는 빠진다
    order = [a["category"] for a in body["apartments"]]
    assert order == sorted(order, key=["now", "within", "lack"].index)  # 구분순


def test_keyword_percent_is_plain_text(client, named):
    assert [a["id"] for a in _keyword(client, "%").json()["apartments"]] == [22]
    assert _keyword(client, "_").json()["apartments"] == []


def test_keyword_with_filters_and_sort(client, named):
    ids = [a["id"] for a in _keyword(client, "아파트", filters={"area_max": 59}, sort="price_desc").json()["apartments"]]
    assert ids == [12, 22]  # 59㎡만: 나 1.5억, 100% 1.2억


def test_keyword_no_result_is_empty_list(client, named):
    res = _keyword(client, "없는이름")
    assert res.status_code == 200
    assert res.json()["counts"] == {"now": 0, "within": 0, "lack": 0, "total": 0}


@pytest.mark.parametrize("where, field, detail", [
    ({"keyword": "   "}, "keyword", "입력한 값을 다시 확인해 주세요."),
    ({"keyword": "호반", "gu": "서구"}, "where", "입력한 값을 다시 확인해 주세요."),
    ({"keyword": "호반", "dong": "치평동"}, "where", "입력한 값을 다시 확인해 주세요."),
    ({}, "where", "필요한 값이 빠졌습니다."),
    ({"dong": "치평동"}, "where", "필요한 값이 빠졌습니다."),
    ({"keyword": 3}, "keyword", "입력한 값을 다시 확인해 주세요."),
])
def test_invalid_where(client, named, where, field, detail):
    res = _search(client, where=where)
    assert res.status_code == 422
    assert res.json() == {"detail": detail, "field": field}
