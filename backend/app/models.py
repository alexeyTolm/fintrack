from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Numeric, Date, DateTime, ForeignKey, Text, Boolean  # <-- ДОБАВЛЕНО Boolean
)
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    username = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    transactions = relationship(
        "Transaction", back_populates="owner", cascade="all, delete-orphan"
    )
    plans = relationship(
        "CategoryPlan", back_populates="owner", cascade="all, delete-orphan"
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, nullable=False)  # 'income' or 'expense'
    category = Column(String, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    date = Column(Date, nullable=False, default=date.today, index=True)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    exclude_from_income = Column(Boolean, default=False, nullable=False)

    owner = relationship("User", back_populates="transactions")


class CategoryPlan(Base):
    __tablename__ = "category_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category = Column(String, nullable=False)
    month = Column(Date, nullable=False)  # first day of month, e.g. 2025-03-01
    limit_amount = Column(Numeric(12, 2), nullable=False)

    owner = relationship("User", back_populates="plans")
