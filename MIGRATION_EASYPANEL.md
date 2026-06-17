# 🚀 Runbook de Desplegament a Easypanel (PXX Geocontent V2 — Clean Slate)

> **Última revisió:** 2026-05-05 (Post-auditoria V2 Sovereign)  
> Aquest document detalla el pla d'acció "Clean Slate" per desplegar l'arquitectura V2 a Easypanel (Hetzner). La V1 queda congelada. Tot el deute tècnic de BullMQ, Supabase i IMAP ha estat eliminat.

---

## FASE 1: Infraestructura V2 a Easypanel i Volums Persistents

Dins d'Easypanel, crea els següents serveis aïllats amb **Volums Persistents** i **Seguretat Perimetral** (zero mapatge de ports externs en producció, accés exclusiu via xarxa interna Docker):

### 1. PostgreSQL (PostGIS 16-3.4)

Imatge: `postgis/postgis:16-3.4`. La base de dades neix completament buida. Forçar `LC_ALL=C.UTF-8` per evitar corrupció d'índexs B-Tree.

- **Volum Persistent obligatori.** La imatge PostGIS arrenca amb un usuari no-root. Si el volum d'Easypanel/Hetzner es crea com a `root`, el contenidor fallarà silenciosament en escriure a `/var/lib/postgresql/data`. Assegurar permisos correctes.
- **Backups diaris automatitzats** cap a object storage extern (AWS S3, Cloudflare R2, Hetzner Storage Box). **Prohibit el MinIO local per als dumps (SPOF)**. Format: `pg_dump -Fc -Z 9` per permetre restauracions multithreading.
- **Seguretat:** No exposar el port 5432 en producció (només xarxa interna Docker).
- **Límit de memòria:** 1536MB (OOM Guard per Hetzner Shared).

### 2. PgBouncer (Connection Pooler)

Imatge: `edoburu/pgbouncer:latest`. Mode transacció per maximitzar connexions.

- `POOL_MODE: transaction` amb `MAX_CLIENT_CONN: 1000` per absorbir el paral·lelisme del Worker ARQ.
- L'App (Next.js) i el Motor (FastAPI) connecten **sempre via PgBouncer** (port 6432). Únicament Alembic bypassa PgBouncer via `DATABASE_DIRECT_URL` (port 5432).
- **Evolució (P1):** Configurar `auth_query` amb `SECURITY DEFINER` per evitar `userlist.txt` manual:
  ```sql
  CREATE OR REPLACE FUNCTION pgbouncer_get_auth(p_usename TEXT)
  RETURNS TABLE(username TEXT, shadow_pass TEXT) AS $$
  BEGIN
      RETURN QUERY SELECT usename::TEXT, passwd::TEXT FROM pg_catalog.pg_shadow WHERE usename = p_usename;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  -- pgbouncer.ini: auth_query = SELECT * FROM pgbouncer_get_auth($1)
  ```
- Deshabilitar el pooling a l'ORM (`poolclass=NullPool`) i configurar healthchecks (`pool_pre_ping=True`). Timeouts agressius: `server_idle_timeout=10-30s`.

### 3. Redis (Cues ARQ)

Imatge: `redis:alpine`. Redis és **purament efímer** — la font de veritat és PostgreSQL (taula `OutboxEvent`).

- **Sense Volum Persistent.** Si el contenidor cau, arrenca en blanc. L'Outbox Pattern garanteix que cap tasca es perdi.
- **Política de memòria: `noeviction`** (obligatori). Polítiques d'evicció com `volatile-lru` corromprien les referències internes d'ARQ.
- **`maxmemory: 256mb`** per rebutjar noves connexions amb errors OOM controlats en lloc de bloquejar el node sencer.
- **Límit de memòria Docker:** 256MB.

### 4. MinIO (S3 Self-Hosted)

Imatge: `minio/minio`. Emmagatzematge d'assets, vídeos HLS i paquets territorials.

- **Volum Persistent obligatori.**
- Buckets públics només per a assets del frontend (`geocontent`), privats per a backups i documents interns.
- **Lifecycle Rule 30 dies** als buckets de backups.
- **Protecció Ransomware (P2):** Object Lock WORM + Versioning al bucket extern de backups.

### 5. API Core (FastAPI + ARQ Worker)

Imatge: Build des de `./backend-python`. Motor REST + worker integrat de tasques asíncrones.

