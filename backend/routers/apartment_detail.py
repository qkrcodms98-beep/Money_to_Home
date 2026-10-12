"""아파트 한 곳. 담당: 안세환

- A-06 GET /api/apartments/{id} : 아파트 한 곳의 정보 (API 명세서 3.1)

지도의 아파트 표시나 목록의 카드를 눌렀을 때 아파트 창에 보여 줄 값을 준다.
없는 번호면 backend.errors.ApiError(404, ...)를 낸다.
"""
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["아파트 한 곳"])
