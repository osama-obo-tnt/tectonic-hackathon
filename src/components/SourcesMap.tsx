"use client";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { Signal } from "@/lib/types";
import { SignalChip } from "./bits";

export interface MapSource {
  id: string;
  title: string;
  typeLabel: string;
  system: string;
  location: string;
  topic: string;
  score: number;
  signals: Signal[];
  content: string;
  author: string;
  updatedAt: string;
}
export interface MapConflict {
  a: string;
  b: string;
  label: string;
}

type Status = "healthy" | "weak" | "risky";
const STATUS: Record<Status, { label: string; color: string; Icon: typeof CheckCircle2 }> = {
  healthy: { label: "Healthy (trust ≥ 75)", color: "var(--good)", Icon: CheckCircle2 },
  weak: { label: "Weak (55–74)", color: "var(--warn)", Icon: AlertTriangle },
  risky: { label: "Risky (< 55)", color: "var(--bad)", Icon: XCircle },
};
const statusOf = (score: number): Status => (score >= 75 ? "healthy" : score >= 55 ? "weak" : "risky");

const W = 960;
const COL = { system: 110, source: 480, topic: 850 };
const NODE_W = 250;
const ROW = 38;

function short(text: string, n: number) {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
}

function curve(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

/** Layered map: source systems → documents → topics, with contradictions between documents. */
export function SourcesMap({ sources, conflicts, topicLabels }: { sources: MapSource[]; conflicts: MapConflict[]; topicLabels: Record<string, string> }) {
  const [topic, setTopic] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const layout = useMemo(() => {
    const list = sources
      .filter((s) => !topic || s.topic === topic)
      .sort((a, b) => a.topic.localeCompare(b.topic) || b.score - a.score);
    const H = Math.max(420, list.length * ROW + 80);
    const srcY = new Map(list.map((s, i) => [s.id, 50 + i * ROW + (H - 80 - list.length * ROW) / 2]));
    const systems = [...new Set(list.map((s) => s.system))];
    const topics = [...new Set(list.map((s) => s.topic))];
    const spread = (items: string[], i: number) => (H / (items.length + 1)) * (i + 1);
    const sysY = new Map(systems.map((s, i) => [s, spread(systems, i)]));
    const topY = new Map(topics.map((t, i) => [t, spread(topics, i)]));
    const visibleConflicts = conflicts.filter((c) => srcY.has(c.a) && srcY.has(c.b));
    return { list, H, srcY, systems, topics, sysY, topY, visibleConflicts };
  }, [sources, conflicts, topic]);

  const focus = hover ?? selectedId;
  const related = useMemo(() => {
    if (!focus) return null;
    const set = new Set<string>([focus]);
    for (const s of layout.list) {
      if (s.id === focus || `sys:${s.system}` === focus || `top:${s.topic}` === focus) {
        set.add(s.id);
        set.add(`sys:${s.system}`);
        set.add(`top:${s.topic}`);
      }
    }
    for (const c of layout.visibleConflicts)
      if (c.a === focus || c.b === focus) {
        set.add(c.a);
        set.add(c.b);
      }
    return set;
  }, [focus, layout]);
  const op = (id: string) => (related && !related.has(id) ? 0.15 : 1);
  const selected = sources.find((s) => s.id === selectedId) ?? null;
  const selectedConflicts = selected ? conflicts.filter((c) => c.a === selected.id || c.b === selected.id) : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {[null, ...Object.keys(topicLabels)].map((t) => (
          <button
            key={t ?? "all"}
            onClick={() => {
              setTopic(t);
              setSelectedId(null);
            }}
            className={`rounded-full border px-3 py-1 text-xs transition ${topic === t ? "border-brand bg-brand/15 text-ink" : "border-line text-ink-3 hover:text-ink-2"}`}
          >
            {t ? topicLabels[t] : "All topics"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="overflow-hidden rounded-2xl border border-line bg-panel">
          <div className="grid grid-cols-3 px-4 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
            <span>Where it lives</span>
            <span className="text-center">Knowledge</span>
            <span className="text-right">Topic</span>
          </div>
          <svg viewBox={`0 0 ${W} ${layout.H}`} className="h-auto w-full" role="img" aria-label="Map of knowledge sources by system and topic">
            {/* system → source */}
            {layout.list.map((s) => {
              const on = related?.has(s.id) && related.has(`sys:${s.system}`);
              return (
                <path
                  key={`sys-${s.id}`}
                  d={curve(COL.system + 60, layout.sysY.get(s.system)!, COL.source - NODE_W / 2, layout.srcY.get(s.id)!)}
                  fill="none"
                  stroke={on ? "var(--brand)" : "var(--line)"}
                  strokeWidth={on ? 2 : 1.5}
                  opacity={related ? (on ? 1 : 0.25) : 0.9}
                />
              );
            })}
            {/* source → topic */}
            {layout.list.map((s) => {
              const on = related?.has(s.id) && related.has(`top:${s.topic}`);
              return (
                <path
                  key={`top-${s.id}`}
                  d={curve(COL.source + NODE_W / 2, layout.srcY.get(s.id)!, COL.topic - 70, layout.topY.get(s.topic)!)}
                  fill="none"
                  stroke={on ? "var(--brand)" : "var(--line)"}
                  strokeWidth={on ? 2 : 1.5}
                  opacity={related ? (on ? 1 : 0.25) : 0.9}
                />
              );
            })}
            {/* contradictions: arcs on the right edge of the knowledge column */}
            {layout.visibleConflicts.map((c) => {
              const y1 = layout.srcY.get(c.a)!;
              const y2 = layout.srcY.get(c.b)!;
              const x = COL.source + NODE_W / 2;
              const bulge = 28 + Math.abs(y2 - y1) * 0.18;
              const on = related ? related.has(c.a) && related.has(c.b) : true;
              return (
                <path
                  key={`${c.a}-${c.b}`}
                  d={`M ${x} ${y1} C ${x + bulge} ${y1}, ${x + bulge} ${y2}, ${x} ${y2}`}
                  fill="none"
                  stroke="var(--bad)"
                  strokeWidth={2}
                  strokeDasharray="2 5"
                  strokeLinecap="round"
                  opacity={on ? 0.85 : 0.08}
                >
                  <title>{`Contradiction: ${c.label}`}</title>
                </path>
              );
            })}

            {/* systems */}
            {layout.systems.map((sys) => (
              <g key={sys} opacity={op(`sys:${sys}`)} onMouseEnter={() => setHover(`sys:${sys}`)} onMouseLeave={() => setHover(null)} className="cursor-default">
                <rect x={COL.system - 60} y={layout.sysY.get(sys)! - 16} width={120} height={32} rx={16} fill="var(--panel-2)" stroke="var(--line)" />
                <text x={COL.system} y={layout.sysY.get(sys)! + 4} textAnchor="middle" className="fill-[var(--ink)] text-[12px] font-semibold">
                  {sys}
                </text>
              </g>
            ))}

            {/* topics */}
            {layout.topics.map((t) => (
              <g key={t} opacity={op(`top:${t}`)} onMouseEnter={() => setHover(`top:${t}`)} onMouseLeave={() => setHover(null)} className="cursor-default">
                <rect x={COL.topic - 70} y={layout.topY.get(t)! - 16} width={140} height={32} rx={16} fill="var(--brand)" fillOpacity={0.18} stroke="var(--brand)" />
                <text x={COL.topic} y={layout.topY.get(t)! + 4} textAnchor="middle" className="fill-[var(--ink)] text-[12px] font-semibold">
                  {topicLabels[t] ?? t}
                </text>
              </g>
            ))}

            {/* knowledge nodes */}
            {layout.list.map((s, i) => {
              const st = STATUS[statusOf(s.score)];
              const y = layout.srcY.get(s.id)!;
              const isSel = selectedId === s.id;
              return (
                <motion.g
                  key={s.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: op(s.id), x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="cursor-pointer"
                  onMouseEnter={() => setHover(s.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setSelectedId(isSel ? null : s.id)}
                  role="button"
                  aria-label={`${s.title}, trust ${s.score}, ${st.label}`}
                >
                  <rect
                    x={COL.source - NODE_W / 2}
                    y={y - 14}
                    width={NODE_W}
                    height={28}
                    rx={8}
                    fill="var(--panel-2)"
                    stroke={isSel ? "var(--ink)" : st.color}
                    strokeWidth={isSel ? 2 : 1.5}
                  />
                  <circle cx={COL.source - NODE_W / 2 + 14} cy={y} r={5} fill={st.color} />
                  <text x={COL.source - NODE_W / 2 + 26} y={y + 4} className="pointer-events-none fill-[var(--ink)] text-[11px]">
                    {short(s.title.replace(/^(Teams|Email) · /, ""), 34)}
                  </text>
                  <text x={COL.source + NODE_W / 2 - 10} y={y + 4} textAnchor="end" className="pointer-events-none fill-[var(--ink-2)] text-[11px] font-semibold tabular-nums">
                    {s.score}
                  </text>
                </motion.g>
              );
            })}
          </svg>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line px-4 py-2 text-[11px] text-ink-3">
            {(Object.keys(STATUS) as Status[]).map((k) => {
              const S = STATUS[k];
              return (
                <span key={k} className="inline-flex items-center gap-1">
                  <S.Icon size={12} style={{ color: S.color }} aria-hidden /> {S.label}
                </span>
              );
            })}
            <span className="inline-flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden>
                <line x1="0" y1="3" x2="18" y2="3" stroke="var(--bad)" strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" />
              </svg>
              Contradiction
            </span>
          </div>
        </div>

        <aside className="rounded-2xl border border-line bg-panel p-4 text-sm">
          {selected ? (
            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold" style={{ color: STATUS[statusOf(selected.score)].color }}>
                  {STATUS[statusOf(selected.score)].label.split(" ")[0]} · trust {selected.score}/100
                </div>
                <p className="mt-1 font-medium leading-snug">{selected.title}</p>
                <p className="text-[11px] text-ink-3">
                  {selected.typeLabel} · {selected.location}
                </p>
                <p className="text-[11px] text-ink-3">
                  by {selected.author} · updated {selected.updatedAt}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {selected.signals.map((sig) => (
                  <SignalChip key={sig.key} signal={sig} />
                ))}
              </div>
              <p className="text-xs text-ink-2">{selected.content}</p>
              {selectedConflicts.map((c) => (
                <p key={c.a + c.b} className="rounded-lg bg-bad/10 p-2 text-xs text-ink-2">
                  ⚔ Contradicts “{sources.find((s) => s.id === (c.a === selected.id ? c.b : c.a))?.title}” on {c.label.toLowerCase()}.
                </p>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-3">Your knowledge landscape</div>
              <p>
                {sources.length} documents in {new Set(sources.map((s) => s.system)).size} systems, with {conflicts.length} contradictions.
              </p>
              <p className="text-xs text-ink-3">Hover a system, document or topic to trace its links. Click a document for its trust signals.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
