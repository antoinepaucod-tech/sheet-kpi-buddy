"""Course KPI models"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid


class Instructor(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: Optional[str] = None
    hourly_rate: float = 0
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CourseKPI(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    year: int
    month: int
    month_name: str
    day_of_week: str  # "Lundi", "Mardi", etc.
    time_slot: str  # "09:00", "18:30", etc.
    course_name: str
    instructor: Optional[str] = None
    max_capacity: int = 10
    # Weekly attendance
    week1_attendance: int = 0
    week2_attendance: int = 0
    week3_attendance: int = 0
    week4_attendance: int = 0
    week5_attendance: int = 0
    # Weekly instructor overrides
    week1_instructor: Optional[str] = None
    week2_instructor: Optional[str] = None
    week3_instructor: Optional[str] = None
    week4_instructor: Optional[str] = None
    week5_instructor: Optional[str] = None
    # Calculated
    attendance_rate: float = 0
    monthly_expenses: float = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CourseKPICreate(BaseModel):
    year: int
    month: int
    day_of_week: str
    time_slot: str
    course_name: str
    instructor: Optional[str] = None
    max_capacity: int = 10
