import { AskView } from "@/components/AskView";
import { demoQuestions } from "@/data/knowledge";
import { requirePageUser } from "@/lib/auth";
import { elevenEnabled } from "@/lib/elevenlabs";
import { llmEnabled } from "@/lib/llm";
import { analysesFor, clientsForUser } from "@/lib/store";

export default async function AskPage() {
  const user = await requirePageUser();
  const clients = clientsForUser(user);
  const examples = demoQuestions.filter((q) => user.clientIds.includes(q.clientId));
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Hi {user.name.split(" ")[0]}, what do you need to be sure about?</h1>
        <p className="mt-1 text-sm text-ink-3">Three AI agents check every source and tell you what you can trust, and why.</p>
      </header>
      <AskView clients={clients} examples={examples} voiceEnabled={elevenEnabled()} engine={llmEnabled() ? "claude" : "demo"}
        initial={analysesFor(user.id)[0] ?? null}
      />
    </div>
  );
}
