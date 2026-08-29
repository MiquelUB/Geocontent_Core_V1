import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# from models.base import * # Descomentar quan estiguin els imports configurats correctament amb la BD

app = FastAPI(
    title="Geocontent Core V2 API",
    description="El Cervell - Motor central de dades i processament asíncron per a PXX",
    version="2.0.0"
)

from routers import s3, webhooks, audio, omnivoice
app.include_router(s3.router)
app.include_router(webhooks.router)
app.include_router(audio.router)
app.include_router(omnivoice.router)

from arq import create_pool
from arq.connections import RedisSettings

@app.on_event("startup")
async def startup_event():
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        settings = RedisSettings.from_dsn(redis_url)
    else:
        settings = RedisSettings(
            host=os.getenv("REDIS_HOST", "127.0.0.1"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            password=os.getenv("REDIS_PASSWORD", None),
            conn_timeout=5,
            conn_retries=5,
            conn_retry_delay=2,
        )
    app.state.arq_pool = await create_pool(settings)

# Configuració estricta de CORS (Comunica amb Next.js i permet Bypass S3)
origins = [
    "http://localhost:3000",
    # Afegir aquí el domini de producció d'Easypanel quan estigui disponible
    os.getenv("FRONTEND_URL", "http://localhost:3000")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
    expose_headers=["X-Request-ID"]
)

@app.get("/health")
async def health_check():
    """
    Ruta de salut. Vital per als Healthchecks de Docker a Hetzner.
    """
    return {"status": "ok", "architecture": "Hybrid V2 Sovereign (FastAPI + ARQ)"}

@app.get("/")
async def root():
    return {"message": "Geocontent Core V2: Múscul Operatiu."}
