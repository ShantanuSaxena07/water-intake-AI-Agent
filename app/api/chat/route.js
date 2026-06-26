import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { userMessage } = await req.json();

    const waterSchema = {
      type: SchemaType.OBJECT,
      properties: {
        action: { 
          type: SchemaType.STRING, 
          // Added 'decrease' and 'reset' to the available actions
          enum: ["log", "decrease", "reset", "query", "unknown"],
          description: "Choose 'log' if they drank water, 'decrease' if they want to reduce/subtract water or made a mistake, 'reset' if they want to clear everything to zero, 'query' for generic questions, or 'unknown' for off-topic chats."
        },
        amount_ml: { 
          type: SchemaType.INTEGER, 
          description: "The volume of water to add or subtract, strictly in milliliters (ml). If the user says 'remove 500ml', set this to 500. For a total reset, set this to 0." 
        },
        ai_reply: { 
          type: SchemaType.STRING, 
          description: "A short, encouraging, 1-sentence conversational response confirming the specific change." 
        }
      },
      required: ["action", "amount_ml", "ai_reply"],
    };

    const model = ai.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: waterSchema,
      }
    });

    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      systemInstruction: "You are a precise health assistant data extractor. Look carefully at whether the user wants to add, subtract, or reset their water log. Always respond in the requested JSON structure.",
    });

    const resultJson = JSON.parse(response.response.text());
    return Response.json(resultJson);

  } catch (error) {
    console.error("Gemini Error:", error);
    return Response.json({ action: "unknown", amount_ml: 0, ai_reply: "Oops, my AI engine glitched. Try telling me again!" }, { status: 500 });
  }
}