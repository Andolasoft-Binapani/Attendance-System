import os, uuid, shutil
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from app.database import get_db
from app.models import Employee, Attendance, User
from app.routers.auth import get_current_user

router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    # Normalize legacy naive timestamps before doing datetime arithmetic.
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _require_employee(user: User = Depends(get_current_user)) -> User:
    if user.role != "employee" or not user.employee_id:
        raise HTTPException(403, "Employee access required")
    return user


@router.get("/me")
async def get_my_profile(
    user: User = Depends(_require_employee),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Employee).where(Employee.id == user.employee_id))
    emp = r.scalar_one_or_none()
    if not emp:
        raise HTTPException(404, "Employee record not found")
    return {
        "id": str(emp.id),
        "employee_id": emp.employee_id,
        "name": emp.name,
        "email": emp.email,
        "phone": emp.phone,
        "department": emp.department.name if emp.department else None,
        "designation": emp.designation,
        "joining_date": str(emp.joining_date) if emp.joining_date else None,
        "image_path": emp.image_path,
    }


@router.get("/today")
async def get_today(
    user: User = Depends(_require_employee),
    db: AsyncSession = Depends(get_db),
):
    today = _utcnow().date()
    r = await db.execute(
        select(Attendance).where(
            and_(Attendance.employee_id == user.employee_id, Attendance.date == today)
        )
    )
    att = r.scalar_one_or_none()
    if not att:
        return {"date": str(today), "status": None, "punch_in_time": None,
                "punch_out_time": None, "working_hours": None,
                "punch_in_image": None, "punch_out_image": None}
    return {
        "id": str(att.id),
        "date": str(att.date),
        "status": att.status,
        "punch_in_time": att.punch_in_time.isoformat() if att.punch_in_time else None,
        "punch_out_time": att.punch_out_time.isoformat() if att.punch_out_time else None,
        "working_hours": float(att.working_hours) if att.working_hours else None,
        "punch_in_image": att.punch_in_image,
        "punch_out_image": att.punch_out_image,
    }


@router.get("/attendance")
async def get_my_attendance(
    skip: int = 0,
    limit: int = 30,
    user: User = Depends(_require_employee),
    db: AsyncSession = Depends(get_db),
):
    q = (select(Attendance)
         .where(Attendance.employee_id == user.employee_id)
         .order_by(desc(Attendance.date))
         .offset(skip).limit(limit))
    r = await db.execute(q)
    return [{
        "id": str(a.id),
        "date": str(a.date),
        "status": a.status,
        "punch_in_time": a.punch_in_time.isoformat() if a.punch_in_time else None,
        "punch_out_time": a.punch_out_time.isoformat() if a.punch_out_time else None,
        "working_hours": float(a.working_hours) if a.working_hours else None,
        "punch_in_image": a.punch_in_image,
        "punch_out_image": a.punch_out_image,
    } for a in r.scalars().all()]


@router.post("/punch")
async def self_punch(
    action: str = Form(...),
    image: Optional[UploadFile] = File(None),
    user: User = Depends(_require_employee),
    db: AsyncSession = Depends(get_db),
):
    if action not in ("punch_in", "punch_out"):
        raise HTTPException(400, "action must be punch_in or punch_out")

    snapshot_path = None
    if image and image.filename:
        if not image.content_type.startswith("image/"):
            raise HTTPException(400, "Only images allowed")
        ext = image.filename.rsplit(".", 1)[-1].lower()
        os.makedirs("uploads/snapshots", exist_ok=True)
        snapshot_path = f"uploads/snapshots/self_{uuid.uuid4()}.{ext}"
        with open(snapshot_path, "wb") as f:
            shutil.copyfileobj(image.file, f)

    today = _utcnow().date()
    now = _utcnow()
    ar = await db.execute(
        select(Attendance).where(
            and_(Attendance.employee_id == user.employee_id, Attendance.date == today)
        )
    )
    att = ar.scalar_one_or_none()

    if action == "punch_in":
        if att and att.punch_in_time:
            return {"status": "already_punched_in",
                    "message": f"Already punched in at {att.punch_in_time.strftime('%H:%M')}"}
        if att is None:
            att = Attendance(employee_id=user.employee_id, date=today)
            db.add(att)
        att.punch_in_time = now
        att.punch_in_image = snapshot_path
        att.status = "late" if now.hour > 9 or (now.hour == 9 and now.minute > 15) else "present"
        await db.commit()
        return {"status": "success", "action": "punch_in", "time": now.isoformat(),
                "message": f"Punched in at {now.strftime('%H:%M')}"}

    if att is None or att.punch_in_time is None:
        return {"status": "not_punched_in", "message": "You have not punched in today"}
    if att.punch_out_time:
        return {"status": "already_punched_out",
                "message": f"Already punched out at {att.punch_out_time.strftime('%H:%M')}"}
    att.punch_out_time = now
    att.punch_out_image = snapshot_path
    hrs = (now - _as_utc(att.punch_in_time)).total_seconds() / 3600
    att.working_hours = round(hrs, 2)
    if hrs < 4:
        att.status = "half_day"
    await db.commit()
    return {"status": "success", "action": "punch_out", "time": now.isoformat(),
            "working_hours": float(att.working_hours),
            "message": f"Punched out at {now.strftime('%H:%M')} — {att.working_hours}h worked"}
