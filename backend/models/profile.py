"""profiles 표를 읽고 쓰는 함수. 회원 한 명에 한 줄이다."""


def find_by_user(conn, user_id: int) -> dict | None:
    """저장한 재무정보. 고른 상품의 이름을 함께 준다. 없으면 None."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT p.age, p.annual_income, p.current_assets,
                   p.loan_choice, p.loan_product_id, lp.name AS loan_product_name,
                   p.repayment_years, p.monthly_saving, p.target_years, p.updated_at
              FROM profiles p
              LEFT JOIN loan_products lp ON lp.id = p.loan_product_id
             WHERE p.user_id = %s
            """,
            (user_id,),
        )
        return cur.fetchone()


def save_finance(conn, user_id: int, age: int, annual_income: int, current_assets: int, restart: bool) -> None:
    """재무정보를 저장한다. restart면 대출 선택과 저축 계획을 함께 지운다 (DB 설계서 3.2)."""
    sql = """
        INSERT INTO profiles (user_id, age, annual_income, current_assets)
        VALUES (%s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            age = VALUES(age),
            annual_income = VALUES(annual_income),
            current_assets = VALUES(current_assets)
    """
    if restart:
        sql += """,
            loan_choice = NULL,
            loan_product_id = NULL,
            repayment_years = NULL,
            monthly_saving = NULL,
            target_years = NULL
        """
    with conn.cursor() as cur:
        cur.execute(sql, (user_id, age, annual_income, current_assets))


def save_loan(conn, user_id: int, loan_choice: str, loan_product_id: int | None, repayment_years: int | None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE profiles
               SET loan_choice = %s, loan_product_id = %s, repayment_years = %s
             WHERE user_id = %s
            """,
            (loan_choice, loan_product_id, repayment_years, user_id),
        )


def save_plan(conn, user_id: int, monthly_saving: int, target_years: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE profiles SET monthly_saving = %s, target_years = %s WHERE user_id = %s",
            (monthly_saving, target_years, user_id),
        )
