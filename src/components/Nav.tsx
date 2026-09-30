"use client";
import { Activity, Inbox, LogOut, MessageSquareText, Network } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function Nav({ inboxCount, isExpert }: { inboxCount: number; isExpert: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/", label: "Ask TrustLens", Icon: MessageSquareText },
    { href: "/sources", label: "Sources map", Icon: Network },
    { href: "/health", label: "Knowledge health", Icon: Activity },
    // Experts answer routed questions here; that is how new validated knowledge is captured.
    ...(isExpert ? [{ href: "/inbox", label: "Expert inbox", Icon: Inbox, count: inboxCount }] : []),
  ];
  return (
    <nav className="space-y-1">
      {items.map(({ href, label, Icon, count }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-white/10 text-ink" : "text-ink-2 hover:bg-white/5"}`}
          >
            <Icon size={16} /> <span className="flex-1">{label}</span>
            {count ? <span className="rounded-full bg-brand px-1.5 text-[11px] font-semibold">{count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="rounded-md p-1.5 text-ink-3 hover:bg-white/10 hover:text-ink"
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut size={16} />
    </button>
  );
}
