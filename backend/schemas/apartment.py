"""아파트 탐색 API의 요청과 응답 모양. 담당: 김목산

A-02(구와 동의 목록)의 응답이 들어 있다.
A-05(아파트 찾기)의 요청과 응답은 이 파일에 이어서 적는다.
"""
from pydantic import BaseModel


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
