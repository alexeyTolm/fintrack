import smtplib
import random
import redis
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import timedelta
import os
from dotenv import load_dotenv

load_dotenv()

# ===== НАСТРОЙКА REDIS (с протоколом 2) =====
redis_client = redis.Redis(
    host='localhost',
    port=6380,
    db=0,
    decode_responses=True,
    protocol=2  # <-- отключаем HELLO
)

# ===== НАСТРОЙКА EMAIL =====
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USERNAME = os.getenv("MAIL_USERNAME")
SMTP_PASSWORD = os.getenv("MAIL_PASSWORD")
MAIL_FROM = os.getenv("MAIL_FROM")


def generate_verification_code() -> str:
    return f"{random.randint(100000, 999999)}"


def save_code(email: str, code: str, ttl_minutes: int = 15):
    key = f"verify:{email}"
    redis_client.setex(key, timedelta(minutes=ttl_minutes), code)


def get_code(email: str) -> str | None:
    key = f"verify:{email}"
    return redis_client.get(key)


def delete_code(email: str):
    key = f"verify:{email}"
    redis_client.delete(key)


def save_temp_user(email: str, password_hash: str, username: str, ttl_minutes: int = 15):
    key = f"temp_user:{email}"
    data = json.dumps({
        "password_hash": password_hash,
        "username": username
    })
    redis_client.setex(key, timedelta(minutes=ttl_minutes), data)


def get_temp_user(email: str) -> dict | None:
    key = f"temp_user:{email}"
    data = redis_client.get(key)
    if data:
        return json.loads(data)
    return None


def delete_temp_user(email: str):
    key = f"temp_user:{email}"
    redis_client.delete(key)


def send_email(to_email: str, subject: str, html_content: str) -> bool:
    try:
        msg = MIMEMultipart()
        msg['From'] = MAIL_FROM
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(html_content, 'html'))
        
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
        print(f"✅ Письмо отправлено на {to_email}")
        return True
    except Exception as e:
        print(f"❌ Ошибка отправки email: {e}")
        return False


def send_verification_email(email: str, code: str):
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">💰 Подтверждение регистрации</h2>
        <p>Здравствуйте!</p>
        <p>Для завершения регистрации введите следующий код:</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 10px; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #1f2937;">
            {code}
        </div>
        <p style="color: #6b7280; font-size: 14px;">Код действителен в течение 15 минут.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 12px;">© ФинУчет</p>
    </body>
    </html>
    """
    return send_email(email, "Код подтверждения регистрации", html_content)


def send_reset_password_email(email: str, code: str):
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">🔐 Сброс пароля</h2>
        <p>Здравствуйте!</p>
        <p>Мы получили запрос на сброс пароля. Введите следующий код:</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 10px; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #1f2937;">
            {code}
        </div>
        <p style="color: #6b7280; font-size: 14px;">Код действителен в течение 15 минут.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 12px;">© ФинУчет</p>
    </body>
    </html>
    """
    return send_email(email, "Код сброса пароля", html_content)