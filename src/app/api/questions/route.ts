import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { topicLabels } from "@/data/knowledge";
import { requireApiUser } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { createQuestion, getClient, getExpert, questionsAskedBy, questionsForExpert } from "@/lib/store";

const Body = z.object({
  expertId: z.string().max(64),
  clientId: z.string().max(64),
  topic: z.string().max(64).nullable(),
  question: z.string().trim().min(5).max(500),
  context: z.string().trim().max(2000).default(""),
});

export async function GET() {
  const { user, error } = await requireApiUser();
  if (error) return error;
  return NextResponse.json({
    asked: questionsAskedBy(user.id),
    inbox: user.expertId ? questionsForExpert(user.expertId) : [],
  });
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  const limited = rateLimit(`question:${user.id}`, 10, 60_000);
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { expertId, clientId, question, context } = parsed.data;

  // Only for clients in the asker's own portfolio, and only to real, active experts.
  if (!user.clientIds.includes(clientId) || !getClient(clientId)) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const expert = getExpert(expertId);
  if (!expert?.active) return NextResponse.json({ error: "Expert not found" }, { status: 404 });
  if (user.expertId === expertId) return NextResponse.json({ error: "You cannot route a question to yourself" }, { status: 400 });

  const topic = parsed.data.topic && parsed.data.topic in topicLabels ? parsed.data.topic : "general";
  const created = createQuestion({ askerId: user.id, askerName: user.name, expertId, clientId, topic, question, context });
  return NextResponse.json({ question: created }, { status: 201 });
}
