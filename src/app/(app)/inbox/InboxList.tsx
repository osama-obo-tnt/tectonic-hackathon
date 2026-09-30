"use client";
import { CheckCircle2, Clock, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExpertQuestion } from "@/lib/types";

type Q = ExpertQuestion & { clientName: string; expertName: string };

export function InboxList({ questions, mode }: { questions: Q[]; mode: "expert" | "asker" }) {
  if (!questions.length)
    return <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ink-3">Nothing here yet.</div>;
  return (
    <div className="space-y-3">
      {questions.map((q) => (
        <QuestionCard key={q.id} q={q} mode={mode} />
      ))}
    </div>
  );
}

function QuestionCard({ q, mode }: { q: Q; mode: "expert" | "asker" }) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");

  async function submit() {
    setState("sending");
    const res = await fetch(`/api/questions/${encodeURIComponent(q.id)}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    }).catch(() => null);
    if (res?.ok) router.refresh();
    else setState("error");
  }

  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-start gap-3">
        {q.status === "answered" ? <CheckCircle2 size={18} className="mt-0.5 text-good" /> : <Clock size={18} className="mt-0.5 text-warn" />}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{q.question}</div>
          <div className="mt-0.5 text-xs text-ink-3">
            {q.clientName} · {mode === "expert" ? `from ${q.askerName}` : `to ${q.expertName}`} · {new Date(q.createdAt).toLocaleString("en-GB")}
          </div>
          {mode === "expert" && q.context && (
            <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-panel-2 p-3 font-sans text-xs text-ink-2">{q.context}</pre>
          )}
          {q.answer && (
            <div className="mt-3 rounded-lg border border-good/30 bg-good/5 p-3 text-sm">
              <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-good">
                <Sparkles size={12} /> Captured as validated knowledge
              </div>
              {q.answer}
            </div>
          )}
          {mode === "expert" && q.status === "open" && (
            <div className="mt-3 space-y-2">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value.slice(0, 3000))}
                rows={3}
                placeholder="Your answer. It will be saved as validated knowledge for this client."
                className="w-full rounded-lg border border-line bg-panel-2 p-2 text-sm outline-none focus:border-brand"
              />
              <button
                onClick={submit}
                disabled={state === "sending" || answer.trim().length < 5}
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium disabled:opacity-60"
              >
                {state === "sending" && <Loader2 size={14} className="animate-spin" />} Answer & capture
              </button>
              {state === "error" && <p className="text-xs text-bad">Could not save the answer.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