- **Responsabilitats:** API REST, processament IA territorial, transcodificació de vídeo (FFmpeg/HLS), generació de paquets territorials.
- **Connexions:** PostgreSQL via PgBouncer + Redis per a cues ARQ.
- **Outbox Pattern:** Un poller intern consulta `OutboxEvent` amb `FOR UPDATE SKIP LOCKED` per garantir exactly-once execution en entorns multi-rèplica.
- **Graceful Shutdown:** Uvicorn gestiona SIGTERM nativament, però s'ha d'assegurar que les tasques ARQ en curs arriben a completar-se abans del shutdown.
- **Límit de memòria:** 512MB.

### 6. BFF Next.js (Cervell)

Imatge: Build des de `.` (arrel). UI + Server Actions + SSR/RSC.

- **Responsabilitats:** Renderitzat, autenticació (Auth.js v5 Magic Links), Server Actions com a capa de mutació, consultes PostGIS natives.
- L'App escriu intencions a la taula `OutboxEvent` de PostgreSQL (mateixa transacció) via l'Outbox Pattern. El Motor Python les recull.
- **SSR/RSC:** Per evitar Flash of Empty Content, les dades inicials es passen com a `fallbackData` a l'SWR del client. Configurar `keepAlive: true` al client HTTP de Node.js.
- **Límit de memòria:** 1024MB.
- **Únic servei que exposa ports externs** (3000 → 80/443 via reverse proxy Easypanel).

---

## FASE 2: Injecció de Secrets i Desplegament de l'Esquema

L'esquema es desplega exclusivament a través de migracions Alembic generades des de SQLModel.

### 1. Variables d'Entorn (Configurar a Easypanel)

```env
# === DATABASE ===
DATABASE_URL="postgresql://postgres:PASS@pgbouncer:6432/geocontent_db"
DATABASE_DIRECT_URL="postgresql://postgres:PASS@db:5432/geocontent_db"
POSTGRES_PASSWORD="password_segura_generada"

# === AUTH.JS V5 ===
AUTH_SECRET="openssl rand -base64 32"
NEXTAUTH_URL="https://el-teu-domini.com"
AUTH_TRUST_HOST="true"
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxx"

# === INFRASTRUCTURE ===
REDIS_URL="redis://redis:6379"
SITE_URL="https://el-teu-domini.com"
NODE_ENV="production"

# === STORAGE S3 (MinIO) ===
S3_ENDPOINT="http://minio:9000"
S3_REGION="eu-central-1"
S3_BUCKET="geocontent"
S3_ACCESS_KEY="minio_access_key"
S3_SECRET_KEY="minio_secret_key"
NEXT_PUBLIC_STORAGE_URL="https://cdn.el-teu-domini.com"

# === IA TERRITORIAL (Opcional) ===
OPENROUTER_API_KEY="sk-or-v1-xxxxx"
AI_MODEL_ID="google/gemini-2.0-flash-001"

# === SEED (Només Dev/Staging) ===
SUPER_ADMIN_EMAIL="admin@projectexinoxano.com"
ALLOW_MOCK_SEED_DANGER="false"
```

### 2. Healthchecks en Cascada (Obligatori)

```
PostgreSQL (5432) → [service_healthy] → PgBouncer (6432) → [service_started] → API Core + BFF
Redis (6379) → [service_healthy] → API Core
API Core (8000) → [service_healthy] → BFF Next.js
```

### 3. Migració Inicial (Pre-Deploy Hook)

Executar `alembic upgrade head` al Pre-Deploy Hook d'Easypanel. L'`env.py` implementa:

- **Advisory Lock PostgreSQL** (`pg_advisory_lock(hashtext('pxx_geocontent_migrations'))`) per evitar condicions de cursa.
- **Mode AUTOCOMMIT** per evitar deadlocks transaccionals.
- **Bypass PgBouncer** automàtic via `DATABASE_DIRECT_URL` (DDL no funciona en mode transacció).

```python
# env.py (ja implementat)
direct_url = os.environ.get("DATABASE_DIRECT_URL")
if direct_url:
    config.set_main_option("sqlalchemy.url", direct_url)

with connectable.connect() as connection:
    connection.execution_options(isolation_level="AUTOCOMMIT").execute(
        text("SELECT pg_advisory_lock(hashtext('pxx_geocontent_migrations'));")
    )
    try:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    finally:
        connection.execution_options(isolation_level="AUTOCOMMIT").execute(
            text("SELECT pg_advisory_unlock(hashtext('pxx_geocontent_migrations'));")
        )
```

### 4. Row Level Security (RLS)

