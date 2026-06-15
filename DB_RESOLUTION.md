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
