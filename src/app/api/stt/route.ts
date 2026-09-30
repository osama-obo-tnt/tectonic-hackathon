import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { elevenEnabled, speechToText } from "@/lib/elevenlabs";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const { user, error } = await requireApiUser();
  if (error) return error;
  if (!elevenEnabled()) return NextResponse.json({ error: "Voice is not configured" }, { status: 503 });

  const limited = rateLimit(`stt:${user.id}`, 15, 60_000);
  if (limited) return limited;

  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof Blob) || file.size === 0 || file.size > MAX_BYTES || !file.type.startsWith("audio/")) {
    return NextResponse.json({ error: "Invalid audio" }, { status: 400 });
  }

  try {
    const text = await speechToText(file);
    return NextResponse.json({ text: text.slice(0, 500) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
  }
}
