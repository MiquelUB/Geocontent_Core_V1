#!/bin/bash
set -e

# Extraure host i port de la DATABASE_URL (ex: postgresql://user:pass@db_host:5432/db_name)
DB_HOST=$(echo $DATABASE_URL | sed -e s,.*@,,g -e s,/.*,,g | cut -d: -f1)
DB_PORT=$(echo $DATABASE_URL | sed -e s,.*@,,g -e s,/.*,,g | cut -d: -f2)

echo "Verificant connexió a PostgreSQL a $DB_HOST:$DB_PORT..."

while ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U postgres; do
  echo "PostgreSQL no està llest. Reintentant en 2 segons..."
  sleep 2
done

echo "PostgreSQL operatiu. Executant migracions d'Alembic..."
alembic upgrade head
