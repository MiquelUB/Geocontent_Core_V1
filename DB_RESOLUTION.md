# 🛡️ Auditoria Definitiva: SASL Authentication Failed (PXX V2 Sovereign)

> **Data:** 2026-06-15  
> **Estat:** ✅ Connexió directa funciona | ❌ Connexió via PgBouncer falla amb `SASL authentication failed`

---

## 1. Fets Demostrats

| Test | Resultat |
|---|---|
| `ALTER USER` amb contrasenya alfanumèrica | ✅ `ALTER ROLE` |
| `npx prisma db push` contra PostgreSQL directe (port 5432) | ✅ Taules creades |
| Login a l'app via `DATABASE_URL` apuntant a `pxx-postgres-db:5432` | ✅ **Funciona** |
| Login a l'app via `DATABASE_URL` apuntant a `pxx-pgbouncer:6432` | ❌ `SASL authentication failed` |
| Logs de PostgreSQL durant error SASL | Cap intent de connexió registrat |

**Conclusió:** PostgreSQL NO rep cap petició. El PgBouncer rebutja el client (Next.js) **abans** d'intentar connectar-se al backend.

---

## 2. La Causa Arrel (Trobada a l'`entrypoint.sh` de `edoburu/pgbouncer`)

He analitzat el [codi font de l'entrypoint.sh](https://github.com/edoburu/docker-pgbouncer/blob/master/entrypoint.sh) de la imatge Docker `edoburu/pgbouncer` i he descobert **tres problemes fatals encadenats**:

### Problema A: El port d'escolta per defecte és 5432, NO 6432

A la línia 109 de l'entrypoint:
```bash
listen_port = ${LISTEN_PORT:-5432}
```

La imatge `edoburu/pgbouncer` **escolta al port 5432 per defecte**, NO al 6432. Si no hem definit la variable `LISTEN_PORT=6432` explícitament a les variables d'entorn del PgBouncer a Easypanel, el PgBouncer escolta al port 5432 i el nostre `DATABASE_URL` apuntant al port 6432 ni tan sols arriba al servei. Easypanel pot estar redireccionant el port de forma transparent, però és una font d'error potencial.

### Problema B: La secció `[databases]` utilitza `auth_user`, NO `password`

A la línia 64 de l'entrypoint:
```bash
${DB_NAME:-*} = host=${DB_HOST} port=${DB_PORT:-5432} auth_user=${DB_USER:-postgres}
```

La configuració generada automàticament per l'entrypoint **NO inclou `password=` a la secció `[databases]`**. En lloc d'això, utilitza `auth_user=admin_geocontent`. Això significa que:

1. Quan Next.js intenta connectar-se, PgBouncer necessita verificar les credencials.
2. Com que `auth_user=admin_geocontent` està definit, PgBouncer intenta connectar-se a PostgreSQL com a `admin_geocontent` per executar l'`auth_query`.
3. Per connectar-se a PostgreSQL, PgBouncer busca les credencials d'`admin_geocontent` al fitxer `userlist.txt`.
4. Si `AUTH_TYPE=scram-sha-256`, PgBouncer espera trobar un hash SCRAM al `userlist.txt` per validar el client... PERÒ alhora necessita la contrasenya en text pla per poder connectar-se al backend PostgreSQL i executar l'`auth_query`.

**Aquesta és la contradicció irresoluble:** amb `AUTH_TYPE=scram-sha-256`, el `userlist.txt` ha de contenir el hash SCRAM per validar el client, però PgBouncer no pot "desxifrar" el hash SCRAM per obtenir la contrasenya en text pla que necessita per autenticar-se al backend PostgreSQL. Resultat: `SASL authentication failed`.

### Problema C: El `userlist.txt` es regenera a cada reinici

L'entrypoint genera el `userlist.txt` a partir de les variables d'entorn `DB_USER` i `DB_PASSWORD` **cada cop que el contenidor arrenca** (si l'entrada no existeix al fitxer). Qualsevol edició manual que fem via Easypanel Storage es perd o es duplica amb entrades conflictives.

Funcions rellevants de l'entrypoint (línies 49-58):
```bash
function generate_userlist_if_needed() {
  if [ -n "${DB_USER}" -a -n "${DB_PASSWORD}" -a -e "${_AUTH_FILE}" ] && ! grep -q "^\"${DB_USER}\"" "${_AUTH_FILE}"; then
    if [ "${AUTH_TYPE}" == "plain" ] || [ "${AUTH_TYPE}" == "scram-sha-256" ]; then
      pass="${DB_PASSWORD}"           # ← Posa la DB_PASSWORD TAL QUAL, sense cap transformació
    else
      pass="md5$(echo -n "${DB_PASSWORD}${DB_USER}" | md5sum | cut -f 1 -d ' ')"
    fi
    echo "\"${DB_USER}\" \"${pass}\"" >> "${_AUTH_FILE}"
  fi
}
```

**Nota clau:** L'entrypoint tracta `plain` i `scram-sha-256` exactament igual — simplement copia el `DB_PASSWORD` sense cap transformació al `userlist.txt`. Per tant, si `DB_PASSWORD` és text pla, PgBouncer el posa en text pla al `userlist.txt`, però com que `auth_type=scram-sha-256`, falla la validació del client perquè el protocol SCRAM espera un hash.

---

## 3. La Solució Definitiva

### Per què `AUTH_TYPE=plain` és la solució correcta i segura

El `GEMINI.md` i el `MIGRATION_EASYPANEL.md` estableixen:
- **PostgreSQL** ha d'usar `password_encryption = scram-sha-256` → ✅ Ja configurat. Les contrasenyes es guarden xifrades amb SCRAM dins del motor.
- **PgBouncer** ha d'usar mode transacció → ✅ Ja configurat.
- **L'`auth_query` amb SECURITY DEFINER** és un ítem de **"Evolució (P1)"** → No és un requisit immediat.

L'`auth_type` de PgBouncer controla com PgBouncer valida el **client** (Next.js), NO com PostgreSQL emmagatzema les contrasenyes. Amb `AUTH_TYPE=plain`:
1. Next.js envia la contrasenya en text pla a PgBouncer per la **xarxa interna Docker** (mai exposada a Internet).
2. PgBouncer valida contra `userlist.txt` (que conté la mateixa contrasenya en text pla, generada automàticament per l'entrypoint).
3. PgBouncer es connecta a PostgreSQL usant **SCRAM-SHA-256 automàticament** (PostgreSQL negocia el protocol de seguretat).
4. PostgreSQL valida la contrasenya contra el seu hash SCRAM intern.

**La seguretat es manté:** la comunicació entre contenidors és interna a Docker i la contrasenya mai viatja per Internet. PostgreSQL segueix usant SCRAM-SHA-256 internament.

### Variables d'entorn definitives per al servei `pxx-pgbouncer`

```env
DB_HOST=pxx-postgres-db
DB_PORT=5432
DB_USER=admin_geocontent
DB_PASSWORD=D5tZukhE4MyLCz97noWwXcRm99283726
DB_NAME=geocontent_db
POOL_MODE=transaction
MAX_CLIENT_CONN=1000
DEFAULT_POOL_SIZE=20
LISTEN_PORT=6432
AUTH_TYPE=plain
IGNORE_STARTUP_PARAMETERS=extra_float_digits
```

Variables que s'han d'**ELIMINAR** completament del servei PgBouncer:
- ❌ `AUTH_QUERY`
- ❌ `AUTH_USER`

### Variables d'entorn per al servei `frontend` (Next.js)

```env
DATABASE_URL="postgresql://admin_geocontent:D5tZukhE4MyLCz97noWwXcRm99283726@pxx-pgbouncer:6432/geocontent_db?pgbouncer=true"
DIRECT_URL="postgresql://admin_geocontent:D5tZukhE4MyLCz97noWwXcRm99283726@pxx-postgres-db:5432/geocontent_db"
```

### Variables d'entorn per al servei `backend` (FastAPI)

```env
DATABASE_URL="postgresql://admin_geocontent:D5tZukhE4MyLCz97noWwXcRm99283726@pxx-pgbouncer:6432/geocontent_db?pgbouncer=true"
DATABASE_DIRECT_URL="postgresql://admin_geocontent:D5tZukhE4MyLCz97noWwXcRm99283726@pxx-postgres-db:5432/geocontent_db"
```

### Procediment d'aplicació

1. Al servei `pxx-pgbouncer` a Easypanel:
   - Elimina qualsevol fitxer `pgbouncer.ini` i `userlist.txt` montat manualment a la pestanya Storage (per deixar que l'entrypoint els regeneri de zero).
   - Actualitza les variables d'entorn exactament com les de la secció anterior.
   - Fes **Deploy** (no reiniciar, sinó deploy complet per forçar recreació del contenidor).
2. Al servei `frontend`: actualitza `DATABASE_URL` per apuntar a `pxx-pgbouncer:6432` i fes **Deploy**.
3. Al servei `backend`: actualitza `DATABASE_URL` per apuntar a `pxx-pgbouncer:6432` i fes **Deploy**.

---

## 4. Evolució P1 (Futur)

Un cop l'aplicació funcioni amb `AUTH_TYPE=plain`, es pot planificar la migració a `AUTH_TYPE=scram-sha-256` seguint aquest patró:

1. Crear un usuari dedicat `pgbouncer_auth` a PostgreSQL (diferent del d'aplicació).
2. Crear la funció `pgbouncer_get_auth` amb `SECURITY DEFINER`.
3. Configurar `AUTH_USER=pgbouncer_auth` i `AUTH_QUERY=SELECT * FROM pgbouncer_get_auth($1)`.
4. Posar les credencials de `pgbouncer_auth` en text pla al `userlist.txt` (necessàries per la connexió interna de PgBouncer).
5. Canviar `AUTH_TYPE=scram-sha-256`.

Això permetrà que PgBouncer usi `pgbouncer_auth` per connectar-se al backend (text pla al userlist.txt) i validi els clients d'aplicació via auth_query (hash SCRAM des de pg_shadow), evitant el conflicte actual.

---

## 5. Inicialització de Dades Mestre i Comptes Administratius

Després d'executar `npx prisma db push` a producció, la base de dades es troba en un estat buit de dades (Clean Slate). Per poder accedir a l'administració, cal inicialitzar el municipi i un compte `SUPER_ADMIN`. 

A causa de la naturalesa de la compilació `standalone` de Next.js, els scripts en TypeScript localitzats a `/scripts/` es descarten en producció. Per tant, l'alternativa resilient és executar la consulta d'inicialització directament des de la consola de PostgreSQL (`pxx-postgres-db`):

```bash
psql -U admin_geocontent -d geocontent_db
```

```sql
-- 1. Municipis base i contrasenya mestra del Gate (admin)
INSERT INTO municipalities (id, name, slug, theme_id, admin_master_password, name_translations, created_at, updated_at, plan_tier, packaging_status)
VALUES (
  'a3b1a8d0-256f-40c2-9e8c-8f921ea0205f',
  'Projecte Xino Xano Core',
  'pxx-core',
  'mountain',
  'admin',
  '{"ca": "Projecte Xino Xano Core", "es": "Proyecto Xino Xano Core", "en": "Project Xino Xano Core", "fr": "Projet Xino Xano Core"}'::jsonb,
  now(),
  now(),
  'basic',
  'IDLE'
)
ON CONFLICT (slug) DO UPDATE SET admin_master_password = 'admin';

-- 2. Usuaris administradors (amb hash bcrypt preparat)
INSERT INTO users (id, email, password_hash, role, username, xp, level, created_at, updated_at, municipality_id)
VALUES (
  'b5b2a9d1-367f-50c3-ae9d-9f032fa13060',
  'miquel@projectexinoxano.cat',
  '$2b$12$cxo.D8Hi0stqbvVaYTyAxuI0aLd1dHm2mY52Ub8MLNWbgDnpYwsDW', -- contrasenya de .env
  'SUPER_ADMIN',
  'Miquel UB',
  1000,
  10,
  now(),
  now(),
  'a3b1a8d0-256f-40c2-9e8c-8f921ea0205f'
)
ON CONFLICT (email) DO UPDATE SET role = 'SUPER_ADMIN', password_hash = '$2b$12$cxo.D8Hi0stqbvVaYTyAxuI0aLd1dHm2mY52Ub8MLNWbgDnpYwsDW';
```

---

## 6. Segregació de Fluxos de Login (Admin vs Turista)

S'ha detectat i resolt un conflicte en la redirecció de NextAuth. Per defecte, NextAuth redirigeix qualsevol petició d'autenticació no resolta a `/login` (el flux públic de turistes amb Magic Link). Això impedia que els administradors accedissin a la pantalla de contrasenya de `/admin/login`.

**Solució implementada:**
1. Desactivar el comportament d'autoredirecció per defecte a `auth.config.ts` forçant `authorized() { return true; }`.
2. Centralitzar tot el control de fluxos d'autenticació i rol a `middleware.ts`:
   - Qualsevol intent d'accés no autenticat a `/admin/...` es redirigeix a `/admin/login` (amb Email + Contrasenya).
   - Els usuaris autenticats amb rol `TOURIST` que intenten accedir a `/admin` són immediatament rebotats a l'arrel de la web (`/[locale]`).

---

## 7. Optimització de Compilació i Dependències de Producció (Alpine)

Durant els desplegaments en calent sobre servidors VPS de memòria limitada (Hetzner), s'han resolt dos problemes crítics de la compilació Docker:

### A. Prevenció d'OOM durant la compilació de Next.js
Next.js té un gran consum de memòria durant el `next build`. S'ha afegit la variable `NODE_OPTIONS` limitant el heap per evitar la cancel·lació forçosa de la imatge pel gestor de memòria del servidor:
```dockerfile
ENV NODE_OPTIONS="--max-old-space-size=1536"
```

### B. Mòduls Natius (bcrypt) a Alpine Linux
A causa de l'ús d'Alpine a la imatge `runner`, el mòdul natiu `bcrypt` requereix llibreries dinàmiques per carregar la seva compilació de C++. S'ha assegurat la presència de `libc6-compat` i `openssl` a la fase final del Dockerfile per permetre la importació nativa:
```dockerfile
RUN apk add --no-cache libc6-compat openssl
```
