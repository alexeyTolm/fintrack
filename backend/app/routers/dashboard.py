from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas, security
from ..database import get_db
from ..constants import INCOME_CATEGORIES, EXPENSE_CATEGORIES

router = APIRouter(tags=["dashboard"])


@router.get("/api/categories", response_model=schemas.CategoriesOut)
def get_categories():
    return schemas.CategoriesOut(income=INCOME_CATEGORIES, expense=EXPENSE_CATEGORIES)


@router.get("/api/dashboard", response_model=schemas.DashboardOut)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    uid = current_user.id

    def sum_for(type_: str, start=None, end=None, exclude_from_income: Optional[bool] = None) -> Decimal:
        q = db.query(func.coalesce(func.sum(models.Transaction.amount), 0)).filter(
            models.Transaction.user_id == uid, models.Transaction.type == type_
        )
        if start:
            q = q.filter(models.Transaction.date >= start)
        if end:
            q = q.filter(models.Transaction.date <= end)
        # Фильтр только для доходов и только если явно указан
        if type_ == "income" and exclude_from_income is not None:
            q = q.filter(models.Transaction.exclude_from_income == exclude_from_income)
        return Decimal(q.scalar() or 0)

    # ===== БАЛАНС — ВСЕ ДОХОДЫ (ВКЛЮЧАЯ ПОМЕЧЕННЫЕ) =====
    total_income = sum_for("income")  # <-- БЕЗ фильтра
    total_expense = sum_for("expense")
    balance = total_income - total_expense

    today = date.today()
    month_start = today.replace(day=1)
    
    # ===== ДОХОДЫ ЗА МЕСЯЦ — ТОЛЬКО БЕЗ ГАЛОЧКИ =====
    month_income = sum_for("income", start=month_start, end=today, exclude_from_income=False)
    month_expense = sum_for("expense", start=month_start, end=today)

    window_start = today - timedelta(days=9)
    rows = (
        db.query(models.Transaction.date, func.sum(models.Transaction.amount))
        .filter(
            models.Transaction.user_id == uid,
            models.Transaction.type == "expense",
            models.Transaction.date >= window_start,
            models.Transaction.date <= today,
        )
        .group_by(models.Transaction.date)
        .all()
    )
    by_day = {d: Decimal(amt) for d, amt in rows}
    daily_expenses = []
    cursor = window_start
    while cursor <= today:
        daily_expenses.append(
            schemas.DailyPoint(date=cursor, amount=by_day.get(cursor, Decimal("0")))
        )
        cursor += timedelta(days=1)

    recent = (
        db.query(models.Transaction)
        .filter(models.Transaction.user_id == uid)
        .order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
        .limit(5)
        .all()
    )

    return schemas.DashboardOut(
        balance=balance,
        month_income=month_income,
        month_expense=month_expense,
        daily_expenses=daily_expenses,
        recent_transactions=recent,
    )