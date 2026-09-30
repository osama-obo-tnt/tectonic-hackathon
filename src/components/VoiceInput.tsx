"use client";
import { Loader2, Mic, Square } from "lucide-react";
import { useRef, useState } from "react";

/** Records a spoken question and transcribes it with ElevenLabs Scribe. */
export function VoiceInput({ onText, enabled }: { onText: (text: string) => void; enabled: boolean }) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("transcribing");
        const form = new FormData();
        form.append("audio", new Blob(chunks, { type: rec.mimeType || "audio/webm" }), "question.webm");
        const res = await fetch("/api/stt", { method: "POST", body: form }).catch(() => null);
        const data = res?.ok ? ((await res.json()) as { text: string }) : null;
        if (data?.text) onText(data.text);
        else setError("Could not transcribe. Please try again.");
        setState("idle");
      };
      recorder.current = rec;
      rec.start();
      setState("recording");
    } catch {
      setError("Microphone not available");
    }
  }

  if (!enabled) return null;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => (state === "recording" ? recorder.current?.stop() : start())}
        disabled={state === "transcribing"}
        className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${
          state === "recording" ? "border-bad bg-bad/20 text-bad" : "border-line bg-panel-2 text-ink-2 hover:text-ink"
        }`}
        aria-label={state === "recording" ? "Stop recording" : "Ask by voice"}
        title="Ask by voice (ElevenLabs Scribe)"
      >
        {state === "recording" ? <Square size={16} /> : state === "transcribing" ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
      </button>
      {error && <span className="text-xs text-bad">{error}</span>}
    </div>
  );
}
