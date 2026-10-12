"""아파트 탐색. 담당: 김목산

- A-02 GET  /api/regions           : 구와 동의 목록
- A-05 POST /api/apartments/search : 아파트 찾기
- A-06 GET  /api/apartments/{id}   : 아파트 한 곳
- A-12 POST /api/regions/summary   : 구별·동별 개수 (2차)
- A-13 GET  /api/data-status       : 수집 기준일 (2차)

요청의 conditions만 쓴다. 로그인 정보와 profiles 표를 읽지 않는다 (NFR-18).
계산식은 여기에 쓰지 않는다. backend/services/calc.py의 함수를 부른다 (NFR-13).
"""
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["아파트 탐색"])
