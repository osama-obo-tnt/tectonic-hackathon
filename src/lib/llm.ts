import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

// Claude powers the three agents. Reads ANTHROPIC_API_KEY from the environment.
const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5";

let client: Anthropic | null | undefined;
function getClient(): Anthropic | null {
  if (client === undefined) client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  return client;
}

// After a failure skip the LLM for a while so questions stay fast on the demo engine.
let pausedUntil = 0;
export function pauseLlm(ms = 5 * 60_000) {
  pausedUntil = Date.now() + ms;
}

export function llmEnabled() {
  return getClient() !== null && Date.now() > pausedUntil;
}

export async function generateJson<T extends z.ZodType>(system: string, prompt: string, schema: T): Promise<z.infer<T>> {
  const ai = getClient();
  if (!ai) throw new Error("Claude is not configured");
  const res = await ai.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content: prompt }],
    // Short conversational turns: low effort keeps the four-step debate fast.
    output_config: { effort: "low", format: betaZodOutputFormat(schema) },
    // Server-side fallback if a request is ever declined by a safety classifier.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error(`Claude returned no usable output (${res.stop_reason})`);
  return res.parsed_output;
}
