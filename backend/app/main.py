from dotenv import load_dotenv
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth
from . import models
from .database import engine
from .routers import auth, transactions, dashboard, plans, export
load_dotenv()
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Личный финансовый учет API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # для разработки; в проде укажите конкретный домен фронтенда
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(transactions.router)
app.include_router(dashboard.router)
app.include_router(plans.router)
app.include_router(export.router)
app.include_router(auth.router)

@app.get("/api/health")
def health():
    return {"status": "ok"}
