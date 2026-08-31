# 🛡️ Auditoria de Seguretat — PXX Geocontent Core V1
> **Data:** 2026-06-15
> **Auditor:** Agent Tecnologia (AnT) — The Builder
> **Codi revisat:** `middleware.ts`, `auth.config.ts`, `lib/actions/auth.ts`,
> `lib/actions/content.ts`, `next.config.js`, `Dockerfile`, `backend-python/main.py`,
> totes les rutes `app/api/**`, `lib/services/ratelimit.ts`, `lib/config/constants.ts`
> **Veredicte Global:** 🟡 **POSTURA BONA AMB FORATS IDENTIFICATS — NO PRODUCTION-READY AL 100%**

---

## Resposta Directa: Podem Estar Tranquils?

**Parcialment sí. No hi ha portes traseres intencionades ni credencials hardcodejades al codi.**
Les defenses implementades cobreixen els vectors d'atac més comuns. Però hi ha
**4 vulnerabilitats reals** i **3 problemes de disseny** que cal tancar abans de
considerar el sistema segur en un entorn multi-tenant de producció.

---

## ✅ El que Funciona Bé (Defenses Verificades)

### 1. Zero Trust d'Identitat
- **`auth.config.ts` línies 33-35:** `authorized() { return true; }` — correcte.
  El control de fluxos d'accés es centralitza exclusivament al `middleware.ts`,
  not a NextAuth. Disseny defensiu.
- **`lib/actions/auth.ts` línia 61:** `role: 'TOURIST'` hardcoded al registre.
  Cap usuari pot auto-assignar-se un rol elevat via HTTP.
- **Ruta `/api/admin/municipality`:** Verifica sessió **i** rol `SUPER_ADMIN` explícitament.
  Doble verificació correcta.

### 2. Rate Limiting Implementat
- **Tourist login:** 5 intents / 5 minuts per email (`lib/services/ratelimit.ts`).
- **IA Generate:** 10 peticions / minut per userId.
- **Report Generate:** 3 informes / hora.
- Implementació via Redis `INCR` + `EXPIRE`. Funcional i eficient.

### 3. SSRF Protection al img-proxy
- **`app/api/img-proxy/route.ts`:** Whitelist d'hosts estricta.
  Bloqueja qualsevol fetch a hosts no autoritzats i registra l'intent.
- Validació de protocol (`http/https` only).
- Validació de MIME type per evitar XSS via SVG o executables.
- Header `X-Content-Type-Options: nosniff` present.

### 4. Signed URLs per a Uploads
- **`app/api/upload/signed-url/route.ts`:** Sessió requerida + whitelist de MIME types.
- Sanitització del nom de fitxer (eliminació de caràcters no-ASCII i especials).
- UUID prefix per evitar path traversal i col·lisions.

### 5. Middleware de Rutes Protegit
- `/admin/*` requereix sessió activa.
- Usuaris `TOURIST` autenticats rebotats fora de `/admin`.
- Ruta de debug `GET /api/debug-legends` **bloquejada en producció** (`NODE_ENV === 'production'` → 404).

### 6. Dockerfile amb Usuari No-Root
- `USER nextjs` (uid 1001) a la fase runner. No s'executa com a `root`.
- Build multi-stage correcte: el codi font no viatja a la imatge final.
- `NODE_OPTIONS="--max-old-space-size=1536"` preveu OOM.

### 7. FastAPI CORS Restrictiu
- `allow_origins` limitat al `FRONTEND_URL` de l'entorn.
- Mètodes HTTP explícits (no `*`).
- Headers personalitzats (`X-Request-ID`) per a traçabilitat.

### 8. `/api/auth/login` Deprecada Correctament
- Retorna `410 Gone` amb missatge explícit.
- No hi ha vector d'atac de força bruta al password tradicional.

---

## 🔴 VULNERABILITATS CRÍTIQUES (Cal Tancar Ara)

### VULN-01 — Contrasenya en TEXT PLA a la Base de Dades
**Fitxer:** `lib/actions/auth.ts` línies 109-119
**Fitxer:** `DB_RESOLUTION.md` línia 167

