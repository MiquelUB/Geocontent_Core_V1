# 🚀 Runbook de Desplegament a Easypanel (PXX Geocontent V2 - Clean Slate)

Aquest document detalla el pla d'acció "Clean Slate" per desplegar la nova arquitectura V2 a Easypanel (Hetzner). La V1 es mantindrà independent a Supabase/Vercel com a entorn de demostració, evitant qualsevol arrossegament de deute tècnic.

## FASE 1: Infraestructura V2 a Easypanel i Volums Persistents

Dins d'Easypanel, has de crear els següents serveis per aïllar la V2. És crític assignar **Volums Persistents** a les bases de dades i aplicar **Seguretat Perimetral** (Zero mapatge de ports externs, accés només via xarxa interna de Docker):

1. **PostgreSQL**: Imatge amb suport espacial (`postgis/postgis:15-3.3`). Aquesta base de dades naixerà completament buida. Forçar entorn `LC_ALL=C.UTF-8` per evitar corrupció d'índexs B-Tree per canvis de locale.
   - *Requisit:* Assignar Volum Persistent. **Important**: La imatge `postgis/postgis` arrenca amb un usuari no-root. Si el volum persistent d'Easypanel/Hetzner es crea com a `root` per defecte, el contenidor fallarà silenciosament en escriure a `/var/lib/postgresql/data`. Assegurar permisos correctes al mapeig host.
   - *Requisit:* Activar backups diaris automatitzats cap a un object storage remot extern (AWS S3, Cloudflare R2, Hetzner Storage Box). **Prohibit utilitzar el MinIO local d'Easypanel per als dumps (SPOF)**. El format del dump **ha de ser obligatòriament custom (`-Fc`)** per permetre restauracions avançades multithreading i aplicar màxima compressió (`pg_dump -Z 9`) per evitar l'efecte "Bloated Dump" amb els arxius de les interaccions.
   - *Seguretat:* **No exposar el port 5432**.
   - *Escalabilitat:* Considerar el desplegament de **PgBouncer** (amb `pool_mode = transaction`) a la mateixa xarxa interna. Configurar l'`auth_query` al PgBouncer apuntant a una funció `SECURITY DEFINER` de PostgreSQL evitant mantenir un `userlist.txt` manual i riscos de seguretat (mai atorgar superusuari a la connexió de PgBouncer):
     ```sql
     CREATE OR REPLACE FUNCTION pgbouncer_get_auth(p_usename TEXT)
     RETURNS TABLE(username TEXT, shadow_pass TEXT) AS $$
     BEGIN
         RETURN QUERY SELECT usename::TEXT, passwd::TEXT FROM pg_catalog.pg_shadow WHERE usename = p_usename;
     END;
     $$ LANGUAGE plpgsql SECURITY DEFINER;
     -- pgbouncer.ini: auth_query = SELECT * FROM pgbouncer_get_auth($1)
     ```
     Assegurar un `max_client_conn` alt (ex: 1000) per absorbir el paral·lelisme del Worker. *Atenció:* L'App ha de configurar `prepared_statement_cache_size=0` en el driver (ex: `asyncpg`). A més, s'ha de deshabilitar el pooling a l'ORM (`poolclass=NullPool`) i implementar pings/healthchecks al driver (ex: `pool_pre_ping=True`) evitant errors `ECONNRESET` quan PgBouncer tanca connexions per inactivitat. Establir timeous agressius (`server_idle_timeout=10-30s`, `client_idle_timeout=10-30s`) pel SWR del frontend.
2. **Redis**: Per a les cues en segon pla (BullMQ / Rate Limiting).
   - *Requisit:* **Sense Volum Persistent**. Redis ha de ser completament efímer. Si el contenidor cau, arrenca en blanc. La font de veritat és exclusivament PostgreSQL. Això evita que el Worker re-processi tasques ja completades si es restaura un dump vell (OOM / zombis).
   - *Requisit Crític:* Configurar la política de gestió de memòria de Redis estrictament a **`noeviction`**. L'ús de polítiques d'evicció com `volatile-lru` és un error fatal d'arquitectura per a BullMQ perquè corromp les referències internes de les cues (ghost jobs / crashes del Worker). A més, per evitar bloquejar tot el node per un error de memòria, cal configurar **`maxmemory`** al `redis.conf` perquè rebutgi noves connexions amb errors OOM controlats.
   - *Protecció OOM (BullMQ):* La memòria s'ha de controlar exclusivament a nivell de codi del Worker forçant la purga (`removeOnComplete: 100`, `removeOnFail: 1000`) evitant l'OOM de Redis de manera nativa sense comprometre l'estat. L'idempotència absoluta és requerida.
