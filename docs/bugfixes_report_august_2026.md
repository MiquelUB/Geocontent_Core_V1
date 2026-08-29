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
- **Sobrecàrrega del Input Stream de Next.js:** Inicialment es va arreglar fent que el Client demanés el POI sencer a la base de dades, però això va causar el `Error in input stream` perquè Next.js col·lapsava intentant serialitzar l'objecte complet del POI (que conté dates i relacions complexes) tantes vegades. **Solució:** Es va implementar la funció `getPoiTranslations` que només descarrega els dos diccionaris estrictament necessaris.
- **Desincronització de Desplegament (Server Actions):** En fer un nou *deploy* a Vercel mentre la pestanya de l'usuari estava oberta fent *polling*, Next.js donava error de Server Action invàlida per incompatibilitat de versions. **Solució:** Afegit un sistema de captura que força un `window.location.reload()` automàticament per purgar l'error.
- **Protecció de Blobs:** Es va afegir una validació per blocar el botó de traducció si l'arxiu té una adreça local tipus `blob:`, informant l'usuari que ha de guardar primer.

---

## 2. Generació d'Audioguies (IA) i MP3 invisibles

**Símptomes reportats:**
- Al fer clic al botó d'Audioguies IA, no s'arribaven a mostrar els reproductors per comprovar l'àudio (no es generaven els mp3).
- Confusió sobre si l'aplicació permetia traduir arxius MP3 pujats manualment.

**Causes i Solucions aplicades:**
- **Errors d'ACL a Amazon S3:** El worker de Python (`worker.py`) utilitzava l'atribut `ACL='public-read'` en pujar els àudios de la IA cap a AWS. Aquesta directiva petava amb "Access Denied" ja que les polítiques modernes de seguretat dels *buckets* S3 ("Bucket Owner Enforced") tenen les llistes d'accés bloquejades per defecte. **Solució:** Es va eliminar la directiva ACL, permetent una pujada neta.
- **Indicadors Visuals (Spinners):** S'ha inclòs també l'estat de la generació d'àudio al sistema de *polling* perquè la interfície mostri clarament quan s'està processant la veu.
- **Aclariment d'Usuari:** El botó "Audioguies IA" converteix text a veu i ho tradueix. No hi ha cap funció programada per processar arxius MP3 personals pujats des de l'ordinador. L'usuari ha de fer servir el generador a partir del text del POI.

---

## 3. Visualització (Disseny) dels Noms d'Arxiu de Vídeo

**Símptomes reportats:**
- Al carregar un POI existent o afegir un nou vídeo, la graella d'arxius (slots) mostrava noms completament indesxifrables (amb prefixos de UUIDs llarguíssims) o bé es mostraven els camps buits.
- L'usuari perdia la pista de quin vídeo havia pujat o de quin vídeo calia traduir.

**Causes i Solucions aplicades:**
- Quan un fitxer es puja a S3, el sistema li adjunta una clau criptogràfica (UUID v4) al nom de l'arxiu per evitar col·lisions (`[uuid]_nom_del_video.mp4`).
- **Solució de UI:** Es va modificar la renderització a `ManualPoiForm.tsx` (secció de Vídeos Reel). Ara el codi llegeix el nom intern de l'URL, en detecta el patró d'UUID mitjançant expressions regulars (`/^[0-9a-f]{8}-..._/i`), i l'amputa del string visible. També dona prioritat sempre al nom real del fitxer local (`slot.file.name`) si s'acaba d'adjuntar. Ara els noms es veuen completament nets a l'apartat visual.

---

## 4. Errors Crítics de Navegació i Entorn (Login)

**Símptomes reportats:**
- Error fatal a la pàgina de POIs en fer accions determinades: `ReferenceError: router is not defined 1255-d3668eefd1b4a69b.js:1:109994`.

**Causes i Solucions aplicades:**
- Al migrar a Next.js App Router (o per descuit de refactorització prèvia), s'havien deixat instruccions com `router.push()` sense instanciar prèviament la constant al capdamunt del component Client.
- **Solució:** Es va importar adequadament el *hook* (`import { useRouter } from 'next/navigation'`) i instanciar dins de `ManualPoiForm`, recuperant el cicle de vida natural del sistema de React.
