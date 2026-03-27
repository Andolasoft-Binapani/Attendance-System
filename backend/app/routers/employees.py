import os, uuid, shutil
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db
from app.models import Employee, Department
from app.routers.auth import get_current_user
from app.services.face_service import encode_face_from_path

router = APIRouter()

class EmployeeOut(BaseModel):
    id: str; employee_id: str; name: str
    email: Optional[str] = None; phone: Optional[str] = None
    department: Optional[str] = None; designation: Optional[str] = None
    joining_date: Optional[date] = None; image_path: Optional[str] = None
    is_active: bool; has_encoding: bool
    class Config: from_attributes = True

def _out(e):
    return EmployeeOut(id=str(e.id), employee_id=e.employee_id, name=e.name,
        email=e.email, phone=e.phone, department=e.department.name if e.department else None,
        designation=e.designation, joining_date=e.joining_date, image_path=e.image_path,
        is_active=e.is_active, has_encoding=e.face_encoding is not None)

@router.get("/departments")
async def get_departments(db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Department).order_by(Department.name))
    return [{"id": d.id, "name": d.name} for d in r.scalars().all()]

@router.get("/", response_model=list[EmployeeOut])
async def list_employees(search: Optional[str]=Query(None), department_id: Optional[int]=Query(None),
    db: AsyncSession=Depends(get_db), _=Depends(get_current_user)):
    q = select(Employee).where(Employee.is_active==True)
    if department_id: q = q.where(Employee.department_id==department_id)
    if search: q = q.where(Employee.name.ilike(f"%{search}%")|Employee.employee_id.ilike(f"%{search}%"))
    r = await db.execute(q.order_by(Employee.name))
    return [_out(e) for e in r.scalars().all()]

@router.post("/", status_code=201)
async def create_employee(employee_id: str=Form(...), name: str=Form(...),
    email: Optional[str]=Form(None), phone: Optional[str]=Form(None),
    department_id: Optional[int]=Form(None), designation: Optional[str]=Form(None),
    joining_date: Optional[date]=Form(None), image: UploadFile=File(...),
    db: AsyncSession=Depends(get_db), _=Depends(get_current_user)):
    dup = await db.execute(select(Employee).where(Employee.employee_id==employee_id))
    if dup.scalar_one_or_none(): raise HTTPException(400,"Employee ID already exists")
    if not image.content_type.startswith("image/"): raise HTTPException(400,"Only images allowed")
    ext = (image.filename or "img.jpg").rsplit(".",1)[-1].lower()
    path = f"uploads/employees/{uuid.uuid4()}.{ext}"
    with open(path,"wb") as f: shutil.copyfileobj(image.file,f)
    enc = encode_face_from_path(path)
    if enc is None: os.remove(path); raise HTTPException(422,"No face detected in photo")
    emp = Employee(employee_id=employee_id, name=name, email=email or None, phone=phone or None,
        department_id=department_id, designation=designation or None,
        joining_date=joining_date, image_path=path, face_encoding=enc)
    db.add(emp); await db.commit(); await db.refresh(emp)
    return {"id": str(emp.id), "message": "Employee created"}

@router.put("/{emp_id}")
async def update_employee(emp_id: str, name: Optional[str]=Form(None),
    email: Optional[str]=Form(None), phone: Optional[str]=Form(None),
    department_id: Optional[int]=Form(None), designation: Optional[str]=Form(None),
    image: Optional[UploadFile]=File(None), db: AsyncSession=Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(Employee).where(Employee.id==emp_id))
    emp = r.scalar_one_or_none()
    if not emp: raise HTTPException(404,"Not found")
    if name: emp.name=name
    if email: emp.email=email
    if phone: emp.phone=phone
    if department_id: emp.department_id=department_id
    if designation: emp.designation=designation
    if image and image.filename:
        if not image.content_type.startswith("image/"): raise HTTPException(400,"Only images allowed")
        path = f"uploads/employees/{uuid.uuid4()}.{image.filename.rsplit('.',1)[-1].lower()}"
        with open(path,"wb") as f: shutil.copyfileobj(image.file,f)
        enc = encode_face_from_path(path)
        if enc is None: os.remove(path); raise HTTPException(422,"No face in new image")
        if emp.image_path and os.path.exists(emp.image_path): os.remove(emp.image_path)
        emp.image_path=path; emp.face_encoding=enc
    await db.commit(); return {"message":"Updated"}

@router.delete("/{emp_id}")
async def delete_employee(emp_id: str, db: AsyncSession=Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(Employee).where(Employee.id==emp_id))
    emp = r.scalar_one_or_none()
    if not emp: raise HTTPException(404,"Not found")
    emp.is_active=False; await db.commit(); return {"message":"Deactivated"}
