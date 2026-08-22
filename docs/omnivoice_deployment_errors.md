# Registre d'Errors i Solucions - Integració OmniVoice (Desplegament)

Aquest document resumeix la cadena d'errors crítics ocorreguts durant el desplegament de la integració OmniVoice a Easypanel (Next.js + Prisma + PgBouncer) i les lliçons apreses per evitar que es torni a repetir.

## 1. Problema de connexió de Prisma amb PgBouncer (Penjades)
*   **Símptoma:** Al afegir el `@prisma/adapter-pg` per donar suport a l'Edge Runtime de Next.js, les consultes a la base de dades es penjaven indefinidament al desplegar-se a Easypanel (utilitzant PgBouncer).
*   **Arrel:** L'adaptador `pg` de Prisma en modes transaccionals no allibera correctament les connexions a través del pooler PgBouncer, provocant un exhauriment de les connexions (`connection leak`).
*   **Solució adoptada inicialment:** Eliminar completament l'adaptador `pg` i revertir a l'ús del motor natiu de Prisma (`engineType="library"`).

## 2. Error de Constructor de Prisma (`PrismaClientConstructorValidationError`)
*   **Símptoma:** Al eliminar la dependència `@prisma/adapter-pg`, l'aplicació llançava en temps d'execució: `Using engine type "client" requires either "adapter" or "accelerateUrl"`.
*   **Arrel:** Les versions 6/7 de Prisma tenen comportaments de generació de memòria cau que persisteixen en la configuració del client generat. Com que l'adaptador havia estat prèviament instal·lat o detectat, el client es generava esperant rebre'l en el constructor, tot i no figurar a la base del codi.
*   **Solució:** Forçar explícitament `engineType = "library"` dins de l'arxiu `schema.prisma` per denegar absolutament qualsevol inferència d'adaptadors de client durant l'etapa `prisma generate`.

## 3. Fallida de construcció de Docker per mòduls desapareguts
*   **Símptoma:** El procés de compilació d'Easypanel fallava a la fase de creació de la imatge Docker amb l'error `failed to compute cache key: "/app/node_modules/split2": not found`.
*   **Arrel:** El `Dockerfile` tenia línies `COPY` explícites per als submòduls de la llibreria `pg` (per optimitzar el contenidor standalone). A l'haver desinstal·lat `pg` del `package.json` durant la resolució del problema anterior, Docker no trobava els fitxers per copiar.
*   **Solució:** Restaurar la instal·lació de `pg` com a dependència només per als scripts de migració que ho necessitaven, mantenint el motor natiu de Prisma actiu.

## 4. Errors persistents de la Memòria Cau de Docker
*   **Símptoma:** Després de reescriure el fitxer `run_migration.js` per no utilitzar `pg`, l'error de Node.js en arrencar continuava mostrant exactament el mateix número de línia del codi antic (ex: `/app/run_migration.js:1:20`), malgrat haver empès la solució a Github.
*   **Arrel:** El mecanisme de memòria cau (Build Cache) de Docker/Buildkit dins l'entorn d'Easypanel estava ignorant les actualitzacions d'aquests fitxers al fer el `COPY . .`.
*   **Solució:** Introduir un comentari `CACHE BUSTER` al principi del `Dockerfile` per obligar a Easypanel a iniciar una construcció completament neta (from scratch) i ignorar totes les capes anteriors.

## Conclusions i Acció presa
Totes les complexitats es van derivar d'un efecte dominó començat per l'intent de fer que Prisma funcionés a l'Edge Runtime amb l'adaptador PG dins d'un ecosistema protegit per PgBouncer. 
Per seguretat arquitectònica, s'ha decidit **fer un rollback complet (git reset --hard)** a l'estat anterior de començar les tasques d'OmniVoice, descartant totes les complexitats per poder replantejar la funcionalitat des d'una base neta i lliure d'efectes secundaris.
