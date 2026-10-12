"""loan_products 표를 읽는 함수."""

_COLUMNS = """
    id, name, institution, max_limit, ltv_ratio, annual_rate_pct,
    repayment_years_options, max_house_price,
    eligibility_summary, eligibility_text, base_date, source_url
"""


def _to_dict(row: dict) -> dict:
    """DB의 한 줄을 API 응답의 모양으로 바꾼다."""
    row = dict(row)
    row["ltv_ratio"] = float(row["ltv_ratio"])
    row["annual_rate_pct"] = float(row["annual_rate_pct"])
    # DB에는 "10,15,20,30"으로 들어 있다. 숫자의 목록으로 바꾼다.
    row["repayment_years_options"] = [
        int(years) for years in row["repayment_years_options"].split(",") if years.strip()
    ]
    return row


def find_all(conn) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(f"SELECT {_COLUMNS} FROM loan_products ORDER BY id")
        return [_to_dict(row) for row in cur.fetchall()]


def find_by_id(conn, product_id: int) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(f"SELECT {_COLUMNS} FROM loan_products WHERE id = %s", (product_id,))
        row = cur.fetchone()
    return _to_dict(row) if row else None
