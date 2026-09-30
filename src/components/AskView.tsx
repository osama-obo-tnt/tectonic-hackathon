"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Building2, ChevronDown, FileText, GitCompareArrows, Headphones, Loader2, Pause, SearchX, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { AGENT_META, STAGE_TEXT } from "@/lib/agentMeta";
import type { AgentId, AskEvent, AskResult, Client, Conflict, Language, ScoredSource, Turn } from "@/lib/types";
import { AgentAvatar, SignalChip, TrustGauge, VERDICT } from "./bits";
import { DebatePanel } from "./DebatePanel";
import { ExpertCard } from "./ExpertCard";
import { useVoice } from "./useVoice";
import { VoiceInput } from "./VoiceInput";

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

export function AskView({
  clients,
  examples,
  voiceEnabled,
  engine,
}: {
  clients: Client[];
  examples: { clientId: string; question: string }[];
  voiceEnabled: boolean;
  engine: "claude" | "demo";
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [language, setLanguage] = useState<Language>("en");
  const [question, setQuestion] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [sources, setSources] = useState<ScoredSource[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const voice = useVoice(language);
  const reasoningRef = useRef<HTMLDivElement>(null);
  const running = stage !== null && !result && !error;
  const client = clients.find((c) => c.id === clientId);

  async function ask(q = question, cid = clientId) {
    if (q.trim().length < 5 || !cid) return;
    voice.stop();
    setQuestion(q);
    setClientId(cid);
    setStage("retrieving");
    setSources([]);
    setConflicts([]);
    setTurns([]);
    setResult(null);
    setError(null);
    setShowReasoning(false);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, clientId: cid, language }),
      });
      if (!res.ok || !res.body) throw new Error(res.status === 429 ? "Too many questions. Wait a moment." : "Request failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as AskEvent;
          if (e.type === "stage") setStage(e.stage);
          else if (e.type === "sources") {
            setSources(e.sources);
            setConflicts(e.conflicts);
          } else if (e.type === "turn") setTurns((t) => [...t, e.turn]);
          else if (e.type === "result") setResult(e.result);
          else if (e.type === "error") setError(e.message);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  function openReasoning() {
    setShowReasoning(true);
    setTimeout(() => reasoningRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const answerPlaying = voice.playingId === "answer" || voice.loadingId === "answer";
  const activeAgent: AgentId | null =
    stage === "scout" || stage === "rebuttal" ? "scout" : stage === "critic" ? "critic" : stage === "arbiter" ? "arbiter" : null;

  return (
    <div className="space-y-6">
      {/* ─── Question ─── */}
      <section className="rounded-2xl border border-line bg-panel/80 p-5 backdrop-blur">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-ink-3">Client</span>
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => setClientId(c.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                c.id === clientId ? "border-brand bg-brand/15 text-ink" : "border-line text-ink-2 hover:border-ink-3"
              }`}
            >
              <Building2 size={12} /> {c.name}
              <span className="text-ink-3">
                {c.country}
                {c.jointCommittee ? ` · ${c.jointCommittee}` : ""}
              </span>
            </button>
          ))}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="ml-auto rounded-lg border border-line bg-panel-2 px-2 py-1 text-xs text-ink-2"
            aria-label="Answer language"
          >
            <option value="en">English</option>
            <option value="nl">Nederlands</option>
            <option value="fr">Français</option>
          </select>
        </div>
        {client?.note && <p className="mb-3 text-xs text-warn">⚑ {client.note}</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, 500))}
            placeholder={`Ask anything about ${client?.name ?? "your client"}…`}
            className="h-11 flex-1 rounded-xl border border-line bg-panel-2 px-4 text-sm outline-none placeholder:text-ink-3 focus:border-brand"
          />
          <VoiceInput elevenEnabled={voiceEnabled} language={language} onText={(t) => ask(t)} />
          <button
            type="submit"
            disabled={running || question.trim().length < 5}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold transition hover:brightness-110 disabled:opacity-50"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Ask
          </button>
        </form>

        {examples.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex.question}
                onClick={() => ask(ex.question, ex.clientId)}
                disabled={running}
                className="rounded-lg bg-white/5 px-3 py-1.5 text-left text-xs text-ink-2 transition hover:bg-white/10 disabled:opacity-50"
              >
                {ex.question}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ─── Live agents ─── */}
      <AnimatePresence>
        {stage && (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(AGENT_META) as AgentId[]).map((a) => {
              const meta = AGENT_META[a];
              const said = turns.filter((t) => t.agent === a).at(-1);
              const thinking = running && activeAgent === a;
              return (
                <div
                  key={a}
                  className="relative overflow-hidden rounded-2xl border bg-panel p-4 transition-colors"
                  style={{ borderColor: thinking ? meta.color : "var(--line)" }}
                >
                  {thinking && <div className="shimmer absolute inset-0" />}
                  <div className="relative flex items-center gap-3">
                    <AgentAvatar agent={a} active={thinking} size={36} />
                    <div>
                      <div className="text-sm font-semibold" style={{ color: meta.color }}>
                        {meta.name}
                      </div>
                      <div className="text-xs text-ink-3">
                        {meta.role} · {meta.tagline}
                      </div>
                    </div>
                  </div>
                  <p className="relative mt-3 line-clamp-3 min-h-[3.75rem] text-xs leading-relaxed text-ink-2">
                    {thinking ? STAGE_TEXT[stage!] : said ? `“${said.text}”` : running ? "Waiting for their turn…" : "—"}
                  </p>
                </div>
              );
            })}
          </motion.section>
        )}
      </AnimatePresence>

      {running && stage === "retrieving" && (
        <p className="flex items-center gap-2 text-sm text-ink-3">
          <Loader2 size={14} className="animate-spin" /> {STAGE_TEXT.retrieving}
        </p>
      )}
      {error && <p className="rounded-xl border border-bad/50 bg-bad/10 p-3 text-sm">{error}</p>}
      {voice.error && (
        <p role="alert" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-warn/50 bg-panel-2 p-3 text-sm text-ink-2 shadow-2xl">
          🔇 {voice.error}
        </p>
      )}

      {/* ─── Result ─── */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <AnswerCard
                result={result}
                playing={answerPlaying}
                onListen={() => (answerPlaying ? voice.stop() : voice.speak([{ id: "answer", text: result.answer, voice: "narrator" }]))}
                onReasoning={openReasoning}
              />

              <div ref={reasoningRef} className="scroll-mt-4 rounded-2xl border border-line bg-panel">
                <button
                  onClick={() => setShowReasoning((s) => !s)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                  aria-expanded={showReasoning}
                >
                  <div className="flex -space-x-2">
                    {(Object.keys(AGENT_META) as AgentId[]).map((a) => (
                      <AgentAvatar key={a} agent={a} size={28} />
                    ))}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">Why is this reliable? The full chain of reasoning</div>
                    <div className="text-xs text-ink-3">Nova, Rex and Sage debated {result.sources.length} sources. Read it or listen to it.</div>
                  </div>
                  <ChevronDown className={`text-ink-3 transition-transform ${showReasoning ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {showReasoning && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="border-t border-line p-4">
                        <div className="mb-5 rounded-xl bg-panel-2 p-3">
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-3">How the score was computed</div>
                          <ul className="space-y-1 text-sm text-ink-2">
                            {result.scoreExplanation.map((e) => (
                              <li key={e}>• {e}</li>
                            ))}
                          </ul>
                          <p className="mt-2 text-[11px] text-ink-3">
                            The score comes from transparent signals (scope 35%, freshness 25%, validation 25%, ownership 15%), not from the AI. The agents explain it.
                          </p>
                        </div>
                        <DebatePanel turns={result.turns} sources={result.sources} voice={voice} voiceEnabled={voiceEnabled} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {conflicts.length > 0 && <ConflictsCard conflicts={conflicts} sources={sources} />}
              <SourcesCard sources={sources} trusted={result.trustedSourceIds} />
            </div>

            <aside className="space-y-4">
              {result.gaps.length > 0 && (
                <div className="rounded-2xl border border-warn/40 bg-warn/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warn">
                    <SearchX size={14} /> Knowledge gap
                  </div>
                  {result.gaps.map((g) => (
                    <p key={g} className="text-sm text-ink-2">
                      {g}
                    </p>
                  ))}
                </div>
              )}
              <ExpertCard key={result.question + result.clientId} result={result} />
              <div className="rounded-2xl border border-line bg-panel p-4 text-xs text-ink-3">
                Engine: <span className="text-ink-2">{result.engine === "claude" ? "Claude agents (Anthropic)" : "Built-in demo agents"}</span>
                <br />
                Voice: <span className="text-ink-2">{voiceEnabled ? "ElevenLabs" : "Browser fallback"}</span>
              </div>
            </aside>
          </motion.div>
        )}
      </AnimatePresence>

      {!stage && (
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(AGENT_META) as AgentId[]).map((a, i) => (
            <motion.div
              key={a}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              className="rounded-2xl border border-line bg-panel/70 p-4"
            >
              <AgentAvatar agent={a} size={36} />
              <div className="mt-3 text-sm font-semibold" style={{ color: AGENT_META[a].color }}>
                {AGENT_META[a].name} · {AGENT_META[a].role}
              </div>
              <p className="text-xs text-ink-3">{AGENT_META[a].tagline}</p>
            </motion.div>
          ))}
          <p className="text-xs text-ink-3 sm:col-span-3">
            {engine === "claude" ? "Agents are powered by Claude." : "Running built-in demo agents. Add an Anthropic API key for live reasoning."}{" "}
            {voiceEnabled ? "Voices are powered by ElevenLabs." : "Add an ElevenLabs key for real agent voices."}
          </p>
        </div>
      )}
    </div>
  );
}

