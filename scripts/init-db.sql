-- PXX V2 SOVEREIGN — Database Initialization Script
-- Automatització de la configuració de seguretat i extensions

-- 1. Forçar l'estàndard de xifratge SCRAM-SHA-256
ALTER SYSTEM SET password_encryption = 'scram-sha-256';
SELECT pg_reload_conf();

-- 2. Assegurar que l'usuari principal té la contrasenya correctament xifrada
-- Nota: En producció, la contrasenya es gestiona via variables d'entorn de Docker,
-- però aquest script assegura que el motor estigui configurat per acceptar-les.

-- 3. Habilitar extensions necessàries (PostGIS i UUID)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 4. Optimitzacions per a PgBouncer
ALTER DATABASE geocontent_db SET application_name = 'geocontent_core';
