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
