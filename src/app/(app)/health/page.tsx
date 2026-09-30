import { GitCompareArrows, UserX } from "lucide-react";
import { claimLabels, topicLabels } from "@/data/knowledge";
import { IssueBars, StatTile } from "@/components/HealthCharts";
import { requirePageUser } from "@/lib/auth";
import { personActive, personName, sourcesForUser } from "@/lib/store";
import { scoreSource } from "@/lib/trust";
import type { Client } from "@/lib/types";

export default async function HealthPage() {
  const user = await requirePageUser();
  const visible = sourcesForUser(user);

  // Score each source in its own home context to judge the knowledge itself.
  const scored = visible.map((s) => {
    const home: Client = {
      id: s.clientId ?? "home",
      name: "its own scope",
      country: s.countries[0],
      jointCommittee: s.jointCommittees?.[0] ?? null,
      employees: 0,
      sector: "",
    };
    return scoreSource(s, home, visible);
  });
  const sig = (key: string, level: string) => scored.filter((s) => s.signals.some((x) => x.key === key && x.level === level));
  const outdated = scored.filter((s) => s.signals.some((x) => x.key === "freshness" && x.level !== "good"));
  const noOwner = sig("ownership", "bad");
  const orphaned = sig("ownership", "warn");
  const unvalidated = scored.filter((s) => s.signals.some((x) => x.key === "validation" && x.level !== "good"));

  // Conflicting claims within the same country.
  const claimMap = new Map<string, { value: string; title: string; score: number }[]>();
  for (const s of scored)
    for (const c of s.source.claims)
      for (const country of s.source.countries) {
        const k = `${c.key}|${country}`;
        claimMap.set(k, [...(claimMap.get(k) ?? []), { value: c.value, title: s.source.title, score: s.score }]);
      }
  const conflicts = [...claimMap.entries()]
    .filter(([, v]) => new Set(v.map((x) => x.value)).size > 1)
    .map(([k, v]) => ({ key: k, label: claimLabels[k.split("|")[0]] ?? k, country: k.split("|")[1], positions: v.sort((a, b) => b.score - a.score) }));

  const healthy = scored.filter((s) => s.score >= 75).length;
  const topics = Object.keys(topicLabels).map((t) => {
    const list = scored.filter((s) => s.source.topic === t);
    return {
      t,
      count: list.length,
      avg: list.length ? Math.round(list.reduce((a, s) => a + s.score, 0) / list.length) : 0,
      conflicts: conflicts.filter((c) => list.some((s) => s.source.claims.some((cl) => cl.key === c.key.split("|")[0]))).length,
    };
  });
  const orphanOwners = [...new Set(orphaned.map((s) => s.source.ownerId))].filter((id) => id && !personActive(id));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Knowledge health</h1>
        <p className="mt-1 text-sm text-ink-3">
          Conflicting, outdated, ownerless and unvalidated knowledge, made visible before it reaches a client.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Sources analysed" value={scored.length} sub={`${healthy} healthy (trust ≥ 75)`} tone="good" />
        <StatTile label="Contradictions" value={conflicts.length} sub="claims that disagree" tone="bad" />
        <StatTile label="Outdated or superseded" value={outdated.length} sub="need a refresh" tone="warn" />
        <StatTile label="Without an active owner" value={noOwner.length + orphaned.length} sub={`${orphaned.length} owners left SD Worx`} tone="bad" />
        <StatTile label="Not validated" value={unvalidated.length} sub="chat, email, unreviewed docs" tone="warn" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="mb-1 text-sm font-semibold">Share of sources affected per issue</h2>
          <p className="mb-4 text-xs text-ink-3">Hover a bar for what it means. A source can have several issues.</p>
          <IssueBars
            total={scored.length}
            rows={[
              { label: "Not validated by an expert", count: unvalidated.length, hint: "Chats, emails and documents nobody has confirmed" },
              { label: "Outdated or superseded", count: outdated.length, hint: "Older than a year, or replaced by a newer version" },
              { label: "No owner", count: noOwner.length, hint: "Nobody is responsible for keeping it correct" },
              { label: "Owner has left", count: orphaned.length, hint: "Knowledge at risk after people leave" },
            ]}
          />
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="mb-4 text-sm font-semibold">Health by topic</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th className="pb-2 font-normal">Topic</th>
                <th className="pb-2 text-right font-normal">Sources</th>
                <th className="pb-2 text-right font-normal">Avg. trust</th>
                <th className="pb-2 text-right font-normal">Conflicts</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((t) => (
                <tr key={t.t} className="border-t border-line">
                  <td className="py-2">{topicLabels[t.t]}</td>
                  <td className="py-2 text-right tabular-nums text-ink-2">{t.count}</td>
                  <td className="py-2 text-right tabular-nums text-ink-2">{t.avg}</td>
                  <td className="py-2 text-right tabular-nums text-ink-2">{t.conflicts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <GitCompareArrows size={16} className="text-serious" /> Contradictions to resolve
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {conflicts.map((c) => (
            <div key={c.key} className="rounded-xl border border-line bg-panel-2 p-3">
              <div className="mb-2 text-sm font-medium">
                {c.label} <span className="text-xs text-ink-3">· {c.country}</span>
              </div>
              {c.positions.map((p, i) => (
                <div key={p.title + i} className="flex gap-2 py-1 text-xs">
                  <span className={`w-7 text-right font-mono tabular-nums ${i === 0 ? "text-good" : "text-ink-3"}`}>{p.score}</span>
                  <div className="min-w-0">
                    <div className={i === 0 ? "text-ink" : "text-ink-2"}>{p.value}</div>
                    <div className="truncate text-ink-3">{p.title}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {orphanOwners.length > 0 && (
        <section className="rounded-2xl border border-warn/40 bg-warn/5 p-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <UserX size={16} className="text-warn" /> Handover risk
          </h2>
          {orphanOwners.map((id) => {
            const docs = orphaned.filter((s) => s.source.ownerId === id);
            return (
              <p key={id} className="text-sm text-ink-2">
                <span className="font-medium text-ink">{personName(id)}</span> left SD Worx and still owns {docs.length} source{docs.length > 1 ? "s" : ""}:{" "}
                {docs.map((d) => d.source.title).join(" · ")}. Reassign an owner, or ask an expert to validate them.
              </p>
            );
          })}
        </section>
      )}
    </div>
  );
}
