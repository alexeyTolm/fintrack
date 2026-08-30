from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from .. import models, schemas, security, email_service
from ..database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ===== ЛОГИН =====
@router.post("/login")
def login(
    payload: schemas.UserLogin,
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    
    if not security.verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    
    access_token = security.create_access_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username
        }
    }


# ===== РЕГИСТРАЦИЯ =====
@router.post("/register")
async def register(
    payload: schemas.UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    # Проверка существования пользователя
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    
    # Проверка паролей
    if payload.password != payload.password_confirm:
        raise HTTPException(status_code=400, detail="Пароли не совпадают")
    
    # Хешируем пароль и сохраняем временно
    password_hash = security.get_password_hash(payload.password)
    email_service.save_temp_user(payload.email, password_hash, payload.username)
    
    # Генерируем код
    code = email_service.generate_verification_code()
    email_service.save_code(payload.email, code)
    
    # Отправляем письмо в фоне
    background_tasks.add_task(email_service.send_verification_email, payload.email, code)
    
    return {"message": "Код подтверждения отправлен на email", "email": payload.email}


# ===== ВЕРИФИКАЦИЯ =====
@router.post("/verify")
def verify_code(
    payload: schemas.VerifyCodeRequest,
    db: Session = Depends(get_db)
):
    # Проверка кода
    saved_code = email_service.get_code(payload.email)
    if not saved_code:
        raise HTTPException(status_code=400, detail="Код не найден или истёк")
    
    if saved_code != payload.code:
        raise HTTPException(status_code=400, detail="Неверный код")
    
    # Получаем временные данные пользователя
    temp_data = email_service.get_temp_user(payload.email)
    if not temp_data:
        raise HTTPException(status_code=400, detail="Данные регистрации истекли. Зарегистрируйтесь заново.")
    
    # Создаём пользователя
    user = models.User(
        email=payload.email,
        username=temp_data["username"],
        password_hash=temp_data["password_hash"]
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Очищаем Redis
    email_service.delete_code(payload.email)
    email_service.delete_temp_user(payload.email)
    
    # Генерируем JWT токен для автоматического входа
    from ..security import create_access_token
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return {
        "message": "Регистрация завершена",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username
        }
    }


# ===== СБРОС ПАРОЛЯ =====
@router.post("/forgot-password")
async def forgot_password(
    payload: schemas.EmailRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    # Проверяем существование пользователя (но не выдаём информацию)
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        # Возвращаем одинаковый ответ для безопасности
        return {"message": "Если такой email существует, код отправлен"}
    
    code = email_service.generate_verification_code()
    email_service.save_code(payload.email, code)
    
    background_tasks.add_task(email_service.send_reset_password_email, payload.email, code)
    
    return {"message": "Если такой email существует, код отправлен"}


# ===== СБРОС ПАРОЛЯ (подтверждение) =====
@router.post("/reset-password")
def reset_password(
    payload: schemas.ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    # Проверка кода
    saved_code = email_service.get_code(payload.email)
    if not saved_code:
        raise HTTPException(status_code=400, detail="Код не найден или истёк")
    
    if saved_code != payload.code:
        raise HTTPException(status_code=400, detail="Неверный код")
    
    # Проверка паролей
    if payload.new_password != payload.new_password_confirm:
        raise HTTPException(status_code=400, detail="Пароли не совпадают")
    
    # Обновление пароля
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    user.password_hash = security.get_password_hash(payload.new_password)
    db.commit()
    
    email_service.delete_code(payload.email)
    
    return {"message": "Пароль успешно изменён"}