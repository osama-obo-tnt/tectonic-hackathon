import "server-only";
import { TODAY, claimLabels, experts, knownGaps, topicLabels } from "@/data/knowledge";
import { personActive, personName } from "./store";
import type { Client, Conflict, ExpertSuggestion, ScoredSource, Signal, Source } from "./types";

const DAY = 86_400_000;
const WEIGHTS = { scope: 0.35, freshness: 0.25, validation: 0.25, ownership: 0.15 } as const;

function monthsAgo(date: string) {
  return Math.max(0, Math.round((TODAY.getTime() - new Date(date).getTime()) / (DAY * 30.4)));
}

function ago(date: string) {
  const m = monthsAgo(date);
  if (m < 1) return "this month";
  if (m < 12) return `${m} month${m === 1 ? "" : "s"} ago`;
  const y = Math.floor(m / 12);
  return `${y} year${y === 1 ? "" : "s"} ago`;
}

function freshness(s: Source, all: Source[]): Signal {
  if (s.supersededBy) {
    const newer = all.find((x) => x.id === s.supersededBy);
    return {
      key: "freshness",
      label: "Superseded",
      level: "bad",
      detail: `Replaced by “${newer?.title ?? "a newer version"}”.`,
      score: 0,
    };
  }
  const days = (TODAY.getTime() - new Date(s.updatedAt).getTime()) / DAY;
  if (days <= 365) return { key: "freshness", label: "Current", level: "good", detail: `Updated ${ago(s.updatedAt)}.`, score: 1 };
  if (days <= 730) return { key: "freshness", label: "Ageing", level: "warn", detail: `Last updated ${ago(s.updatedAt)}.`, score: 0.5 };
  return { key: "freshness", label: "Outdated", level: "bad", detail: `Not updated for ${ago(s.updatedAt)}.`, score: 0.1 };
}

function ownership(s: Source): Signal {
  if (!s.ownerId) return { key: "ownership", label: "No owner", level: "bad", detail: "Nobody is responsible for keeping this correct.", score: 0 };
  const name = personName(s.ownerId);
  if (!personActive(s.ownerId))
    return { key: "ownership", label: "Orphaned", level: "warn", detail: `Owner ${name} has left SD Worx.`, score: 0.3 };
  return { key: "ownership", label: "Owned", level: "good", detail: `Maintained by ${name}.`, score: 1 };
}

function scope(s: Source, client: Client): Signal {
  if (!s.countries.includes(client.country))
    return {
      key: "scope",
      label: "Wrong country",
      level: "bad",
      detail: `Applies to ${s.countries.join(", ")} — ${client.name} is in ${client.country}.`,
      score: 0,
    };
  if (s.jointCommittees && client.jointCommittee && !s.jointCommittees.includes(client.jointCommittee))
    return {
      key: "scope",
      label: "Wrong sector",
      level: "bad",
      detail: `Written for ${s.jointCommittees.join(", ")} — ${client.name} falls under ${client.jointCommittee}.`,
      score: 0.1,
    };
  if (s.clientId === client.id)
    return { key: "scope", label: "Client-specific", level: "good", detail: `Written specifically for ${client.name}.`, score: 1 };
  const where = [client.country, client.jointCommittee].filter(Boolean).join(" · ");
  return { key: "scope", label: "Applies here", level: "good", detail: `Covers ${where}.`, score: 0.9 };
}

function validation(s: Source): Signal {
  if (s.validatedBy)
    return { key: "validation", label: "Expert-validated", level: "good", detail: `Confirmed by ${personName(s.validatedBy)}.`, score: 1 };
  if (s.type === "teams" || s.type === "email" || s.type === "handover")
    return { key: "validation", label: "Informal", level: "bad", detail: `A ${s.type === "teams" ? "chat message" : s.type} — never reviewed.`, score: 0.2 };
  return { key: "validation", label: "Not validated", level: "warn", detail: "Official document, but nobody has confirmed it.", score: 0.55 };
}

export function scoreSource(s: Source, client: Client, all: Source[]): ScoredSource {
  const signals = [scope(s, client), freshness(s, all), validation(s), ownership(s)];
  const byKey = Object.fromEntries(signals.map((x) => [x.key, x.score])) as Record<Signal["key"], number>;
  let score = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) score += byKey[key as Signal["key"]] * weight;
  const usable = byKey.scope >= 0.5 && !s.supersededBy;
  return {
    source: s,
    signals,
    score: Math.round(score * 100),
    usable,
    ownerName: personName(s.ownerId),
    validatorName: personName(s.validatedBy),
  };
}

