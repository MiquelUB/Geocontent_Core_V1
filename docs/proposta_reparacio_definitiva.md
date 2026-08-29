# Anàlisi Profunda i Proposta de Reparació Definitiva
## Sessió de Manteniment - Agost 2026

---

## VISIÓ GENERAL: Quin és el problema real?

Mirant tots els errors de les sessions de manteniment **des de dalt**, la conclusió és clara: **no hi ha un problema de codi, hi ha un problema d'arquitectura de la capa de comunicació asíncrona.**

Tots els errors que han aparegut en cercle (roda atascada, MP3 invisible, Server Action vella, input stream, OpaqueResponseBlocking) **no són errors independents**. Són tots manifestacions del mateix problema de disseny: el circuit que va des que l'usuari demana una traducció fins que veu el resultat a la pantalla **no té un canal de retorn fiable**.

---

## MAPA DEL CIRCUIT ACTUAL (on falla)

```
USUARI          FRONTEND          VERCEL/NEXTJS         WORKER (Python/ARQ)         S3 / DB
  |                 |                    |                       |                     |
  | Clic "Traduir"  |                    |                       |                     |
  |---------------->| Server Action     |                       |                     |
  |                 |------------------->| INSERT outbox_event  |                     |
  |                 |                    |---worker em llegeix-->|                     |
  |                 |                    |                       | Processa MP4/TTS    |
  |                 |                    |                       |--puja arxiu-------->|
  |                 |                    |                       |--UPDATE pois.db---->|
  |                 |                    |                       |                     |
  |     ??? (com s'entera el frontend que ha acabat?) ???
  |                 |                    |                       |                     |
  | Fa polling cada 5s (setInterval)     |                       |                     |
  |                 | Server Action      |                       |                     |
  |                 |------------------->|  <-- AQUÍ FALLA -->  |                     |
  |                 |    (versió errònia, input stream, etc.)    |                     |
```

**El punt crític és el "canal de retorn".** El worker acaba la feina i actualitza la base de dades, però **el frontend no té una manera nativa, eficient i robusta de saber-ho**. El *polling* manual cada 5 segons és un pegat que trenca constantment per culpa de:
1. Incompatibilitats de versions de desplegament (Server Actions Hash mismatch)
2. Sobrecàrrega del serialitzador de Next.js (input stream error)
3. El component que fa polling és Client, però les dades fresques venen del Server

---

## DIAGNÒSTIC DELS 4 GRUPS D'ERRORS

### Grup A — Errors de "Canal de Retorn" (Polling)
**Errors:** Roda atascada, Server Action Hash mismatch, TypeError input stream
**Arrel única:** El frontend no té un mecanisme natiu per rebre notificacions del backend. El *polling* via Server Actions de Next.js és estructuralment fràgil.

### Grup B — Errors de Configuració d'Infraestructura (S3)
**Errors:** OpaqueResponseBlocking, Access Denied en pujar MP3
**Arrel única:** El worker de Python tenia instruccions de permisos (`ACL: public-read`) incompatibles amb la configuració actual del bucket S3 (Bucket Owner Enforced). A més, quan S3 retorna un error XML en lloc del binari (MP3/MP4), el navegador el bloqueja per seguretat (ORB).

