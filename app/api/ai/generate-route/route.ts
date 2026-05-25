import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { auth } from '@/auth';
import { rateLimit } from '@/lib/services/ratelimit';
import { SECURITY_CONFIG } from '@/lib/config/constants';
const pdfParse = require('pdf-parse');

// Ometem la validació bloquejant de Prisma (AiUsageLog) per evitar l'error 500 si la taula no està llesta.

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "sk-placeholder",
  defaultHeaders: {
    "HTTP-Referer": process.env.SITE_URL || "https://projectexinoxano.com",
    "X-Title": "PXX Dashboard",
  },
});

export const maxDuration = 60; // Permite que la función dure hasta 60 segundos (para Vercel/Next.js)

export async function POST(req: Request) {
  try {
    // SEC-02: Auth guard — prevenir abús de quota d'IA
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'No autoritzat.' }, { status: 401 });
    }

    // SEC-04: Rate Limiting
    const { attempts, windowSeconds } = SECURITY_CONFIG.RATE_LIMITS.AI_GENERATE;
    const rl = await rateLimit(`ai:${session.user.id}`, attempts, windowSeconds);
    if (!rl.success) {
      return NextResponse.json({ success: false, error: 'Massa peticions. Espera un minut.' }, { status: 429 });
    }

    // 1. RECOLLIDA DE FITXER (FormData en lloc de JSON)
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No s'ha pujat cap document." }, { status: 400 });
    }

    // 2. BLINDATGE DE SEGURETAT (Directiva: Només PDF/TXT)
    if (file.type !== 'application/pdf' && file.type !== 'text/plain') {
      return NextResponse.json(
        { success: false, error: "Format no suportat. Només s'accepten documents de text (.txt) i PDF (.pdf). Les imatges i vídeos estan bloquejats." },
        { status: 415 }
      );
    }

    // Extracció del text del fitxer 
    let contextText = '';

    if (file.type === 'application/pdf') {
      // Conversió a Buffer per a pdf-parse
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const pdfData = await pdfParse(buffer);
      contextText = pdfData.text;
    } else {
      // Text pla
      contextText = await file.text();
    }

    // Neteja bàsica per estalviar tokens i soroll
    contextText = contextText.replace(/\n+/g, ' ').trim();

    // Limitamos el texto para no exceder el contexto del LLM y evitar timeouts
    const safeContext = contextText.substring(0, 15000);

    // 3. ENGINYERIA DE PROMPT ESTRICTA (STRICT GROUNDING)
    const systemPrompt = `
      Ets un expert en turisme, patrimoni cultural i natura. El teu rol és el d'un investigador que prepara material de treball per a un gestor de rutes turístiques humà.

      MISSIÓ: Analitza el text proporcionat i extreu TOTA la informació turísticament rellevant, organitzada i enriquida per facilitar la creació posterior de rutes. No crees la ruta: prepares la matèria primera perquè un humà la construeixi amb criteri.

      REGLES ABSOLUTES:
      - Inclou ÚNICAMENT informació present al text font. Cap invenció.
      - Si un camp no té dades al text, usa null. Mai inventes coordenades.
      - Extreu fins l'últim detall útil: dates, noms propis, xifres, anècdotes, personatges, connexions històriques.
      - El to ha de ser informatiu i atractiu, com una fitxa de treball professional.

      DESAGREGACIÓ DE POIs — REGLA CRÍTICA:
      Cada element patrimonial, museu, edifici o punt d'interès singular ha de ser un POI independent. No agrupis en un sol POI tot el que hi ha en un nucli de població. Un poble amb castell, església i museu genera 3 POIs separats. El nucli de població és el contenidor (camp "nucleus"), no el POI en si mateix.

      ASSIGNACIÓ DE CATEGORIES — REGLES ESTRICTES:
      - "patrimoni_civil": castells, fortificacions, cases senyorials, museus de memòria, centres històrics, espais civils de qualsevol tipus.
      - "patrimoni_religiós": exclusivament esglésies, ermites, monestirs i elements de culte religiós.
      - "etnografia": museus i espais vinculats a oficis, cultura popular, tradicions i modos de vida tradicionals.
      - "natura": espais naturals, rutes de paisatge, elements geogràfics destacats.
      - "gastronomia": productors artesans, mercats, espais de cultura alimentària.
      - "museus": museus temàtics no etnogràfics ni de memòria.
      - "esport": espais o infraestructures per a activitats esportives o d'aventura.
      - "altres": qualsevol element que no encaixi clarament en les categories anteriors.

      Retorna NOMÉS un JSON vàlid amb aquesta estructura, sense markdown ni text addicional:

      {
        "territory": {
          "name": "Nom del territori o comarca",
          "context": "Resum del caràcter del territori: geografia, història, identitat. Extret del text (max 400 caràcters)",
          "suggested_themes": [
            "Llista de temàtiques de ruta possibles detectades al text: patrimoni romànic, rutes literàries, etnografia pastoral, etc."
          ]
        },
        "pois": [
          {
            "id": "slug-unic-del-lloc",
            "title": "Nom exacte i específic de l'element patrimonial o punt d'interès, no del poble",
            "nucleus": "Poble o nucli al qual pertany",
            "category": "patrimoni_religiós | patrimoni_civil | natura | etnografia | gastronomia | museus | esport | altres",
            "status": "habitat | semiabandonat | despoblat | ruina",
            "altitude_m": null,
            "coordinates_available": false,
            "historical_period": "Segle o època si consta al text",
            "description": "Descripció rica i atractiva basada estrictament en el text. Inclou: valor patrimonial, anècdota o fet singular, context històric, estat actual si consta (min 200, max 400 caràcters)",
            "unique_facts": [
              "Fet o dada singular extreta del text que el diferencia d'altres elements similars. No repeteixis informació ja present a description. Si no hi ha cap fet singular al text, usa []."
            ],
            "connections": "Connexió amb altres POIs del document, personatges o esdeveniments si el text ho indica. Null si no n'hi ha.",
            "visitor_potential": "alt | mitjà | baix",
            "visitor_potential_reason": "Una frase que justifica la valoració. Si és baix, indica què caldria per millorar-la.",
            "raw_data_gaps": [
              "Informació concreta que seria necessària per publicar aquest POI i que no apareix al text"
            ]
          }
        ],
        "notable_figures": [
          {
            "name": "Nom del personatge",
            "connection": "Vincle amb el territori segons el text"
          }
        ],
        "route_building_notes": {
          "top_pois": [
            "Llista dels 3 POIs amb major potencial turístic i una frase explicant per què"
          ],
          "suggested_combinations": [
            {
              "theme": "Nom de la temàtica",
              "poi_ids": ["id-poi-1", "id-poi-2", "id-poi-3"],
              "rationale": "Per què aquests POIs formen una ruta coherent i atractiva"
            }
          ],
          "not_ready_to_publish": [
            {
              "poi_id": "id-del-poi",
              "missing": "Què falta concretament per poder-lo publicar"
            }
          ],
          "accessibility_warnings": [
            "Advertències sobre accessibilitat, estat d'abandonament o condicions especials que constin al text. Null si no n'hi ha."
          ]
        }
      }
    `;

    // 4. GENERACIÓ (OpenRouter)
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL_ID || "qwen/qwen-2.5-72b-instruct",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analitza aquest document municipal i crea la ruta. Document: ${safeContext}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // Temperatura baixa per a màxim determinisme
    });

    const rawContent = completion.choices[0].message.content || "{}";

    // Neteja per seguretat per si l'LLM afegeix markdown trencant el JSON
    const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    const sanitizedData = JSON.parse(cleanJson);

    return NextResponse.json({ success: true, data: sanitizedData });

  } catch (error: any) {
    console.error("AI Route Fatal Error:", error);
    // GARANTIZAMOS QUE EL ERROR SEA JSON Y NO HTML
    return new Response(
      JSON.stringify({ success: false, error: "Error interno procesando el documento: " + (error.message || "Fallo desconocido") }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
