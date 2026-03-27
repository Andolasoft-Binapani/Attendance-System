from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from app.database import get_db
from app.models import User
from app.config import settings

router = APIRouter()
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

class Token(BaseModel):
    access_token: str; token_type: str; role: str; username: str

def create_token(data: dict) -> str:
    p = {**data, "exp": datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)}
    return jwt.encode(p, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    exc = HTTPException(status_code=401, detail="Invalid credentials", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username = payload.get("sub")
        if not username: raise exc
    except JWTError: raise exc
    r = await db.execute(select(User).where(User.username == username))
    user = r.scalar_one_or_none()
    if not user or not user.is_active: raise exc
    return user

def require_admin(user: User = Depends(get_current_user)):
    if user.role != "admin": raise HTTPException(403, "Admin access required")
    return user

@router.post("/login", response_model=Token)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.username == form.username))
    user = r.scalar_one_or_none()
    if not user or not pwd_ctx.verify(form.password, user.hashed_password):
        raise HTTPException(401, "Invalid username or password")
    return Token(access_token=create_token({"sub": user.username, "role": user.role}),
                 token_type="bearer", role=user.role, username=user.username)

@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {"id": str(user.id), "username": user.username, "role": user.role}
