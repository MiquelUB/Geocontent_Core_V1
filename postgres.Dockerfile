FROM postgis/postgis:16-3.4

# Forçar PostgreSQL a usar un subdirectori per evitar conflictes
# amb el VOLUME anònim declarat a la imatge base de postgres.
# El volum d'EasyPanel es munta a /var/lib/postgresql/data
# i PGDATA apunta al subdirectori /var/lib/postgresql/data/pgdata
ENV PGDATA=/var/lib/postgresql/data/pgdata

# Canvi a root per poder instal·lar paquets
USER root

# Instal·lació de pgvector (Necessari per a la cerca semàntica IA)
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-16-pgvector \
    && rm -rf /var/lib/apt/lists/*

# Retorn a l'usuari postgres per seguretat en runtime
USER postgres

# L'extensió s'activa a la DB amb: CREATE EXTENSION vector;
