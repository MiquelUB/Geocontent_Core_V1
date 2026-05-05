import uuid
from typing import Optional, List
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB

class Tenant(SQLModel, table=True):
    """
    Representa un Ajuntament o Client. Aïllat via RLS.
    """
    __tablename__ = "tenants"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    nom: str = Field(index=True)
    schema_name: str = Field(unique=True, index=True)
    creat_el: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    deals: List["Deal"] = Relationship(back_populates="tenant")

class Deal(SQLModel, table=True):
    """
    L'arquitectura és Deal-cèntrica. Tot penja d'un Deal.
    """
    __tablename__ = "deals"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    tenant_id: uuid.UUID = Field(foreign_key="tenants.id", index=True)
    titol: str
    estat: str = Field(default="Obert")
    creat_el: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    tenant: Tenant = Relationship(back_populates="deals")
    interaccions: List["Interaccio"] = Relationship(back_populates="deal")

class Interaccio(SQLModel, table=True):
    """
    Representa un correu (IMAP), trucada o nota lligada a un Deal.
    L'índex compost garanteix la deduplicació de correus via BD.
    """
    __tablename__ = "interaccions"
    __table_args__ = (
        UniqueConstraint("message_id_extern", "content_hash", name="uq_interaccio_dedup"),
        Index("ix_interaccions_contingut_gin", "contingut", postgresql_using="gin", postgresql_ops={"contingut": "gin_trgm_ops"}),
    )
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    deal_id: uuid.UUID = Field(foreign_key="deals.id", index=True)
    
    message_id_extern: Optional[str] = Field(default=None)
    content_hash: Optional[str] = Field(default=None)
    contingut: str
    
    creat_el: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    deal: Deal = Relationship(back_populates="interaccions")

class OutboxEvent(SQLModel, table=True):
    """
    Outbox Pattern: Usat pel Worker (ARQ/Celery) via FOR UPDATE SKIP LOCKED
    per evitar la pèrdua de tasques en redeploys de Redis.
    """
    __tablename__ = "outbox_events"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    tipus_event: str = Field(index=True)
    payload: dict = Field(sa_column=Column(JSONB))
    estat: str = Field(default="Pendent", index=True) # Pendent, Processat, Error
    creat_el: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
