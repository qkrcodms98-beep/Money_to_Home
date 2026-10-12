"""머니 to 홈 서버.

실행 (프로젝트 폴더에서):
    uvicorn backend.main:app --reload --port 8000

- 화면:     http://localhost:8000
- API 문서: http://localhost:8000/docs
- 상태 확인: http://localhost:8000/api/health
"""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend.config import FRONTEND_DIR
from backend.errors import register_error_handlers
from backend.routers import apartment_detail, apartments, loans, plans, profile, scenario, system

app = FastAPI(title="머니 to 홈", version="0.1.0")

register_error_handlers(app)

# API. 새 router 파일을 만들면 여기에 한 줄을 더한다.
app.include_router(system.router)
app.include_router(loans.router)
app.include_router(plans.router)
app.include_router(profile.router)
app.include_router(apartments.router)
app.include_router(apartment_detail.router)
app.include_router(scenario.router)

# 화면. API를 모두 등록한 뒤 마지막에 연결한다. /api로 시작하지 않는 주소는 frontend 폴더의 파일을 준다.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
