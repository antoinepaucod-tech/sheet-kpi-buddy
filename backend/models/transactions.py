"""Transaction and category models"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid


class AccountingCategory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    kpi_column: str
    type: str  # "expense" | "revenue"
    revenue_type: Optional[str] = None  # "Membre" | "Produit" | "Service" (for revenue only)
    color: str = "#3B82F6"


class CategoryCreate(BaseModel):
    name: str
    kpi_column: str
    type: str
    revenue_type: Optional[str] = None
    color: str = "#3B82F6"


class AccountingTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    description: str
    amount: float
    type: str  # "revenue" | "expense"
    category: str
    sub_type: Optional[str] = None  # "members" | "coaching"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TransactionCreate(BaseModel):
    date: str
    description: str
    amount: float
    type: str
    category: str
    sub_type: Optional[str] = None


class ExcludedRecurringExpense(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    original_transaction_id: str
    category: str
    description: str
    amount: float
    type: str = "expense"
    sub_type: Optional[str] = None
    date: Optional[str] = None
    excluded_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RecurringTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # "revenue" | "expense"
    category: str
    description: str
    amount: float
    sub_type: Optional[str] = None
    recurrence_day: int = 1  # Day of month (1-28)
    recurrence_end_date: Optional[str] = None  # Date de fin de récurrence
    is_indefinite_recurrence: bool = True  # Sans date de fin
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RecurringTransactionCreate(BaseModel):
    type: str
    category: str
    description: str
    amount: float
    sub_type: Optional[str] = None
    recurrence_day: int = 1
    recurrence_end_date: Optional[str] = None
    is_indefinite_recurrence: bool = True
    is_active: bool = True
