from datetime import date
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas, security
from ..database import get_db
from ..constants import EXPENSE_CATEGORIES

router = APIRouter(prefix="/api/plans", tags=["plans"])


def _month_start(d: date) -> date:
    return d.replace(day=1)


@router.get("", response_model=List[schemas.PlanOut])
def list_plans(
    month: Optional[date] = Query(None, description="Любая дата внутри нужного месяца"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    target_month = _month_start(month or date.today())
    next_month = (
        target_month.replace(month=target_month.month + 1)
        if target_month.month < 12
        else target_month.replace(year=target_month.year + 1, month=1)
    )

    plans = (
        db.query(models.CategoryPlan)
        .filter(
            models.CategoryPlan.user_id == current_user.id,
            models.CategoryPlan.month == target_month,
        )
        .all()
    )
    plans_by_cat = {p.category: p for p in plans}

    spent_rows = (
        db.query(models.Transaction.category, func.coalesce(func.sum(models.Transaction.amount), 0))
        .filter(
            models.Transaction.user_id == current_user.id,
            models.Transaction.type == "expense",
            models.Transaction.date >= target_month,
            models.Transaction.date < next_month,
        )
        .group_by(models.Transaction.category)
        .all()
    )
    spent_by_cat = {cat: Decimal(amt) for cat, amt in spent_rows}

    result = []
    for cat in EXPENSE_CATEGORIES:
        plan = plans_by_cat.get(cat)
        spent = spent_by_cat.get(cat, Decimal("0"))
        if plan:
            result.append(
                schemas.PlanOut(
                    id=plan.id,
                    category=cat,
                    month=target_month,
                    limit_amount=plan.limit_amount,
                    spent=spent,
                )
            )
        else:
            result.append(
                schemas.PlanOut(id=0, category=cat, month=target_month, limit_amount=Decimal("0"), spent=spent)
            )
    return result


@router.post("", response_model=schemas.PlanOut, status_code=201)
def upsert_plan(
    payload: schemas.PlanCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    target_month = _month_start(payload.month)
    plan = (
        db.query(models.CategoryPlan)
        .filter(
            models.CategoryPlan.user_id == current_user.id,
            models.CategoryPlan.category == payload.category,
            models.CategoryPlan.month == target_month,
        )
        .first()
    )
    if plan:
        plan.limit_amount = payload.limit_amount
    else:
        plan = models.CategoryPlan(
            user_id=current_user.id,
            category=payload.category,
            month=target_month,
            limit_amount=payload.limit_amount,
        )
        db.add(plan)
    db.commit()
    db.refresh(plan)

    next_month = (
        target_month.replace(month=target_month.month + 1)
        if target_month.month < 12
        else target_month.replace(year=target_month.year + 1, month=1)
    )
    spent = Decimal(
        db.query(func.coalesce(func.sum(models.Transaction.amount), 0))
        .filter(
            models.Transaction.user_id == current_user.id,
            models.Transaction.type == "expense",
            models.Transaction.category == payload.category,
            models.Transaction.date >= target_month,
            models.Transaction.date < next_month,
        )
        .scalar()
        or 0
    )

    return schemas.PlanOut(
        id=plan.id,
        category=plan.category,
        month=plan.month,
        limit_amount=plan.limit_amount,
        spent=spent,
    )
