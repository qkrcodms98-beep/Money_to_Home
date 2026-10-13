"""재무정보 저장 API(A-08 ~ A-11)의 요청과 응답 모양.

주민등록번호는 받지 않는다. 화면이 계산한 만 나이만 받는다 (NFR-25).
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, StrictBool, StrictInt, field_validator, model_validator

from backend.schemas.common import check_age, check_asset, check_monthly_saving, check_target_years


class FinanceIn(BaseModel):
    """A-09 요청"""

    age: StrictInt
    annual_income: StrictInt
    current_assets: StrictInt
    restart: StrictBool = False  # true면 대출 선택과 저축 계획을 함께 지운다

    _age = field_validator("age")(check_age)
    _money = field_validator("annual_income", "current_assets")(check_asset)


class LoanChoiceIn(BaseModel):
    """A-10 요청"""

    loan_choice: Literal["product", "none"]
    loan_product_id: StrictInt | None = None
    repayment_years: StrictInt | None = None

    @model_validator(mode="after")
    def check_combination(self):
        has_product = self.loan_product_id is not None and self.repayment_years is not None
        has_nothing = self.loan_product_id is None and self.repayment_years is None
        if self.loan_choice == "product" and not has_product:
            raise ValueError("대출 상품과 상환 기간을 골라 주세요.")
        if self.loan_choice == "none" and not has_nothing:
            raise ValueError("대출 상품과 상환 기간을 골라 주세요.")
        return self


class PlanIn(BaseModel):
    """A-11 요청"""

    monthly_saving: StrictInt
    target_years: StrictInt

    _saving = field_validator("monthly_saving")(check_monthly_saving)
    _years = field_validator("target_years")(check_target_years)


class Profile(BaseModel):
    # models의 Profile을 그대로 넘기면 이 모양으로 바뀐다.
    model_config = ConfigDict(from_attributes=True)

    age: int
    annual_income: int
    current_assets: int
    loan_choice: Literal["product", "none"] | None
    loan_product_id: int | None
    loan_product_name: str | None
    repayment_years: int | None
    monthly_saving: int | None
    target_years: int | None
    updated_at: datetime


class ProfileOut(BaseModel):
    """A-08 ~ A-11 응답. 저장한 것이 없으면 profile이 null이다."""

    profile: Profile | None
