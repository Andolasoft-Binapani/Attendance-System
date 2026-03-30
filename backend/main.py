from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
from sqlalchemy import select
from passlib.context import CryptContext
from app.database import engine, Base, AsyncSessionLocal
from app.models import User
from app.routers import employees, attendance, recognition, auth, export, employee_panel, kiosk, settings as settings_router, liveness
from sqlalchemy import text

DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_EMAIL = "admin@company.com"
DEFAULT_ADMIN_PASSWORD = "Admin@123"
LEGACY_DEFAULT_ADMIN_HASH = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def ensure_default_admin():
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.username == DEFAULT_ADMIN_USERNAME)
        )
        user = result.scalar_one_or_none()
        if user is None:
            session.add(User(
                username=DEFAULT_ADMIN_USERNAME,
                email=DEFAULT_ADMIN_EMAIL,
                hashed_password=pwd_ctx.hash(DEFAULT_ADMIN_PASSWORD),
                role="admin",
                is_active=True,
            ))
            await session.commit()
            return

        # Keep the documented demo account usable for local/dev setups.
        if user.email == DEFAULT_ADMIN_EMAIL or user.hashed_password == LEGACY_DEFAULT_ADMIN_HASH:
            user.hashed_password = pwd_ctx.hash(DEFAULT_ADMIN_PASSWORD)
            user.email = DEFAULT_ADMIN_EMAIL
            user.role = "admin"
            user.is_active = True
            await session.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
            "employee_id UUID REFERENCES employees(id) ON DELETE SET NULL"
        ))
    await ensure_default_admin()
    os.makedirs("uploads/employees", exist_ok=True)
    os.makedirs("uploads/snapshots", exist_ok=True)
    yield

app = FastAPI(title="AI Attendance System", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:3000","http://127.0.0.1:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.include_router(auth.router,        prefix="/api/auth",        tags=["Auth"])
app.include_router(employees.router,   prefix="/api/employees",   tags=["Employees"])
app.include_router(recognition.router, prefix="/api/recognition", tags=["Recognition"])
app.include_router(attendance.router,  prefix="/api/attendance",  tags=["Attendance"])
app.include_router(export.router,      prefix="/api/export",      tags=["Export"])
app.include_router(employee_panel.router, prefix="/api/employee", tags=["Employee Panel"])
app.include_router(kiosk.router,          prefix="/api/kiosk",    tags=["Kiosk"])
app.include_router(liveness.router,       prefix="/api/liveness", tags=["Liveness"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["Settings"])

@app.get("/health")
async def health():
    return {"status": "ok"}
