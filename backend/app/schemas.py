from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Literal
from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------- Users / Auth ----------

class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=6)
    password_confirm: str

    @field_validator("password_confirm")
    @classmethod
    def passwords_match(cls, v, info):
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Пароли не совпадают")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    username: str
    currency: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Transactions ----------

class TransactionBase(BaseModel):
    type: Literal["income", "expense", "investment"]
    category: str
    amount: Decimal = Field(gt=0)
    date: date
    comment: Optional[str] = None
    exclude_from_income: bool = False  # <-- ДОБАВЛЕНО


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    type: Optional[Literal["income", "expense", "investment"]] = None
    category: Optional[str] = None
    amount: Optional[Decimal] = Field(default=None, gt=0)
    date: Optional[str] = None  # <-- ИЗМЕНЕНО НА str
    comment: Optional[str] = None
    exclude_from_income: Optional[bool] = None


class TransactionOut(TransactionBase):
    id: int

    class Config:
        from_attributes = True


# ---------- Category Plans ----------

class PlanCreate(BaseModel):
    category: str
    month: date
    limit_amount: Decimal = Field(gt=0)


class PlanOut(BaseModel):
    id: int
    category: str
    month: date
    limit_amount: Decimal
    spent: Decimal = Decimal("0")

    class Config:
        from_attributes = True


# ---------- Dashboard ----------

class DailyPoint(BaseModel):
    date: date
    amount: Decimal


class RecentTransaction(TransactionOut):
    pass


class DashboardOut(BaseModel):
    balance: Decimal
    month_income: Decimal
    month_expense: Decimal
    month_investment: Decimal  # <-- ДОБАВИТЬ
    total_investment: Decimal  # <-- ДОБАВИТЬ
    daily_expenses: List[DailyPoint]
    recent_transactions: List[RecentTransaction]


class CategoriesOut(BaseModel):
    income: List[str]
    expense: List[str]
    investment: List[str]

# ===== EMAIL VERIFICATION =====

class EmailRequest(BaseModel):
    email: EmailStr


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=1, max_length=100)
    code: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str = Field(min_length=6)
    new_password_confirm: str

    @field_validator("new_password_confirm")
    @classmethod
    def passwords_match(cls, v, info):
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Пароли не совпадают")
        return v

class UserUpdate(BaseModel):
    currency: Optional[str] = None