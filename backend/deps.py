"""지금 사용자가 누구인지 알아내는 함수.

1차에는 로그인이 없다. 테스트 사용자 한 명(번호 1)으로 고정한다 (T-USER-08).
2차에 로그인을 붙일 때 이 함수만 고친다. 다른 파일은 고치지 않는다.
"""

TEST_USER_ID = 1


def get_current_user_id() -> int:
    return TEST_USER_ID