### Grup C — Errors de Navegació (Router)
**Errors:** `ReferenceError: router is not defined`
**Arrel única:** Refactoritzacions de codi que van moure el component a un context diferent (d'un Server Component a un Client Component pur) sense actualitzar totes les dependències de hooks.

### Grup D — Errors de Visualització de Dades
**Errors:** Noms de fitxers amb UUID, slots buits en obrir POI
**Arrel única:** Manca de capa de presentació ("ViewModel") entre la dada crua de la base de dades i la UI. El frontend mostrava directament l'URL tècnica de S3 sense cap post-processament.

---

## PROPOSTA DE REPARACIÓ DEFINITIVA (sense programar)

### Solució A — Eliminar el Polling. Implementar WebSockets o SSE

**El problema actual:** El frontend pregunta "Ja has acabat?" cada 5 segons.
**La solució:** Que el worker digui "He acabat!" un cop sol, quan acabi de veritat.

La tecnologia adequada per a això és **Server-Sent Events (SSE)** o **WebSockets**.

**Flux proposat:**
1. L'usuari prem "Traduir".
2. El frontend s'**subscriu** a un canal de notificació únic per al seu POI (per exemple: `/api/events/poi/[poiId]`).
3. El worker, quan acaba de processar el vídeo o l'àudio, fa una petició HTTP a un endpoint de Next.js que **tanca el canal SSE amb les dades fresques**.
4. El frontend rep les dades fresques en temps real i actualitza la UI.
5. **No hi ha polling, no hi ha incompatibilitats de versió, no hi ha sobrecàrrega.**

> **Avantatge clau:** Com que el frontend no fa cap petició activa, no patirà mai més errors de "Server Action Hash mismatch" per desplegament de nova versió.

---

### Solució B — Bucket S3 amb Configuració Unificada

**El problema actual:** El sistema té dos codis que pugen a S3 (el client Next.js i el worker de Python) i cada un configurava els permisos de manera diferent.

**Solució proposada:**
1. Definir **una única política de CORS i permisos al bucket S3** que sigui coherent amb ambdós clients.
2. Eliminar tota referència a `ACL` als dos codis (ja fet al worker). Verificar que el codi de Next.js (`upload-client.ts`) tampoc no l'usa.
3. Afegir validació al worker: **si la pujada falla, marcar l'event a `outbox_events` com a `FAILED`** i retornar un error clar (en lloc de deixar la tasca en silenci).
4. Al frontend, llegir l'estat `FAILED` i mostrar un missatge d'error clar a l'usuari en lloc de la roda girant per sempre.

---

### Solució C — Codi de Migració de Hooks amb Test

**El problema actual:** En refactoritzar, és fàcil oblidar un `useRouter` o un `useState` en components grans.

**Solució proposada:**
1. Establir una **convenció de codi**: tots els hooks de navegació (`useRouter`, `usePathname`) s'han de declarar al principi de cada component en un bloc marcat com a `// --- HOOKS ---`.
2. Afegir una revisió amb ESLint (`eslint-plugin-react-hooks`) que detecti errors d'ús de hooks fora d'un component o sense declarar. Ja existeix la regla, cal activar-la al `.eslintrc`.

---

### Solució D — Capa de ViewModel per a Dades de S3

**El problema actual:** L'URL de S3 és `https://bucket.s3.region.amazonaws.com/media/pois/UUID_filename.mp4` i el frontend mostra directament l'UUID.

**Solució proposada:**
1. Crear una funció utilitària compartida `parseS3Filename(url: string): string` que extregui sempre el nom net. Ja tenim una versió en línia al component, però caldria extreure-la a `lib/utils.ts` i usar-la a tots els components que mostrin URLs de S3.
2. Guardar el nom original del fitxer a la base de dades (camp `videoFileNames: Json?`) en el moment de la pujada, per tenir sempre una referència neta independent de la URL tècnica.

---

## RESUM EXECUTIU DE LA PROPOSTA

| Problema | Solució Definitiva | Prioritat |
|---|---|---|
| Roda atascada / Polling fràgil | Migrar a SSE (Server-Sent Events) | 🔴 ALTA |
| S3 Access Denied / ORB | Política única de bucket + validació d'errors al worker | 🔴 ALTA |
| Router no definit | ESLint strict + convenció de bloc de hooks | 🟡 MITJANA |
| Noms UUID visibles | Funció `parseS3Filename` a `lib/utils.ts` + camp `videoFileNames` a DB | 🟡 MITJANA |

La solució SSE és la que tallaria d'arrel el 80% dels errors que estem veient en bucle. Les altres tres són neteges de qualitat que evitarien regressions futures.
