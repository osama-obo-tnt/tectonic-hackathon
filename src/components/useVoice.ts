"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceName = "narrator" | "scout" | "critic" | "arbiter";
export interface SpeakItem {
  id: string;
  text: string;
  voice: VoiceName;
}

// Browser voice fallback, used when ElevenLabs is not configured: pitch/rate make each agent distinct.
const FALLBACK: Record<VoiceName, { pitch: number; rate: number }> = {
  narrator: { pitch: 1, rate: 1 },
  scout: { pitch: 1.25, rate: 1.05 },
  critic: { pitch: 0.75, rate: 1.02 },
  arbiter: { pitch: 0.9, rate: 0.92 },
};

const LANG: Record<string, string> = { en: "en-GB", nl: "nl-BE", fr: "fr-BE" };

async function fetchAudio(item: SpeakItem, signal: AbortSignal): Promise<string | null> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: item.text, voice: item.voice }),
    signal,
  });
  if (!res.ok) return null;
  return URL.createObjectURL(await res.blob());
}

/** Plays a queue of lines one after another, exposing which line is currently speaking. */
export function useVoice(language = "en") {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const urls = useRef<string[]>([]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setPlayingId(null);
    setLoadingId(null);
  }, []);

  useEffect(
    () => () => {
      stop();
      urls.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [stop],
  );

  const playFallback = (item: SpeakItem, signal: AbortSignal) =>
    new Promise<void>((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      const u = new SpeechSynthesisUtterance(item.text);
      u.lang = LANG[language] ?? "en-GB";
      u.pitch = FALLBACK[item.voice].pitch;
      u.rate = FALLBACK[item.voice].rate;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      signal.addEventListener("abort", () => resolve());
      window.speechSynthesis.speak(u);
    });

  const playUrl = (url: string, signal: AbortSignal) =>
    new Promise<void>((resolve) => {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      signal.addEventListener("abort", () => resolve());
      audio.play().catch(() => resolve());
    });

  const speak = useCallback(
    async (items: SpeakItem[]) => {
      stop();
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;

      let next: Promise<string | null> | null = items[0] ? fetchAudio(items[0], signal).catch(() => null) : null;
      for (let i = 0; i < items.length; i++) {
        if (signal.aborted) return;
        const item = items[i];
        setLoadingId(item.id);
        const url = await next;
        // Prefetch the following line while this one plays.
        next = items[i + 1] ? fetchAudio(items[i + 1], signal).catch(() => null) : null;
        if (signal.aborted) return;
        setLoadingId(null);
        setPlayingId(item.id);
        if (url) {
          urls.current.push(url);
          await playUrl(url, signal);
        } else {
          await playFallback(item, signal);
        }
      }
      if (!signal.aborted) {
        setPlayingId(null);
        abortRef.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stop, language],
  );

  return { speak, stop, playingId, loadingId, busy: playingId !== null || loadingId !== null };
}
