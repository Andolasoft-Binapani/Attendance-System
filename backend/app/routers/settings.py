from datetime import date as dt_date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from app.database import get_db
from app.models import Setting, Holiday
from app.routers.auth import get_current_user

router = APIRouter()

DEFAULTS = {
    "work_start_time": "09:00",
    "work_end_time":   "18:00",
    "late_threshold":  "09:15",
}


async def load_settings(db: AsyncSession) -> dict:
    r = await db.execute(select(Setting))
    result = dict(DEFAULTS)
    for row in r.scalars().all():
        result[row.key] = row.value
    return result


class SettingsUpdate(BaseModel):
    work_start_time: str
    work_end_time: str
    late_threshold: str


class HolidayCreate(BaseModel):
    date: dt_date
    name: str
    type: str = "public"


@router.get("")
async def get_settings(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    return await load_settings(db)


@router.put("")
async def update_settings(
    payload: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    for key, value in payload.model_dump().items():
        r = await db.execute(select(Setting).where(Setting.key == key))
        setting = r.scalar_one_or_none()
        if setting:
            setting.value = value
        else:
            db.add(Setting(key=key, value=value))
    await db.commit()
    return {"status": "ok"}


@router.get("/holidays")
async def list_holidays(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(Holiday).order_by(Holiday.date))
    return [
        {"id": h.id, "date": str(h.date), "name": h.name, "type": h.type}
        for h in r.scalars().all()
    ]


@router.post("/holidays", status_code=201)
async def add_holiday(
    payload: HolidayCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    r = await db.execute(select(Holiday).where(Holiday.date == payload.date))
    if r.scalar_one_or_none():
        raise HTTPException(400, "Holiday already exists for this date")
    db.add(Holiday(date=payload.date, name=payload.name, type=payload.type))
    await db.commit()
    return {"status": "ok"}


@router.delete("/holidays/{holiday_id}")
async def delete_holiday(
    holiday_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    await db.execute(delete(Holiday).where(Holiday.id == holiday_id))
    await db.commit()
    return {"status": "ok"}
