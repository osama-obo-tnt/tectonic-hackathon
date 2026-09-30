import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { clients, experts, people, sources as seedSources, users } from "@/data/knowledge";
import type { ExpertQuestion, Source, User } from "./types";

// Small file-backed store for the data that changes at runtime:
// questions routed to experts and the knowledge captured from their answers.
interface StoreShape {
  questions: ExpertQuestion[];
  captured: Source[];
}

const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "store.json");

function load(): StoreShape {
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as StoreShape;
    return { questions: parsed.questions ?? [], captured: parsed.captured ?? [] };
  } catch {
    return { questions: [], captured: [] };
  }
}

function save(data: StoreShape) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  const tmp = `${STORE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, STORE_FILE);
}

export function allSources(): Source[] {
  return [...seedSources, ...load().captured];
}

/** Sources a user may see: generic knowledge plus client notes for clients in their portfolio. */
export function sourcesForUser(user: User): Source[] {
  return allSources().filter((s) => s.clientId === null || user.clientIds.includes(s.clientId));
}

export function getClient(id: string) {
  return clients.find((c) => c.id === id) ?? null;
}

export function clientsForUser(user: User) {
  return clients.filter((c) => user.clientIds.includes(c.id));
}

export function getUser(id: string) {
  return users.find((u) => u.id === id) ?? null;
}

export function getUserByEmail(email: string) {
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function getExpert(id: string) {
  return experts.find((e) => e.id === id) ?? null;
}

export function personName(id: string | null): string | null {
  if (!id) return null;
  return getExpert(id)?.name ?? people.find((p) => p.id === id)?.name ?? null;
}

export function personActive(id: string | null): boolean {
  if (!id) return false;
  const expert = getExpert(id);
  if (expert) return expert.active;
  return people.find((p) => p.id === id)?.active ?? false;
}

export function questionsAskedBy(userId: string) {
  return load()
    .questions.filter((q) => q.askerId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function questionsForExpert(expertId: string) {
  return load()
    .questions.filter((q) => q.expertId === expertId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function countOpenQuestionsForExpert(expertId: string) {
  return load().questions.filter((q) => q.expertId === expertId && q.status === "open").length;
}

export function createQuestion(input: Omit<ExpertQuestion, "id" | "createdAt" | "status">): ExpertQuestion {
  const data = load();
  const question: ExpertQuestion = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    status: "open",
  };
  data.questions.push(question);
  save(data);
  return question;
}

/**
 * Records an expert's answer and turns it into validated knowledge.
 * Only the expert the question was routed to may answer, and only once.
 */
export function answerQuestion(questionId: string, expertId: string, answer: string) {
  const data = load();
  const question = data.questions.find((q) => q.id === questionId);
  if (!question || question.expertId !== expertId) return { error: "not_found" as const };
  if (question.status !== "open") return { error: "already_answered" as const };

  const expert = getExpert(expertId)!;
  const client = getClient(question.clientId);
  const now = new Date().toISOString();
  const captured: Source = {
    id: `s-captured-${randomUUID().slice(0, 8)}`,
    title: `Expert answer — ${question.question.slice(0, 80)}`,
    type: "expert-answer",
    location: "TrustLens › Captured expert knowledge",
    topic: question.topic,
    tags: [...question.question.toLowerCase().split(/\W+/).filter((w) => w.length > 3).slice(0, 12), "expert answer"],
    content: answer,
    author: expert.name,
    ownerId: expert.id,
    updatedAt: now.slice(0, 10),
    countries: client ? [client.country] : expert.countries,
    jointCommittees: client?.jointCommittee ? [client.jointCommittee] : null,
    clientId: question.clientId,
    validatedBy: expert.id,
    supersededBy: null,
    claims: [],
  };

  question.status = "answered";
  question.answer = answer;
  question.answeredAt = now;
  question.capturedSourceId = captured.id;
  data.captured.push(captured);
  save(data);
  return { question, captured };
}
