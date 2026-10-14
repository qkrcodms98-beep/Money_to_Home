"""재무정보 저장. 담당: 김해원

- A-08 GET /api/profile         : 저장한 재무정보
- A-09 PUT /api/profile/finance : 재무정보 저장
- A-10 PUT /api/profile/loan    : 대출 선택 저장
- A-11 PUT /api/profile/plan    : 저축 계획 저장

로그인한 회원의 값을 읽고 쓴다. 로그인하지 않았으면 401이다. 누구의 값인지는 deps.py가 정한다.
router는 요청을 받아 services의 함수를 부르고 응답을 만든다. DB를 다루는 일은 backend/services/profile.py에 있다.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.deps import get_current_user_id
from backend.schemas.profile import FinanceIn, LoanChoiceIn, PlanIn, ProfileOut
from backend.services import profile

router = APIRouter(prefix="/api/profile", tags=["재무정보"])


@router.get("", response_model=ProfileOut)
def get_profile(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    return {"profile": profile.find_by_user(db, user_id)}


@router.put("/finance", response_model=ProfileOut)
def put_finance(body: FinanceIn, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    saved = profile.save_finance(db, user_id, body.age, body.annual_income, body.current_assets, body.restart)
    return {"profile": saved}


@router.put("/loan", response_model=ProfileOut)
def put_loan(body: LoanChoiceIn, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    saved = profile.save_loan(db, user_id, body.loan_choice, body.loan_product_id, body.repayment_years)
    return {"profile": saved}


@router.put("/plan", response_model=ProfileOut)
def put_plan(body: PlanIn, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    saved = profile.save_plan(db, user_id, body.monthly_saving, body.target_years)
    return {"profile": saved}
