"use client";
import { Loader2, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Minimal typing for the browser Web Speech API (not in TypeScript's DOM lib).
interface Recognition {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function browserRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const LANG: Record<string, string> = { en: "en-GB", nl: "nl-BE", fr: "fr-BE" };

function micError(e: unknown) {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError") return "Microphone blocked. Allow it via the icon in the address bar, then try again.";
  if (name === "NotFoundError") return "No microphone found on this device.";
  return "Microphone not available in this browser.";
}

/**
 * Records a spoken question and transcribes it with ElevenLabs Scribe.
 * Falls back to the browser's own speech recognition when Scribe is unavailable.
 */
export function VoiceInput({ onText, elevenEnabled, language }: { onText: (text: string) => void; elevenEnabled: boolean; language: string }) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"eleven" | "browser" | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => {
    setMode(elevenEnabled ? "eleven" : browserRecognition() ? "browser" : null);
  }, [elevenEnabled]);

  function startBrowser() {
    const Ctor = browserRecognition();
    if (!Ctor) return setError("Speech recognition is not supported in this browser. Try Chrome or Edge.");
    const rec = new Ctor();
    rec.lang = LANG[language] ?? "en-GB";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript?.trim();
      if (text) onText(text);
    };
    rec.onerror = (e) => setError(e.error === "not-allowed" ? "Microphone blocked. Allow it via the icon in the address bar." : `Speech recognition error: ${e.error}`);
    rec.onend = () => setState("idle");
    recognition.current = rec;
    rec.start();
    setState("recording");
  }

  async function startEleven() {
    if (!navigator.mediaDevices?.getUserMedia) return setError("Microphone needs http://localhost or https.");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      return setError(micError(e));
    }
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setState("transcribing");
      const form = new FormData();
      form.append("audio", new Blob(chunks, { type: (rec.mimeType || "audio/webm").split(";")[0] }), "question.webm");
      const res = await fetch("/api/stt", { method: "POST", body: form }).catch(() => null);
      const data = res?.ok ? ((await res.json()) as { text: string }) : null;
      setState("idle");
      if (data?.text) return onText(data.text);
      if (browserRecognition()) {
        setMode("browser");
        setError("ElevenLabs transcription is unavailable. Switched to browser speech recognition: click the mic and speak again.");
      } else setError("Could not transcribe. Please type your question.");
    };
    recorder.current = rec;
    rec.start();
    setState("recording");
  }

  function toggle() {
    setError(null);
    if (state === "recording") {
      if (recorder.current?.state === "recording") recorder.current.stop();
      recognition.current?.stop();
      return;
    }
    if (mode === "browser") startBrowser();
    else startEleven();
  }

  if (!mode) return null;
  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={toggle}
        disabled={state === "transcribing"}
        className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${
          state === "recording" ? "animate-pulse border-bad bg-bad/20 text-bad" : "border-line bg-panel-2 text-ink-2 hover:text-ink"
        }`}
        aria-label={state === "recording" ? "Stop recording" : "Ask by voice"}
        title={state === "recording" ? "Click to stop and send" : mode === "eleven" ? "Ask by voice (ElevenLabs Scribe)" : "Ask by voice (browser speech recognition)"}
      >
        {state === "recording" ? <Square size={16} /> : state === "transcribing" ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
      </button>
      {error && (
        <span role="alert" className="absolute right-0 top-full z-10 mt-2 w-72 rounded-lg border border-bad/40 bg-panel-2 p-2 text-xs text-ink-2 shadow-lg">
          {error}
        </span>
      )}
    </div>
  );
}