/** Scores every source in its own home scope, to judge the knowledge itself rather than one client question. */
export function scoreInHomeContext(visible: Source[]): ScoredSource[] {
  return visible.map((s) =>
    scoreSource(
      s,
      { id: s.clientId ?? "home", name: "its own scope", country: s.countries[0], jointCommittee: s.jointCommittees?.[0] ?? null, employees: 0, sector: "" },
      visible,
    ),
  );
}

// ─── Retrieval ────────────────────────────────────────────────────────────

const STOP = new Set(
  "a an the and or of to in on for at is are do does can i we my our this that with from they them it be still get how what which who when year".split(" "),
);

function tokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9€%.\-\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[.\-]+|[.\-]+$/g, ""))
    .filter((t) => t.length > 2 && !STOP.has(t));
}

const SYNONYMS: Record<string, string[]> = {
  bonus: ["year-end", "13th", "eindejaarspremie", "dertiende"],
  "year-end": ["bonus"],
  resigned: ["resign", "leavers"],
  resigns: ["resign", "leavers"],
  quit: ["resign", "leavers"],
  leaving: ["leavers"],
  homework: ["telework"],
  "home-working": ["telework"],
  thuiswerk: ["telework"],
  remote: ["telework"],
  wfh: ["telework"],
  luxembourg: ["cross-border", "frontalier"],
  frontier: ["cross-border"],
};

function expand(ts: string[]) {
  const out = new Set(ts);
  for (const t of ts) for (const s of SYNONYMS[t] ?? []) out.add(s);
  return [...out];
}

function relevance(s: Source, qTokens: string[], client: Client) {
  const title = s.title.toLowerCase();
  const tags = s.tags.join(" ").toLowerCase();
  const body = s.content.toLowerCase();
  let score = 0;
  for (const t of qTokens) {
    if (tags.includes(t)) score += 3;
    if (title.includes(t)) score += 2;
    if (body.includes(t)) score += 1;
  }
  if (s.clientId === client.id) score += 2;
  return score;
}

/** Finds the topic the question is about and returns every source on that topic. */
export function retrieve(question: string, client: Client, visible: Source[]) {
  const qTokens = expand(tokens(question));
  const clientTokens = tokens(client.name);
  const scored = visible.map((s) => ({ s, r: relevance(s, [...qTokens, ...clientTokens], client) }));

  // A topic only matches when at least two distinct question words hit its tags,
  // so a single generic word ("company") does not pull in an unrelated topic.
  const perTopic = new Map<string, { hits: Set<string>; score: number }>();
  for (const { s, r } of scored) {
    const entry = perTopic.get(s.topic) ?? { hits: new Set<string>(), score: 0 };
    const tagWords = new Set(s.tags.flatMap((t) => t.toLowerCase().split(/\s+/)));
    for (const t of qTokens) if (tagWords.has(t)) entry.hits.add(t);
    entry.score += r;
    perTopic.set(s.topic, entry);
  }
  const [topic] =
    [...perTopic.entries()]
      .filter(([, v]) => v.hits.size >= 2)
      .sort((a, b) => b[1].hits.size - a[1].hits.size || b[1].score - a[1].score)[0] ?? [];

  if (!topic) return { topic: null, sources: [] as Source[] };
  const sources = scored
    .filter(({ s, r }) => s.topic === topic || r >= 8)
    .sort((a, b) => b.r - a.r)
    .map(({ s }) => s)
    .slice(0, 8);
  return { topic, sources };
}

// ─── Conflicts, gaps, experts ─────────────────────────────────────────────

