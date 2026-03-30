import cv2
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import numpy as np
from app.database import get_db
from app.models import Employee
from app.services.face_service import decode_frame, recognize_face
from app.config import settings

router = APIRouter()

class FrameRequest(BaseModel):
    frame: str

class RecognitionResult(BaseModel):
    recognized: bool; employee_id: Optional[str]=None; employee_db_id: Optional[str]=None
    name: Optional[str]=None; department: Optional[str]=None; designation: Optional[str]=None
    image_path: Optional[str]=None; snapshot_path: Optional[str]=None; message: str

@router.post("/identify", response_model=RecognitionResult)
async def identify(payload: FrameRequest, db: AsyncSession=Depends(get_db)):
    frame = decode_frame(payload.frame)
    if frame is None: raise HTTPException(400,"Invalid frame")
    r = await db.execute(select(Employee).where(Employee.is_active==True,Employee.face_encoding!=None))
    employees = r.scalars().all()
    if not employees: return RecognitionResult(recognized=False,message="No employees enrolled")
    known = [np.frombuffer(e.face_encoding,dtype=np.float64) for e in employees]
    match = recognize_face(frame, known, tolerance=settings.FACE_RECOGNITION_TOLERANCE)
    if match=="no_face": return RecognitionResult(recognized=False,message="No face detected")
    if match=="multiple": return RecognitionResult(recognized=False,message="Multiple faces detected")
    if match is None: return RecognitionResult(recognized=False,message="Employee not recognized")
    emp = employees[match]
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    snap = f"uploads/snapshots/{emp.employee_id}_{ts}.jpg"
    _, buf = cv2.imencode(".jpg", frame)
    with open(snap,"wb") as f: f.write(buf.tobytes())
    return RecognitionResult(recognized=True, employee_id=emp.employee_id, employee_db_id=str(emp.id),
        name=emp.name, department=emp.department.name if emp.department else None,
        designation=emp.designation, image_path=emp.image_path, snapshot_path=snap, message="Identified")
