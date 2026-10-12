"""DB 연결. MariaDB에 PyMySQL로 접속한다.

router에서는 아래처럼 받아 쓴다.

    from backend.database import get_db

    @router.get("/api/...")
    def 함수(conn=Depends(get_db)):
        ...

규칙
- SQL에 값을 직접 붙이지 않는다. %s 자리에 매개변수로 넘긴다 (NFR-09).
- 요청이 오류 없이 끝나면 저장(commit)하고, 오류가 나면 되돌린다(rollback).
"""
import pymysql
from pymysql.cursors import DictCursor

from backend.config import settings


def connect():
    """DB 연결 하나를 연다. 조회 결과는 칸 이름을 키로 하는 dict로 온다."""
    return pymysql.connect(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        password=settings.db_password,
        database=settings.db_name,
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=False,
    )


def get_db():
    """요청 하나에 연결 하나를 내주고, 끝나면 닫는다."""
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
