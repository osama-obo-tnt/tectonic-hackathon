"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Headphones, Loader2, Pause, Play, Radio } from "lucide-react";
import { useState } from "react";
import { AGENT_META } from "@/lib/agentMeta";
import type { T } from "@/lib/i18n";
import type { ScoredSource, Turn } from "@/lib/types";
import { AgentAvatar, Equalizer } from "./bits";
import type { useVoice } from "./useVoice";

export function DebatePanel({
  turns,
  sources,
  voice,
  voiceEnabled,
  t: tr,
}: {
  turns: Turn[];
  sources: ScoredSource[];
  voice: ReturnType<typeof useVoice>;
  voiceEnabled: boolean;
  t: T;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [podcast, setPodcast] = useState<{ state: "idle" | "loading" | "ready" | "error"; url?: string }>({ state: "idle" });
  const titleOf = (id: string) => sources.find((s) => s.source.id === id)?.source.title ?? id;
  const items = turns.map((t, i) => ({ id: `turn-${i}`, text: t.text, voice: t.agent }));
  const debatePlaying = voice.busy && (voice.playingId?.startsWith("turn-") || voice.loadingId?.startsWith("turn-"));

  async function renderPodcast() {
    setPodcast({ state: "loading" });
    try {
      const res = await fetch("/api/dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: turns.map((t) => ({ text: t.text.slice(0, 800), voice: t.agent })) }),
      });
      if (!res.ok) throw new Error();
      setPodcast({ state: "ready", url: URL.createObjectURL(await res.blob()) });
    } catch {
      setPodcast({ state: "error" });
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => (debatePlaying ? voice.stop() : voice.speak(items))}
          className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/15"
        >
          {debatePlaying ? <Pause size={16} /> : <Headphones size={16} />}
          {debatePlaying ? tr("stop") : tr("listenDebate")}
        </button>
        {voiceEnabled && (
          <button
            onClick={renderPodcast}
            disabled={podcast.state === "loading"}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink-2 hover:bg-white/5 disabled:opacity-60"
            title="Render the whole debate as one natural multi-voice conversation (ElevenLabs v3 dialogue)"
          >
            {podcast.state === "loading" ? <Loader2 size={16} className="animate-spin" /> : <Radio size={16} />}
            {podcast.state === "loading" ? tr("producingPodcast") : tr("podcast")}
          </button>
        )}
        {podcast.state === "ready" && podcast.url && <audio src={podcast.url} controls autoPlay className="h-9" />}
        {podcast.state === "error" && <span className="text-xs text-bad">{tr("podcastError")}</span>}
      </div>

      <ol className="relative space-y-4 before:absolute before:left-5 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-line">
        {turns.map((t, i) => {
          const meta = AGENT_META[t.agent];
          const id = `turn-${i}`;
          const speaking = voice.playingId === id;
          const loading = voice.loadingId === id;
          return (
            <motion.li
              key={id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.12 }}
              className="relative flex gap-3"
            >
              <AgentAvatar agent={t.agent} active={speaking} />
              <div
                className="flex-1 rounded-xl border bg-panel-2 p-3 transition-colors"
                style={{ borderColor: speaking ? meta.color : "var(--line)" }}
              >
                <div className="mb-1 flex items-center gap-2 text-xs">
                  <span className="font-semibold" style={{ color: meta.color }}>
                    {meta.name}
                  </span>
                  <span className="text-ink-3">
                    {tr(`role.${t.agent}`)} · {tr(`turn.${t.stage}`)}
                  </span>
                  {speaking && <Equalizer color={meta.color} />}
                  {loading && <Loader2 size={12} className="animate-spin text-ink-3" />}
                  <button
                    onClick={() => (speaking ? voice.stop() : voice.speak([{ id, text: t.text, voice: t.agent }]))}
                    className="ml-auto rounded-md p-1 text-ink-3 hover:bg-white/10 hover:text-ink"
                    aria-label={speaking ? `Stop ${meta.name}` : `Listen to ${meta.name}`}
                  >
                    {speaking ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                </div>
                <p className="text-sm leading-relaxed text-ink">{t.text}</p>
                {(t.points.length > 0 || t.sourceIds.length > 0) && (
                  <button
                    onClick={() => setOpen(open === i ? null : i)}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink-2"
                    aria-expanded={open === i}
                  >
                    <ChevronDown size={14} className={`transition-transform ${open === i ? "rotate-180" : ""}`} />
                    {tr("reasoningSources")}
                  </button>
                )}
                <AnimatePresence>
                  {open === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <ul className="mt-2 space-y-1 text-xs text-ink-2">
                        {t.points.map((p, j) => (
                          <li key={j} className="flex gap-2">
                            <span style={{ color: meta.color }}>›</span>
                            {p}
                          </li>
                        ))}
                      </ul>
                      {t.sourceIds.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {t.sourceIds.map((sid) => (
                            <span key={sid} className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-ink-3">
                              {titleOf(sid)}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
