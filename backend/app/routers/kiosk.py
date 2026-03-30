from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.database import get_db
from app.models import Attendance

router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.get("/status/{employee_db_id}")
async def kiosk_status(employee_db_id: str, db: AsyncSession = Depends(get_db)):
    today = _utcnow().date()
    r = await db.execute(
        select(Attendance).where(
            and_(Attendance.employee_id == employee_db_id, Attendance.date == today)
        )
    )
    att = r.scalar_one_or_none()
    if att is None:
        return {"punch_in": None, "punch_out": None}
    return {
        "punch_in": att.punch_in_time.isoformat() if att.punch_in_time else None,
        "punch_out": att.punch_out_time.isoformat() if att.punch_out_time else None,
    }
