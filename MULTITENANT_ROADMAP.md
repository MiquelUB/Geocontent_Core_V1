# 🏛️ Roadmap Multi-Tenant: Un Domini, N Ajuntaments (PXX V2 Sovereign)

> **Data:** 2026-06-15
> **Autor:** Agent Tecnologia (AnT) — The Builder
> **Estat:** 📋 Planificació — Pendent d'implementació
> **Prerequisit:** Arquitectura V2 "Clean Slate" desplegada a Easypanel/Hetzner

---

## 1. Visió General

L'arquitectura PXX és un motor SaaS B2G **multi-tenant natiu**. El model de dades
ja separa totes les entitats per `municipality_id`. L'objectiu d'aquest document
és formalitzar les peces que falten per convertir una instància única en un
directori complet d'ajuntaments clients accessibles via subdominis.

**Una sola instància. Una sola base de dades. N ajuntaments aïllats.**

---

## 2. Topologia Objectiu

```
projectexinoxano.cat                    ← Landing pública (directori d'ajuntaments)
  │
  ├── granollers.projectexinoxano.cat   → municipality slug = "granollers"
  ├── vic.projectexinoxano.cat          → municipality slug = "vic"
  ├── manresa.projectexinoxano.cat      → municipality slug = "manresa"
  └── pxx-core.projectexinoxano.cat     → municipality slug = "pxx-core" (actual)
```

### Flux d'una petició

```
Usuari → granollers.projectexinoxano.cat/ca/mapa
              │
              ▼
         middleware.ts
              │  llegeix req.headers.host → "granollers.projectexinoxano.cat"
              │  extreu subdomain → "granollers"
              │  confirma que NO és root (www / projectexinoxano)
              │  injecta el slug al context de la petició
              ▼
         Next.js Server Components / Server Actions
              │  query: WHERE municipalities.slug = "granollers"
              │  obté municipality_id → "uuid-granollers"
              │  filtra totes les queries: routes, pois, users
              ▼
         PostgreSQL (RLS actiu)
              │  POLICY: municipality_id = current_setting('app.current_municipality_id')
              ▼
         Resposta aïllada ✅ — l'usuari mai veu dades d'un altre ajuntament
```

---

## 3. Matriu de URLs i Rols

| URL | Audiència | Funció |
|-----|-----------|--------|
| `projectexinoxano.cat` | Qualsevol | Landing comercial + directori d'ajuntaments actius |
| `projectexinoxano.cat/ca/admin` | SUPER_ADMIN (tu) | Gestió global de tots els ajuntaments |
| `granollers.projectexinoxano.cat` | Turistes | PWA guia de Granollers (offline-first) |
| `granollers.projectexinoxano.cat/ca/admin` | ADMIN de Granollers | Backoffice exclusiu del seu municipi |
| `vic.projectexinoxano.cat` | Turistes | PWA guia de Vic |
| `vic.projectexinoxano.cat/ca/admin` | ADMIN de Vic | Backoffice exclusiu de Vic |

> **Regla d'or:** L'`ADMIN` d'un ajuntament mai pot veure ni modificar dades d'un altre.
> El `SUPER_ADMIN` (rol exclusiu creat via CLI) té visibilitat global.

---

## 4. Peces a Construir (Per Ordre de Prioritat)

### 📌 FASE A — Seguretat (Prerequisit bloquejant)

**A.1 — Activar Row Level Security (RLS)**
*Prioritat: 🔴 CRÍTICA. Sense aquest pas, el multi-tenant no és segur.*

Migració Alembic nova (`init_rls.py`) que activi RLS a totes les taules core:

```sql
-- Taula: routes
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY municipality_isolation ON routes
  FOR ALL
  USING (municipality_id = current_setting('app.current_municipality_id')::UUID);

-- Taula: users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_own_profile ON users
  FOR ALL
  USING (id = current_setting('app.current_user_id')::UUID
         OR municipality_id = current_setting('app.current_municipality_id')::UUID);

-- Taula: reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY municipality_reports ON reports
  FOR ALL
  USING (municipality_id = current_setting('app.current_municipality_id')::UUID);

-- Taula: user_unlocks
ALTER TABLE user_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY unlock_owner ON user_unlocks
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::UUID);

-- Taula: user_route_progress
ALTER TABLE user_route_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY progress_owner ON user_route_progress
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::UUID);

-- Taula: outbox_events
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_only ON outbox_events
  FOR ALL
  USING (current_setting('app.role', true) = 'system');
```