La migració `init_rls.py` activa RLS a totes les taules core amb polítiques:
- **`users`:** Accés exclusiu al propi perfil (`current_setting('app.current_user_id')`).
- **`municipalities`, `routes`, `pois`:** Lectura pública.
- **`user_unlocks`, `user_route_progress`:** Propietari.
- **`outbox_events`:** Només system/worker.

---

## FASE 3: Poblament Inicial (Seed i Fixtures)

### 1. Dades Mestres (Producció)
Dades oficials (DIBA, Idescat) **pre-processades a un `.sql`** (Data Migration) inclòs dins la imatge Docker. No descarregar via xarxa durant el desplegament.

### 2. Fixtures de Validació (Dev/Staging)
`scripts/seed_mock_data.py` injecta contactes, llicències i interaccions falses.
- **Guard de seguretat:** Requereix `ALLOW_MOCK_SEED_DANGER="true"`. Sense ella, avorta automàticament.

### 3. Cerques Textuals (P2)
Optimitzar el camp de contingut a `interaccions` amb índexs `GIN` / `tsvector` natiu per cerques ràpides sense bloquejar taules.

---

## FASE 4: Aïllament i Coexistència

| Entorn | Stack | Estat |
|---|---|---|
| **V1** (Supabase/Vercel) | Congelada | Exclusiva per demos històriques |
| **V2** (Easypanel/Hetzner) | Actiu i sobirà | Arquitectura Clean Slate |

---

## FASE 5: Protocol de Disaster Recovery (DR)

Testejar la restauració dels backups regularment. Script de restauració:

```bash
#!/bin/bash
set -e

# 0. Connexió al REMOTE Object Storage (S3/R2/Hetzner), NO al MinIO local
ENCODED_AK=$(python3 -c "import urllib.parse, os; print(urllib.parse.quote(os.environ.get('REMOTE_S3_ACCESS_KEY', '')))")
ENCODED_SK=$(python3 -c "import urllib.parse, os; print(urllib.parse.quote(os.environ.get('REMOTE_S3_SECRET_KEY', '')))")

export MC_HOST_remotes3="https://${ENCODED_AK}:${ENCODED_SK}@s3.eu-central.cloud-provider.com"

# 1. Descarregar l'últim backup des de l'extern
mc cp remotes3/backups/geocontent_latest.dump ./latest.dump

# 2. Reset local (clean slate)
dropdb -U postgres geocontent_local --if-exists
createdb -U postgres geocontent_local

# 3. Extensió PostGIS + Esquema via Alembic
psql -U postgres -d geocontent_local -c "CREATE EXTENSION IF NOT EXISTS postgis;"
DATABASE_DIRECT_URL="postgresql://postgres@localhost:5432/geocontent_local" alembic upgrade head

# 4. Restauració segura amb desactivació temporal de FKs
PGOPTIONS='-c session_replication_role=replica' pg_restore -U postgres -d geocontent_local --data-only -O -x -j 4 \
    -T spatial_ref_sys \
    -T alembic_version \
    ./latest.dump || echo "Restauració finalitzada amb warnings menors."

# NOTA: El dump conté `outbox_events`. El poller ha de tenir lògica per ignorar
# esdeveniments antics post-restauració per evitar re-disparar tasques històriques.
# Les Primary Keys són UUIDs v4, no calen resincronitzacions de seqüències.
```

---

## Annex: Topologia Docker

```
┌─────────────────────────────────────────────────────────────────────┐
│  Easypanel (Hetzner Shared — OOM Guards actius)                     │
│                                                                     │
│  ┌───────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐    │
│  │ PostgreSQL│───▶│ PgBouncer │───▶│ API Core │───▶│ BFF      │    │
│  │ 16+PostGIS│    │ :6432     │    │ FastAPI  │    │ Next.js  │    │
│  │ :5432     │    │ tx mode   │    │ + ARQ    │    │ :3000    │──▶ 🌐
│  └─────┬─────┘    └───────────┘    │ :8000    │    └──────────┘    │
│        │                           └────┬─────┘                     │
│  ┌─────▼─────┐                    ┌─────▼─────┐                    │
│  │ pgdata    │                    │   Redis   │                    │
│  │ (volume)  │                    │   :6379   │                    │
│  └───────────┘                    │ (efímer)  │                    │
│                                   └───────────┘                    │
│  ┌───────────┐                                                     │
│  │   MinIO   │                                                     │
│  │   :9000   │                                                     │
│  │ (volume)  │                                                     │
│  └───────────┘                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---
*Preparat per Agent Tecnologia (AnT) — PXX Architectures. Revisió V2 Sovereign, Maig 2026.*
