import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

// Development-only: lets the browser report voice/mic problems to the server log.
const Body = z.object({ event: z.string().max(60), detail: z.string().max(500).default("") });

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { user, error } = await requireApiUser();
  if (error) return error;
  const limited = rateLimit(`diag:${user.id}`, 60, 60_000);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  console.log(`[client-diag] ${user.email} ${parsed.data.event} ${parsed.data.detail}`);
  return NextResponse.json({ ok: true });
}
