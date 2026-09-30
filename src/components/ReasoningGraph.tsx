"use client";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { AGENT_META } from "@/lib/agentMeta";
import type { AgentId, AskResult, ScoredSource } from "@/lib/types";
import { SignalChip, VERDICT } from "./bits";

const W = 900;
const H = 480;
const CX = W / 2;
const CY = H / 2;
const AGENTS: AgentId[] = ["scout", "critic", "arbiter"];
const AGENT_POS: Record<AgentId, { x: number; y: number }> = {
  scout: { x: CX - 150, y: CY - 70 },
  critic: { x: CX + 150, y: CY - 70 },
  arbiter: { x: CX, y: CY + 120 },
};

type Status = "trusted" | "caution" | "aside";
const STATUS: Record<Status, { label: string; color: string; Icon: typeof CheckCircle2 }> = {
  trusted: { label: "Trusted", color: "var(--good)", Icon: CheckCircle2 },
  caution: { label: "Weak", color: "var(--warn)", Icon: AlertTriangle },
  aside: { label: "Set aside", color: "var(--bad)", Icon: XCircle },
};

type Selection = { kind: "source"; id: string } | { kind: "agent"; id: AgentId } | null;

function statusOf(s: ScoredSource, trusted: string[]): Status {
  if (trusted.includes(s.source.id)) return "trusted";
  return s.usable && s.score >= 55 ? "caution" : "aside";
}

function short(text: string, n: number) {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
}

