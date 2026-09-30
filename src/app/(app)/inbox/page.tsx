import { requirePageUser } from "@/lib/auth";
import { getClient, getExpert, questionsAskedBy, questionsForExpert } from "@/lib/store";
import { InboxList } from "./InboxList";

export default async function InboxPage() {
  const user = await requirePageUser();
  const inbox = user.expertId ? questionsForExpert(user.expertId) : [];
  const asked = questionsAskedBy(user.id);
  const decorate = (q: (typeof asked)[number]) => ({
    ...q,
    clientName: getClient(q.clientId)?.name ?? "Unknown client",
    expertName: getExpert(q.expertId)?.name ?? "Expert",
  });

  return (
    <div className="space-y-8">
      {user.expertId && (
        <section>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Expert inbox</h1>
          <p className="mb-4 mt-1 text-sm text-ink-3">
            Questions routed to you with the full trust analysis attached. Your answer becomes validated knowledge, so the next colleague gets a trusted answer
            instantly.
          </p>
          <InboxList questions={inbox.map(decorate)} mode="expert" />
        </section>
      )}
      <section>
        <h2 className={user.expertId ? "text-lg font-semibold" : "text-2xl font-bold tracking-tight md:text-3xl"}>Questions I asked</h2>
        <p className="mb-4 mt-1 text-sm text-ink-3">Follow up on questions you routed to experts.</p>
        <InboxList questions={asked.map(decorate)} mode="asker" />
      </section>
    </div>
  );
}
