FROM python:3.12-slim

# Evitar que Python generi fitxers .pyc i forçar output en temps real
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Instal·lació de dependències GIS a nivell de sistema operatiu (Crucial per a PostGIS/GDAL)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin \
    libgdal-dev \
    libgeos-dev \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Crear usuari no-root
RUN adduser --disabled-password --gecos "" appuser

# Instal·lar dependències de Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar el codi de la API
COPY . .

# Canviar propietat a l'usuari no-root
RUN chown -R appuser:appuser /app
USER appuser

# El port 8000 NO s'ha d'exposar públicament a Easypanel (comunicació interna)
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
