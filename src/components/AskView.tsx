"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown, FileText, GitCompareArrows, Headphones, Loader2, Pause, SearchX, Sparkles } from "lucide-react";
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
  const [showDetails, setShowDetails] = useState(false);
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
    setShowDetails(false);

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
  const lastTurn = turns.at(-1);

  return (
    <div className="space-y-5">
      {/* ─── Question ─── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-panel p-2"
      >
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="h-11 rounded-xl bg-panel-2 px-3 text-sm text-ink outline-none"
          aria-label="Client"
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, 500))}
          placeholder="Ask a question…"
          className="h-11 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-ink-3"
        />
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          className="h-11 rounded-xl bg-transparent px-1 text-xs text-ink-3 outline-none"
          aria-label="Answer language"
        >
          <option value="en">EN</option>
          <option value="nl">NL</option>
          <option value="fr">FR</option>
        </select>
        <VoiceInput elevenEnabled={voiceEnabled} language={language} onText={(t) => ask(t)} />
        <button
          type="submit"
          disabled={running || question.trim().length < 5}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold transition hover:brightness-110 disabled:opacity-40"
        >
          {running ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Ask
        </button>
      </form>

      {!stage && examples.length > 0 && (
        <div className="space-y-1.5 pl-1">
          <p className="text-xs text-ink-3">Try one of these:</p>
          {examples.map((ex) => (
            <button key={ex.question} onClick={() => ask(ex.question, ex.clientId)} className="block text-left text-sm text-ink-2 transition hover:text-ink">
              → {ex.question} <span className="text-xs text-ink-3">· {clients.find((c) => c.id === ex.clientId)?.name}</span>
            </button>
          ))}
          <p className="pt-3 text-xs text-ink-3">
            {engine === "claude" ? "Agents powered by Claude" : "Demo agents"} · {voiceEnabled ? "voices by ElevenLabs" : "browser voices"}
          </p>
        </div>
      )}
      {client?.note && !result && <p className="pl-1 text-xs text-warn">⚑ {client.note}</p>}

      {/* ─── Live agents: one compact row ─── */}
      {running && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4 rounded-2xl border border-line bg-panel p-4">
          <div className="flex gap-2">
            {(Object.keys(AGENT_META) as AgentId[]).map((a) => (
              <div key={a} className={`transition-opacity ${activeAgent === a ? "opacity-100" : "opacity-35"}`}>
                <AgentAvatar agent={a} size={34} active={activeAgent === a} />
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink">{STAGE_TEXT[stage!]}</p>
            {lastTurn && (
              <p className="mt-0.5 truncate text-xs text-ink-3">
                {AGENT_META[lastTurn.agent].name}: “{lastTurn.text}”
              </p>
            )}
          </div>
          <Loader2 size={16} className="animate-spin text-ink-3" />
        </motion.div>
      )}
      {error && <p className="rounded-xl border border-bad/50 bg-bad/10 p-3 text-sm">{error}</p>}

      {/* ─── Result ─── */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <AnswerCard
              result={result}
              playing={answerPlaying}
              onListen={() => (answerPlaying ? voice.stop() : voice.speak([{ id: "answer", text: result.answer, voice: "narrator" }]))}
              onReasoning={openReasoning}
            />

            {result.verdict !== "trusted" && result.expert && (
              <div className="grid gap-4 md:grid-cols-2">
                {result.gaps.length > 0 && (
                  <div className="rounded-2xl border border-warn/40 bg-warn/5 p-4">
                    <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warn">
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
              </div>
            )}

            <Section
              innerRef={reasoningRef}
              open={showReasoning}
              onToggle={() => setShowReasoning((s) => !s)}
              icon={
                <div className="flex -space-x-2">
                  {(Object.keys(AGENT_META) as AgentId[]).map((a) => (
                    <AgentAvatar key={a} agent={a} size={24} />
                  ))}
                </div>
              }
              title="Why is this reliable?"
              subtitle="Read or listen to Nova, Rex and Sage debate it"
            >
              <p className="mb-4 text-xs text-ink-3">
                {result.scoreExplanation.join(" ")} Score = scope 35% · freshness 25% · validation 25% · ownership 15%, computed from the sources, not by the AI.
              </p>
              <DebatePanel turns={result.turns} sources={result.sources} voice={voice} voiceEnabled={voiceEnabled} />
            </Section>

            <Section
              open={showDetails}
              onToggle={() => setShowDetails((s) => !s)}
              icon={<FileText size={18} className="text-ink-3" />}
              title={`${sources.length} sources checked · ${result.trustedSourceIds.length} trusted`}
              subtitle={conflicts.length ? `${conflicts.length} conflict${conflicts.length > 1 ? "s" : ""} resolved` : "No conflicts"}
            >
              <div className="space-y-4">
                {conflicts.length > 0 && <ConflictsCard conflicts={conflicts} sources={sources} />}
                <SourcesCard sources={sources} trusted={result.trustedSourceIds} />
              </div>
            </Section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Always mounted so the audio element exists before the first click (autoplay unlock). */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 px-4 py-2 backdrop-blur transition ${voice.current ? "translate-y-0" : "pointer-events-none translate-y-full opacity-0"}`}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          {voice.current && voice.current.voice !== "narrator" ? (
            <AgentAvatar agent={voice.current.voice} size={30} active={voice.playingId !== null} />
          ) : (
            <Headphones size={20} className="text-ink-2" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold">
              {voice.loadingId ? "Preparing voice… " : "Now speaking: "}
              {voice.current ? (voice.current.voice === "narrator" ? "TrustLens narrator" : `${AGENT_META[voice.current.voice].name}, ${AGENT_META[voice.current.voice].role}`) : ""}
            </div>
            <div className="truncate text-[11px] text-ink-3">{voice.current?.text}</div>
          </div>
          <audio ref={voice.bindAudio} controls className="h-9 w-72 max-w-[45%]" />
          <button onClick={voice.stop} className="rounded-lg border border-line px-2 py-1 text-xs text-ink-2 hover:bg-white/5">
            Stop
          </button>
        </div>
      </div>

      {voice.error && (
        <p role="alert" className="fixed bottom-20 right-4 z-50 max-w-sm rounded-xl border border-warn/50 bg-panel-2 p-3 text-sm text-ink-2 shadow-2xl">
          🔇 {voice.error}
        </p>
      )}
    </div>
  );
}

function Section({
  open,
  onToggle,
  icon,
  title,
  subtitle,
  children,
  innerRef,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  innerRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div ref={innerRef} className="scroll-mt-4 rounded-2xl border border-line bg-panel">
      <button onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={open}>
        {icon}
        <div className="flex-1">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-ink-3">{subtitle}</div>
        </div>
        <ChevronDown className={`text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-line p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
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
