import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/generative-ai';

export async function POST(request) {
  try {
    const { userMessage } = await request.json();

    if (!userMessage) {
      return NextResponse.json({ action: "none", amount_ml: 0, ai_reply: "I didn't receive any message." }, { status: 400 });
    }

    // 1. INITIALIZE THE GOOGLE GEN AI CLIENT
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        action: "none", 
        amount_ml: 0, 
        ai_reply: "API Key Configuration Missing. Please add GEMINI_API_KEY to environment variables." 
      }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // 2. COMPREHENSIVE RE-CALIBRATED FLUID CONVERSION DATA MATRIX
    const systemPrompt = `
      You are the backend parsing conversion engine of HydroAgent AI. Your sole job is to interpret what a user drank or ate, calculate the net water/fluid content in milliliters (ml), and reply strictly in valid JSON format.

      Use this standard biological fluid extraction chart for references:
      - 1 Cup of Regular Tea / Green Tea = 200ml of water equivalence
      - 1 Cup of Coffee = 150ml of water equivalence
      - 1 Glass of Juice / Milk = 250ml of water equivalence
      - 1 Can of Soda = 350ml of water equivalence
      - 1 Bowl of Soup / Broth = 200ml of water equivalence
      - 1 Cup of Watermelon / Strawberries / Grapefruit = 140ml of water equivalence
      - 1 Cup of Salad / Cucumber / Tomatoes / Celery = 100ml of water equivalence

      Rules:
      1. If the user logs an item from the reference chart (e.g., "i drank a cup of tea"), map it to the respective ml value, set action to "log", and populate amount_ml.
      2. If they log multiple portions (e.g., "ate 2 cups of watermelon"), calculate the total fluid yield (2 * 140 = 280), set action to "log", and set amount_ml to 280.
      3. For items not explicitly on the list, estimate their approximate water composition accurately based on standard nutritional value guidelines.
      4. If they request to fix an entry error (e.g., "remove 150ml" or "decrease by 200ml"), set action to "decrease" and populate amount_ml.
      5. If they say "clear everything" or "reset today", set action to "reset" and set amount_ml to 0.
      6. If they are just talking normally or asking a question that doesn't involve adding/removing fluids, set action to "none" and set amount_ml to 0.

      Respond ONLY in this exact raw JSON format, without markdown formatting blocks, without backticks (\`\`\`json), and without prose:
      {
        "action": "log" | "decrease" | "reset" | "none",
        "amount_ml": number,
        "ai_reply": "A concise, elegant notification string detailing the exact water volume extracted from their food/beverage input."
      }
    `;

    // 3. EXECUTE THE GENERATIVE MODEL UNDER SAFE EXECUTION BOUNDS
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2, // Low temperature enforces strict rule following and consistent JSON outputs
        responseMimeType: 'application/json'
      }
    });

    const replyText = response.text;

    // 4. CLEAN AND PARSE THE INCOMING METRIC MAP
    let parsedData;
    try {
      parsedData = JSON.parse(replyText.trim());
    } catch (parseError) {
      console.error("Failed parsing raw text stream to structured JSON:", replyText);
      return NextResponse.json({ 
        action: "none", 
        amount_ml: 0, 
        ai_reply: "I understood your entry, but had a small processing error. Mind telling me again?" 
      });
    }

    return NextResponse.json(parsedData);

  } catch (error) {
    console.error('API Chat Route Engine Crash:', error.message);
    return NextResponse.json({ 
      action: "none", 
      amount_ml: 0, 
      ai_reply: "System pipeline latency detected. Try sending your entry again." 
    }, { status: 500 });
  }
}