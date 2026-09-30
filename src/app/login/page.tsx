import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { currentUser } from "@/lib/auth";
import { users } from "@/data/knowledge";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  const accounts = users.map((u) => ({ email: u.email, name: u.name, title: u.title, role: u.role }));
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-line bg-panel/80 backdrop-blur md:grid-cols-2">
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-brand/25 via-arbiter/10 to-transparent p-8 md:flex">
          <div>
            <div className="flex items-center gap-2">
              <div className="brand-bars h-7 w-1.5 rounded-full" />
              <span className="text-xl font-bold">TrustLens</span>
            </div>
            <p className="mt-6 text-3xl font-bold leading-tight">
              Find it.
              <br />
              Understand it.
              <br />
              <span className="text-brand">Trust it.</span>
            </p>
            <p className="mt-4 text-sm text-ink-2">
              Three AI agents search, challenge and weigh SD Worx&apos;s scattered knowledge, so you know which answer to rely on and why.
            </p>
          </div>
          <p className="text-xs text-ink-3">Hackathon proof of concept · fictional demo data</p>
        </div>
        <div className="p-8">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mb-6 text-sm text-ink-3">Use a demo account. The password is in the README / .env.</p>
          <LoginForm accounts={accounts} />
        </div>
      </div>
    </main>
  );
}