function AnswerCard({
  result,
  playing,
  onListen,
  onReasoning,
}: {
  result: AskResult;
  playing: boolean;
  onListen: () => void;
  onReasoning: () => void;
}) {
  const v = VERDICT[result.verdict];
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-panel p-5" style={{ borderColor: `color-mix(in srgb, ${v.color} 40%, var(--line))` }}>
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: v.color }} />
      <div className="flex flex-col gap-5 sm:flex-row">
        <TrustGauge score={result.trustScore} verdict={result.verdict} />
        <div className="flex-1">
          <button
            onClick={onReasoning}
            className="group mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold transition hover:brightness-125"
            style={{ background: `color-mix(in srgb, ${v.color} 18%, transparent)`, color: v.color }}
            title="Show the full chain of reasoning"
          >
            <v.Icon size={16} /> {v.label}
            <span className="text-xs font-normal text-ink-2 group-hover:underline">· see why</span>
            <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
          </button>
          <p className="whitespace-pre-line text-[15px] leading-relaxed">{result.answer}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button onClick={onListen} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15">
              {playing ? <Pause size={14} /> : <Headphones size={14} />} {playing ? "Stop" : "Listen"}
            </button>
            <span className="text-xs text-ink-3">{v.sub}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConflictsCard({ conflicts, sources }: { conflicts: Conflict[]; sources: ScoredSource[] }) {
  const title = (id: string) => sources.find((s) => s.source.id === id)?.source.title ?? id;
  return (
    <div className="rounded-2xl border border-serious/40 bg-panel p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-serious">
        <GitCompareArrows size={14} /> {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} detected
      </div>
      <div className="space-y-4">
        {conflicts.map((c) => (
          <div key={c.key}>
            <div className="mb-2 text-sm font-medium">{c.topicLabel}</div>
            <div className="space-y-1.5">
              {c.positions.map((p) => {
                const win = p.sourceId === c.winnerId;
                return (
                  <div key={p.sourceId} className={`flex items-center gap-3 rounded-lg p-2 text-sm ${win ? "bg-good/10" : "bg-white/[0.03]"}`}>
                    <span className={`w-10 shrink-0 text-right font-mono text-xs tabular-nums ${win ? "text-good" : "text-ink-3"}`}>{p.score}</span>
                    <div className="min-w-0 flex-1">
                      <div className={win ? "text-ink" : "text-ink-3 line-through decoration-ink-3/50"}>{p.value}</div>
                      <div className="truncate text-[11px] text-ink-3">{title(p.sourceId)}</div>
                    </div>
                    {win && <span className="rounded bg-good/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-good">wins</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourcesCard({ sources, trusted }: { sources: ScoredSource[]; trusted: string[] }) {
  const sorted = [...sources].sort((a, b) => Number(trusted.includes(b.source.id)) - Number(trusted.includes(a.source.id)) || b.score - a.score);
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
        <FileText size={14} /> {sources.length} sources found · {trusted.length} trusted
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {sorted.map((s, i) => {
          const isTrusted = trusted.includes(s.source.id);
          return (
            <motion.div
              key={s.source.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-xl border p-3 ${isTrusted ? "border-good/40 bg-good/[0.04]" : "border-line bg-panel-2 opacity-80"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-snug">{s.source.title}</div>
                  <div className="mt-0.5 truncate text-[11px] text-ink-3">
                    {TYPE_LABEL[s.source.type]} · {s.source.location}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm tabular-nums">{s.score}</div>
                  <div className="text-[10px] text-ink-3">{isTrusted ? "trusted" : "set aside"}</div>
                </div>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: s.score >= 75 ? "var(--good)" : s.score >= 55 ? "var(--warn)" : "var(--bad)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${s.score}%` }}
                  transition={{ duration: 0.8, delay: 0.2 + i * 0.05 }}
                />
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-ink-2">{s.source.content}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {s.signals.map((sig) => (
                  <SignalChip key={sig.key} signal={sig} />
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
