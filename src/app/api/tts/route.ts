import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { elevenEnabled, textToSpeech } from "@/lib/elevenlabs";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const Body = z.object({
  text: z.string().trim().min(1).max(1500),
  voice: z.enum(["narrator", "scout", "critic", "arbiter"]),
});

export async function POST(req: NextRequest) {
  const { user, error } = await requireApiUser();
  if (error) return error;
  if (!elevenEnabled()) return NextResponse.json({ error: "Voice is not configured" }, { status: 503 });

  const limited = rateLimit(`tts:${user.id}`, 40, 60_000);
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const audio = await textToSpeech(parsed.data.text, parsed.data.voice);
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Voice generation failed" }, { status: 502 });
  }
}
