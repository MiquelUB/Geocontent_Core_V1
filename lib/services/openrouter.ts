import OpenAI from 'openai';

let openRouter: OpenAI | null = null;

function getOpenRouter() {
  if (!openRouter) {
    openRouter = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY || 'sk-placeholder', // Prevent SDK from throwing "Missing credentials"
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://geocontent.app',
        'X-Title': 'Geocontent',
      },
    });
  }
  return openRouter;
}

export async function generateExecutiveSummary(data: any, municipalityName: string = "el territori"): Promise<string> {
  try {
    const client = getOpenRouter();

    // Safety check for empty or near-empty data
    const isActive = data.metrics.users.active > 0;

    const systemPrompt = `Ets un consultor de turisme digital expert i analista de dades per a "Geocontent".
L'objectiu és redactar un "Resum Executiu de l'Impacte Turístic" per a l'Alcalde de ${municipalityName}.

REQUISITS DE CONTINGUT:
1. Analitza les mètriques: Usuaris actius, rutes completades i èxit als reptes (quizzes).
2. Si hi ha poques dades (per exemple, només 1-5 usuaris), has de ser transparent: indica que l'informe és preliminar i que s'espera un creixement de dades a mesura que la plataforma es difongui.
3. El text ha de mencionar explícitament el nom del municipi (${municipalityName}) per donar-li un to oficial i personalitzat. No usis placeholders com "[Nom del municipi]".
4. To: Institucional, professional, optimista però realista.
5. Idioma: Català.
6. Extensió: 3-4 paràgrafs ben estructurats.
7. Valor afegit: Proposa una acció concreta si els resultats són baixos (ex: millorar la senyalització física dels punts).

Dades actuals de ${municipalityName}:
- Usuaris actius: ${data.metrics.users.active}
- Total rutes completades: ${data.metrics.routesCompleted.value}
- Taxa d'èxit en reptes: ${data.metrics.quizStats.value}%
- Abandonament: ${data.metrics.abandonmentRate.value}%
- Punts d'interès amb més activitat: ${data.metrics.quizStats.details.slice(0, 3).map((d: any) => d.title).join(", ")}
`;

    const completion = await client.chat.completions.create({
      model: process.env.AI_MODEL_ID || "google/gemini-2.0-flash-001", // Using a better model if available
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: isActive
            ? "Genera el resum executiu basat en les dades proporcionades."
            : "ADVERTÈNCIA: Tenim molt poques dades encara. Genera un text que ho reflecteixi però que expliqui el valor de començar a mesurar aquestes interaccions."
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    return completion.choices[0]?.message?.content || "No s'ha pogut generar el resum. Per favor, contacteu amb suport tècnic.";
  } catch (error) {
    console.error("Error generating executive summary:", error);
    return "S'ha produït un error en connectar amb el motor d'IA. L'analítica està disponible als gràfics inferiors.";
  }
}

/**
 * GEOCONTENT QUIZ GENERATION MOTOR
 */

export async function generatePoiQuiz(title: string, content: string, type: string) {
  try {
    const client = getOpenRouter();

    let tone = "informatiu";
    if (type === 'GUERRA_CIVIL') tone = "respectuós i històric";
    else if (type === 'LLEGENDA') tone = "místic";

    const systemPrompt = `Ets l'expert en patrimoni de Geocontent. Genera un quiz de 3 opcions basat ÚNICAMENT en el text proporcionat. No inventis dades visuals. La resposta ha de ser deduïble pel text o l'àudio.
Si el punt és 'Guerra Civil', el to ha de ser respectuós i històric.
Si el punt és 'Llegenda', el to ha de ser místic. Actualment el to és: ${tone}.
Format JSON: { "pregunta": "...", "opcions": ["A", "B", "C"], "correcta": 0 }`;

    const completion = await client.chat.completions.create({
      model: process.env.AI_MODEL_ID || "google/gemini-2.0-flash-001",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Punt: ${title}\nContingut: ${content}` }
      ],
      temperature: 0.3,
    });

    let resultText = completion.choices[0]?.message?.content || "{}";
    const match = resultText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match) resultText = match[1];

    return JSON.parse(resultText);
  } catch (error) {
    console.error("Error generating poi quiz:", error);
    return null;
  }
}

export async function generateFinalRouteQuiz(routeName: string, poisData: { title: string, content: string }[]) {
  try {
    const client = getOpenRouter();

    const context = poisData.map(p => `[Punt: ${p.title}] ${p.content}`).join("\n\n");

    const systemPrompt = `Ets l'expert en patrimoni de Geocontent. Genera el "Repte Final" que tanca la ruta "${routeName}". Ha de ser un quiz transversal de 5 preguntes diferents i originals que analitzi o connecti diversos punts de la ruta basant-se ÚNICAMENT en el contingut proporcionat.
Les preguntes HAN DE SER NOVES, no copiïs possibles preguntes individuals de cada punt.
Format JSON EXACTE: { "preguntes": [ { "pregunta": "...", "opcions": ["A", "B", "C"], "correcta": 0 }, ... ] }`;

    const completion = await client.chat.completions.create({
      model: process.env.AI_MODEL_ID || "qwen/qwen-2.5-72b-instruct",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Context de la ruta:\n${context}` }
      ],
      temperature: 0.5,
    });

    let resultText = completion.choices[0]?.message?.content || "{}";
    const match = resultText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match) resultText = match[1];

    return JSON.parse(resultText);
  } catch (error) {
    console.error("Error generating final route quiz:", error);
    return null;
  }
}
