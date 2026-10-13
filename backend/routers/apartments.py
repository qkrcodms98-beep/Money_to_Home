"""아파트 탐색. 담당: 김목산

- A-02 GET  /api/regions           : 구와 동의 목록
- A-05 POST /api/apartments/search : 아파트 찾기
- A-12 POST /api/regions/summary   : 구별·동별 개수 (2차)
- A-13 GET  /api/data-status       : 수집 기준일 (2차)

A-06 아파트 한 곳은 backend/routers/apartment_detail.py에 있다 (담당: 안세환).

요청의 conditions만 쓴다. 로그인 정보와 profiles 표를 읽지 않는다 (NFR-18).
DB를 다루는 코드는 backend/services/apartment.py, 계산은 backend/services/calc.py에 있다 (NFR-13).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas.apartment import RegionsOut
from backend.services import apartment

router = APIRouter(prefix="/api", tags=["아파트 탐색"])


@router.get("/regions", response_model=RegionsOut)
def list_regions(db: Session = Depends(get_db)):
    return {"regions": apartment.regions(db)}