```typescript
// ❌ VULNERABILITAT ACTIVA
const muni = await prisma.municipality.findUnique({ where: { id: municipalityId } });
if (muni.adminMasterPassword && muni.adminMasterPassword !== password) {
  // Comparació directa: la contrasenya està guardada en PLAIN TEXT a la DB
}
```

**Risc:** La taula `municipalities` guarda `admin_master_password` en text pla.
Si la base de dades és compromesa (SQL injection, backup robat, accés intern),
totes les contrasenyes d'admin de tots els ajuntaments quedaran exposades directament.

**Evidència addicional** (`DB_RESOLUTION.md` línia 167):
```sql
INSERT INTO municipalities (..., admin_master_password, ...)
VALUES (..., 'admin', ...)  -- ← contrasenya 'admin' en text pla a la seed
```

**Remediació requerida:**
```typescript
// ✅ Cal usar bcrypt (ja tens la dependència instal·lada)
import bcrypt from 'bcrypt';

// En guardar: await bcrypt.hash(password, 12)
// En verificar: await bcrypt.compare(password, muni.adminMasterPassword)
```

---

### VULN-02 — Rutes d'API de Dades Obertes Sense Autenticació
**Fitxers:**
- `app/api/municipalities/route.ts` — GET sense auth
- `app/api/municipality/route.ts` — GET sense auth
- `app/api/routes/route.ts` — GET sense auth
- `app/api/pois/route.ts` — GET sense auth

**Risc:** Qualsevol persona sense sessió pot fer:
```bash
curl https://projectexinoxano.cat/api/municipalities
# → Retorna TOTA la llista d'ajuntaments, noms, slugs, themeId, logoUrl, plan_tier
# → Inclou ajuntaments "inactius" o de prova

curl https://projectexinoxano.cat/api/routes?municipality=granollers
# → Retorna TOTES les rutes sense filtre de visibilitat

curl https://projectexinoxano.cat/api/pois?route_id=uuid-qualsevol
# → Retorna TOTS els POIs d'una ruta, inclosos els en DRAFT
```

En un context multi-tenant, això exposa l'estructura interna del negoci:
quants ajuntaments tens, quin pla tenen, quantes rutes, etc.

**Remediació:**
- Les rutes de lectura pública (turistes) han de filtrar per `status: 'CLOSED'`
  (ja ho fa `/api/routes`) pero també per `plan_tier: { not: 'inactive' }`.
- `/api/municipalities` ha d'exposar **únicament** els camps necessaris per al
  directori públic (nom, slug, themeId) i filtrar els inactius.
- Valorar si `/api/municipality?id=...` ha d'estar autenticada o limitada.

---

### VULN-03 — `loginOrRegister()` Sense Autenticació Prèvia
**Fitxer:** `lib/actions/auth.ts` línies 122-143

```typescript
// ❌ PROBLEMA: Aquesta Server Action no valida cap sessió
export async function loginOrRegister(name: string, email: string) {
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { username: name },
    create: { email, username: name, role: 'TOURIST', ... }
  });
  return { success: true, user }; // ← Retorna l'objecte user complet
}
```

**Risc:** Qualsevol client pot cridar aquesta Server Action directament per:
1. **Registrar usuaris** sense cap validació (email fictici, spam).
2. **Sobreescriure el `username`** d'un usuari existent coneixent el seu email.
3. **Enumeració d'usuaris:** la resposta diferent per a emails existents vs. nous
   permet descobrir quins emails estan registrats.

**Remediació:**
```typescript
// ✅ Afegir rate limiting per IP i validació de format d'email
import { rateLimit } from '@/lib/services/ratelimit';
import { headers } from 'next/headers';

export async function loginOrRegister(name: string, email: string) {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') ?? 'unknown';
  const rl = await rateLimit(`register:${ip}`, 3, 3600);
  if (!rl.success) return { success: false, error: 'Massa intents.' };

  // Validar format email amb Zod
  const emailSchema = z.string().email();
  if (!emailSchema.safeParse(email).success) {
    return { success: false, error: 'Email no vàlid.' };
  }
  // ... resta de la lògica
}
```

---

### VULN-04 — `analytics/executive-report` Sense Verificació de Rol ni Pertinença
**Fitxer:** `app/api/analytics/executive-report/route.ts`

