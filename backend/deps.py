"""지금 사용자가 누구인지 알아내는 함수.

누구인지는 로그인 쿠키의 회원 번호로만 정한다. 요청에 든 번호를 믿지 않는다 (FR-USER-15).

- login_user_id      : 로그인했으면 회원 번호, 아니면 None
- require_login      : 로그인했으면 회원 번호, 아니면 401. 로그인이 꼭 필요한 API가 쓴다 (NFR-10)
- get_current_user_id: 재무정보 API(A-08 ~ A-11)가 쓴다.
    로그인했으면 그 회원, 아니면 테스트 사용자(번호 1)다.
    명세로는 로그인하지 않으면 401이어야 한다. 그런데 지금 입력 화면은 로그인과 상관없이 저장 API를 부른다.
    화면이 "로그인했을 때만 저장"으로 바뀐 뒤에 이 함수를 require_login으로 바꾼다 (그때 이 파일만 고친다).
"""
from fastapi import Request

from backend.errors import ApiError
from backend.services import auth

TEST_USER_ID = 1


def login_user_id(request: Request) -> int | None:
    return auth.read_token(request.cookies.get(auth.COOKIE_NAME))


def require_login(request: Request) -> int:
    user_id = login_user_id(request)
    if user_id is None:
        raise ApiError(401, auth.MSG_LOGIN_REQUIRED)
    return user_id


def get_current_user_id(request: Request) -> int:
    user_id = login_user_id(request)
    return TEST_USER_ID if user_id is None else user_id
