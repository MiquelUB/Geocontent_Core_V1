# Informe de Resolució d'Errors (Bugfixes) - Agost 2026

Aquest document recull l'historial d'errors tractats i solucionats durant les recents sessions de manteniment relacionades amb la integració d'OmniVoice, el panell d'administració (ManualPoiForm) i la gestió de mitjans a S3.

---

## 1. Traducció de Vídeos i Polling (Roda "Atascada")

**Símptomes reportats:**
- La traducció del vídeo es quedava bloquejada ("no avança").
- Els vídeos ja traduïts mostraven errors de `OpaqueResponseBlocking` per consola al reproductor.
- Errors de `TypeError: Error in input stream` i `Failed to find Server Action` durant el procés de traducció.
- S'intentava traduir vídeos des d'URLs temporals (`blob:http...`) abans de guardar.

**Causes i Solucions aplicades:**
- **Estats de React desactualitzats:** El component Client `ManualPoiForm` utilitzava `router.refresh()` cada 5 segons per buscar l'estat de la traducció. Tanmateix, com que es trobava dins d'un diàleg controlat per `RoutePoiManager`, les dades (`poi`) mai s'actualitzaven a la interfície.
- **Sobrecàrrega del Input Stream de Next.js:** Inicialment es va arreglar fent que el Client demanés el POI sencer a la base de dades, però això va causar el `Error in input stream`. **Solució:** Es va implementar la funció `getPoiTranslations`.
- **Desincronització de Desplegament:** En fer un nou *deploy* mentre la pestanya estava oberta, Next.js donava error de Server Action invàlida. **Solució:** Forçar `window.location.reload()`.

---

## 2. Generació d'Audioguies (IA) i MP3 invisibles

**Símptomes reportats:**
- Al fer clic al botó d'Audioguies IA, no s'arribaven a mostrar els reproductors per comprovar l'àudio.

**Causes i Solucions aplicades:**
- **Errors d'ACL a Amazon S3:** El worker de Python (`worker.py`) utilitzava l'atribut `ACL='public-read'`, el qual fallava per les polítiques de seguretat actuals d'AWS. **Solució:** Eliminar la directiva ACL.
- **Indicadors Visuals (Spinners):** S'ha inclòs l'estat de la generació d'àudio al sistema visual per mostrar quan s'està processant.

---

## 3. Visualització (Disseny) dels Noms d'Arxiu de Vídeo

**Símptomes reportats:**
- Al carregar un POI existent o afegir un nou vídeo, la graella d'arxius mostrava noms amb prefixos de UUIDs llarguíssims o espais en blanc.

**Causes i Solucions aplicades:**
- **Solució de UI:** Es va modificar la renderització a `ManualPoiForm.tsx` (parseS3Filename) per netejar el nom visualment amputant el UUID (36 caràcters) utilitzant expressions regulars.

---

## 4. Silenci al Botó de Traducció ("Ghost Clicks")

**Símptomes reportats:**
- L'usuari seleccionava un vídeo i en prémer traduir el botó no feia absolutament res (l'arxiu no s'enviava enlloc ni saltava la càrrega).

**Causes i Solucions aplicades:**
- **Trampa del Input File d'HTML:** Si l'usuari testejava pujant el mateix arxiu consecutivament, el navegador bloquejava l'esdeveniment `onChange`. **Solució:** Buidar programàticament la memòria de l'input (`e.target.value = ''`).
- **Stale Closures a l'actualització d'estat:** React trepitjava les matrius d'estat a causa de les operacions asíncrones llargues. **Solució:** Ús de funcions modificadores prèvies (`setVideoSlots(prev => ...)`).

---

## 5. (ACTUAL) "Efecte Forat Negre" a la cua de processament

**Símptomes reportats:**
- Després d'un *force deploy*, en clicar a "Traduir" l'acció s'executa amb èxit al Next.js (`success: true, message: "Traducció de vídeo encuada correctament."`), el botó passa a "PROCESSANT...", però **mai arriba a traduir-se**.

**Anàlisi Arquitectònic de l'Error:**
El flux actual obliga a fer moltes passes fràgils:
1. *Next.js Front* crida el *Next.js Backend*.
2. *Next.js Backend* escriu a la taula `outbox_events` (PostgreSQL).
3. *Python Worker* fa un *polling* cada 5 segons llegint tota la taula PostgreSQL per pescar tasques.
4. *Python Worker* actualitza PostgreSQL en acabar.
5. *Next.js Backend* (ruta d'events SSE) fa un altre *polling* cada 3 segons a la taula `pois`.
6. L'EventSource del navegador actualitza l'estat.

**El coll d'ampolla:** Amb un proxy com Nginx per davant (Easypanel), les connexions persistents (SSE) sovint es tallen per temps d'espera (timeouts) o pateixen buffering. A més, dependre de dos sistemes fent *polling* en bucle a la mateixa base de dades provoca bloquejos de lectura/escriptura (race conditions) on el Python Worker pot no estar agafant la fila per problemes de bloqueig transaccional o latència, i el front pot perdre's el canvi de la base de dades.

---

## PROPOSTA DE REPARACIÓ DEFINITIVA (Visió àmplia sense programar)

Després de fer tombs amb petites modificacions, la causa arrel és una **sobre-enginyeria en la comunicació asíncrona**. Per tenir un sistema robust i 100% fiable a Easypanel s'ha d'eliminar la bústia de base de dades i les connexions SSE fràgils.

**Nou Flux d'Arquitectura Directa:**

1. **Eliminar el Outbox Pattern a la base de dades:**
   Next.js ha de parlar directament amb Redis o amb l'API del Worker (FastAPI). En comptes d'escriure a PostgreSQL i pregar que el Python ho llegeixi, l'acció de servidor del Next.js ha de fer un `Redis.lpush('cua_traduccions', dades)`. És instantani i no satura la base de dades de l'aplicació.

2. **Substituir el Server-Sent Events (SSE) per un "Client Polling" elegant:**
   El protocol SSE és bonic però molt fràgil a darrere d'Nginx. La solució a prova de bales és que el client React (`ManualPoiForm`), un cop posi l'estat a `PROCESSANT...`, executi internament un senzill `setInterval` de 4 segons fent un `fetch('/api/pois/[id]/status')`. 
   - Avantatges: El navegador gestiona la petició HTTP normal. No hi ha desconnexions silencioses. No hi ha buffering del proxy. Quan el JSON retorna que hi ha dades noves, s'atura el bucle i es refresca el component.

3. **Independència del Worker de Python:**
   El Python Worker només escoltarà les llistes de Redis (que està dissenyat exactament per això) en comptes de fer queries pesades tipus `SELECT ... FOR UPDATE SKIP LOCKED` a PostgreSQL. En acabar, només farà l'escriptura final del camp `video_translations`.

*Aquesta reducció de complexitat eliminarà de cop totes les variables (bloquejos de base de dades, connexions penjades de Vercel/Easypanel i retards d'actualització), creant un botó de "Traduir" totalment reactiu i predictible.*
