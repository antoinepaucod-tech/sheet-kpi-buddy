"""Pydantic models for email_templates collection (Atlas Mongo).

Une entrée représente une version active (ou pas) d'un template d'email
pour un `template_key` donné (ex: "renewal_reminder"). Le `club_id`
permet le multi-tenant : un template peut être :
  - Global : club_id = None → s'applique à tous les clubs
  - Spécifique : club_id = <uuid> → override le global pour ce club

La résolution suit la cascade `core.email_templates.get_template`.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class EmailTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    template_key: str            # ex: "renewal_reminder"
    club_id: Optional[str] = None  # None = global (toutes franchises)
    version: int = 1
    is_active: bool = True
    subject: str                 # peut contenir des variables Jinja2 (ex: "{{ first_name }}, ...")
    html_body: str               # body HTML Jinja2 (escape automatique activé)
    text_body: str = ""          # variante texte pour clients sans HTML
    variables: List[str] = Field(default_factory=list)  # noms des variables attendues
    metadata: dict = Field(default_factory=dict)        # libre (notes, brand_version, etc.)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class EmailTemplateCreate(BaseModel):
    template_key: str
    club_id: Optional[str] = None
    version: int = 1
    is_active: bool = True
    subject: str
    html_body: str
    text_body: str = ""
    variables: List[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class RenderedEmail(BaseModel):
    subject: str
    html: str
    text: str
    template_id: Optional[str] = None  # id du doc utilisé (None si fallback)
    used_fallback: bool = False
    fallback_reason: Optional[str] = None
