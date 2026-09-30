import "server-only";
import { createHash } from "node:crypto";

const API = "https://api.elevenlabs.io/v1";

// Each speaker gets a distinct premade ElevenLabs voice (override via env).
export const VOICES = {
  narrator: process.env.ELEVENLABS_VOICE_NARRATOR ?? "nPczCjzI2devNBz1zQrb", // Brian: deep, calm male narrator
  scout: process.env.ELEVENLABS_VOICE_SCOUT ?? "cgSgspJ2msm6clMCkdW9", // Jessica: bright and curious
  critic: process.env.ELEVENLABS_VOICE_CRITIC ?? "N2lVS1w4EtoT3dr4eOWO", // Callum: gritty and sceptical
  arbiter: process.env.ELEVENLABS_VOICE_ARBITER ?? "onwK4e9ZLuTAKqWW03F9", // Daniel: measured, authoritative
} as const;
export type VoiceKey = keyof typeof VOICES;

export function elevenEnabled() {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

function headers(extra: Record<string, string> = {}) {
  return { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "", ...extra };
}

// Small in-memory cache so replaying a debate does not spend credits twice.
const cache = new Map<string, ArrayBuffer>();
const MAX_CACHE = 200;
function remember(key: string, audio: ArrayBuffer) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(key, audio);
}

export async function textToSpeech(text: string, voice: VoiceKey): Promise<ArrayBuffer> {
  const key = createHash("sha256").update(`tts:${voice}:${text}`).digest("hex");
  const hit = cache.get(key);
  if (hit) return hit;
  const res = await fetch(`${API}/text-to-speech/${VOICES[voice]}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", Accept: "audio/mpeg" }),
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_TTS_MODEL ?? "eleven_multilingual_v2",
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: voice === "critic" ? 0.45 : 0.25 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS failed (${res.status})`);
  const audio = await res.arrayBuffer();
  remember(key, audio);
  return audio;
}

/** Renders the whole agent debate as one multi-speaker conversation (Eleven v3 dialogue). */
export async function textToDialogue(lines: { text: string; voice: VoiceKey }[]): Promise<ArrayBuffer> {
  const key = createHash("sha256").update(`dlg:${JSON.stringify(lines)}`).digest("hex");
  const hit = cache.get(key);
  if (hit) return hit;
  const res = await fetch(`${API}/text-to-dialogue?output_format=mp3_44100_128`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", Accept: "audio/mpeg" }),
    body: JSON.stringify({
      model_id: "eleven_v3",
      inputs: lines.map((l) => ({ text: l.text, voice_id: VOICES[l.voice] })),
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs dialogue failed (${res.status})`);
  const audio = await res.arrayBuffer();
  remember(key, audio);
  return audio;
}

export async function speechToText(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", audio, "question.webm");
  form.append("model_id", process.env.ELEVENLABS_STT_MODEL ?? "scribe_v1");
  const res = await fetch(`${API}/speech-to-text`, { method: "POST", headers: headers(), body: form });
  if (!res.ok) throw new Error(`ElevenLabs STT failed (${res.status})`);
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}
