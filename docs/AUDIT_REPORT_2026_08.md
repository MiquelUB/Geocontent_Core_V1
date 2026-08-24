# 🛡️ Auditoria Tècnica i de Seguretat (Projecte PXX)

*Data de l'auditoria: Agost 2026*

A continuació es detallen les troballes de l'auditoria de seguretat, arquitectura i rendiment, classificades per severitat. L'objectiu és assegurar que el sistema està preparat per a la producció, escalabilitat i compliment normatiu (incloent les estrictes directives del `GEMINI.md`).

---

## 1. 🚨 Risc Crític i Alt (Prioritat Immediata)

### 1.1. Vulnerabilitats a Dependències de Producció (NPM Audit)
- **Risc:** CRÍTIC / ALT
- **Troballa:** L'auditoria de l'arbre de dependències de producció (`npm audit --production`) ha revelat **22 vulnerabilitats** (3 Crítiques, 16 Altes), afectant paquets core com `ws` (DoS per esgotament de memòria / Uninitialized memory disclosure) i `valibot`.
- **Recomanació:** Executar immediatament `npm audit fix` i, si escau, actualitzar manualment les llibreries afectades. El servidor de producció està exposat a atacs de denegació de servei (DoS) a causa del paquet websockets.

### 1.2. Manca de Guards d'Autenticació a Server Actions (Privilegis Escalats)
- **Risc:** ALT
- **Troballa:** S'han detectat múltiples funcions exportades amb `'use server'` que muten o llegeixen l'estat del sistema i **no tenen la crida a `auth()` o `requireAuth()`** explícita a dins de la funció. Exemples clars:
  - `lib/actions/packager.ts`: `generateTerritorialPackageAction`, `queueTerritorialPackageAction`.
  - `lib/actions/storage.ts`: `uploadFile`, `updateProfileAvatar`, `handleAvatarUploadAction`.
  - `lib/actions/queries.ts`: `getAllProfiles`, etc.
- **Recomanació:** Tot i que l'accés a dades pot estar mitjanament protegit pel RLS de Prisma, qualsevol usuari maliciós (o no autenticat) pot invocar aquestes Server Actions directament via HTTP POST. Cal injectar `await requireAuth()` a l'inici de **totes** les accions sensibles.

### 1.3. Vector DoS: Mida Màxima del Body de Server Actions
- **Risc:** ALT
- **Troballa:** A `next.config.mjs`, s'ha establert globalment `bodySizeLimit: '200mb'` per a les Server Actions. Això permet a qualsevol atacant fer peticions HTTP massives i col·lapsar la memòria RAM del servidor (especialment perillós en entorns amb recursos limitats com els contenidors Docker esmentats al `GEMINI.md`).
- **Recomanació:** Reduir el límit global a valors normals (ex: `10mb` o `20mb`). Si es requereixen pujades d'arxius grans, utilitzar exclusivament **Presigned URLs d'S3** directes des del client al bucket, evitant passar pel backend de Next.js.

### 1.4. Seguretat en Generació de PDFs (Puppeteer)
- **Risc:** ALT
- **Troballa:** A `lib/services/pdf.ts`, s'aixeca Puppeteer amb el flag `--no-sandbox`. Atès que s'està renderitzant HTML que inclou dades introduïdes pels usuaris, existeix un risc de *Server-Side XSS* que podria derivar en lectura d'arxius locals.
- **Recomanació:** Validar/Sanititzar estrictament el contingut abans d'injectar-lo a la plantilla HTML, o bé intentar córrer Puppeteer amb sandbox.

---

## 2. ⚠️ Risc Mitjà (Arquitectura i Rendiment)

### 2.1. Prisma: Índexs (Indexes) Absents a les FKs
- **Risc:** MITJÀ
- **Troballa:** El fitxer `prisma/schema.prisma` conté múltiples claus foranes (FKs) com `municipalityId` a `User`, o `routeId` / `poiId`, que **no tenen** definit un `@@index`. L'absència d'índexs provoca "Seq Scans" molt lents quan la base de dades creix.
- **Recomanació:** Afegir `@@index([municipalityId])`, `@@index([userId])`, etc., a totes les FKs que s'utilitzin freqüentment en filtres o `include` de Prisma.

### 2.2. Deute Tècnic: Typescript `any`
- **Risc:** MITJÀ
- **Troballa:** L'auditoria mostra **125 incidències** de la paraula clau `any` al backend i frontend. Això trenca l'escut de seguretat en temps de compilació que ofereix TypeScript.
- **Recomanació:** Planificar un esprint de refactorització tipogràfica. Substituir `any` per tipus Zod derivats, o com a mínim tipus `unknown`.

### 2.3. Rutes d'API sense Protecció Explícita
- **Risc:** MITJÀ
- **Troballa:** Rutes com `api/municipalities`, `api/pois`, `api/routes` són completament públiques. 
- **Recomanació:** Si aquestes dades es consideren un "asset" de negoci, estem exposant tota la nostra base de dades a *scraping*. Cal implementar **CORS restrictiu** o *Rate Limiting* explícit per a lectura.

---

## 3. ℹ️ Millores i Bones Pràctiques (Baixa Severitat)

### 3.1. RLS (Row Level Security) Implementation
- **Estat:** EXCEL·LENT 🟢
- **Comentari:** La implementació de `lib/database/prisma-rls.ts` amb `SET LOCAL app.current_user_id` és de llibre. La protecció multi-tenant és sòlida i el `withRLS()` assegura que les transaccions de sessió no provoquin fuites entre usuaris, complint el `GEMINI.md`.

### 3.2. Error Boundaries absents (React)
- **Estat:** DEFICIENT 🟡
- **Comentari:** No s'han trobat components genèrics d'`error.tsx` a l'arrel de l'aplicació (`app/`). S'han de definir Error Boundaries globals que permetin la recuperació de l'aplicació.

### 3.3. Integració amb OpenRouter / IA
- **Estat:** CORRECTE (Amb espai de millora) 🟢
- **Comentari:** Tota la lògica de crides a l'API inclou blocks `try/catch`. Això no obstant, no hi ha una lògica de **Retry** (Reintents automàtics en errors 429 o 500).
- **Recomanació:** Implementar reintents exponencials per esmorteir caigudes de la IA.

### 3.4. Vectors XSS Menors a Client
- **Estat:** MONITORITZAR 🟡
- **Comentari:** Es fa servir `dangerouslySetInnerHTML` als components per renderitzar JSON-LD i icones de forma lícita. Mentre el contingut estigui estrictament hardcodejat, no hi ha perill immediat.
