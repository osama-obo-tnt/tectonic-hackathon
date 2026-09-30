"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { AnimatedNumber } from "./bits";

export function StatTile({ label, value, sub, tone }: { label: string; value: number; sub: string; tone?: "good" | "warn" | "bad" }) {
  const color = tone ? `var(--${tone})` : "var(--ink)";
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line bg-panel p-4">
      <div className="text-xs text-ink-3">{label}</div>
      <AnimatedNumber value={value} className="mt-1 block text-3xl font-bold tabular-nums" />
      <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-2">
        {tone && <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />}
        {sub}
      </div>
    </motion.div>
  );
}

/** Single-series horizontal bars: share of sources affected by each issue. */
export function IssueBars({ rows, total }: { rows: { label: string; count: number; hint: string }[]; total: number }) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="space-y-3" role="table" aria-label="Sources affected per issue">
      {rows.map((r, i) => {
        const pct = total ? Math.round((r.count / total) * 100) : 0;
        return (
          <div
            key={r.label}
            role="row"
            className="relative"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="mb-1 flex justify-between text-xs">
              <span role="cell" className="text-ink-2">
                {r.label}
              </span>
              <span role="cell" className="tabular-nums text-ink-2">
                {r.count} of {total} · {pct}%
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-line">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "var(--brand)", opacity: hover === null || hover === i ? 1 : 0.45 }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.9, delay: 0.1 * i, ease: "easeOut" }}
              />
            </div>
            {hover === i && (
              <div className="absolute right-0 top-full z-10 mt-1 rounded-lg border border-line bg-panel-2 px-2 py-1 text-[11px] text-ink-2 shadow-lg">
                {r.hint}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
