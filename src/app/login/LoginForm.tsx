"use client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({ accounts }: { accounts: { email: string; name: string; title: string; role: string }[] }) {
  const router = useRouter();
  const [email, setEmail] = useState(accounts[0]?.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);
    setLoading(false);
    if (res?.ok) {
      router.push("/");
      router.refresh();
    } else setError(res?.status === 429 ? "Too many attempts. Try again later." : "Invalid email or password");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        {accounts.map((a) => (
          <button
            type="button"
            key={a.email}
            onClick={() => setEmail(a.email)}
            className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition ${
              email === a.email ? "border-brand bg-brand/10" : "border-line hover:border-ink-3"
            }`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
              {a.name
                .split(" ")
                .map((p) => p[0])
                .join("")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{a.name}</div>
              <div className="truncate text-[11px] text-ink-3">{a.title}</div>
            </div>
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-ink-3">{a.role}</span>
          </button>
        ))}
      </div>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoComplete="current-password"
        className="h-11 w-full rounded-xl border border-line bg-panel-2 px-4 text-sm outline-none focus:border-brand"
      />
      {error && <p className="text-sm text-bad">{error}</p>}
      <button disabled={loading || !password} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold disabled:opacity-60">
        {loading && <Loader2 size={16} className="animate-spin" />} Sign in
      </button>
    </form>
  );
}
