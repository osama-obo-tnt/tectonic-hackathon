import { AskView } from "@/components/AskView";
import { demoQuestions } from "@/data/knowledge";
import { requirePageUser } from "@/lib/auth";
import { elevenEnabled } from "@/lib/elevenlabs";
import { llmEnabled } from "@/lib/llm";
import { clientsForUser } from "@/lib/store";

export default async function AskPage() {
  const user = await requirePageUser();
  const clients = clientsForUser(user);
  const examples = demoQuestions.filter((q) => user.clientIds.includes(q.clientId));
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Good to see you, {user.name.split(" ")[0]}. <span className="text-ink-3">What do you need to be sure about?</span>
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          TrustLens searches every knowledge source, lets three AI agents debate what holds up, and shows you exactly why you can (or can&apos;t) rely on it.
        </p>
      </header>
      <AskView clients={clients} examples={examples} voiceEnabled={elevenEnabled()} engine={llmEnabled() ? "claude" : "demo"} />
    </div>
  );
}
