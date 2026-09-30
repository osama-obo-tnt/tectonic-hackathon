import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { llmEnabled } from "@/lib/llm";
import { rateLimit } from "@/lib/ratelimit";
import { analysesFor, saveAnalysis } from "@/lib/store";
import { translateResult } from "@/lib/translate";
import type { AskResult, Language } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({ language: z.enum(["en", "nl", "fr"]) });

// Translations of each user's analyses, so switching back and forth is instant.
const cache = new Map<string, AskResult>();
const cacheKey = (userId: string, r: AskResult, lang: Language) => `${userId}|${r.clientId}|${r.question}|${lang}`;

/** Translates the signed-in user's latest analysis. Only ever touches the caller's own data. */
export async function POST(req: NextRequest) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  const limited = rateLimit(`translate:${user.id}`, 10, 60_000);
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { language } = parsed.data;

  const latest = analysesFor(user.id)[0];
  if (!latest) return NextResponse.json({ error: "No analysis to translate" }, { status: 404 });
  if (latest.language === language) return NextResponse.json({ result: latest });

  // Remember the version we translate from, so every language maps back to the same analysis.
  cache.set(cacheKey(user.id, latest, latest.language), latest);
  let translated = cache.get(cacheKey(user.id, latest, language));
  if (!translated) {
    if (!llmEnabled()) return NextResponse.json({ error: "Translation needs the Claude agents to be configured" }, { status: 503 });
    try {
      translated = await translateResult(latest, language);
    } catch (err) {
      console.error("translate failed", err instanceof Error ? err.message : err);
      return NextResponse.json({ error: "Translation failed" }, { status: 502 });
    }
    cache.set(cacheKey(user.id, latest, language), translated);
  }
  saveAnalysis(user.id, translated);
  return NextResponse.json({ result: translated });
}
