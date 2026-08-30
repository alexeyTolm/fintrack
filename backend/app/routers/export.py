import io
from datetime import date
from typing import Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Font
from sqlalchemy.orm import Session

from .. import models, security
from ..database import get_db

router = APIRouter(tags=["export"])


@router.get("/api/export")
def export_transactions(
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    expenses_only: bool = Query(False, description="Если true — только расходы"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    query = db.query(models.Transaction).filter(models.Transaction.user_id == current_user.id)
    if start:
        query = query.filter(models.Transaction.date >= start)
    if end:
        query = query.filter(models.Transaction.date <= end)
    if expenses_only:
        query = query.filter(models.Transaction.type == "expense")

    rows = query.order_by(models.Transaction.date.asc()).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Отчет"

    headers = ["Дата", "Тип", "Категория", "Сумма", "Комментарий", "Исключено из доходов"]
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)

    total_income = Decimal("0")
    total_expense = Decimal("0")
    type_labels = {"income": "Доход", "expense": "Расход"}

    for tx in rows:
        # ===== ПОКАЗЫВАЕМ СТАТУС ГАЛОЧКИ =====
        excluded = "Да" if tx.exclude_from_income else "Нет"
        
        ws.append(
            [
                tx.date.strftime("%Y-%m-%d"),
                type_labels.get(tx.type, tx.type),
                tx.category,
                float(tx.amount),
                tx.comment or "",
                excluded,
            ]
        )
        
        # ===== СЧИТАЕМ ИТОГИ (ИСКЛЮЧАЯ ПОМЕЧЕННЫЕ ДОХОДЫ) =====
        if tx.type == "income" and not tx.exclude_from_income:
            total_income += Decimal(str(tx.amount))
        elif tx.type == "expense":
            total_expense += Decimal(str(tx.amount))

    ws.append([])
    ws.append(["", "", "Итого доходы:", float(total_income)])
    ws.append(["", "", "Итого расходы:", float(total_expense)])
    ws.append(["", "", "Разница:", float(total_income - total_expense)])

    # ===== ДОБАВЛЯЕМ ПРИМЕЧАНИЕ =====
    ws.append([])
    ws.append(["Примечание: доходы с пометкой 'Исключено из доходов' не учитываются в итоговой сумме"])

    for col, width in zip("ABCDEF", [12, 10, 18, 14, 30, 18]):
        ws.column_dimensions[col].width = width

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    filename = f"finance_report_{start or 'all'}_{end or 'all'}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )