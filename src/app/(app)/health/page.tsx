import { GitCompareArrows, UserX } from "lucide-react";
import { claimLabels } from "@/data/knowledge";
import { IssueBars, StatTile } from "@/components/HealthCharts";
import { ReasoningGraph } from "@/components/ReasoningGraph";
import { requirePageUser } from "@/lib/auth";
import { analysesFor, personActive, personName, sourcesForUser } from "@/lib/store";
import { scoreInHomeContext } from "@/lib/trust";

export default async function HealthPage() {
  const user = await requirePageUser();
  const visible = sourcesForUser(user);

  const scored = scoreInHomeContext(visible);
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
  const orphanOwners = [...new Set(orphaned.map((s) => s.source.ownerId))].filter((id) => id && !personActive(id));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Knowledge health</h1>
        <p className="mt-1 text-sm text-ink-3">See how the agents reasoned, and where SD Worx knowledge needs fixing.</p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Reasoning map · your recent questions</h2>
        <ReasoningGraph analyses={analysesFor(user.id)} />
      </section>

      <h2 className="pt-2 text-sm font-semibold">Knowledge base health</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Sources analysed" value={scored.length} sub={`${healthy} healthy (trust ≥ 75)`} tone="good" />
        <StatTile label="Contradictions" value={conflicts.length} sub="claims that disagree" tone="bad" />
        <StatTile label="Outdated or superseded" value={outdated.length} sub="need a refresh" tone="warn" />
        <StatTile label="Without an active owner" value={noOwner.length + orphaned.length} sub={`${orphaned.length} owners left SD Worx`} tone="bad" />
        <StatTile label="Not validated" value={unvalidated.length} sub="chat, email, unreviewed docs" tone="warn" />
      </div>

      <div className="grid gap-6">
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
