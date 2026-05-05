FROM postgis/postgis:16-3.4

# Canvi a root per poder instal·lar paquets
USER root

# Instal·lació de pgvector (Necessari per a la cerca semàntica IA)
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-16-pgvector \
    && rm -rf /var/lib/apt/lists/*

# Retorn a l'usuari postgres per seguretat en runtime
USER postgres

# L'extensió s'activa a la DB amb: CREATE EXTENSION vector;
