"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceName = "narrator" | "scout" | "critic" | "arbiter";
export interface SpeakItem {
  id: string;
  text: string;
  voice: VoiceName;
}

// Browser voice fallback, used when ElevenLabs is unavailable: pitch/rate make each agent distinct.
const FALLBACK: Record<VoiceName, { pitch: number; rate: number }> = {
  narrator: { pitch: 0.85, rate: 1 },
  scout: { pitch: 1.25, rate: 1.05 },
  critic: { pitch: 0.75, rate: 1.02 },
  arbiter: { pitch: 0.9, rate: 0.92 },
};

const LANG: Record<string, string> = { en: "en-GB", nl: "nl-BE", fr: "fr-BE" };

// 0.1s of silence. Playing it inside the click "unlocks" the audio element, so browsers
// that block sound started after an await (Firefox, Safari, Brave) still play the voices.
const SILENCE = "data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";

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
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<SpeakItem | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const urls = useRef<string[]>([]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    audioRef.current?.pause();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setPlayingId(null);
    setLoadingId(null);
    setCurrent(null);
  }, []);

  /** Attach to a visible <audio controls> element so users can press play if autoplay is blocked. */
  const bindAudio = useCallback((el: HTMLAudioElement | null) => {
    if (el) audioRef.current = el;
  }, []);

  useEffect(
    () => () => {
      stop();
      urls.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [stop],
  );

  /** Must run synchronously inside the click handler. */
  function unlock() {
    if (!audioRef.current) audioRef.current = new Audio();
    const el = audioRef.current;
    el.src = SILENCE;
    el.play().catch(() => {});
    if ("speechSynthesis" in window) window.speechSynthesis.resume();
  }

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
    new Promise<boolean>((resolve) => {
      const el = audioRef.current ?? new Audio();
      audioRef.current = el;
      el.onended = () => resolve(true);
      el.onerror = () => resolve(false);
      signal.addEventListener("abort", () => resolve(true));
      el.src = url;
      el.play().catch((e: unknown) => {
        const name = e instanceof DOMException ? e.name : "";
        if (name === "NotAllowedError") {
          // Keep the line loaded; the visible player lets the user start it manually.
          el.onplay = () => setError(null);
        } else resolve(false);
        setError(
          name === "NotAllowedError"
            ? "Your browser blocked auto-play. Press ▶ on the player below, or allow audio for localhost in the address bar."
            : "Could not play audio in this browser.",
        );
      });
    });

  const speak = useCallback(
    async (items: SpeakItem[]) => {
      stop();
      unlock();
      setError(null);
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;

      let next: Promise<string | null> | null = items[0] ? fetchAudio(items[0], signal).catch(() => null) : null;
      for (let i = 0; i < items.length; i++) {
        if (signal.aborted) return;
        const item = items[i];
        setLoadingId(item.id);
        setCurrent(item);
        const url = await next;
        // Prefetch the following line while this one plays.
        next = items[i + 1] ? fetchAudio(items[i + 1], signal).catch(() => null) : null;
        if (signal.aborted) return;
        setLoadingId(null);
        setPlayingId(item.id);
        let played = false;
        if (url) {
          urls.current.push(url);
          played = await playUrl(url, signal);
        }
        if (!played && !signal.aborted) await playFallback(item, signal);
      }
      if (!signal.aborted) {
        setPlayingId(null);
        setCurrent(null);
        abortRef.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stop, language],
  );

  return { speak, stop, bindAudio, current, playingId, loadingId, error, busy: playingId !== null || loadingId !== null };
}