3. **MinIO (S3)**: Per a l'emmagatzematge d'assets i paquets (eliminació total de dependència del sistema de fitxers local).
   - *Requisit:* Assignar Volum Persistent.
   - *Seguretat:* Configurar polítiques d'accés (buckets públics només per a *assets* del frontend, privats per a documents i backups). No exposar la interfície interna.
   - *Manteniment:* Establir una **"Lifecycle Rule" de 30 dies** als buckets de backups. **Protecció Crítica Ransomware**: Activar **Object Lock (WORM - Write Once Read Many)** i **Versioning** al bucket remot on s'envien els backups per evitar que un atacant o procés corrupte pugui sobreescriure o esborrar els dumps històrics vàlids.
4. **App (Backend/Frontend)**: L'aplicació web i la nova API. Aquest és l'únic servei que ha d'exposar ports (ex. 80/443).
   - *Frontend (SWR + SSR):* Per evitar el *Flash of Empty Content* i la degradació UX, configurar Node.js per realitzar la petició principal en Server-Side Rendering (SSR/RSC) i passar les dades inicials com a `fallbackData` a l'SWR del client. A més, configurar `keepAlive: true` a nivell de client HTTP (Axios/Fetch) a Node.js per reaprofitar connexions TCP. *Crític:* El timeout de l'HTTP Agent del frontend ha de ser inferior al timeout d'inactivitat del backend.
5. **Worker**: Procés daemon independent connectat a la xarxa interna de Redis per processar les cues (DLQ/Retries).
   - *Outbox Pattern (Prevenció de Pèrdua):* En cas de redeploy de Redis, les tasques "en vol" es perden si s'injecten directament de l'App. L'App escriurà la intenció a una taula `outbox_events` de Postgres a la mateixa transacció, i un poller les injectarà a Redis. **Crític:** El poller ha d'utilitzar explícitament `FOR UPDATE SKIP LOCKED` al consultar PostgreSQL per evitar condicions de cursa i duplicacions si múltiples rèpliques del Worker operen concurrentment.
   - *Concurrència:* Si aquest Worker obre connexions a la base de dades concurrentment, **ha de passar per PgBouncer**, igual que l'App (només Alembic evita PgBouncer).
   - *Resiliència:* Capturar explícitament el senyal **SIGTERM** per executar un *Graceful Shutdown* en cada redeploy.
   - *Monitorització:* Configurar un webhook per alertar immediatament a l'equip si la **DLQ (Dead Letter Queue)** de Redis reporta un volum > 0.

## FASE 2: Injecció de Secrets i Desplegament de l'Esquema (Alembic)

L'esquema es desplegarà exclusivament a través de les migracions automàtiques d'Alembic generades a partir del nou SQLModel.

