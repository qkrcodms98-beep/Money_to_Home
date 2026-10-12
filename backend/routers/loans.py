"""대출 상품. 담당: 박채은

- A-01 GET  /api/loan-products : 상품 목록 (만들어 둠)
- A-03 POST /api/calc/loan     : 대출 계산 (담당자가 만든다. API 명세서 3.2)

계산식은 여기에 쓰지 않는다. backend/services/calc.py의 함수를 부른다 (NFR-13).
"""
from fastapi import APIRouter, Depends

from backend.database import get_db
from backend.models import loan_product
from backend.schemas.loan import LoanProductsOut

router = APIRouter(prefix="/api", tags=["대출 상품"])


@router.get("/loan-products", response_model=LoanProductsOut)
def list_loan_products(conn=Depends(get_db)):
    return {"products": loan_product.find_all(conn)}
