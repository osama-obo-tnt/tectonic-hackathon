import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { answerQuestion } from "@/lib/store";

const Body = z.object({ answer: z.string().trim().min(5).max(3000) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireApiUser();
  if (error) return error;
  if (user.role !== "expert" || !user.expertId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limited = rateLimit(`answer:${user.id}`, 20, 60_000);
  if (limited) return limited;

  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || id.length > 64) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // The store only lets the expert the question was routed to answer it (no IDOR).
  const result = answerQuestion(id, user.expertId, parsed.data.answer);
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ question: result.question, capturedSourceId: result.captured.id });
}
