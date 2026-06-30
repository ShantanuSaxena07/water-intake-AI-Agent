import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai'; // Or OpenAI depending on your setup

export async function POST(request) {
  try {
    const { userMessage } = await request.json();

    // 1. SYSTEM PROMPT DESIGNED TO TRAIN THE AI ON HYDRO-METRICS
    const systemPrompt = `
      You are the engine of HydroAgent AI. Your sole job is to read what a user drank or ate, calculate the net water/fluid content in milliliters (ml), and reply in JSON format.

      Use this standard fluid extraction chart for calculations:
      - 1 Cup of Regular Tea / Green Tea = 200ml of water
      - 1 Cup of Coffee = 150ml of water
      - 1 Glass of Juice / Milk = 250ml of water
      - 1 Can of Soda = 350ml of water
      - 1 Bowl of Soup / Broth = 200ml of water
      - 1 Cup of Watermelon / Hydrating Fruit = 140ml of water
      - 1 Cup of Salad / Cucumber / Tomatoes = 100ml of water

      Rules:
      1. If they say "drank a cup of tea", you must set action to "log" and amount_ml to 200.
      2. If they say "ate 2 cups of watermelon", calculate 2 * 140 = 280ml, set action to "log" and amount_ml to 280.
      3. If they want to fix a mistake like "remove 100ml", set action to "decrease" and amount_ml to 100.
      4. If they say "clear everything", set action to "reset" and amount_ml to 0.

      Respond ONLY in this exact raw JSON format, nothing else:
      {
        "action": "log" | "decrease" | "reset" | "none",
        "amount_ml": number,
        "ai_reply": "Short, friendly response telling them what water weight was extracted."
      }
    `;

    // 2. CALL YOUR MODEL WITH THE NEW INTELLIGENT SYSTEM PROMPT
    // (This example shows Gemini, but adapt the call to match your current imports)
    const aiResponse = await callYourAIModel({
      system: systemPrompt,
      prompt: userMessage
    });

    const parsedData = JSON.parse(aiResponse);
    return NextResponse.json(parsedData);

  } catch (error) {
    return NextResponse.json({ action: "none", amount_ml: 0, ai_reply: "Error parsing fluid log." }, { status: 500 });
  }
}