#!/bin/bash

echo "=== INICIANT EL CONTENIDOR PXX-BACKEND ==="

# Trap per netejar processos de fons si el contenidor s'atura
cleanup() {
    echo "Aturant processos de fons..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Supervisió del worker ARQ amb reinici automàtic si cau
(while true; do
  echo "[Supervisor] Arrencant ARQ Worker..."
  python3 -m arq worker.WorkerSettings
  EXIT_CODE=$?
  echo "[Supervisor] ARQ Worker ha finalitzat amb codi $EXIT_CODE. Reiniciant en 5s..."
  sleep 5
done) &


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