> **Nota:** Les taules `pois` i `municipalities` tenen lectura pública per disseny
> (els POIs no estan directament lligats a un municipi, sinó a través de `routes`).
> Revisar si cal afegir un `municipality_id` directe a `pois` per futures polítiques.

---

### 📌 FASE B — Middleware de Subdominis

**B.1 — Modificar `middleware.ts` per llegir el subdomini**

El middleware actual gestiona autenticació i i18n. Cal afegir la detecció de subdomini
**abans** de qualsevol altra lògica i injectar-lo com a capçalera per als Server Components.

Lògica a implementar (pseudocodi conceptual):

```typescript
// 1. Llegir el host
const host = req.headers.get('host') ?? '';
const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'projectexinoxano.cat';

// 2. Detectar si és el domini arrel (landing)
const isRootDomain = host === rootDomain || host === `www.${rootDomain}`;

// 3. Extreure el slug del subdomini
const subdomain = host.replace(`.${rootDomain}`, ''); // "granollers"

// 4. Si NO és arrel, afegir el slug com a capçalera per als Server Components
if (!isRootDomain && subdomain) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-municipality-slug', subdomain);
  // Continuar amb la resposta modificada
}
```

**B.2 — Crear helper `getMunicipalityFromRequest()`**

Una funció de servidor que, a qualsevol Server Component o Server Action, llegeixi
la capçalera `x-municipality-slug` i retorni l'objecte `Municipality` complet:

```typescript
// lib/utils/municipality-context.ts
import { headers } from 'next/headers';
import { prisma } from '@/lib/database/prisma';

export async function getMunicipalityContext() {
  const headersList = await headers();
  const slug = headersList.get('x-municipality-slug');

  if (!slug) return null; // Estem a la landing arrel

  return prisma.municipality.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, themeId: true, planTier: true }
  });
}
```

---

### 📌 FASE C — Landing Pública (Directori d'Ajuntaments)

**C.1 — Pàgina `projectexinoxano.cat`**

Quan l'usuari arriba al domini arrel (sense subdomini), veu una pàgina de presentació
comercial amb la llista de tots els ajuntaments actius. Fa una sola query:

```typescript
// app/[locale]/page.tsx (condicional: només si !subdomain)
const municipalities = await prisma.municipality.findMany({
  where: {
    planTier: { not: 'inactive' } // Només ajuntaments clients actius
  },
  select: {
    id: true,
    slug: true,
    name: true,
    nameTranslations: true,
    themeId: true,
  },
  orderBy: { name: 'asc' }
});
```

Cada ajuntament de la llista és un link a `https://{slug}.projectexinoxano.cat`.

**C.2 — Estructura de la Landing**

```
projectexinoxano.cat
  ├── Hero Section          → Presentació de la plataforma PXX
  ├── Directori d'Ajuntaments → Grid/mapa amb tots els clients actius
  │     ├── Granollers  → granollers.projectexinoxano.cat
  │     ├── Vic         → vic.projectexinoxano.cat
  │     └── Manresa     → manresa.projectexinoxano.cat
  ├── Secció Institucional  → "Ets un ajuntament? Contacta'ns"
  └── Footer               → Links legals, contacte
```

---

### 📌 FASE D — Infraestructura (Easypanel + DNS)

**D.1 — Wildcard DNS**

Al proveïdor de DNS (Cloudflare recomanat), afegir un registre wildcard:

```
Tipus: CNAME
Nom:   *.projectexinoxano.cat
Valor: [IP del servidor Hetzner o el domini d'Easypanel]
TTL:   Auto
```

Amb això, qualsevol subdomini nou (`novajuntament.projectexinoxano.cat`) funciona
automàticament sense tocar el DNS cada vegada.

**D.2 — Easypanel: Wildcard al Reverse Proxy**

Al servei `frontend` (Next.js) d'Easypanel, configurar el domini com a wildcard:

```
Domini: *.projectexinoxano.cat
Port: 3000
SSL: Let's Encrypt Wildcard (requereix challenge DNS-01 via Cloudflare API)
```

**D.3 — Variable d'entorn nova**

```env
NEXT_PUBLIC_ROOT_DOMAIN="projectexinoxano.cat"
```

---

### 📌 FASE E — Gestió d'Ajuntaments (Backoffice SUPER_ADMIN)

**E.1 — Panell de gestió global**

A `/admin` (accessible només amb rol `SUPER_ADMIN`), afegir una secció per:

