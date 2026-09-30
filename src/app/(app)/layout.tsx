import { LogoutButton, Nav } from "@/components/Nav";
import { requirePageUser } from "@/lib/auth";
import { countOpenQuestionsForExpert } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const inboxCount = user.expertId ? countOpenQuestionsForExpert(user.expertId) : 0;
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-panel/60 p-4 backdrop-blur md:flex">
        <Logo />
        <div className="mt-8 flex-1">
          <Nav inboxCount={inboxCount} isExpert={user.role === "expert"} />
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-panel-2 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/25 text-xs font-semibold text-brand">
            {user.name
              .split(" ")
              .map((p) => p[0])
              .join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-[11px] text-ink-3">{user.title}</div>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mb-4 flex items-center justify-between md:hidden">
          <Logo />
          <LogoutButton />
        </div>
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

function Logo() {
  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="brand-bars h-6 w-1.5 rounded-full" />
        <span className="text-lg font-bold tracking-tight">TrustLens</span>
      </div>
      <div className="mt-0.5 whitespace-nowrap pl-3.5 text-[10.5px] text-ink-3">for SDWorx · Find it. Understand it. Trust it.</div>
    </div>
  );
}
