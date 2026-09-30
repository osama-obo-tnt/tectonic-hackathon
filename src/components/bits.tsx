"use client";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useEffect } from "react";
import type { AgentId, Signal } from "@/lib/types";
import { AGENT_META } from "@/lib/agentMeta";

export const LEVEL_COLOR = { good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)" } as const;

export function SignalChip({ signal }: { signal: Signal }) {
  const Icon = signal.level === "good" ? CheckCircle2 : signal.level === "warn" ? AlertTriangle : XCircle;
  return (
    <span
      title={signal.detail}
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium text-ink-2"
      style={{ borderColor: `color-mix(in srgb, ${LEVEL_COLOR[signal.level]} 45%, transparent)`, background: `color-mix(in srgb, ${LEVEL_COLOR[signal.level]} 10%, transparent)` }}
    >
      <Icon size={12} style={{ color: LEVEL_COLOR[signal.level] }} aria-hidden />
      {signal.label}
    </span>
  );
}

export function AgentAvatar({ agent, size = 40, active = false }: { agent: AgentId; size?: number; active?: boolean }) {
  const meta = AGENT_META[agent];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {active && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: meta.color }}
          initial={{ opacity: 0.5, scale: 1 }}
          animate={{ opacity: 0, scale: 1.6 }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}
      <div
        className="relative flex h-full w-full items-center justify-center rounded-full font-semibold text-bg"
        style={{ background: `linear-gradient(135deg, ${meta.color}, color-mix(in srgb, ${meta.color} 55%, #000))`, fontSize: size * 0.42 }}
        aria-label={`${meta.name}, ${meta.role}`}
      >
        {meta.name[0]}
      </div>
    </div>
  );
}

export function Equalizer({ color }: { color: string }) {
  return (
    <span className="eq inline-flex h-4 items-end" style={{ color }} aria-hidden>
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v).toString());
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.1, ease: "easeOut" });
    return () => controls.stop();
  }, [mv, value]);
  return <motion.span className={className}>{rounded}</motion.span>;
}

export function TrustGauge({ score, verdict }: { score: number; verdict: "trusted" | "caution" | "expert" }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = verdict === "trusted" ? "var(--good)" : verdict === "caution" ? "var(--warn)" : "var(--bad)";
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line)" strokeWidth="9" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedNumber value={score} className="text-3xl font-bold tabular-nums" />
        <span className="text-[10px] uppercase tracking-wider text-ink-3">trust / 100</span>
      </div>
    </div>
  );
}

export const VERDICT = {
  trusted: { label: "Trusted", sub: "You can rely on this", color: "var(--good)", Icon: CheckCircle2 },
  caution: { label: "Use with caution", sub: "Mostly reliable: check the flagged parts", color: "var(--warn)", Icon: AlertTriangle },
  expert: { label: "Ask an expert", sub: "Not enough trusted knowledge", color: "var(--bad)", Icon: XCircle },
} as const;
