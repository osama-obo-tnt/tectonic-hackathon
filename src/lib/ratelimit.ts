import "server-only";
import { NextResponse } from "next/server";

// In-memory fixed-window limiter. Fine for a single instance; use Redis/Memorystore when scaling out.
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): NextResponse | null {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return null;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    const retry = Math.ceil((bucket.reset - now) / 1000);
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(retry) } });
  }
  return null;
}
