"""시나리오(필요자금 결과). 담당: 박채은 (화면은 안세환)

- A-07 POST /api/apartments/{id}/scenario : 아파트 한 곳의 시나리오 (API 명세서 3.2)

요청의 conditions만 쓴다. 로그인 정보와 profiles 표를 읽지 않는다 (NFR-18).
계산식은 여기에 쓰지 않는다. backend/services/calc.py의 함수를 부른다 (NFR-13).
"""
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["시나리오"])
