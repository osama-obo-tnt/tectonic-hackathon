import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { elevenEnabled, textToDialogue } from "@/lib/elevenlabs";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const Body = z.object({
  lines: z
    .array(z.object({ text: z.string().trim().min(1).max(800), voice: z.enum(["narrator", "scout", "critic", "arbiter"]) }))
    .min(1)
    .max(8),
});

export async function POST(req: NextRequest) {
  const { user, error } = await requireApiUser();
  if (error) return error;
  if (!elevenEnabled()) return NextResponse.json({ error: "Voice is not configured" }, { status: 503 });

  const limited = rateLimit(`dialogue:${user.id}`, 6, 60_000);
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const audio = await textToDialogue(parsed.data.lines);
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Dialogue generation failed" }, { status: 502 });
  }
}