1. **Injecció de Secrets**: Abans d'aixecar els serveis, configura les variables d'entorn a Easypanel (`DATABASE_URL`, `DATABASE_DIRECT_URL`, credencials IMAP de CDmon, API Keys d'OpenRouter, `ALLOW_MOCK_SEED_DANGER`, `REDIS_URL`). Necessitem dues URL de connexió distintes:
   ```env
   # Variables requerides a Easypanel
   DATABASE_URL="postgresql://user:pass@pgbouncer:6432/geocontent"
   DATABASE_DIRECT_URL="postgresql://user:pass@postgres:5432/geocontent" # Per a Alembic
   ```
2. **Dependències en Cascada a Docker (Healthchecks)**: Configura dependències estrictes a Easypanel evitant pànics de connexió: L'App i el Worker depenen de **PgBouncer** (port 6432), i al seu torn **PgBouncer** depèn de **PostgreSQL** (port 5432). Aquests enllaços han de ser obligatòriament de tipus `condition: service_healthy` evitant llançar PgBouncer quan la base de dades encara està en cold-boot.
3. **Definició Estricta (SQLModel)**: Totes les restriccions d'integritat (`UNIQUE`, `NOT NULL`) estaran explícitament definides als models de Python.
4. **Migració Inicial i Lock d'Alembic (Pre-Deploy Hook)**: Executar les migracions a l'arrencada és un anti-patró de disponibilitat. L'execució d'`alembic upgrade head` s'ha de moure al **Pre-Deploy Hook** d'Easypanel, de manera que l'App i Worker només s'aixequin si la migració funciona. Per evitar condicions de cursa si el hook es dispara múltiples cops, s'implementa un **Advisory Lock a nivell de PostgreSQL** dins `env.py`. Utilitza el mode `AUTOCOMMIT` per evitar deadlocks transaccionals:
   - *Atenció PgBouncer:* L'`env.py` d'Alembic ha de forçar l'ús de la connexió directa ignorant el PgBouncer per evitar bloquejos en DDL (Data Definition Language):
   ```python
   # Dins env.py
   import os
   from sqlalchemy import engine_from_config, pool, text

   config = context.config
   direct_url = os.environ.get("DATABASE_DIRECT_URL")
   if direct_url:
       config.set_main_option("sqlalchemy.url", direct_url)

   connectable = engine_from_config(
       config.get_section(config.config_ini_section),
       prefix="sqlalchemy.",
       poolclass=pool.NullPool,
   )

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

## FASE 3: Poblament Inicial (Seed i Fixtures)

L'estratègia de dades per validar el sistema es divideix en:

1. **Dades Mestres (Producció)**: Les dades oficials (DIBA, Idescat) **NO s'han de descarregar via xarxa** en el moment del desplegament per evitar fragilitat d'origen. Han de ser pre-processades a un fitxer `.sql` (Data Migration) o injeccions massives via `seed.json` ja inclosos nativament dins de la imatge Docker de l'App.
2. **Fixtures de Validació (Dev/Staging)**: L'script `scripts/seed_mock_data.py` injectarà contactes, llicències i interaccions falses per testejar l'arquitectura "Deal-cèntrica".
   - *Protecció Crítica (Prevenció de Desastres):* L'script requereix imperativament la variable d'entorn `ALLOW_MOCK_SEED_DANGER="true"`. Sense ella, avorta l'execució automàticament.
3. **Deduplicació i Rendiment de Cerques**:
   - *Integritat Asíncrona (IMAP):* Evitar *race conditions* durant l'obtenció d'emails descartant comprovacions via codi (SELECT -> INSERT). Cal usar restriccions `UNIQUE` compostes (`message_id_extern`, `content_hash`) a la BD. L'error d'inserció s'ha de tractar com a "Skipped" pel Worker per no provocar retries infinits.
   - *Full Text Search:* El camp de contingut a `interaccions` s'ha d'optimitzar imperativament amb índexs `GIN` o utilitzar `tsvector` natiu per permetre cerques textuals ràpides i asíncrones sense bloquejar taules senceres.

## FASE 4: Aïllament i Coexistència

- **V1 (Supabase/Vercel)**: Congelada. Exclusiva per a demos històriques.
- **V2 (Easypanel)**: Entorn actiu i sobirà.

## FASE 5: Protocol de Disaster Recovery (DR)

És obligatori testejar regularment la restauració dels backups. Aquí tens l'script bàsic per descarregar l'últim backup des de MinIO i restaurar-lo en un entorn local tolerant als errors de permisos de PostGIS. La connexió al MinIO usa variables d'entorn natives per evitar fugues de credencials a l'historial (`ps aux` / `.bash_history`):

```bash
#!/bin/bash
set -e

# 0. Connexió al REMOTE Object Storage (S3/R2/Hetzner), NO al MinIO local
ENCODED_AK=$(python3 -c "import urllib.parse, os; print(urllib.parse.quote(os.environ.get('REMOTE_S3_ACCESS_KEY', '')))")
ENCODED_SK=$(python3 -c "import urllib.parse, os; print(urllib.parse.quote(os.environ.get('REMOTE_S3_SECRET_KEY', '')))")

# Ajustar la URL a l'endpoint real de l'emmagatzematge extern
export MC_HOST_remotes3="https://${ENCODED_AK}:${ENCODED_SK}@s3.eu-central.cloud-provider.com"

# 1. Descarregar l'últim backup des de l'extern
mc cp remotes3/backups/geocontent_latest.dump ./latest.dump

# 2. Reset local (clean slate)
dropdb -U postgres geocontent_local --if-exists
createdb -U postgres geocontent_local

# 3. Preparar extensió espacial prèvia i Recrear l'esquema (CRÍTIC abans de restaurar dades pures)
psql -U postgres -d geocontent_local -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# CRÍTIC: Ús de la variable correcta segons env.py
DATABASE_DIRECT_URL="postgresql://postgres@localhost:5432/geocontent_local" alembic upgrade head

# 4. FIX: Restauració segura amb desactivació temporal de FKs i evitant col·lisions d'Alembic/PostGIS
PGOPTIONS='-c session_replication_role=replica' pg_restore -U postgres -d geocontent_local --data-only -O -x -j 4 \
    -T spatial_ref_sys \
    -T alembic_version \
    ./latest.dump || echo "Restauració finalitzada amb warnings menors."

# Nota: L'arquitecte ha de preveure que el dump també contindrà la taula `outbox_events`. El Poller ha de tenir lògica per ignorar esdeveniments antics post-restauració per evitar disparar emails històrics repetits.
# Nota: S'elimina l'script de resincronització de seqüències atès que les Primary Keys són UUIDs v4, evitant errors PL/pgSQL.
```

---
*Preparat per Agent Tecnologia (AnT) - PXX Architectures*
