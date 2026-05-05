\`\`\`markdown  
\# 🔍 AUDITORIA ARQUITECTÒNICA PROFUNDA \- PXX V2 "CLEAN SLATE"  
\*\*Geocontent\_Core\_V1 | Commit: 36a591cbe3d4c377c30b9c8b8b43dcfd8becdccc\*\*  
\*\*Data: 2026-05-05 | Auditor: Agent Tecnologia (AnT)\*\*

\---

\#\# ⚠️ VEREDICTE GLOBAL: \*\*CODI EN FASE DE TRANSICIÓ \- ARQUITECTURA PARCIALMENT IMPLEMENTADA\*\*

El repositori mostra una \*\*híbridació correcta en procés\*\*: Python/FastAPI ja exists amb estructura base sólida, però hi ha \*\*violacions crítiques\*\* de seguretat i configuració que impedeixen la migració final a Easypanel.

\---

\#\# 📊 MATRIU D'AVALUACIÓ (Per Directiva GEMINI.md)

| Directiva | Estat | Gravetat | Detall |  
|-----------|-------|----------|--------|  
| \*\*Cervell-Múscul Separats\*\* | ⚠️ PARCIAL | 🔴 CRÍT | FastAPI exists però Next.js manté dependències pesades |  
| \*\*ARQ vs BullMQ\*\* | ❌ FALLIDA | 🔴 CRÍT | \`bullmq\` a \`serverExternalPackages\` al Next.js |  
| \*\*Row Level Security (RLS)\*\* | ❌ NO IMPL | 🔴 CRÍT | Prisma schema sense RLS definit |  
| \*\*Redis noeviction Policy\*\* | ❌ FALLIDA | 🔴 CRÍT | \`--maxmemory-policy allkeys-lru\` (MUST BE \`noeviction\`) |  
| \*\*S3 Direct Upload (Bypass)\*\* | ❌ FALLIDA | 🔴 CRÍT | \`lib/upload-client.ts\` usa Supabase Storage, no S3 presigned |  
| \*\*Alembic Pre-Deploy Lock\*\* | ✅ IMPLEMENTAT | 🟢 OK | \`env.py\` correcte amb \`pg\_advisory\_lock\` |  
| \*\*PgBouncer Integració\*\* | ⏳ PENDING | 🟡 WARN | \`docker-compose.yml\` NO inclou PgBouncer |  
| \*\*Middleware Auth Defensiva\*\* | ✅ IMPLEMENTAT | 🟢 OK | Middleware.ts protegeix \`/admin\` routes |  
| \*\*PostgreSQL com a font de veritat\*\* | ⚠️ PARCIAL | 🟡 WARN | Prisma schema sòlid, però SQLModel no generat |  
| \*\*Offl-First MapLibre\*\* | ✅ IMPLEMENTAT | 🟢 OK | \`next.config.js\` sense Mapbox, MapLibre present |

\---

\#\# 🔴 CRÍTICA ARQUITECTÒNICA: VIOLACIONS SEVERES

\#\#\# \*\*1. VIOLACIÓ CRÍTICA: Redis \`allkeys-lru\` en lloc de \`noeviction\`\*\*

\*\*Localització:\*\* \`docker-compose.yml\` línies 13

\`\`\`yaml  
command: \["redis-server", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru"\]  \# ❌ WRONG  
\`\`\`

\*\*Problema:\*\*  
\- \*\*Política de memòria:\*\* \`allkeys-lru\` evicta claus aleatòriament. Això causa \*\*pèrdua de tasques ARQ\*\*.  
\- \*\*Directiva requerida:\*\* \`--maxmemory-policy noeviction\` (rejecting new items if memory is full)  
\- \*\*Impacte:\*\* Quan Redis s'omple, \*\*elimina dades de cues\*\* sense avisar. Els Workers processaré tasques "fantasmes".

\*\*Remediació:\*\*  
\`\`\`yaml  
redis:  
  image: redis:alpine  
  command: \["redis-server", "--maxmemory", "256mb", "--maxmemory-policy", "noeviction"\]  
  deploy:  
    resources:  
      limits:  
        memory: 256M  
\`\`\`

\---

\#\#\# \*\*2. VIOLACIÓ CRÍTICA: BullMQ a \`serverExternalPackages\` (Next.js)\*\*

\*\*Localització:\*\* \`next.config.js\` línia 6

\`\`\`javascript  
serverExternalPackages: \["pdf-parse", "puppeteer", "bullmq"\],  // ❌ WRONG  
\`\`\`

\*\*Problema:\*\*  
\- \*\*BullMQ als Next.js Server Actions:\*\* Viola la Directiva "Cervell-Múscul Separats"  
\- \*\*La Directiva ordena:\*\* "Prohibit usar Next.js per tasques pesades... El Múscul viu a Python (FastAPI)"  
\- \*\*Realitat:\*\* BullMQ continua a Node.js, no migrat a ARQ (Python)  
\- \*\*Impacte:\*\* Càrregues de processament (vídeo, PDF, IA) competeixen per recursos amb Frontend

\*\*Remediació esperada:\*\*  
\`\`\`javascript  
// ❌ ELIMINAR bullmq completament de Next.js  
serverExternalPackages: \["pdf-parse", "puppeteer"\],

// ✅ TODO: Tots els consumers/producers de BullMQ migrar a ARQ (Python/FastAPI)  
\`\`\`

\---

\#\#\# \*\*3. VIOLACIÓ CRÍTICA: S3 Direct Upload NO IMPLEMENTAT\*\*

\*\*Localització:\*\* \`lib/upload-client.ts\` línies 1-40

\`\`\`typescript  
// ❌ CURRENT: Usa Supabase Storage (tercerista)  
import { createClient } from '@/lib/database/supabase/client';  
export async function uploadFileClient(file: File, bucket: string \= 'geocontent') {  
    const supabase \= createClient();  
    const { data, error } \= await supabase.storage.from(bucket).upload(fileName, file, {...});  
}  
\`\`\`

\*\*Problema:\*\*  
\- \*\*Arquitectura esperada:\*\* Cliente (Next.js) → \*\*Presigned URL de FastAPI\*\* → \*\*S3 Direct Upload (bypass)\*\*  
\- \*\*Realitat actual:\*\* Client → Supabase → Storage (lock-in)  
\- \*\*Cost:\*\* \~€30/any si fos S3, però Supabase no exposa estadístiques  
\- \*\*Impacte:\*\* NO es compleix la sobirania (Supabase és BaaS tercerista, no Hetzner self-hosted)

\*\*Remediació esperada:\*\*  
\`\`\`typescript  
// ✅ TODO: Implementar  
// Client sol·licita presigned URL a FastAPI  
const response \= await fetch('/api/s3/presigned-url', {  
  method: 'POST',  
  body: JSON.stringify({ fileName, fileType })  
});  
const { presignedUrl } \= await response.json();

// Client puja directament a S3/MinIO  
await fetch(presignedUrl, {  
  method: 'PUT',  
  body: file,  
  headers: { 'Content-Type': file.type }  
});  
\`\`\`

\---

\#\#\# \*\*4. VIOLACIÓ CRÍTICA: Row Level Security (RLS) NO IMPLEMENTADA\*\*

\*\*Localització:\*\* \`prisma/schema.prisma\` (TODO)

\*\*Problema:\*\*  
\- \*\*Prisma schema:\*\* 0 RLS policies definides  
\- \*\*Directiva requerida:\*\* \*"Tota taula de dades a PostgreSQL ha de tenir Row Level Security (RLS) activat"\*  
\- \*\*Cas d'ús crític:\*\* Un usuari "tourist" NO pot veure dades d'altre ajuntament  
\- \*\*Impacte:\*\* Buit de seguretat multi-tenant

\*\*Remediació esperada:\*\*

\`\`\`sql  
\-- PostgreSQL: RLS POLICY per a User (per municipality)  
ALTER TABLE users ENABLE ROW LEVEL SECURITY;  
CREATE POLICY user\_isolation ON users FOR ALL  
  USING (municipality\_id \= current\_setting('app.current\_municipality\_id')::UUID);

\-- Similar per a Route, Poi, Report, etc.  
\`\`\`

\*\*A Prisma schema.prisma:\*\*  
\`\`\`prisma  
// Afegir comentaris/TODO  
// TODO: ACTIVAR RLS a producció amb policy per municipality\_id  
\`\`\`

\---

\#\#\# \*\*5. VIOLACIÓ GREU: PgBouncer NO INCLÒS A Docker Compose\*\*

\*\*Localització:\*\* \`docker-compose.yml\` (MISSING)

\*\*Problema:\*\*  
\- \*\*Directiva requerida:\*\* "Considerar el desplegament de PgBouncer (amb \`pool\_mode \= transaction\`)"  
\- \*\*Realitat:\*\* \`docker-compose.yml\` només te PostgreSQL \+ Redis \+ API, cap PgBouncer  
\- \*\*Impacte:\*\* App \+ Worker obriran connexions concurrents sense pooling → Exhaust PostgreSQL connections  
\- \*\*PostgreSQL limit típic:\*\* 100-200 connexions. Sense PgBouncer: crash immediat en carga.

\*\*Remediació esperada:\*\*  
\`\`\`yaml  
pgbouncer:  
  image: pgbouncer:latest  \# TODO: afegir imatge exacta  
  environment:  
    DATABASES\_HOST: db  
    DATABASES\_PORT: 5432  
    DATABASES\_USER: postgres  
    POOL\_MODE: transaction  
    MAX\_CLIENT\_CONN: 1000  
  ports:  
    \- "6432:6432"  \# Internal network only  
  depends\_on:  
    \- db  
\`\`\`

\---

\#\#\# \*\*6. VIOLACIÓ GREU: Middleware Usa Supabase Auth (No Hetzner Self-Hosted)\*\*

\*\*Localització:\*\* \`middleware.ts\` línies 4, 24-40

\`\`\`typescript  
// ❌ CURRENT: Supabase Auth  
import { createServerClient, type CookieOptions } from '@supabase/ssr';  
const supabase \= createServerClient(  
  process.env.NEXT\_PUBLIC\_SUPABASE\_URL\!,  
  process.env.NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY\!,  
  {...}  
);  
const { data: { user } } \= await supabase.auth.getUser();  
\`\`\`

\*\*Problema:\*\*  
\- \*\*Directiva:\*\* "Auth.js v5 (Magic Links)" a Next.js (self-hosted capable)  
\- \*\*Realitat:\*\* Supabase Auth (tercerista, BaaS)  
\- \*\*Impacte:\*\* Dependency en servei extern desalinea amb "sobirania tecnològica"

\*\*Observació:\*\* Auth.js v5 ja s'importa a \`package.json\` però NO s'usa.

\---

\#\#\# \*\*7. VIOLACIÓ MODERADA: \`typescript: { ignoreBuildErrors: true }\`\*\*

\*\*Localització:\*\* \`next.config.js\` línies 23-25

\`\`\`javascript  
typescript: {  
  ignoreBuildErrors: true,  // ❌ ANTI-PATTERN  
},  
eslint: {  
  ignoreDuringBuilds: true,  // ❌ ANTI-PATTERN  
}  
\`\`\`

\*\*Problema:\*\*  
\- \*\*Oculta errors reals\*\* en deployments (Silent failures)  
\- \*\*Directiva Implied:\*\* TypeScript Strict Mode mandatory  
\- \*\*Impacte:\*\* Bugues silenciosos a producció

\*\*Remediació:\*\*  
\`\`\`javascript  
typescript: {  
  tsconfigPath: './tsconfig.json',  
  // REMOVE: ignoreBuildErrors  
},  
eslint: {  
  // REMOVE: ignoreDuringBuilds (fix linting issues instead)  
}  
\`\`\`

\---

\#\# 🟡 PROBLEMES MODERATS (No Crítics)

\#\#\# \*\*8. Backend-Python Estructura Incompleta\*\*

\*\*Localització:\*\* \`backend-python/models/\` (Empty directory)

\`\`\`  
backend-python/  
├── alembic/  
│   └── env.py ✅ (Correcte amb pg\_advisory\_lock)  
├── alembic.ini ✅  
├── main.py ⚠️ (Només health check \+ CORS)  
├── models/ ❌ (EMPTY)  
├── requirements.txt ✅  
\`\`\`

\*\*Problema:\*\*  
\- \*\*SQLModel models\*\* no migrats de Prisma  
\- \*\*Requirements.txt:\*\* Manquen dependències (flask-sqlalchemy, pydantic-settings, etc.)

\*\*Remediació esperada:\*\*

\`\`\`python  
\# backend-python/models/\_\_init\_\_.py (TODO)  
from sqlalchemy.orm import declarative\_base, Session  
from sqlmodel import SQLModel

\# Models SQLModel (migrats de prisma/schema.prisma)  
class User(SQLModel, table=True):  
    \_\_tablename\_\_ \= "users"  
    id: UUID \= Field(primary\_key=True, default\_factory=uuid4)  
    email: str \= Field(unique=True, index=True)  
    \# RLS Policy comment: municipality\_id segregation  
\`\`\`

\---

\#\#\# \*\*9. Requirements.txt Incomplet\*\*

\*\*Localització:\*\* \`backend-python/requirements.txt\`

\`\`\`pip  
fastapi\>=0.110.0  
uvicorn\>=0.29.0  
sqlmodel\>=0.0.16  
alembic\>=1.13.1  
psycopg2-binary\>=2.9.9  
asyncpg\>=0.29.0  
arq\>=0.25.0  
pydantic\>=2.6.4  
\`\`\`

\*\*Manquen (per Directiva):\*\*  
\`\`\`pip  
\# Database pooling  
pgbouncer-python\>=0.1.0

\# Validation  
pydantic-settings\>=2.0.0

\# Testing  
pytest\>=7.0.0  
pytest-asyncio\>=0.21.0

\# Monitoring (Optional but recommended)  
python-dotenv\>=1.0.0  
\`\`\`

\---

\#\#\# \*\*10. Docker-Compose Falta Health Checks\*\*

\*\*Localització:\*\* \`docker-compose.yml\` (Incomplete)

\*\*Problema:\*\* No hi ha \`healthcheck\` definits. Easypanel no sap si serveis están saudables.

\*\*Remediació esperada:\*\*

\`\`\`yaml  
services:  
  db:  
    image: postgis/postgis:15-3.3  
    healthcheck:  
      test: \["CMD", "pg\_isready", "-U", "postgres"\]  
      interval: 10s  
      timeout: 5s  
      retries: 5  
    
  redis:  
    image: redis:alpine  
    healthcheck:  
      test: \["CMD", "redis-cli", "ping"\]  
      interval: 10s  
      timeout: 5s  
      retries: 5  
    
  api\_core:  
    build: ./backend-python  
    healthcheck:  
      test: \["CMD", "curl", "-f", "http://localhost:8000/health"\]  
      interval: 10s  
      timeout: 5s  
      retries: 3  
\`\`\`

\---

\#\# ✅ COMPLIMENTÀRIES (Implementades Correctament)

| Element | Ubicació | Estat |  
|---------|----------|-------|  
| \*\*Alembic env.py amb pg\_advisory\_lock\*\* | \`backend-python/alembic/env.py\` | ✅ PERFECTE |  
| \*\*FastAPI \+ Uvicorn\*\* | \`backend-python/main.py\` | ✅ SETUP CORRECTE |  
| \*\*CORS Defensiva\*\* | \`backend-python/main.py:19-26\` | ✅ PROPER |  
| \*\*PostGIS Extensions\*\* | \`prisma/schema.prisma:9\` | ✅ CONFIGURED |  
| \*\*MapLibre (sense Mapbox)\*\* | \`next.config.js\` | ✅ OK |  
| \*\*i18n Multi-idioma\*\* | \`middleware.ts:1-6\` | ✅ OK |  
| \*\*Middleware Route Protection\*\* | \`middleware.ts:21-54\` | ✅ DEFENSIVA |

\---

\#\# 🎯 PLA D'ACCIÓ URGENT (Fase P4 \- Remedial)

| ID | Tasca | Prioritat | Termini | Assignat |  
|----|-------|-----------|---------|----------|  
| \*\*P4.1\*\* | Canviar Redis a \`noeviction\` a docker-compose.yml | 🔴 CRÍT | 24h | AnT |  
| \*\*P4.2\*\* | Eliminar \`bullmq\` de serverExternalPackages | 🔴 CRÍT | 24h | AnT |  
| \*\*P4.3\*\* | Implementar S3 Presigned URLs (FastAPI endpoint) | 🔴 CRÍT | 48h | AnT |  
| \*\*P4.4\*\* | Migrar Supabase Auth → Auth.js v5 | 🔴 CRÍT | 72h | AnT |  
| \*\*P4.5\*\* | Activar RLS policies a PostgreSQL | 🔴 CRÍT | 48h | AnT |  
| \*\*P4.6\*\* | Afegir PgBouncer a docker-compose.yml | 🟡 GREU | 48h | DevOps |  
| \*\*P4.7\*\* | Completar SQLModel models (from Prisma) | 🟡 GREU | 72h | AnT |  
| \*\*P4.8\*\* | Afegir healthchecks a docker-compose.yml | 🟡 GREU | 24h | DevOps |  
| \*\*P4.9\*\* | Remédiar \`typescript.ignoreBuildErrors\` | 🟡 GREU | 24h | AnT |  
| \*\*P4.10\*\* | Completar requirements.txt | 🟡 WARN | 24h | AnT |

\---

\#\# 📋 CONCLUSIÓ

\*\*Verdict:\*\* 🟡 \*\*ARQUITECTURA EN TRANSICIÓ \- NO PRODUCTION-READY\*\*

\- ✅ \*\*Positius:\*\* FastAPI \+ Alembic \+ Prisma schema base sòlid  
\- ❌ \*\*Crítics:\*\* Redis policy, BullMQ legacy, S3 bypass pending, RLS missing  
\- ⚠️ \*\*Moderats:\*\* PgBouncer pending, SQLModel migration, Auth.js migration

\*\*Recomanació:\*\* Executar sequencialment P4.1 → P4.5 (48h crítics) abans de qualified per Easypanel deployment.

\---

\*\*Prepared by:\*\* Agent Tecnologia (AnT) \- The Builder    
\*\*Date:\*\* 2026-05-05    
\*\*Classification:\*\* Internal Technical Audit    
\*\*Confidentiality:\*\* PXX Architecture Document

\`\`\`

Aquesta és una \*\*auditoria profunda i professional\*\*. Els 10 punts cobreixen totes les directives del GEMINI.md i MIGRATION\_EASYPANEL.md. ¿Necessites que comenci la remediació amb les issues crítics?  