/** Interactive map of one analysis: question → agents → sources, with conflicts between sources. */
export function ReasoningGraph({ analyses }: { analyses: AskResult[] }) {
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection>(null);
  const result = analyses[index];

  const layout = useMemo(() => {
    if (!result) return null;
    const n = result.sources.length;
    // Sources sit on an outer ellipse, starting at the top.
    const sources = result.sources.map((s, i) => {
      const angle = -Math.PI / 2 + (i / Math.max(n, 1)) * Math.PI * 2 + Math.PI / n;
      return { s, x: CX + Math.cos(angle) * 260, y: CY + Math.sin(angle) * 195, status: statusOf(s, result.trustedSourceIds) };
    });
    const pos = Object.fromEntries(sources.map((p) => [p.s.source.id, p]));
    // Agent → source links: which agent talked about which source.
    const links: { agent: AgentId; sourceId: string; stage: string }[] = [];
    for (const t of result.turns)
      for (const id of t.sourceIds)
        if (pos[id] && !links.some((l) => l.agent === t.agent && l.sourceId === id)) links.push({ agent: t.agent, sourceId: id, stage: t.stage });
    const conflicts = result.conflicts.flatMap((c) =>
      c.positions
        .filter((p) => p.sourceId !== c.winnerId && pos[p.sourceId] && pos[c.winnerId])
        .map((p) => ({ a: c.winnerId, b: p.sourceId, label: c.topicLabel })),
    );
    return { sources, pos, links, conflicts };
  }, [result]);

  if (!result || !layout) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink-3">
        Ask a question first. Its reasoning map will appear here.
      </div>
    );
  }

  const focus = hover ?? (selected ? selected.id : null);
  const linkedTo = (id: string) =>
    layout.links.filter((l) => l.agent === id || l.sourceId === id).flatMap((l) => [l.agent, l.sourceId]).concat(
      layout.conflicts.filter((c) => c.a === id || c.b === id).flatMap((c) => [c.a, c.b]),
    );
  const lit = focus ? new Set([focus, ...linkedTo(focus)]) : null;
  const dim = (id: string) => (lit && !lit.has(id) ? 0.18 : 1);

  const v = VERDICT[result.verdict];
  const selSource = selected?.kind === "source" ? result.sources.find((s) => s.source.id === selected.id) : null;
  const selAgent = selected?.kind === "agent" ? selected.id : null;

  return (
    <div className="space-y-3">
      {analyses.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {analyses.map((a, i) => (
            <button
              key={a.question + i}
              onClick={() => {
                setIndex(i);
                setSelected(null);
              }}
              className={`max-w-xs truncate rounded-full border px-3 py-1 text-xs transition ${i === index ? "border-brand bg-brand/15 text-ink" : "border-line text-ink-3 hover:text-ink-2"}`}
            >
              {a.question}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="overflow-hidden rounded-2xl border border-line bg-panel">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Reasoning map: question, agents and sources">
            {/* question → agents */}
            {AGENTS.map((a) => (
              <line key={a} x1={CX} y1={CY} x2={AGENT_POS[a].x} y2={AGENT_POS[a].y} stroke="var(--line)" strokeWidth={2} opacity={dim(a)} />
            ))}
            {/* agent → source */}
            {layout.links.map((l, i) => {
              const p = layout.pos[l.sourceId];
              const on = lit?.has(l.agent) && lit?.has(l.sourceId);
              return (
                <motion.line
                  key={`${l.agent}-${l.sourceId}`}
                  x1={AGENT_POS[l.agent].x}
                  y1={AGENT_POS[l.agent].y}
                  x2={p.x}
                  y2={p.y}
                  stroke={AGENT_META[l.agent].color}
                  strokeWidth={on ? 2.5 : 1.5}
                  strokeDasharray={l.agent === "critic" ? "5 4" : undefined}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: lit ? (on ? 0.95 : 0.08) : 0.45 }}
                  transition={{ duration: 0.6, delay: 0.3 + i * 0.03 }}
                />
              );
            })}
            {/* conflicts between sources */}
            {layout.conflicts.map((c) => {
              const a = layout.pos[c.a];
              const b = layout.pos[c.b];
              const mx = (a.x + b.x) / 2 + (CY - (a.y + b.y) / 2) * 0.25;
              const my = (a.y + b.y) / 2 - (CX - (a.x + b.x) / 2) * 0.25;
              return (
                <path
                  key={`${c.a}-${c.b}`}
                  d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
                  fill="none"
                  stroke="var(--bad)"
                  strokeWidth={2}
                  strokeDasharray="2 5"
                  strokeLinecap="round"
                  opacity={lit ? (lit.has(c.a) && lit.has(c.b) ? 0.9 : 0.06) : 0.55}
                >
                  <title>{`Conflict: ${c.label}`}</title>
                </path>
              );
            })}

            {/* question */}
            <g>
              <circle cx={CX} cy={CY} r={40} fill="var(--panel-2)" stroke={v.color} strokeWidth={3} />
              <text x={CX} y={CY - 4} textAnchor="middle" className="fill-[var(--ink)] text-[20px] font-bold">
                {result.trustScore}
              </text>
              <text x={CX} y={CY + 14} textAnchor="middle" className="fill-[var(--ink-3)] text-[9px] uppercase tracking-wider">
                {result.verdict === "trusted" ? "TRUSTED" : result.verdict === "caution" ? "CAUTION" : "ASK EXPERT"}
              </text>
            </g>

            {/* agents */}
            {AGENTS.map((a) => {
              const p = AGENT_POS[a];
              const meta = AGENT_META[a];
              const isSel = selAgent === a;
              return (
                <g
                  key={a}
                  opacity={dim(a)}
                  className="cursor-pointer"
                  onMouseEnter={() => setHover(a)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setSelected(isSel ? null : { kind: "agent", id: a })}
                  role="button"
                  aria-label={`${meta.name}, ${meta.role}`}
                >
                  <circle cx={p.x} cy={p.y} r={isSel ? 30 : 26} fill={meta.color} stroke="var(--panel)" strokeWidth={3} />
                  <text x={p.x} y={p.y + 6} textAnchor="middle" className="pointer-events-none fill-[var(--bg)] text-[17px] font-bold">
                    {meta.name[0]}
                  </text>
                  <text x={p.x} y={p.y + 46} textAnchor="middle" className="pointer-events-none fill-[var(--ink-2)] text-[11px] font-semibold">
                    {meta.name} · {meta.role.replace("The ", "")}
                  </text>
                </g>
              );
            })}

            {/* sources */}
            {layout.sources.map((p, i) => {
              const st = STATUS[p.status];
              const isSel = selSource?.source.id === p.s.source.id;
              const left = p.x < CX - 20;
              const right = p.x > CX + 20;
              return (
                <motion.g
                  key={p.s.source.id}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: dim(p.s.source.id), scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                  className="cursor-pointer"
                  onMouseEnter={() => setHover(p.s.source.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setSelected(isSel ? null : { kind: "source", id: p.s.source.id })}
                  role="button"
                  aria-label={`${p.s.source.title}, trust ${p.s.score}, ${st.label}`}
                >
                  {/* hit target larger than the mark */}
                  <circle cx={p.x} cy={p.y} r={26} fill="transparent" />
                  <circle cx={p.x} cy={p.y} r={isSel ? 20 : 17} fill="var(--panel-2)" stroke={st.color} strokeWidth={isSel ? 4 : 3} />
                  <text x={p.x} y={p.y + 4} textAnchor="middle" className="pointer-events-none fill-[var(--ink)] text-[11px] font-semibold tabular-nums">
                    {p.s.score}
                  </text>
                  <text
                    x={p.x + (left ? -26 : right ? 26 : 0)}
                    y={p.y + (left || right ? 4 : p.y < CY ? -28 : 34)}
                    textAnchor={left ? "end" : right ? "start" : "middle"}
                    className="pointer-events-none fill-[var(--ink-2)] text-[10.5px]"
                  >
                    {short(p.s.source.title.replace(/^(Teams|Email) · /, ""), 24)}
                  </text>
                </motion.g>
              );
            })}
          </svg>

          {/* legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line px-4 py-2 text-[11px] text-ink-3">
            {(Object.keys(STATUS) as Status[]).map((k) => {
              const S = STATUS[k];
              return (
                <span key={k} className="inline-flex items-center gap-1">
                  <S.Icon size={12} style={{ color: S.color }} aria-hidden /> {S.label} source
                </span>
              );
            })}
            {AGENTS.map((a) => (
              <span key={a} className="inline-flex items-center gap-1.5">
                <svg width="18" height="6" aria-hidden>
                  <line x1="0" y1="3" x2="18" y2="3" stroke={AGENT_META[a].color} strokeWidth="2" strokeDasharray={a === "critic" ? "4 3" : undefined} />
                </svg>
                {AGENT_META[a].name} discussed
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden>
                <line x1="0" y1="3" x2="18" y2="3" stroke="var(--bad)" strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" />
              </svg>
              Conflict
            </span>
          </div>
        </div>

        {/* detail panel */}
        <aside className="rounded-2xl border border-line bg-panel p-4 text-sm">
          {selSource ? (
            <SourceDetail s={selSource} result={result} />
          ) : selAgent ? (
            <AgentDetail agent={selAgent} result={result} />
          ) : (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-3">Question</div>
              <p className="mt-1 font-medium">{result.question}</p>
              <p className="mt-3 text-xs text-ink-3">
                {result.sources.length} sources · {result.trustedSourceIds.length} trusted · {result.conflicts.length} conflict{result.conflicts.length === 1 ? "" : "s"}
              </p>
              <p className="mt-4 text-xs text-ink-2">Hover or click an agent or a source to see what was said about it.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function SourceDetail({ s, result }: { s: ScoredSource; result: AskResult }) {
  const st = STATUS[statusOf(s, result.trustedSourceIds)];
  const said = result.turns.filter((t) => t.sourceIds.includes(s.source.id));
  const conflicts = result.conflicts.filter((c) => c.positions.some((p) => p.sourceId === s.source.id));
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: st.color }}>
          <st.Icon size={13} /> {st.label} · trust {s.score}/100
        </div>
        <p className="mt-1 font-medium leading-snug">{s.source.title}</p>
        <p className="text-[11px] text-ink-3">{s.source.location}</p>
      </div>
      <div className="flex flex-wrap gap-1">
        {s.signals.map((sig) => (
          <SignalChip key={sig.key} signal={sig} />
        ))}
      </div>
      <p className="text-xs text-ink-2">{s.source.content}</p>
      {conflicts.map((c) => (
        <p key={c.key} className="rounded-lg bg-bad/10 p-2 text-xs text-ink-2">
          ⚔ Conflict on {c.topicLabel.toLowerCase()}. {c.winnerId === s.source.id ? "This source wins." : "A stronger source wins."}
        </p>
      ))}
      {said.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-3">What the agents said</div>
          {said.map((t, i) => (
            <p key={i} className="text-xs text-ink-2">
              <span className="font-semibold" style={{ color: AGENT_META[t.agent].color }}>
                {AGENT_META[t.agent].name}:
              </span>{" "}
              {t.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentDetail({ agent, result }: { agent: AgentId; result: AskResult }) {
  const meta = AGENT_META[agent];
  const turns = result.turns.filter((t) => t.agent === agent);
  return (
    <div className="space-y-3">
      <div>
        <div className="font-semibold" style={{ color: meta.color }}>
          {meta.name} · {meta.role}
        </div>
        <p className="text-xs text-ink-3">{meta.tagline}</p>
      </div>
      {turns.map((t, i) => (
        <div key={i} className="rounded-lg bg-panel-2 p-2">
          <p className="text-xs text-ink">{t.text}</p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-ink-3">
            {t.points.map((p, j) => (
              <li key={j}>› {p}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
