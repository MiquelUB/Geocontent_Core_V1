-- 1. Injecció manual de l'extensió PostGIS (PAS 4)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Creació de taules amb suport geogràfic (Mostra del canvi a geometry)
-- Nota: Prisma usarà Unsupported("geometry(Point, 4326)") per a aquests camps

-- Exemple per a la taula 'pois'
ALTER TABLE "pois" ADD COLUMN IF NOT EXISTS "location" geometry(Point, 4326);
CREATE INDEX IF NOT EXISTS "pois_location_idx" ON "pois" USING GIST ("location");

-- Exemple per a la taula 'user_telemetry'
ALTER TABLE "user_telemetry" ADD COLUMN IF NOT EXISTS "location" geometry(Point, 4326);
CREATE INDEX IF NOT EXISTS "user_telemetry_location_idx" ON "user_telemetry" USING GIST ("location");

-- (La resta de la migració serà generada per Prisma quan facis el primer 'db push' o 'migrate dev' real)
