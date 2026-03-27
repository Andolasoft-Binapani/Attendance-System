from datetime import datetime, date as dt_date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
from app.database import get_db
from app.models import Attendance, Employee
from app.routers.auth import get_current_user

router = APIRouter()

class PunchRequest(BaseModel):
    employee_db_id: str; action: str; snapshot_path: Optional[str]=None

@router.post("/punch")
async def punch(payload: PunchRequest, db: AsyncSession=Depends(get_db)):
    r = await db.execute(select(Employee).where(Employee.id==payload.employee_db_id))
    emp = r.scalar_one_or_none()
    if not emp: raise HTTPException(404,"Employee not found")
    today = datetime.utcnow().date(); now = datetime.utcnow()
    ar = await db.execute(select(Attendance).where(and_(Attendance.employee_id==emp.id,Attendance.date==today)))
    att = ar.scalar_one_or_none()
    if payload.action=="punch_in":
        if att and att.punch_in_time: return {"status":"already_punched_in","message":f"{emp.name} already punched in at {att.punch_in_time.strftime('%H:%M:%S')}"}
        if att is None: att=Attendance(employee_id=emp.id,date=today); db.add(att)
        att.punch_in_time=now; att.punch_in_image=payload.snapshot_path
        att.status="late" if now.hour>9 or (now.hour==9 and now.minute>15) else "present"
        await db.commit()
        return {"status":"success","action":"punch_in","time":now.isoformat(),"message":f"Punch in for {emp.name}"}
    if payload.action=="punch_out":
        if att is None or att.punch_in_time is None: return {"status":"not_punched_in","message":f"{emp.name} has not punched in"}
        if att.punch_out_time: return {"status":"already_punched_out","message":f"{emp.name} already punched out at {att.punch_out_time.strftime('%H:%M:%S')}"}
        att.punch_out_time=now; att.punch_out_image=payload.snapshot_path
        hrs = (now-att.punch_in_time).total_seconds()/3600
        att.working_hours=round(hrs,2)
        if hrs<4: att.status="half_day"
        await db.commit()
        return {"status":"success","action":"punch_out","time":now.isoformat(),"working_hours":float(att.working_hours),"message":f"Punch out for {emp.name}"}
    raise HTTPException(400,"action must be punch_in or punch_out")

@router.get("/today")
async def today_attendance(db: AsyncSession=Depends(get_db), _=Depends(get_current_user)):
    today = datetime.utcnow().date()
    r = await db.execute(select(Attendance,Employee).join(Employee).where(Attendance.date==today).order_by(Attendance.punch_in_time.desc()))
    return [{"id":str(a.id),"employee_id":e.employee_id,"name":e.name,
             "department":e.department.name if e.department else None,
             "punch_in":a.punch_in_time.isoformat() if a.punch_in_time else None,
             "punch_out":a.punch_out_time.isoformat() if a.punch_out_time else None,
             "working_hours":float(a.working_hours) if a.working_hours else None,
             "status":a.status} for a,e in r.all()]

@router.get("/logs")
async def logs(start_date: Optional[dt_date]=Query(None), end_date: Optional[dt_date]=Query(None),
    employee_id: Optional[str]=Query(None), department_id: Optional[int]=Query(None),
    status: Optional[str]=Query(None), skip: int=0, limit: int=200,
    db: AsyncSession=Depends(get_db), _=Depends(get_current_user)):
    q = select(Attendance,Employee).join(Employee)
    if start_date: q=q.where(Attendance.date>=start_date)
    if end_date: q=q.where(Attendance.date<=end_date)
    if employee_id: q=q.where(Employee.employee_id==employee_id)
    if department_id: q=q.where(Employee.department_id==department_id)
    if status: q=q.where(Attendance.status==status)
    q=q.order_by(Attendance.date.desc(),Attendance.punch_in_time.desc()).offset(skip).limit(limit)
    r = await db.execute(q)
    return [{"id":str(a.id),"employee_id":e.employee_id,"employee_name":e.name,
             "department":e.department.name if e.department else None,"date":str(a.date),
             "punch_in_time":a.punch_in_time.isoformat() if a.punch_in_time else None,
             "punch_out_time":a.punch_out_time.isoformat() if a.punch_out_time else None,
             "working_hours":float(a.working_hours) if a.working_hours else None,
             "status":a.status} for a,e in r.all()]
