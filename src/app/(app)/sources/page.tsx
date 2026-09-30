import { claimLabels, topicLabels } from "@/data/knowledge";
import { SourcesMap, type MapConflict, type MapSource } from "@/components/SourcesMap";
import { requirePageUser } from "@/lib/auth";
import { sourcesForUser } from "@/lib/store";
import { scoreInHomeContext } from "@/lib/trust";

const TYPE_LABEL: Record<string, string> = {
  procedure: "Procedure",
  policy: "Policy",
  faq: "FAQ",
  checklist: "Checklist",
  teams: "Teams chat",
  email: "Email",
  handover: "Handover note",
  "expert-answer": "Expert answer",
};

export default async function SourcesPage() {
  const user = await requirePageUser();
  const scored = scoreInHomeContext(sourcesForUser(user));

  const sources: MapSource[] = scored.map(({ source: s, score, signals }) => ({
    id: s.id,
    title: s.title,
    typeLabel: TYPE_LABEL[s.type] ?? s.type,
    system: s.location.split(" › ")[0],
    location: s.location,
    topic: s.topic,
    score,
    signals,
    content: s.content,
    author: s.author,
    updatedAt: s.updatedAt,
  }));

  // Two documents contradict when they make different claims on the same point for a shared country.
  const conflicts: MapConflict[] = [];
  const all = scored.map((x) => x.source);
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      if (!a.countries.some((c) => b.countries.includes(c))) continue;
      const clash = a.claims.find((ca) => b.claims.some((cb) => cb.key === ca.key && cb.value !== ca.value));
      if (clash) conflicts.push({ a: a.id, b: b.id, label: claimLabels[clash.key] ?? clash.key });
    }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Sources map</h1>
        <p className="mt-1 text-sm text-ink-3">Every system and document TrustLens retrieves from, and where they contradict each other.</p>
      </header>
      <SourcesMap sources={sources} conflicts={conflicts} topicLabels={topicLabels} />
    </div>
  );
}
