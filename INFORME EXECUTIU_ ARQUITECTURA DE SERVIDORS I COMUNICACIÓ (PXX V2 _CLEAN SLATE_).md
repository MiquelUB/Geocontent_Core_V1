

**INFORME EXECUTIU: ARQUITECTURA DE SERVIDORS I COMUNICACIÓ (PXX V2 "CLEAN SLATE")**

Com a CEO de Projecte Xino Xano, presento l'estructura definitiva de la nostra infraestructura. Aquest disseny garanteix la sobirania tecnològica, l'escalabilitat institucional i la protecció del nostre marge operatiu (70% en fase beta, 94% a ple rendiment). Hem aplicat una política estricta de "Separació de Poders": el cervell no fa tasques musculars.

A continuació es detalla la topologia i el flux de comunicació entre els serveis interns (gestionats dins d'Easypanel/Hetzner) i els serveis externs.

### ---

**1\. NUCLI INTERN: EL "CERVELL" (Integrat a Easypanel / Servidor Hetzner)**

Aquest és el nostre servidor principal (*Shared* 2vCPU / 4GB RAM). Tots els recursos aquí estan blindats amb límits estrictes via Docker per evitar que un coll d'ampolla faci caure el sistema sencer per a tots els ajuntaments.

* **Frontend & BFF (Next.js 15+):** Serveix la interfície d'usuari (PXX Studio i PWA mòbil) i gestiona l'autenticació "Humanitzada" amb Auth.js v5 (Magic Links). S'encarrega d'encaminar les peticions del client cap a l'API de dades.  
* **API Core (Python / FastAPI):** El veritable "Cervell" de dades (capat a 512MB). Gestiona tota la lògica de negoci, les validacions i les rutes. És l'únic component que interactua de manera directa d'escriptura/lectura amb la base de dades.  
* **Base de Dades (PostgreSQL \+ PostGIS):** (Capada a 1.5GB). Emmagatzema metadades, coordenades, títols, textos i la lògica del Passaport. Obligatòriament utilitza *Row Level Security (RLS)* per segregar les dades de cada diputació o ajuntament.  
* **Broker de Cues (Redis):** (Capat a 256MB). Funciona com el sistema nerviós de l'arquitectura. Comunica l'API Core (interna) amb els Workers (externs) per a tasques asíncrones.  
* **Vector Tile Server (MapLibre / OSM):** El pilar de la nostra "Sobirania Digital". Serveix els paquets de mapes territorials (sempre \<30MB per municipi) directament als usuaris finals per garantir que l'App funciona *Offline-First* als boscos i nuclis antics. No parla amb l'API, només serveix fitxers vectorials de mapa.

### **2\. INFRAESTRUCTURA EXTERNA: EL "MÚSCUL" (Fora d'Easypanel / Hetzner)**

Tot el que exigeix càlcul intensiu o emmagatzematge massiu queda estrictament fora del nostre servidor Hetzner per no asfixiar-lo.

* **Emmagatzematge Cloud Sbirà (AWS S3 o equivalent compatible):**  
  * **Funció:** Emmagatzemar el pes de la "Capa Sensorial" (fotos històriques, vídeos i àudios immersius).  
  * **Comunicació:** L'API Core de FastAPI (a Hetzner) signa i autoritza les pujades, però el client (el tècnic municipal pujant dades o l'usuari descarregant el *Snack*) es comunica **directament** amb l'S3. Fem *bypass* complet del disc local de l'Hetzner. Cost limitat a \~30€/any per client.  
* **Worker de Processament i Multimèdia (Python \+ FFmpeg via ARQ/Celery):**  
  * **Funció:** Transcodificació de vídeo a formats adaptatius (HLS / .m3u8) i compressió d'àudio (AAC) per als "Punts d'Or".  
  * **Comunicació:** Aquest servidor/worker extern està contínuament escoltant el **Redis** allotjat a l'Hetzner. Quan un Ajuntament puja un vídeo pesat, l'API posa un missatge a Redis. El Worker extern llegeix la tasca, descarrega el vídeo cru des de l'S3, el processa utilitzant la seva pròpia CPU/RAM (mai la de l'Hetzner), puja el resultat segmentat a l'S3, i avisa a l'API Core que la tasca està acabada.  
* **Motor d'Intel·ligència Artificial (API Externa / Tokens IA):**  
  * **Funció:** La màgia darrere de la productivitat del funcionari (Pantalla Partida). Redacta relats a partir de PDFs i genera automàticament els Quizzes (manual i final) per a la gamificació del passaport.  
  * **Comunicació:** L'API Core (FastAPI) es comunica via HTTP amb l'API del proveïdor d'IA, processa el text resultant, i l'injecta estructurat al PostgreSQL. Cost vigilat de \~20€/any.

---

**Cita:** *Directiva Técnica Maestra:CTO\_7*, *Hoja de Ruta Estratégica: CEO\_7*, *Hoja de ruta para CFO\_7*, *DOCUMENT 2: ESPECIFICACIONS TÈCNIQUES* i acords tècnics recents (Historial de converses V2 "Clean Slate").

**Acció:**

* **AGENT TECNOLOGIA (The Builder):** Configura les regles CORS de FastAPI i els rols IAM/Polítiques de l'S3 extern per garantir que els uploads directes (bypass) funcionin des de Next.js (Easypanel) sense bloquejos de seguretat. Verifica que l'ARQ del Worker extern pugui connectar-se al port del Redis intern d'Easypanel amb la contrasenya correcta i de forma xifrada.  
* **AGENT FINANCER (The Guardian):** Audita i monitoritza mensualment les factures de l'S3 i del proveïdor del Worker extern (on resideix FFmpeg) per assegurar-nos que els costos variables respecten el marge del 70% durant aquesta fase de llançament.