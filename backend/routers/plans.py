"""저축 계획. 담당: 김해원

- A-04 POST /api/calc/plan : 저축 계획 계산 (API 명세서 3.2)

계산식은 여기에 쓰지 않는다. backend/services/calc.py의 함수를 부른다 (NFR-13).
"""
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["저축 계획"])
