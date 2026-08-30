#!/bin/bash

# Arrencar el worker d'ARQ en segon pla
echo "Arrencant l'ARQ Worker..."
arq worker.WorkerSettings &

# Arrencar l'API FastAPI en primer pla
echo "Arrencant FastAPI (Uvicorn)..."
exec uvicorn main:app --host 0.0.0.0 --port 8000
