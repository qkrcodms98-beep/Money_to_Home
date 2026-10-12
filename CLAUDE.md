# 머니 to 홈 — AI 도구에 주는 규칙

이 파일은 Claude 같은 AI 도구가 이 프로젝트에서 일할 때 먼저 읽는 규칙이다. 네 명이 같은 규칙으로 AI를 쓰면 결과물의 모양이 같아진다. 사람이 읽어도 된다.

## 프로젝트

광주시 아파트의 내 집 마련 시뮬레이터. 보유자산, 저축 계획, 대출 상품으로 목표할 수 있는 아파트를 지도에 보여 준다. 4명이 2주 동안 만드는 수업 프로젝트다.

- 서버: Python 3.12, FastAPI, PyMySQL (SQL을 직접 쓴다)
- DB: MariaDB 11.4
- 화면: HTML, CSS, JavaScript. Bootstrap, Sass, React 같은 라이브러리와 프레임워크를 쓰지 않는다. 모양은 `css/common.css`와 화면별 CSS로 만든다.
- 지도: 카카오맵 JavaScript SDK

## 먼저 읽을 문서

일을 시작하기 전에 관련된 문서를 읽는다. 문서와 다르게 만들지 않는다.

| 알고 싶은 것 | 문서 |
| --- | --- |
| 전체 요약 | `docs/00_summary.md` |
| 무엇을 만드는가, 계산 규칙 C-01 ~ C-13 | `docs/02_requirements.md` |
| 화면의 동작과 문구 | `docs/03_ui_design.md`, `docs/03_ui_design_wireframe.md` |
| 표와 칸 | `docs/04_database_design.md`, `db/schema.sql` |
| API의 주소, 요청, 응답 | `docs/05_api_spec.md` |
| 폴더 구조 | `docs/06_architecture.md` |
| 누가 무엇을 어떤 순서로 하는가 | `docs/roles.md` |
| Git 사용법 | `docs/git_rule.md` |

## 반드시 지킬 것

1. **요구사항에 없는 기능을 만들지 않는다.** 필요해 보여도 먼저 묻는다.
2. **계산식은 `backend/services/calc.py`에만 둔다.** router와 JavaScript에 계산식을 쓰지 않는다. 화면은 서버가 준 숫자를 보여 주기만 한다.
3. **금액은 원 단위 정수다.** API의 요청과 응답, DB, 브라우저 저장소 모두 같다. 만원은 화면에서 보여 줄 때만 쓴다.
4. **API의 모양은 `docs/05_api_spec.md`를 따른다.** 주소, 이름, 형식을 바꾸려면 명세서를 먼저 고치고 팀에 알린다.
5. **SQL에 값을 붙이지 않는다.** `%s`와 매개변수로 넘긴다. f-string으로 값을 넣지 않는다.
6. **오류 응답은 `{"detail": "...", "field": "..."}` 한 모양이다.** router에서는 `backend.errors.ApiError`를 낸다. 내부 정보(SQL, 경로)를 응답에 넣지 않는다.
7. **키와 비밀번호를 코드에 적지 않는다.** `.env`에만 두고 `backend.config.settings`로 읽는다. `.env`의 값을 출력하거나 문서에 적지 않는다.
8. **주민등록번호를 저장하거나 서버에 보내지 않는다.** 화면에서 만 나이를 계산하는 데만 쓴다. 실명, 연락처, 계좌번호, 주소, 위치도 모으지 않는다.
9. **요청을 처리하는 중에 외부 API를 부르지 않는다.** 실거래가와 좌표는 `data/`의 스크립트가 미리 DB에 넣는다.
10. **계산과 탐색 API는 요청에 든 값만 쓴다.** 로그인 정보와 `profiles` 표를 읽지 않는다.
11. **서버나 DB에서 온 글자를 화면에 넣을 때 `textContent`를 쓴다.** `innerHTML`에 넣지 않는다.
12. **쓰지 않는 말**: "구매 가능", "승인", "추천", "10년 후 집값". 대신 "지금 가능", "기간 내 가능", "자금 부족"을 쓴다.

## 담당

자기 담당 파일만 고친다. 남의 파일을 고쳐야 하면 고치지 말고 그 담당에게 알릴 내용을 적어 준다.

| 담당 | 파일 |
| --- | --- |
| 김해원 (입력과 공통) | `backend/main.py`, `config.py`, `database.py`, `deps.py`, `errors.py`, `routers/profile.py`, `routers/plans.py`, `routers/system.py`, `models/profile.py`, `schemas/common.py`, `schemas/profile.py`, `frontend/index.html`, `profile.html`, `plan.html`, `css/common.css`, `js/api.js`, `store.js`, `format.js`, `guard.js`, `layout.js` |
| 박채은 (대출과 계산) | `backend/services/calc.py`, `routers/loans.py`, `routers/scenario.py`, `models/loan_product.py`, `schemas/loan.py`, `tests/test_calc.py`, `db/seed_loan_products.sql`, `frontend/loan.html`, `js/scenario.js`, `css/scenario.css` |
| 김목산 (자료와 탐색) | `backend/routers/apartments.py`, 아파트와 거래의 `models`와 `schemas`, `data/collect_trades.py`, `data/load_trades.py`, `frontend/js/list.js`, `css/list.css` |
| 안세환 (지도와 아파트 창) | `backend/routers/apartment_detail.py`, `data/geocode.py`, `frontend/map.html`, `js/map-view.js`, `sheet.js`, `apartment.js`, 지도와 아래 창의 CSS |

