import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# from models.base import * # Descomentar quan estiguin els imports configurats correctament amb la BD

app = FastAPI(
    title="Geocontent Core V2 API",
    description="El Cervell - Motor central de dades i processament asíncron per a PXX",
    version="2.0.0"
)

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
    allow_headers=["*"],
    expose_headers=["*"]
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
