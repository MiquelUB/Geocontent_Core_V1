#!/bin/bash

echo "=== INICIANT EL CONTENIDOR PXX-BACKEND ==="

# Arrencar el worker d'ARQ en segon pla
echo "Arrencant l'ARQ Worker..."
python3 -m arq worker.WorkerSettings &
ARQ_PID=$!

# Arrencar l'API FastAPI en primer pla
echo "Arrencant FastAPI (Uvicorn)..."
if python3 -m uvicorn main:app --host 0.0.0.0 --port 8000; then
    echo "Uvicorn ha finalitzat."
else
    EXIT_CODE=$?
    echo "=== ERROR CRÍTIC: Uvicorn ha fallat amb codi $EXIT_CODE ==="
    echo "Mantenint el contenidor viu per depuració (1 hora)..."
    sleep 3600
fi
