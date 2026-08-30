from datetime import date, datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas, security
from ..database import get_db
from ..constants import INCOME_CATEGORIES, EXPENSE_CATEGORIES

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.get("", response_model=List[schemas.TransactionOut])
def list_transactions(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    category: Optional[str] = Query(None),
    type: Optional[str] = Query(None, pattern="^(income|expense)$"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    query = db.query(models.Transaction).filter(
        models.Transaction.user_id == current_user.id
    )
    if start_date:
        query = query.filter(models.Transaction.date >= start_date)
    if end_date:
        query = query.filter(models.Transaction.date <= end_date)
    if category:
        query = query.filter(models.Transaction.category == category)
    if type:
        query = query.filter(models.Transaction.type == type)

    return query.order_by(models.Transaction.date.desc(), models.Transaction.id.desc()).all()


@router.post("", response_model=schemas.TransactionOut, status_code=201)
def create_transaction(
    payload: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    if payload.type == "income" and payload.category not in INCOME_CATEGORIES:
        raise HTTPException(status_code=400, detail="Неверная категория дохода")
    if payload.type == "expense" and payload.category not in EXPENSE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Неверная категория расхода")
    
    tx = models.Transaction(
        user_id=current_user.id,
        type=payload.type,
        category=payload.category,
        amount=payload.amount,
        date=payload.date,  # payload.date уже является объектом date
        comment=payload.comment,
        exclude_from_income=payload.exclude_from_income
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def _get_owned_transaction(tx_id: int, db: Session, user: models.User) -> models.Transaction:
    tx = (
        db.query(models.Transaction)
        .filter(models.Transaction.id == tx_id, models.Transaction.user_id == user.id)
        .first()
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Операция не найдена")
    return tx


@router.put("/{tx_id}", response_model=schemas.TransactionOut)
def update_transaction(
    tx_id: int,
    payload: schemas.TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    tx = _get_owned_transaction(tx_id, db, current_user)
    
    update_data = payload.model_dump(exclude_unset=True)
    
    # ===== КОНВЕРТАЦИЯ ДАТЫ ИЗ СТРОКИ В ОБЪЕКТ DATE =====
    if "date" in update_data and update_data["date"] is not None:
        update_data["date"] = datetime.strptime(update_data["date"], "%Y-%m-%d").date()
    # ====================================================
    
    # Проверка категорий
    if "type" in update_data or "category" in update_data:
        new_type = update_data.get("type", tx.type)
        new_category = update_data.get("category", tx.category)
        if new_type == "income" and new_category not in INCOME_CATEGORIES:
            raise HTTPException(status_code=400, detail="Неверная категория дохода")
        if new_type == "expense" and new_category not in EXPENSE_CATEGORIES:
            raise HTTPException(status_code=400, detail="Неверная категория расхода")
    
    for field, value in update_data.items():
        setattr(tx, field, value)
    
    db.commit()
    db.refresh(tx)
    return tx


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    tx = _get_owned_transaction(tx_id, db, current_user)
    db.delete(tx)
    db.commit()
    return None