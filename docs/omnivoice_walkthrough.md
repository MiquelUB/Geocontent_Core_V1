# 🚀 Implementació d'Omnivoice (Finalitzada)

La integració asíncrona de Text-To-Speech (TTS) i traducció de vídeo està completament implementada seguint el Master Plan. El sistema s'ha refactoritzat per delegar les càrregues pesades (IA, transcodificació de vídeos i TTS) a l'entorn de Python, alliberant completament l'entorn de Next.js/Vercel.

## 🎯 Canvis Realitzats

### 1. Base de Dades (Esquema i Modelat)
- S'han afegit les propietats de `videoTranslations` (JSON), `voiceId` i `voicePersona` als models Prisma pertinents.
- Les migracions ja permeten desar l'historial complet sense corrompre cap taula existent.

### 2. Next.js "El Cervell" (Server Actions)
- Hem deixat obsoleta la generació **síncrona** d'àudio que generava Timeout Errors en Vercel.
- S'han introduït dues noves Server Actions (`requestTtsGeneration` i `requestVideoTranslation`) ubicades a `lib/actions/omnivoice.ts`.
- Aquestes accions insereixen un registre de tipus Outbox directament a la base de dades PostgreSQL (a la taula `outbox_events`), incloent seguretat (RBAC per usuaris Admin) i **Rate Limiting** associat al `userId`.
- També s'ha auditat i modificat `lib/actions/content.ts` per assegurar que els "Partial Updates" dels POIs **no** esborren la informació d'àudio/vídeo traduïda en modificacions posteriors.

### 3. Interfície d'Usuari Frontend
- El panell `ManualPoiForm.tsx` (on es crea o s'edita l'audioguia) ara incorpora **Selector de Veu (Persona)** on l'administrador pot triar entre Nova, Alloy, Onyx, Shimmer, Echo o Fable.
- Els formularis d'àudio i vídeo utilitzen dissenys asíncrons. Quan es fa clic a "Traduir Vídeo (IA)" o "Generar Audioguia", s'avisa a l'usuari i la petició s'envia a l'Outbox (cueing), mostrant un loader temporal i una nota per refrescar la pàgina més tard per veure'n el resultat.
- El previsualitzador d'àudio i vídeo s'ha actualitzat perquè suporti la previsualització dels arxius HTML5 generats i pujats a S3, llistant la traducció generada de forma autònoma.

### 4. Múscul Operatiu (Python Worker & ARQ)
- Hem reescrit `backend-python/worker.py` creant un **Outbox Poller** totalment integrat. Aquest loop (que corre en segon pla) busca regularment els esdeveniments `PENDING` de la base de dades sense necessitat que Next.js accedeixi a un Redis extern (millorant la seguretat de l'arquitectura).
- El Poller llegeix el PostgreSQL, encua les peticions als seus `process_tts_job` o `process_video_translation_job` via ARQ.
- El Worker realitza el processament (fent servir `edge-tts` com a fallback gratuït i asíncron). Dins del mateix Worker, els fitxers MP4 (Vídeos Traduïts) i MP3 (TTS multilingüe) **es pugen directament a l'emmagatzematge S3** (`boto3`) utilitzant les variables del bucket ja configurat (`pxx-core-v1`).
- Immediatament després, el Worker actualitza directament el camp JSON (ex: `audio_translations` o `video_translations`) a la taula `pois` via `asyncpg`, tancant el loop asíncron sense que el Cervell (Vercel) se n'hagi d'ocupar gens.

## 🛠 Comprovacions de Validació i Testing
- ✅ **Base de dades Connectada**: El Worker extreu de PostgreSQL i hi fa l'update final sense intermediaris.
- ✅ **TypeScript OK**: Validació `npx tsc --noEmit` executada amb 0 errors (incloent les modificacions de UI).
- ✅ **Prevenció Timeout / OOM**: Next.js (Vercel) ja no es penja processant MP3 i MP4 en entorns Edge o Node serverless. 
- ✅ **Pèrdua de dades (Parcials)**: Editar el Títol d'un POI ja no esborra les URLs de vídeo S3 creades prèviament per la IA.

> [!TIP]
> Per posar en producció, caldrà assegurar-se que el Worker de Python a Easypanel (o servidor on estigui hostat) tingui variables d'entorn com la connexió asíncrona al PostgreSQL (`DATABASE_URL`) i credencials vàlides d'AWS `S3`.