- **Crear un ajuntament nou:** Inserir una fila a `municipalities` amb el `slug` desitjat.
  El subdomini funciona automàticament gràcies al wildcard DNS.
- **Activar/desactivar ajuntaments:** Canviar `plan_tier` a `'inactive'` per ocultar-los
  del directori sense eliminar les dades.
- **Assignar admins:** Crear usuaris amb rol `ADMIN` i `municipality_id` corresponent.

**E.2 — Alta d'un ajuntament nou (flux complet)**

```
1. SUPER_ADMIN crea fila a `municipalities` (slug: "nou-ajuntament")
2. SUPER_ADMIN crea usuari ADMIN assignat a aquest municipality_id
3. Wildcard DNS ya serveix "nou-ajuntament.projectexinoxano.cat" ✅
4. L'admin del nou ajuntament accedeix al backoffice i crea rutes i POIs
5. El directori a projectexinoxano.cat mostra el nou ajuntament automàticament ✅
```

> **Zero intervenció tècnica per afegir un client nou.** Tot és autoservei.

---

## 5. Variables d'Entorn Addicionals Necessàries

```env
# Identificador del domini arrel (sense protocol ni www)
NEXT_PUBLIC_ROOT_DOMAIN="projectexinoxano.cat"

# URL base per als subdominis (usada per construir links cross-municipality)
NEXT_PUBLIC_APP_URL="https://projectexinoxano.cat"
```

---

## 6. Pla d'Acció

| ID | Tasca | Prioritat | Bloqueig |
|----|-------|-----------|----------|
| **MT-1** | Activar RLS a totes les taules core (migració Alembic) | 🔴 CRÍT | Cap |
| **MT-2** | Afegir lògica de subdomini a `middleware.ts` | 🔴 CRÍT | MT-1 |
| **MT-3** | Crear helper `getMunicipalityContext()` | 🔴 CRÍT | MT-2 |
| **MT-4** | Adaptar Server Components per usar el context de municipi | 🟡 GREU | MT-3 |
| **MT-5** | Construir la landing pública + directori d'ajuntaments | 🟡 GREU | MT-3 |
| **MT-6** | Configurar wildcard DNS a Cloudflare | 🟡 GREU | Cap |
| **MT-7** | Configurar wildcard SSL + domini a Easypanel | 🟡 GREU | MT-6 |
| **MT-8** | Panell SUPER_ADMIN per gestió d'ajuntaments | 🟢 MILLORA | MT-4 |
| **MT-9** | Revisar si `pois` necessita `municipality_id` directe | 🟢 MILLORA | Cap |

---

## 7. Estat del Repositori (Base de Partida)

El que **JA FUNCIONA** i no cal tocar:

| Element | Ubicació | Estat |
|---------|----------|-------|
| Model `Municipality` amb `slug` i `plan_tier` | `prisma/schema.prisma` | ✅ Llest |
| FK `municipality_id` a `Route`, `User`, `Report` | `prisma/schema.prisma` | ✅ Llest |
| Lògica de filtrat per `municipality_id` | `lib/actions/content.ts` | ✅ Funcional |
| Middleware d'autenticació i rols | `middleware.ts` | ✅ Base sòlida |
| Sistema de temes per `themeId` | `projects/active/config.ts` | ✅ White-label |
| PostGIS + pgvector | `prisma/schema.prisma` | ✅ Llest |

El que **FALTA** (aquest roadmap):

| Element | Prioritat |
|---------|-----------|
| RLS activat a PostgreSQL | 🔴 CRÍT |
| Middleware llegeix subdomini | 🔴 CRÍT |
| Landing arrel amb directori | 🟡 GREU |
| Wildcard DNS + SSL a Easypanel | 🟡 GREU |

---

## 8. Conclusió

L'arquitectura PXX ja és multi-tenant per disseny. **No cal duplicar el repositori ni
el servidor** per afegir un ajuntament nou. El model de negoci SaaS B2G és plenament
viable amb una sola instància a Hetzner.

El cost marginal d'afegir un ajuntament nou és pràcticament zero a nivell d'infraestructura:
una fila nova a `municipalities`, un subdomini que el wildcard DNS ja cobreix, i un
usuari `ADMIN` nou. Tot la resta (mapes, rutes, POIs, gamificació, offline-first)
és autoservei del backoffice.

---

*Preparat per Agent Tecnologia (AnT) — PXX Architectures.*
*Data: 2026-06-15 | Revisió: V2 Sovereign Multi-Tenant Extension*
