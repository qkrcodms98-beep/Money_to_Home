"""재무정보 저장. 담당: 김해원

- A-08 GET /api/profile         : 저장한 재무정보
- A-09 PUT /api/profile/finance : 재무정보 저장
- A-10 PUT /api/profile/loan    : 대출 선택 저장
- A-11 PUT /api/profile/plan    : 저축 계획 저장

1차에는 테스트 사용자 한 명의 값을 읽고 쓴다. 누구의 값인지는 deps.py가 정한다.
"""
from fastapi import APIRouter, Depends

from backend.database import get_db
from backend.deps import get_current_user_id
from backend.errors import ApiError
from backend.models import loan_product, profile
from backend.schemas.profile import FinanceIn, LoanChoiceIn, PlanIn, ProfileOut

router = APIRouter(prefix="/api/profile", tags=["재무정보"])

MSG_FINANCE_FIRST = "재무정보를 먼저 입력해 주세요."


def _require_profile(conn, user_id: int) -> None:
    if profile.find_by_user(conn, user_id) is None:
        raise ApiError(422, MSG_FINANCE_FIRST)


@router.get("", response_model=ProfileOut)
def get_profile(conn=Depends(get_db), user_id: int = Depends(get_current_user_id)):
    return {"profile": profile.find_by_user(conn, user_id)}


@router.put("/finance", response_model=ProfileOut)
def put_finance(body: FinanceIn, conn=Depends(get_db), user_id: int = Depends(get_current_user_id)):
    profile.save_finance(conn, user_id, body.age, body.annual_income, body.current_assets, body.restart)
    return {"profile": profile.find_by_user(conn, user_id)}


@router.put("/loan", response_model=ProfileOut)
def put_loan(body: LoanChoiceIn, conn=Depends(get_db), user_id: int = Depends(get_current_user_id)):
    _require_profile(conn, user_id)
    if body.loan_choice == "product":
        product = loan_product.find_by_id(conn, body.loan_product_id)
        if product is None:
            raise ApiError(422, "대출 상품과 상환 기간을 골라 주세요.", "loan_product_id")
        if body.repayment_years not in product["repayment_years_options"]:
            raise ApiError(422, "상환 기간을 다시 골라 주세요.", "repayment_years")
    profile.save_loan(conn, user_id, body.loan_choice, body.loan_product_id, body.repayment_years)
    return {"profile": profile.find_by_user(conn, user_id)}


@router.put("/plan", response_model=ProfileOut)
def put_plan(body: PlanIn, conn=Depends(get_db), user_id: int = Depends(get_current_user_id)):
    _require_profile(conn, user_id)
    profile.save_plan(conn, user_id, body.monthly_saving, body.target_years)
    return {"profile": profile.find_by_user(conn, user_id)}
