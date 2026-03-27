import io, csv
from datetime import date as dt_date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Attendance, Employee
from app.routers.auth import get_current_user

router = APIRouter()

@router.get("/csv")
async def export_csv(start_date: Optional[dt_date]=Query(None), end_date: Optional[dt_date]=Query(None),
    employee_id: Optional[str]=Query(None), db: AsyncSession=Depends(get_db), _=Depends(get_current_user)):
    q = select(Attendance,Employee).join(Employee).order_by(Attendance.date.desc())
    if start_date: q=q.where(Attendance.date>=start_date)
    if end_date: q=q.where(Attendance.date<=end_date)
    if employee_id: q=q.where(Employee.employee_id==employee_id)
    r = await db.execute(q)
    out = io.StringIO(); w = csv.writer(out)
    w.writerow(["Employee ID","Name","Department","Date","Punch In","Punch Out","Working Hours","Status"])
    for a,e in r.all():
        w.writerow([e.employee_id,e.name,e.department.name if e.department else "",a.date,
            a.punch_in_time.strftime("%H:%M:%S") if a.punch_in_time else "",
            a.punch_out_time.strftime("%H:%M:%S") if a.punch_out_time else "",
            float(a.working_hours) if a.working_hours else "",a.status])
    out.seek(0)
    return StreamingResponse(iter([out.getvalue()]),media_type="text/csv",
        headers={"Content-Disposition":"attachment; filename=attendance_export.csv"})
