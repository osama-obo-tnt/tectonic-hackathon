"use client";
import { CheckCircle2, Loader2, Send, UserRoundSearch } from "lucide-react";
import { useState } from "react";
import type { AskResult } from "@/lib/types";

export function ExpertCard({ result }: { result: AskResult }) {
  const expert = result.expert;
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState(result.question);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  if (!expert) return null;

  const context = [
    `TrustLens verdict: ${result.verdict} (${result.trustScore}/100)`,
    ...result.gaps.map((g) => `Gap: ${g}`),
    ...result.conflicts.map((c) => `Conflict: ${c.topicLabel}`),
    `Draft answer: ${result.answer}`,
  ].join("\n");

  async function send() {
    setState("sending");
    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expertId: expert!.expertId, clientId: result.clientId, topic: result.topic, question, context: context.slice(0, 2000) }),
    }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
  }

  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
        <UserRoundSearch size={14} /> Who knows this
      </div>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/20 text-sm font-semibold text-brand">
          {expert.name
            .split(" ")
            .map((p) => p[0])
            .join("")}
        </div>
        <div className="min-w-0">
          <div className="font-medium">{expert.name}</div>
          <div className="truncate text-xs text-ink-3">{expert.title}</div>
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-2">{expert.reason}</p>

      {state === "sent" ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-good/10 p-2 text-xs text-ink-2">
          <CheckCircle2 size={14} className="text-good" /> Sent with full context. Their answer becomes validated knowledge for everyone.
        </div>
      ) : open ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, 500))}
            rows={3}
            className="w-full rounded-lg border border-line bg-panel-2 p-2 text-sm outline-none focus:border-brand"
          />
          <p className="text-[11px] text-ink-3">The trust analysis (conflicts, gaps, draft answer) is attached automatically.</p>
          <button
            onClick={send}
            disabled={state === "sending" || question.trim().length < 5}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium disabled:opacity-60"
          >
            {state === "sending" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send to {expert.name.split(" ")[0]}
          </button>
          {state === "error" && <p className="text-xs text-bad">Could not send. Please try again.</p>}
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="mt-3 w-full rounded-lg border border-brand/60 px-3 py-2 text-sm font-medium text-brand hover:bg-brand/10">
          Ask {expert.name.split(" ")[0]} to confirm
        </button>
      )}
    </div>
  );
}
