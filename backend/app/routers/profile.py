from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas, security
from ..database import get_db

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("", response_model=schemas.UserOut)
def get_profile(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    return current_user


@router.put("", response_model=schemas.UserOut)
def update_profile(
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    if payload.currency is not None:
        current_user.currency = payload.currency
    db.commit()
    db.refresh(current_user)
    return current_user