export function detectConflicts(scored: ScoredSource[]): Conflict[] {
  const byKey = new Map<string, { sourceId: string; value: string; score: number; usable: boolean }[]>();
  for (const sc of scored)
    for (const c of sc.source.claims) {
      const list = byKey.get(c.key) ?? [];
      list.push({ sourceId: sc.source.id, value: c.value, score: sc.score, usable: sc.usable });
      byKey.set(c.key, list);
    }

  const conflicts: Conflict[] = [];
  for (const [key, positions] of byKey) {
    if (new Set(positions.map((p) => p.value)).size < 2) continue;
    const ranked = [...positions].sort((a, b) => Number(b.usable) - Number(a.usable) || b.score - a.score);
    const winner = ranked[0];
    const winnerSource = scored.find((s) => s.source.id === winner.sourceId)!;
    const losers = ranked.slice(1).map((p) => scored.find((s) => s.source.id === p.sourceId)!);
    const reasons = losers.map((l) => {
      const weak = l.signals.filter((sig) => sig.level !== "good").map((sig) => sig.label.toLowerCase());
      return `“${l.source.title}” (${weak.join(", ") || "lower score"})`;
    });
    conflicts.push({
      key,
      topicLabel: claimLabels[key] ?? key,
      positions: ranked.map(({ sourceId, value, score }) => ({ sourceId, value, score })),
      winnerId: winner.sourceId,
      explanation: `${ranked.length} sources disagree. “${winnerSource.source.title}” wins with trust ${winner.score}/100 over ${reasons.join("; ")}.`,
    });
  }
  return conflicts;
}

export function detectGaps(question: string, topic: string | null, client: Client): string[] {
  if (!topic) return [`No knowledge in SD Worx sources covers this question for ${client.name}.`];
  const q = question.toLowerCase();
  return knownGaps
    .filter((g) => g.topic === topic && g.keywords.some((k) => q.includes(k)))
    .map((g) => g.gap);
}

export function suggestExpert(topic: string | null, client: Client, trusted: ScoredSource[]): ExpertSuggestion | null {
  const candidates = experts.filter((e) => e.active && e.countries.includes(client.country));
  const pool = candidates.length ? candidates : experts.filter((e) => e.active);
  const ownerIds = new Set(trusted.map((t) => t.source.ownerId));
  const ranked = pool
    .map((e) => {
      let score = e.answered / 100;
      if (topic && e.topics.includes(topic)) score += 5;
      if (ownerIds.has(e.id)) score += 4;
      return { e, score };
    })
    .sort((a, b) => b.score - a.score);
  const best = ranked[0]?.e;
  if (!best) return null;
  const why: string[] = [];
  if (ownerIds.has(best.id)) why.push("owns the most trusted source");
  if (topic && best.topics.includes(topic)) why.push(`specialist in ${(topicLabels[topic] ?? topic).toLowerCase()}`);
  why.push(`answered ${best.answered} similar questions`);
  return { expertId: best.id, name: best.name, title: best.title, reason: why.join(" · "), answered: best.answered };
}

/**
 * Overall trust is computed from the signals of the sources the answer relies on —
 * never by the language model — so it can always be explained.
 */
export function overallTrust(trusted: ScoredSource[], conflicts: Conflict[], gaps: string[]) {
  const explanation: string[] = [];
  if (!trusted.length) {
    explanation.push("No usable source applies to this client — ask an expert.");
    return { score: 12, verdict: "expert" as const, explanation };
  }
  const best = Math.max(...trusted.map((t) => t.score));
  const avg = trusted.reduce((a, t) => a + t.score, 0) / trusted.length;
  let score = Math.round(best * 0.7 + avg * 0.3);
  explanation.push(`Based on ${trusted.length} trusted source${trusted.length > 1 ? "s" : ""} (best ${best}/100).`);

  const close = conflicts.filter((c) => c.positions.length > 1 && c.positions[0].score - c.positions[1].score < 20);
  if (close.length) {
    score -= 12 * close.length;
    explanation.push(`−${12 * close.length}: ${close.length} conflict${close.length > 1 ? "s" : ""} between sources of similar strength.`);
  } else if (conflicts.length) {
    explanation.push(`${conflicts.length} conflict${conflicts.length > 1 ? "s" : ""} resolved clearly in favour of the strongest source.`);
  }
  if (gaps.length) {
    score = Math.min(score - 8, 72);
    explanation.push("Capped: part of the question is not covered by any source.");
  }
  score = Math.max(5, Math.min(98, score));
  const verdict = score >= 75 ? "trusted" : score >= 50 ? "caution" : "expert";
  return { score, verdict: verdict as "trusted" | "caution" | "expert", explanation };
}
