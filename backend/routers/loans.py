"""대출 상품. 담당: 박채은

- A-01 GET  /api/loan-products : 상품 목록 (만들어 둠)
- A-03 POST /api/calc/loan     : 대출 계산 (담당자가 만든다. API 명세서 3.2)

router는 요청을 받아 services의 함수를 부르고 응답을 만든다. DB를 다루는 코드와 계산식을 여기에 쓰지 않는다.
DB는 backend/services/loan_product.py, 계산은 backend/services/calc.py에 있다 (NFR-13).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas.loan import LoanProductsOut
from backend.services import loan_product

router = APIRouter(prefix="/api", tags=["대출 상품"])


@router.get("/loan-products", response_model=LoanProductsOut)
def list_loan_products(db: Session = Depends(get_db)):
    return {"products": loan_product.find_all(db)}
