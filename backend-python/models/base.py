import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, Index, String
from sqlalchemy.dialects.postgresql import JSONB, ARRAY

class User(SQLModel, table=True):
    """
    Representa un usuari del sistema (Turista o Administrador d'Ajuntament).
    Aïllat via RLS a PostgreSQL.
    """
    __tablename__ = "users"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(unique=True, index=True)
    email_verified: Optional[datetime] = Field(default=None)
    password_hash: Optional[str] = Field(default=None)
    username: Optional[str] = Field(default=None)
    image: Optional[str] = Field(default=None)
    avatar_url: Optional[str] = Field(default=None)
    role: str = Field(default="TOURIST")
    xp: int = Field(default=0)
    level: int = Field(default=1)
    municipality_id: Optional[uuid.UUID] = Field(default=None, foreign_key="municipalities.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    municipality: Optional["Municipality"] = Relationship(back_populates="users")

class Municipality(SQLModel, table=True):
    """
    Representa un municipi (client). Multi-tenant base.
    """
    __tablename__ = "municipalities"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    slug: str = Field(unique=True, index=True)
    name_translations: Dict[str, str] = Field(default_factory=dict, sa_column=Column(JSONB))
    logo_url: Optional[str] = Field(default=None)
    plan_tier: str = Field(default="basic")
    theme_id: str = Field(default="mountain")
    admin_master_password: Optional[str] = Field(default=None)
    last_published_at: Optional[datetime] = Field(default=None)
    packaging_status: str = Field(default="IDLE")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    users: List[User] = Relationship(back_populates="municipality")
    routes: List["Route"] = Relationship(back_populates="municipality")

class Route(SQLModel, table=True):
    """
    Rutes o itineraris de Llegendes que pertanyen a un municipi.
    """
    __tablename__ = "routes"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    municipality_id: Optional[uuid.UUID] = Field(default=None, foreign_key="municipalities.id", index=True)
    slug: str = Field(unique=True, index=True)
    name: Optional[str] = Field(default=None)
    name_translations: Dict[str, str] = Field(default_factory=dict, sa_column=Column(JSONB))
    description: Optional[str] = Field(default=None)
    description_translations: Dict[str, str] = Field(default_factory=dict, sa_column=Column(JSONB))
    theme_id: str = Field(default="mountain")
    availability_type: str = Field(default="permanent")
    is_premium: bool = Field(default=False)
    thumbnail_1x1: Optional[str] = Field(default=None)
    header_16x9: Optional[str] = Field(default=None)
    status: str = Field(default="DRAFT")
    final_quiz: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSONB))
    audio_translations: Dict[str, str] = Field(default_factory=dict, sa_column=Column(JSONB))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    municipality: Optional[Municipality] = Relationship(back_populates="routes")

class Poi(SQLModel, table=True):
    """
    Punts d'Interès (POIs / Punts d'Or).
    Contenen el contingut immersiu (vídeos, àudios i quizzes) transcodificats pel Worker.
    """
    __tablename__ = "pois"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str
    description: Optional[str] = Field(default=None)
    title_translations: Dict[str, str] = Field(default_factory=dict, sa_column=Column(JSONB))
    description_translations: Dict[str, str] = Field(default_factory=dict, sa_column=Column(JSONB))
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)
    audio_url: Optional[str] = Field(default=None)
    video_urls: List[str] = Field(default_factory=list, sa_column=Column(ARRAY(String)))
    text_content: Optional[str] = Field(default=None)
    app_thumbnail: Optional[str] = Field(default=None)
    header_16x9: Optional[str] = Field(default=None)
    carousel_images: List[str] = Field(default_factory=list, sa_column=Column(ARRAY(String)))
    icon: Optional[str] = Field(default=None)
    type: Optional[str] = Field(default=None)
    manual_quiz: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSONB))
    text_content_translations: Dict[str, str] = Field(default_factory=dict, sa_column=Column(JSONB))
    audio_translations: Dict[str, str] = Field(default_factory=dict, sa_column=Column(JSONB))
    voice_script: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RoutePoi(SQLModel, table=True):
    """
    Taula associativa molts-a-molts entre Rutes i POIs amb sort_order.
    """
    __tablename__ = "route_pois"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    route_id: uuid.UUID = Field(foreign_key="routes.id", index=True)
    poi_id: uuid.UUID = Field(foreign_key="pois.id", index=True)
    order_index: int = Field(default=0)

class UserUnlock(SQLModel, table=True):
    """
    Registre del Passaport d'un usuari en completar / desbloquejar un POI.
    Aïllat via RLS per user_id.
    """
    __tablename__ = "user_unlocks"
    user_id: uuid.UUID = Field(foreign_key="users.id", primary_key=True)
    poi_id: uuid.UUID = Field(foreign_key="pois.id", primary_key=True)
    unlocked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    earned_xp: int
    quiz_solved: bool = Field(default=False)

class UserRouteProgress(SQLModel, table=True):
    """
    Registre del progrés / compleció d'una ruta sencera pel Passaport.
    """
    __tablename__ = "user_route_progress"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    route_id: uuid.UUID = Field(foreign_key="routes.id", index=True)
    completed_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OutboxEvent(SQLModel, table=True):
    """
    Outbox Pattern: Els esdeveniments escrits pel BFF i processats pel Worker Python.
    Garanteix la sincronització exactamente-una-vegada en deploys i caigudes de Redis.
    """
    __tablename__ = "outbox_events"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    tipus_event: str = Field(index=True)
    payload: Dict[str, Any] = Field(sa_column=Column(JSONB))
    estat: str = Field(default="PENDING", index=True)
    creat_el: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
