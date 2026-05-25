import 'dotenv/config';
import OpenAI from 'openai';

async function testKimi() {
  console.log("Testing OpenRouter with Kimi K2...");
  console.log("Model:", process.env.AI_MODEL_ID);
  
  const openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  });

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL_ID || "moonshotai/kimi-k2",
      messages: [
        { role: "system", content: "Ets un assistent que parla català." },
        { role: "user", content: "Hola Kimi, confirma que estàs actiu per al Projecte Geocontent." }
      ],
    });

    console.log("Response from Kimi:");
    console.log(completion.choices[0]?.message?.content);
  } catch (error: any) {
    console.error("Error connecting to OpenRouter:", error.message);
  }
}

testKimi();