```typescript
// ❌ PROBLEMA: Verifica sessió però NO verifica que l'usuari pertanyi al municipi
const session = await auth();
if (!session?.user?.id) { /* 401 */ }

// Qualsevol usuari autenticat (fins i tot TOURIST de Vic) pot demanar
// les analítiques de Granollers passant el seu municipalityId:
const municipalityId = searchParams.get('municipalityId');
// → No hi ha cap comprovació que session.user.municipalityId === municipalityId
```

**Risc:** Un turista registrat a Vic pot veure el dashboard d'analítiques
de Granollers (nombre de visites, heatmap de telemetria d'usuaris, etc.).

**Remediació:**
```typescript
// ✅ Verificar pertinença o rol elevat
const userRole = (session.user as any).role;
const userMuniId = (session.user as any).municipalityId;

if (userRole !== 'SUPER_ADMIN' && userMuniId !== municipalityId) {
  return NextResponse.json({ error: 'Accés denegat.' }, { status: 403 });
}
```

---

## 🟡 PROBLEMES DE DISSENY (No Crítics però Importants)

### DIS-01 — `registerUser()` Compara Rol amb 'admin' (minúscules) en lloc de 'ADMIN'
**Fitxer:** `lib/actions/auth.ts` línia 49

```typescript
// ❌ Bug subtil: el rol és 'ADMIN' (enum Prisma) però es compara amb 'admin'
if (!session || (session.user as any).role !== 'admin') {
  return { success: false, error: "Accés denegat." };
}
// → Aquesta protecció SEMPRE falla i mai permet crear usuaris via aquesta ruta
// → Paradoxalment "protegeix" per error, però és un bug que pot confondre
```

**Remediació:** Canviar `'admin'` per `'SUPER_ADMIN'` o afegir els dos rols vàlids.

---

### DIS-02 — `next.config.js`: `allowedOrigins` de Server Actions Conté Domini d'Easypanel
**Fitxer:** `next.config.js` línia 20

```javascript
serverActions: {
  allowedOrigins: ['pxxv-pxx-frontend.80opze.easypanel.host', 'localhost:3000']
}
```

**Risc:** El domini intern d'Easypanel (`80opze`) és un identificador que no hauria
d'estar al codi font (repositori públic o semi-públic). Si mai es fa pública
la llista de dominis d'Easypanel, facilita el reconeixement de la infraestructura.

**Remediació:**
```javascript
// ✅ Usar variable d'entorn
serverActions: {
  allowedOrigins: [
    process.env.NEXTAUTH_URL?.replace('https://', '') ?? 'localhost:3000',
    'localhost:3000'
  ].filter(Boolean)
}
```

---

### DIS-03 — `impersonateMunicipalityId` Sense Auditoria de Log
**Fitxer:** `auth.config.ts` línies 17-22

```typescript
// Patró d'impersonació per a SUPER_ADMIN (correcte en disseny)
if (trigger === "update" && session?.impersonateMunicipalityId) {
  if (token.role === 'SUPER_ADMIN') {
    token.municipalityId = session.impersonateMunicipalityId;
  }
}
```

**Risc:** El mecanisme d'impersonació és correcte (verifica `SUPER_ADMIN`),
però no deixa cap registre de l'acció. En un SaaS B2G, poder demostrar
que el SUPER_ADMIN NO va accedir a les dades d'un ajuntament en un moment
concret és clau per a RGPD i auditories.

**Remediació:** Afegir un registre a la taula `AiUsageLog` o crear una taula
`AdminAuditLog` que registri: `admin_id`, `action: 'impersonate'`,
`target_municipality_id`, `timestamp`.

---

## 📋 Matriu de Riscos (Resum)

| ID | Vulnerabilitat | Gravetat | Explotable sense credencials? | Impacte |
|----|---------------|----------|-------------------------------|---------|
| VULN-01 | Contrasenyes admin en text pla a DB | 🔴 CRÍT | ❌ (cal accés a DB) | Exposició total si backup robat |
| VULN-02 | APIs de dades obertes sense auth | 🔴 CRÍT | ✅ Sí, directament | Enumeració de clients i dades |
| VULN-03 | `loginOrRegister` sense rate limit ni validació | 🟠 GREU | ✅ Sí, via Server Action | Spam de registres, enumeració d'emails |
| VULN-04 | Analytics sense verificació de pertinença | 🟠 GREU | ❌ (cal sessió TOURIST) | Filtració de dades entre municipis |
| DIS-01 | Comparació de rol incorrecta ('admin' vs 'ADMIN') | 🟡 MODER | ❌ | Bug funcional, confusió |
| DIS-02 | Domini d'Easypanel al codi font | 🟡 MODER | ✅ (reconeixement) | Exposició d'infraestructura |
| DIS-03 | Impersonació sense auditoria | 🟡 MODER | ❌ | Risc RGPD / auditories |
| RLS | Cap policy RLS activa a PostgreSQL | 🔴 CRÍT | ❌ (cal sessió) | Creuament de dades multi-tenant |

---

## 🎯 Pla de Millora Pas a Pas

> Els passos estan ordenats per **impacte de seguretat descendent**.
> Cada pas inclou els fitxers exactes a modificar, el codi de remediació complet
> i el criteri de verificació per confirmar que el fix és correcte.
> **Completar els passos 1–4 és suficient per fer el sistema segur per a producció.**

---

### PAS 1 — Hash bcrypt per a `adminMasterPassword`
**Prioritat:** 🔴 CRÍTICA | **Temps:** ~2h | **Referència:** VULN-01

#### 1.1 Modificar `lib/actions/auth.ts`

Localitzar la funció `verifyAdminPassword` (línies ~109-119) i substituir la
comparació directa per `bcrypt.compare`:

```typescript
// ABANS ❌
export async function verifyAdminPassword(municipalityId: string, password: string) {
  const muni = await prisma.municipality.findUnique({ where: { id: municipalityId } });
  if (!muni) return { success: false, error: "Municipality not found" };
  if (muni.adminMasterPassword && muni.adminMasterPassword !== password) {
    return { success: false, error: "Invalid password" };
  }
  return { success: true };
}

// DESPRÉS ✅
import bcrypt from 'bcrypt';

export async function verifyAdminPassword(municipalityId: string, password: string) {
  try {
    const muni = await prisma.municipality.findUnique({ where: { id: municipalityId } });
    if (!muni) return { success: false, error: "Municipality not found" };
    if (!muni.adminMasterPassword) return { success: false, error: "No password configured" };

    const isValid = await bcrypt.compare(password, muni.adminMasterPassword);
    if (!isValid) return { success: false, error: "Invalid password" };

    return { success: true };
  } catch (err) {
    return { success: false, error: "Database error" };
  }
}
```

#### 1.2 Modificar `lib/services/municipality-service.ts`

La funció que actualitza el municipi ha de fer hash abans de guardar:

```typescript
import bcrypt from 'bcrypt';

// Dins de updateMunicipalityInternal, abans del prisma.update:
let hashedPassword: string | undefined;
if (adminMasterPassword) {
  hashedPassword = await bcrypt.hash(adminMasterPassword, 12);
}

await prisma.municipality.update({
  where: { id },
  data: {
    ...restOfData,
    adminMasterPassword: hashedPassword, // ✅ Sempre guardat com hash
  }
});
```

#### 1.3 Migrar les contrasenyes existents a producció

Executar des de la consola de PostgreSQL (`pxx-postgres-db`) per re-hashear
les contrasenyes actuals. Substituir `HASH_BCRYPT_DE_ADMIN` pel hash real
generat amb `bcrypt.hash('admin', 12)` des d'un script Node.js local:

```sql
-- Pas previ: generar el hash localment:
-- node -e "const b=require('bcrypt'); b.hash('admin',12).then(console.log)"
-- Resultat exemple: $2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

UPDATE municipalities
SET admin_master_password = '$2b$12$HASH_GENERAT_LOCALMENT'
WHERE admin_master_password = 'admin';
```

#### 1.4 Verificació
- [ ] `verifyAdminPassword('uuid', 'admin')` retorna `{ success: true }` amb contrasenya hashejada
- [ ] `verifyAdminPassword('uuid', 'wrongpass')` retorna `{ success: false }`
- [ ] La columna `admin_master_password` a PostgreSQL **no mostra text pla** (`SELECT admin_master_password FROM municipalities`)

---

### PAS 2 — Protegir les APIs de Dades Públiques
**Prioritat:** 🔴 CRÍTICA | **Temps:** ~1h | **Referència:** VULN-02

#### 2.1 Fitxer: `app/api/municipalities/route.ts`

Afegir filtre d'inactius i limitar els camps exposats (cap `plan_tier` a la resposta pública):

```typescript
// ABANS ❌ — Exposa tot incloent plan_tier i ajuntaments inactius
const municipalities = await prisma.municipality.findMany({
  include: { _count: { select: { routes: true } } },
  orderBy: { name: 'asc' }
});

// DESPRÉS ✅ — Filtre i camps mínims per al directori públic
const municipalities = await prisma.municipality.findMany({
  where: {
    planTier: { not: 'inactive' }, // Ocultar ajuntaments no actius
  },
  select: {
    id: true,
    name: true,
    slug: true,
    themeId: true,
    nameTranslations: true,
    _count: { select: { routes: true } }
    // ❌ NO exposar: adminMasterPassword, planTier, packagingStatus
  },
  orderBy: { name: 'asc' }
});
```

#### 2.2 Fitxer: `app/api/routes/route.ts`

Ja filtra per `status: 'CLOSED'` (correcte). Afegir filtre de municipi actiu:

```typescript
// Afegir al WHERE existent:
const where: any = {
  status: 'CLOSED',
  municipality: {
    planTier: { not: 'inactive' } // ✅ No retornar rutes de municipis inactius
  }
};
```

#### 2.3 Fitxer: `app/api/pois/route.ts`

Afegir verificació que la ruta pertany a un municipi actiu:

```typescript
// Afegir validació prèvia a la query principal:
const route = await prisma.route.findUnique({
  where: { id: routeId, status: 'CLOSED' }, // ✅ Només rutes publicades
  select: { id: true, municipality: { select: { planTier: true } } }
});

if (!route || route.municipality?.planTier === 'inactive') {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
```

#### 2.4 Fitxer: `app/api/municipality/route.ts`

Limitar els camps de resposta (treure `logoUrl` si no és necessari públicament,
i mai exposar dades internes):

```typescript
const brand = await prisma.municipality.findUnique({
  where: { id, planTier: { not: 'inactive' } }, // ✅ Filtre actiu
  select: {
    name: true,
    themeId: true,
    // logoUrl: true — mantenir si és necessari per al tema visual
    // ❌ NO: adminMasterPassword, packagingStatus, planTier
  }
});
```

#### 2.5 Verificació
- [ ] `curl /api/municipalities` no retorna ajuntaments amb `planTier = 'inactive'`
- [ ] La resposta de `/api/municipalities` no inclou el camp `adminMasterPassword` ni `planTier`
- [ ] `curl /api/pois?route_id=uuid-ruta-draft` retorna 404

---

### PAS 3 — Endurir `loginOrRegister()`
**Prioritat:** 🟠 GREU | **Temps:** ~1h | **Referència:** VULN-03

#### 3.1 Fitxer: `lib/actions/auth.ts`

Substituir la funció actual per la versió endurita:

```typescript
export async function loginOrRegister(
  name: string,
  email: string
): Promise<{success: boolean, user?: any, error?: string}> {
  try {
    // 1. Rate limiting per IP (prevenir spam massiu)
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
    const rl = await rateLimit(`register:${ip}`, 5, 3600); // 5 intents/hora per IP
    if (!rl.success) {
      return { success: false, error: 'Massa intents des d\'aquesta IP. Torna-ho a provar in 1 hora.' };
    }

    // 2. Validació d'email amb Zod (prevenir input malformat)
    const emailSchema = z.string().email().max(254);
    const emailParse = emailSchema.safeParse(email.toLowerCase().trim());
    if (!emailParse.success) {
      return { success: false, error: 'Format d\'email no vàlid.' };
    }

    // 3. Validació de nom
    const nameSchema = z.string().min(2).max(100).trim();
    const nameParse = nameSchema.safeParse(name);
    if (!nameParse.success) {
      return { success: false, error: 'El nom ha de tenir entre 2 i 100 caràcters.' };
    }

    // 4. Upsert amb resposta uniforme (evitar enumeració d'usuaris)
    const user = await prisma.user.upsert({
      where: { email: emailParse.data },
      update: { username: nameParse.data },
      create: {
        email: emailParse.data,
        username: nameParse.data,
        role: 'TOURIST',
        xp: 0,
        level: 1
      },
      select: { id: true, email: true, role: true } // ❌ NO retornar password_hash ni camps interns
    });

    return { success: true, user };
  } catch (err: any) {
    console.error("Error in loginOrRegister:", err.message); // Log intern sense detalls sensibles
    return { success: false, error: 'No s\'ha pogut completar el registre. Torna-ho a provar.' };
  }
}
```

#### 3.2 Verificació
- [ ] Cridar la funció 6 vegades seguides des de la mateixa IP retorna error al 6è intent
- [ ] `loginOrRegister('', 'no-es-un-email')` retorna `{ success: false }`
- [ ] La resposta exitosa **no inclou** `password_hash` ni `municipalityId` intern

---

### PAS 4 — Verificació de Pertinença a Analytics
**Prioritat:** 🟠 GREU | **Temps:** ~30min | **Referència:** VULN-04

#### 4.1 Fitxer: `app/api/analytics/executive-report/route.ts`

Afegir les 5 línies de verificació just després del guard d'autenticació existent:

```typescript
// Bloc existent (mantenir):
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ success: false, error: 'No autoritzat.' }, { status: 401 });
}

// ✅ AFEGIR: Verificació de pertinença o rol elevat
const userRole = (session.user as any).role as string;
const userMunicipalityId = (session.user as any).municipalityId as string | null;

const isAuthorized =
  userRole === 'SUPER_ADMIN' ||                    // SUPER_ADMIN veu tot
  userRole === 'ADMIN' && userMunicipalityId === municipalityId; // ADMIN veu el seu

if (!isAuthorized) {
  console.warn(`[Analytics] Accés denegat: user ${session.user.id} (${userRole}) intentant accedir a municipi ${municipalityId}`);
  return NextResponse.json({ success: false, error: 'Accés denegat.' }, { status: 403 });
}
```

#### 4.2 Verificació
- [ ] Un usuari amb rol `TOURIST` i `municipalityId = 'uuid-granollers'` rep 403 en demanar analytics de `'uuid-vic'`
- [ ] Un usuari amb rol `ADMIN` i `municipalityId = 'uuid-granollers'` rep 200 en demanar analytics de `'uuid-granollers'`
- [ ] Un usuari amb rol `SUPER_ADMIN` rep 200 en demanar analytics de qualsevol municipi

---

### PAS 5 — Activar Row Level Security (RLS) a PostgreSQL
**Prioritat:** 🔴 CRÍTICA (per a multi-tenant) | **Temps:** ~3h | **Referència:** MT-1 (MULTITENANT_ROADMAP.md)

#### 5.1 Crear nova migració Alembic

```bash
cd backend-python
alembic revision --autogenerate -m "init_rls_policies"
```

#### 5.2 Contingut de la migració `init_rls.py`

```python
from alembic import op
import sqlalchemy as sa

def upgrade() -> None:
    # Activar RLS a totes les taules core
    op.execute("ALTER TABLE routes ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE reports ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE user_unlocks ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE user_route_progress ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;")

    # Policy: routes — per municipi
    op.execute("""
        CREATE POLICY municipality_isolation ON routes FOR ALL
        USING (municipality_id = current_setting('app.current_municipality_id', true)::UUID
               OR current_setting('app.role', true) = 'system');
    """)

    # Policy: users — per municipi + propi perfil
    op.execute("""
        CREATE POLICY user_municipality_isolation ON users FOR ALL
        USING (municipality_id = current_setting('app.current_municipality_id', true)::UUID
               OR id = current_setting('app.current_user_id', true)::UUID
               OR current_setting('app.role', true) = 'system');
    """)

    # Policy: reports — per municipi
    op.execute("""
        CREATE POLICY reports_municipality ON reports FOR ALL
        USING (municipality_id = current_setting('app.current_municipality_id', true)::UUID
               OR current_setting('app.role', true) = 'system');
    """)

    # Policy: user_unlocks — propietari
    op.execute("""
        CREATE POLICY unlock_owner ON user_unlocks FOR ALL
        USING (user_id = current_setting('app.current_user_id', true)::UUID
               OR current_setting('app.role', true) = 'system');
    """)

    # Policy: user_route_progress — propietari
    op.execute("""
        CREATE POLICY progress_owner ON user_route_progress FOR ALL
        USING (user_id = current_setting('app.current_user_id', true)::UUID
               OR current_setting('app.role', true) = 'system');
    """)

    # Policy: outbox_events — només sistema (ARQ worker)
    op.execute("""
        CREATE POLICY system_only_outbox ON outbox_events FOR ALL
        USING (current_setting('app.role', true) = 'system');
    """)

def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS municipality_isolation ON routes;")
    op.execute("DROP POLICY IF EXISTS user_municipality_isolation ON users;")
    op.execute("DROP POLICY IF EXISTS reports_municipality ON reports;")
    op.execute("DROP POLICY IF EXISTS unlock_owner ON user_unlocks;")
    op.execute("DROP POLICY IF EXISTS progress_owner ON user_route_progress;")
    op.execute("DROP POLICY IF EXISTS system_only_outbox ON outbox_events;")
    op.execute("ALTER TABLE routes DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE users DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE reports DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE user_unlocks DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE user_route_progress DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE outbox_events DISABLE ROW LEVEL SECURITY;")
```

#### 5.3 Injectar el context RLS des de Prisma

Cada request del servidor ha d'establir el context de sessió de PostgreSQL
**abans** de qualsevol query. Afegir un middleware de Prisma:

```typescript
// lib/database/prisma.ts — afegir middleware de context
prisma.$use(async (params, next) => {
  const session = await auth(); // Obtenir sessió actual
  if (session?.user) {
    await prisma.$executeRaw`
      SELECT
        set_config('app.current_user_id', ${session.user.id}, true),
        set_config('app.current_municipality_id', ${(session.user as any).municipalityId ?? ''}, true),
        set_config('app.role', 'user', true)
    `;
  }
  return next(params);
});
```

> **Nota:** El worker ARQ (Python/FastAPI) ha d'establir `app.role = 'system'`
> per poder accedir a `outbox_events` sense restriccions de RLS.

#### 5.4 Verificació
- [ ] `SELECT * FROM routes` des d'una sessió amb `app.current_municipality_id = 'uuid-vic'` NO retorna rutes de Granollers
- [ ] `SELECT * FROM outbox_events` sense `app.role = 'system'` retorna 0 files

---

### PAS 6 — Correccions Menors (Quick Wins, < 15 min en total)
**Prioritat:** 🟡 MODERADA | **Referència:** DIS-01, DIS-02

#### 6.1 Corregir comparació de rol (`lib/actions/auth.ts` línia 49)

```typescript
// ABANS ❌
if (!session || (session.user as any).role !== 'admin') {

// DESPRÉS ✅
if (!session || !['ADMIN', 'SUPER_ADMIN'].includes((session.user as any).role)) {
```

#### 6.2 Moure domini Easypanel a variable d'entorn (`next.config.js`)

```javascript
// ABANS ❌
allowedOrigins: ['pxxv-pxx-frontend.80opze.easypanel.host', 'localhost:3000']

// DESPRÉS ✅
allowedOrigins: [
  process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, '') ?? '',
  'localhost:3000'
].filter(Boolean)
```

I afegir al `.env.example`:
```env
# Domini de producció (sense protocol). Usat per Server Actions allowedOrigins.
NEXTAUTH_URL="https://projectexinoxano.cat"
```

#### 6.3 Verificació
- [ ] `registerUser()` cridat per un `ADMIN` (majúscules) no retorna "Accés denegat"
- [ ] El fitxer `next.config.js` no conté cap referència a `easypanel.host`

---

### PAS 7 — Taula `AdminAuditLog` per a Impersonació (RGPD)
**Prioritat:** 🟡 MODERADA | **Temps:** ~2h | **Referència:** DIS-03

#### 7.1 Afegir el model a `prisma/schema.prisma`

```prisma
model AdminAuditLog {
  id                   String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  adminUserId          String   @map("admin_user_id") @db.Uuid
  action               String   // "impersonate" | "create_municipality" | "delete_user" | etc.
  targetMunicipalityId String?  @map("target_municipality_id") @db.Uuid
  targetUserId         String?  @map("target_user_id") @db.Uuid
  metadata             Json?    // Informació addicional (IP, User-Agent, etc.)
  createdAt            DateTime @default(now()) @map("created_at")

  @@map("admin_audit_logs")
  @@index([adminUserId])
  @@index([createdAt])
}
```

#### 7.2 Registrar impersonació a `auth.config.ts`

```typescript
import { prisma } from '@/lib/database/prisma';

// Dins del callback jwt, quan hi ha impersonació:
if (trigger === "update" && session?.impersonateMunicipalityId) {
  if (token.role === 'SUPER_ADMIN') {
    token.municipalityId = session.impersonateMunicipalityId;

    // ✅ AFEGIR: Registre d'auditoria
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: token.id as string,
        action: 'impersonate',
        targetMunicipalityId: session.impersonateMunicipalityId,
        metadata: { timestamp: new Date().toISOString() }
      }
    }).catch(err => console.error('[AuditLog] Failed to log impersonation:', err));
  }
}
```

#### 7.3 Verificació
- [ ] Cada cop que un SUPER_ADMIN impersona un municipi, apareix una fila nova a `admin_audit_logs`
- [ ] `SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 10` mostra les darreres accions

---

## 📊 Checklist de Seguiment

Marcar cada ítem com ✅ un cop verificat a producció:

### Fase Crítica (Fer ABANS de tenir clients reals)
- [ ] **PASS-1.1** `verifyAdminPassword` usa `bcrypt.compare`
- [ ] **PASS-1.2** `updateMunicipalityInternal` fa hash abans de guardar
- [ ] **PASS-1.3** Contrasenyes actuals migrades a hash a producció
- [ ] **PASS-2.1** `/api/municipalities` filtra inactius i no exposa `plan_tier`
- [ ] **PASS-2.2** `/api/routes` filtra per `municipality.planTier != inactive`
- [ ] **PASS-2.3** `/api/pois` verifica que la ruta és CLOSED i el municipi actiu
- [ ] **PASS-3.1** `loginOrRegister` té rate limit per IP (5/hora)
- [ ] **PASS-3.2** `loginOrRegister` valida email amb Zod
- [ ] **PASS-3.3** `loginOrRegister` no retorna camps sensibles a la resposta
- [ ] **PASS-4.1** Analytics verifica `ADMIN` pertany al municipi o `SUPER_ADMIN`
- [ ] **PASS-5.1** RLS activat a `routes`, `users`, `reports`, `user_unlocks`, `user_route_progress`, `outbox_events`
- [ ] **PASS-5.2** Context RLS injectat a totes les requests via middleware Prisma

### Fase Moderada (Fer en la propera iteració)
- [ ] **PASS-6.1** Comparació de rol corregida a `'ADMIN'` (majúscules)
- [ ] **PASS-6.2** Domini Easypanel eliminat del codi font
- [ ] **PASS-7.1** Model `AdminAuditLog` creat i migrat
- [ ] **PASS-7.2** Impersonació registrada automàticament

---

## ✅ Conclusió

**No hi ha portes traseres intencionades.** El sistema mostra bones pràctiques
de seguretat defensiva (rate limiting, Zero Trust d'identitat, SSRF protection,
Dockerfile no-root). L'equip ha fet la feina correctament en els aspectes principals.

**Però no és segur per a producció multi-tenant** fins que es completin els Passos 1–5,
especialment VULN-02 (APIs obertes) i la manca de RLS a PostgreSQL, que junts
permeten a qualsevol persona enumeració d'informació sensible del negoci i creuament
de dades entre ajuntaments.

**Recomanació:** Executar els Passos 1–4 (~4.5h) de forma immediata i el Pas 5 (RLS)
durant la propera sessió de desenvolupament planificada. Completar Passos 6–7
com a part del cicle normal de manteniment.

---

*Preparat per Agent Tecnologia (AnT) — PXX Security Audit.*
*Data: 2026-06-15 | Darrera actualització: 2026-06-15 (Pla de Millora V1)*
*Classificació: Document Intern Confidencial*
