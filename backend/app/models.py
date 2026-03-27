import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Date, DateTime, Numeric, ForeignKey, Text, LargeBinary, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    employees = relationship("Employee", back_populates="department")

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(80), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(Text, nullable=False)
    role = Column(String(20), default="hr")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class Employee(Base):
    __tablename__ = "employees"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(String(20), unique=True, nullable=False)
    name = Column(String(150), nullable=False)
    email = Column(String(255), unique=True)
    phone = Column(String(20))
    department_id = Column(Integer, ForeignKey("departments.id"))
    designation = Column(String(100))
    joining_date = Column(Date)
    image_path = Column(Text)
    face_encoding = Column(LargeBinary)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    department = relationship("Department", back_populates="employees")
    attendances = relationship("Attendance", back_populates="employee", cascade="all, delete-orphan")

class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    punch_in_time = Column(DateTime(timezone=True))
    punch_out_time = Column(DateTime(timezone=True))
    status = Column(String(20), default="present")
    punch_in_image = Column(Text)
    punch_out_image = Column(Text)
    working_hours = Column(Numeric(5, 2))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    employee = relationship("Employee", back_populates="attendances")
