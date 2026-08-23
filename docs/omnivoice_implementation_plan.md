# 🗣️ Implementació d'Omnivoice — Pla d'Arquitectura i Execució

L'objectiu d'aquest pla és dissenyar i implementar la integració d'**Omnivoice** (generació d'àudio Text-to-Speech avançada i traducció de vídeo) assegurant que no repetim els errors de desplegament recents (Next.js Edge vs Node.js, connexions Prisma, i seguretat Multi-tenant).

> [!NOTE]
> Aquest pla s'ha creat observant detalladament el document `docs/omnivoice_deployment_errors.md` per evitar caure en els paranys de Prisma 7 i l'ecosistema Edge de Vercel (Next.js).

## 1. Actualització de l'Esquema de Base de Dades

Durant la preparació ja es van afegir certes columnes a PostgreSQL via `run_migration.js`, però no estan sincronitzades amb l'ORM Prisma, cosa que causarà errors de TypeScript o pèrdua de dades en consultes.

### Canvis a `prisma/schema.prisma`
- **Model `Poi`**: 
  - Afegir `videoTranslations Json @default("{}") @map("video_translations")`. (El camp `voiceScript` ja hi és).
  - Afegir `voiceId String? @map("voice_id")` per guardar el tipus de veu seleccionada per a cada punt concret.
- **Model `Municipality`**: Afegir `voicePersona String? @default("Persona gran, veu càlida, serena i amb experiència patrimonial") @map("voice_persona")`.

*(Després s'executarà `npx prisma generate` per sincronitzar el client de TypeScript).*

## 2. Desenvolupament de l'API (Backend)

La integració amb serveis externs de TTS/Vídeo (com ElevenLabs o OpenAI) s'ha de fer amb cura per evitar el bloqueig per Edge Runtime.

### Rutes a implementar:
- **`POST /api/omnivoice/tts`**:
  - Rebrà el `poiId`. Extraurà el `voiceScript` i el `voicePersona` de l'ajuntament.
  - Generarà l'àudio, el penjarà a l'Storage (Cloudflare R2 / AWS S3) i guardarà l'URL a `Poi.audioUrl` o `Poi.audioTranslations`.
  - **Crític**: Aquest fitxer ha de tenir `export const runtime = 'nodejs'` (o directament ser una *Server Action* sense clàusula edge) per poder carregar l'adaptador Prisma-Pg lliurement.
- **`POST /api/omnivoice/video-translate`**:
  - Rebrà el `poiId` i l'URL del vídeo original.
  - Iniciarà un job de traducció i actualitzarà el JSONB `videoTranslations`.

### 🛡️ Defenses de Seguretat (Segons `SECURITY_AUDIT_2026-06.md`)
1. **Verificació de Rol i Propietat**: Cap `TOURIST` podrà disparar aquestes APIs. Es verificarà que l'usuari és `ADMIN` del municipi propietari del POI, o `SUPER_ADMIN`.
2. **Rate Limiting**: Cada intent de generar àudio/vídeo cridarà a `rateLimit('omnivoice:' + userId, 10, 3600)` per evitar atacs de denegació de servei (DDoS) financers contra l'API d'IA.
3. **Auditoria (`AiUsageLog`)**: Registrarem cada generació amb l'ID de l'usuari i els tokens estimats/cost, evitant ús fantasma.

## 3. Interfície d'Usuari (Frontend)

Per complir amb el requeriment *"Necessitamos reproductor de audio para validar que las traducciones son correctas. Traduccion de video"*:

### 3.1. Reproductor d'Àudio al Dashboard i Selector de Veus
Crearem un component React `AdminAudioPlayer` integrat al panell d'edició del POI:
- Mostrarà l'àudio generat per al POI.
- Permetrà reproduir-lo, pausar-lo i ajustar-ne el volum per validar la traducció.
- **Selector de Veus**: Un desplegable (Dropdown) on l'administrador podrà triar el tipus de veu abans de generar (ex: "Narrador Masculí Profund", "Veu Femenina Càlida", "Veu Infantil", etc.). Aquesta selecció es passarà a l'API de TTS.
- Inclourà un botó **"Generar / Regenerar Àudio"** que obrirà un modal on es podrà ajustar el `voiceScript` manualment, verificar el tipus de veu seleccionat, i generar-lo (amb confirmació visual que això consumeix crèdits d'IA).

### 3.2. Panell de Traducció de Vídeo
A la secció d'edició d'un POI, s'afegirà un bloc de "Mitjans Audiovisuals Avançats":
- Llista de `videoUrls` actuals.
- Taula de `videoTranslations` on es mostrin les pistes de doblatge/subtítols generades, permetent la seva validació i reproducció (fent servir la API nativa de `<video>` d'HTML5).

## 4. Validació de `GEMINI.md` (Sobirania de Projecte)

> [!IMPORTANT]
> - **Zero Vercel**: No utilitzarem @vercel/blob per guardar els àudios (ja teniu R2 o un Storage configurat, s'utilitzarà el `lib/services/upload.ts` ja existent).
> - **NextAuth Segur**: Utilitzarem exclusivament la instància `prisma` del singleton `lib/database/prisma.ts` per assegurar que el RLS (Row Level Security) per l'Admin s'executa correctament sobre la connexió PgBouncer SSL.
> - **Sense CSS-in-JS de moda**: Els components de UI faran servir el Tailwind CSS existent del dashboard de Geocontent per alinear-se estèticament.