네 명 모두 화면, 서버, DB를 다 쓴다. 기능 하나를 화면부터 DB까지 한 사람이 맡는다. 순서는 `docs/roles.md`에 있다.

- `backend/main.py`에는 새 router를 등록하는 한 줄만 더한다.
- `frontend/map.html`은 안세환이 틀과 빈 자리를 만든다. 목록(김목산)과 시나리오 탭(박채은)은 각자의 JavaScript와 CSS 파일에서 만든다.

## 코드를 쓰는 방법

### 서버

- 층을 지킨다. `routers`는 요청을 받아 `schemas`로 검사하고, `models`와 `services`를 부르고, 응답을 만든다. `models`는 SQL만 안다. `services/calc.py`는 숫자만 안다 (DB와 요청을 모른다).
- DB 연결은 `conn=Depends(get_db)`로 받는다. 직접 열지 않는다.
- 지금 사용자는 `user_id: int = Depends(get_current_user_id)`로 받는다. 번호를 코드에 적지 않는다.
- 새 API를 만들 때는 이미 있는 `routers/profile.py`, `models/profile.py`, `schemas/profile.py`의 모양을 따른다.
- 입력 검증의 문구는 `docs/05_api_spec.md` 5장의 문장을 그대로 쓴다.
- 계산의 버림, 반올림, 올림은 `docs/02_requirements.md` 부록 C를 따른다. 대출금액은 버림, 월 상환액은 반올림, 필요 월 저축액은 올림이다.

### 화면

- 화면마다 HTML 파일 하나. CSS와 JavaScript도 화면 이름으로 따로 둔다.
- 모든 화면이 `js/api.js`, `store.js`, `format.js`, `guard.js`, `layout.js`를 이 순서로 먼저 불러 쓴다 (`frontend/index.html` 참고).
- 서버는 `api.get`, `api.post`, `api.put`으로만 부른다. `fetch`를 직접 쓰지 않는다.
- 브라우저 저장소는 `store.get`, `store.set`으로만 읽고 쓴다. `sessionStorage`를 직접 쓰지 않는다.
- 금액과 면적은 `format.won`, `format.area`로 보여 준다.
- 색과 크기는 `css/common.css`의 `:root`에 있는 이름을 쓴다. 색 값을 화면 파일에 직접 적지 않는다.
- 모바일이 기본이다. 누르는 영역은 가로세로 44픽셀 이상으로 한다.

### 공통

- 주석과 문서는 한국어로 쓴다. 변수, 함수, 파일의 이름은 영어로 쓴다.
- 이름은 API와 DB의 이름과 같게 쓴다 (`current_assets`, `monthly_saving`, `target_years`).
- 새 라이브러리를 더하지 않는다. 꼭 필요하면 먼저 묻는다.

## 실행

프로젝트 폴더에서, 가상 환경을 켠 뒤 실행한다.

```
.venv\Scripts\activate
uvicorn backend.main:app --reload --port 8000
pytest
```

- 화면: http://localhost:8000
- API 목록: http://localhost:8000/docs
- 상태 확인: http://localhost:8000/api/health

## 일을 마치기 전에

- `pytest`가 통과하는지 본다.
- 서버를 켜서 만든 것을 직접 돌려 본다.
- `git status`로 자기 담당 파일만 바뀌었는지, `.env`가 없는지 본다.
- `git add .`을 쓰지 않는다. 파일 이름을 적어 담는다.
- 커밋 메시지는 `종류: 내용` 형식이다. 예: `feat: 대출 계산 API 추가`
- `main`과 `develop`에 직접 올리지 않는다. `develop`에서 만든 작업 브랜치를 올리고 PR을 보낸다.

## 예시 값

문서, 와이어프레임, 테스트가 같은 값을 쓴다. 결과를 확인할 때 쓴다.

| 입력 | 값 |
| --- | --- |
| 현재 보유자산 | 50,000,000 |
| 월 저축 가능액 | 1,000,000 |
| 목표 기간 | 5년 |
| 첫째 상품 | 최대 한도 360,000,000, 대출 비율 0.7, 연 4.0%, 상환 30년 |

| 결과 | 값 |
| --- | --- |
| 누적 저축액 | 60,000,000 |
| 목표 시점 자기자금 | 110,000,000 |
| 최대 예상 대출금액 | 116,666,666 |
| 그때의 월 상환액 | 556,985 |
| 목표 가능 가격 | 366,666,666 |
| 3억 원 아파트 | 대출 210,000,000, 월 상환 1,002,572, 부족자금 -20,000,000 (기간 내 가능) |
| 4억 5,000만 원 아파트 | 부족자금 25,000,000, 필요 월 저축액 1,416,667 |
