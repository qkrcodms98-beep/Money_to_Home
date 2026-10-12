"""테스트 공통 준비.

여기의 테스트는 DB 없이 돈다. DB 연결을 가짜로 바꿔 끼운다.
실행 (프로젝트 폴더에서): pytest
"""
import pytest
from fastapi.testclient import TestClient

from backend.database import get_db
from backend.main import app


class FakeCursor:
    """아무 줄도 돌려주지 않는 가짜 커서."""

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, sql, params=None):
        return 0

    def fetchone(self):
        return None

    def fetchall(self):
        return []


class FakeConnection:
    def cursor(self):
        return FakeCursor()


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = lambda: FakeConnection()
    yield TestClient(app)
    app.dependency_overrides.clear()
