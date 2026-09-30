import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { runPipeline } from "@/lib/agents";
import { requireApiUser } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { getClient, saveAnalysis } from "@/lib/store";
import type { AskEvent } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({
  question: z.string().trim().min(5).max(500),
  clientId: z.string().max(64),
  language: z.enum(["en", "nl", "fr"]).default("en"),
});

export async function POST(req: NextRequest) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  const limited = rateLimit(`ask:${user.id}`, 20, 60_000);
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // Authorization: consultants may only ask about clients in their own portfolio.
  const client = user.clientIds.includes(parsed.data.clientId) ? getClient(parsed.data.clientId) : null;
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AskEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      try {
        const result = await runPipeline(parsed.data.question, client, user, parsed.data.language, emit);
        saveAnalysis(user.id, result);
      } catch (err) {
        console.error("ask pipeline error", err);
        emit({ type: "error", message: "Something went wrong while analysing the sources." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
