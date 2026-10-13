"""재무정보를 읽고 쓰는 함수. 담당: 김해원

회원 한 명에 한 줄이다. 저장은 요청이 끝날 때 get_db가 한다. 여기서 commit하지 않는다.
"""
from sqlalchemy.orm import Session

from backend.errors import ApiError
from backend.models import Profile
from backend.services import loan_product

MSG_FINANCE_FIRST = "재무정보를 먼저 입력해 주세요."
MSG_CHOOSE_LOAN = "대출 상품과 상환 기간을 골라 주세요."
MSG_CHOOSE_YEARS = "상환 기간을 다시 골라 주세요."


def find_by_user(db: Session, user_id: int) -> Profile | None:
    """저장한 재무정보. 없으면 None"""
    return db.get(Profile, user_id)


def _require(db: Session, user_id: int) -> Profile:
    profile = find_by_user(db, user_id)
    if profile is None:
        raise ApiError(422, MSG_FINANCE_FIRST)
    return profile


def _saved(db: Session, profile: Profile) -> Profile:
    """DB에 보내고, DB가 정한 값(수정한 시각, 상품 이름)을 다시 읽는다."""
    db.flush()
    db.refresh(profile)
    return profile


def save_finance(db: Session, user_id: int, age: int, annual_income: int, current_assets: int, restart: bool) -> Profile:
    """재무정보를 저장한다. 없으면 만들고 있으면 고친다.

    restart면 "처음부터 다시 입력"이다. 대출 선택과 저축 계획을 함께 지운다 (DB 설계서 3.2).
    """
    profile = find_by_user(db, user_id)
    if profile is None:
        profile = Profile(user_id=user_id)
        db.add(profile)
    profile.age = age
    profile.annual_income = annual_income
    profile.current_assets = current_assets
    if restart:
        profile.loan_choice = None
        profile.loan_product_id = None
        profile.repayment_years = None
        profile.monthly_saving = None
        profile.target_years = None
    return _saved(db, profile)


def save_loan(db: Session, user_id: int, loan_choice: str, loan_product_id: int | None, repayment_years: int | None) -> Profile:
    """대출 선택을 저장한다. 상품을 골랐으면 그 상품에 있는 상환 기간인지 확인한다."""
    profile = _require(db, user_id)
    if loan_choice == "product":
        product = loan_product.find_by_id(db, loan_product_id)
        if product is None:
            raise ApiError(422, MSG_CHOOSE_LOAN, "loan_product_id")
        if repayment_years not in product.repayment_years_list:
            raise ApiError(422, MSG_CHOOSE_YEARS, "repayment_years")
    profile.loan_choice = loan_choice
    profile.loan_product_id = loan_product_id
    profile.repayment_years = repayment_years
    return _saved(db, profile)


def save_plan(db: Session, user_id: int, monthly_saving: int, target_years: int) -> Profile:
    profile = _require(db, user_id)
    profile.monthly_saving = monthly_saving
    profile.target_years = target_years
    return _saved(db, profile)
