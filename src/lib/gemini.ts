import "server-only";
import { GoogleGenAI } from "@google/genai";

// Gemini on Vertex AI, authenticated with Application Default Credentials (no API key).
let client: GoogleGenAI | null | undefined;

function getClient(): GoogleGenAI | null {
  if (client !== undefined) return client;
  client = process.env.GOOGLE_CLOUD_PROJECT
    ? new GoogleGenAI({
        vertexai: true,
        project: process.env.GOOGLE_CLOUD_PROJECT,
        location: process.env.GOOGLE_CLOUD_LOCATION ?? "us-east1",
      })
    : null;
  return client;
}

export function geminiEnabled() {
  return getClient() !== null;
}

export async function generateJson<T>(system: string, prompt: string, schema: object): Promise<T> {
  const ai = getClient();
  if (!ai) throw new Error("Gemini is not configured");
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      temperature: 0.6,
    },
  });
  const text = res.text;
  if (!text) throw new Error("Empty response from Gemini");
  return JSON.parse(text) as T;
}
