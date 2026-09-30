# TrustLens: Find it. Understand it. Trust it.

**Tectonic Hackathon 2026 · SD Worx challenge: "Unlock the Knowledge Within"**

> **Short description:** TrustLens turns SD Worx's scattered knowledge (policies, SharePoint pages, Teams chats, emails, handover notes) into answers people can trust. Three AI agents (a Scout, a Critic and an Arbiter) debate every source out loud, a transparent trust score shows *why* an answer can be relied on, conflicts and knowledge gaps are flagged, and the right expert is one click away. Their answer is captured as validated knowledge for the next colleague.

*Search finds answers. TrustLens tells you which one to trust, and why.*

---

## 1. The problem

SD Worx runs payroll and HR for 100,000+ customers in 100+ countries. Its knowledge lives in policies, manuals, SharePoint, Teams channels, mailboxes, handover notes and the heads of experts.

**Finding information is easy. Trusting it is hard.** A search returns an outdated procedure, a document with no owner, a rule for another country and a Teams message that contradicts all three. The consultant *has* the information but cannot act on it with confidence. That leads to slow decisions, repeated work, payroll errors and overloaded experts.

## 2. Our focus

One **role** (a payroll consultant), one **moment** (an urgent client question, for example right after inheriting a client portfolio from a colleague who left). TrustLens moves that person from *"I found something"* to *"I understand why I can rely on it."*

## 3. What TrustLens does

| The brief's question | How TrustLens answers it |
|---|---|
| **Is it reliable?** | Every source gets explainable trust signals: *scope*, *freshness*, *validation*, *ownership* |
| **Is it current?** | Superseded and outdated documents are detected and set aside |
| **Does it apply here?** | Sources for the wrong country or joint committee (e.g. PC 124 vs PC 200) are flagged, never silently used |
| **Where are the gaps?** | Conflict detection between sources, and gap detection for questions no source covers |
| **Who has the expertise?** | Expert routing with the full trust analysis attached; the expert's answer becomes validated knowledge |

### The screens
- **Ask TrustLens:** ask a question for one of your clients. You get the answer, a trust gauge (0–100), a verdict (*Trusted / Use with caution / Ask an expert*) and, when needed, a knowledge-gap card and the expert who can confirm it.
  - **"See why"** opens the full chain of reasoning: the debate between the three agents, which you can **read or listen to**.
  - **Sources checked** lists every source with its trust signals and the conflicts that were resolved.
  - **EN / NL / FR:** switching language translates the whole result (answer, debate, signals and labels).
- **Sources map:** an interactive graph of where knowledge lives (SharePoint, Teams, Outlook, OneDrive, Intranet) → each document (coloured by trust) → its topic, with red arcs where documents contradict each other.
- **Knowledge health:** an interactive **reasoning map** of your recent questions (question → agents → sources, with conflicts), plus organisation-wide health: contradictions, outdated and unvalidated knowledge, and handover risk (documents owned by people who left).
- **Expert inbox** (experts only): questions routed to you with context. Your answer is captured as validated knowledge.

## 4. How it works

```
 Question + client ──► 1. Retrieve ──► 2. Score ──► 3. Detect ──► 4. Debate ──► 5. Verdict ──► 6. Capture
                         topic &        trust        conflicts     Nova → Rex    trust score    expert answer
                         sources        signals      & gaps        → Nova → Sage  + expert      → new knowledge
```

1. **Retrieve.** The question is matched to a topic, and every source on that topic the user is allowed to see is collected. Client-specific notes are only visible to consultants who manage that client.
2. **Score (deterministic, never the AI).** Each source gets four signals and a 0–100 score:

   | Signal | Weight | Examples |
   |---|---|---|
   | Scope | 35% | applies here · client-specific · wrong country · wrong joint committee |
   | Freshness | 25% | current · ageing · outdated · superseded |
   | Validation | 25% | expert-validated · official but unreviewed · informal chat/email |
   | Ownership | 15% | owned · orphaned (owner left) · no owner |

3. **Detect.**
   - **Conflicts:** sources that make different claims on the same point. The strongest source wins, and the reason is shown.
   - **Gaps:** parts of the question no source covers.
4. **Debate (Claude).** Three agents discuss the evidence like colleagues at a table:
   - **Nova, the Scout:** presents what she found and a draft answer
   - **Rex, the Critic:** challenges outdated, ownerless, informal or out-of-scope sources and conflicts
   - **Nova** responds: she concedes what Rex got right and defends what still holds
   - **Sage, the Arbiter:** gives the ruling and the final answer

   Each turn is streamed live to the screen and has its own **ElevenLabs voice**.
5. **Verdict.** The overall trust score is computed from the trusted sources, with penalties for close conflicts and a cap when there is a gap. The best expert is suggested based on topic, ownership of the trusted source, and track record.
6. **Capture.** "Ask Sarah to confirm" sends the question plus the trust analysis to the expert. Their answer is stored as a new *expert-validated, client-specific* source. Ask again and the verdict goes from **Use with caution (72)** to **Trusted (98)**.

The trust score is **transparent by design**: the agents *explain* it, but they don't *decide* it. TrustLens is never a black box.

## 5. Tech stack

| Layer | Technology |
|---|---|
| App | Next.js 15 (App Router, TypeScript), React 19 |
| UI | Tailwind CSS 4, Framer Motion, lucide icons, hand-built SVG graphs |
| AI agents | **Claude** (`claude-opus-5`) via the Anthropic SDK, with Zod-validated structured outputs |
| Voice | **ElevenLabs**: multilingual text-to-speech (a distinct voice per agent) and a multi-speaker debate podcast (Eleven v3 dialogue) |
| Trust engine | Deterministic TypeScript (`src/lib/trust.ts`) |
| Data | Fictional SD Worx knowledge base (`src/data/knowledge.ts`) and a file-backed store for runtime data |

## 6. Run it locally

**Requirements:** Node.js 20+.

```bash
git clone https://github.com/osama-obo-tnt/tectonic-hackathon.git
cd tectonic-hackathon
npm install
cp .env.example .env.local      # then fill in the values (see below)
npm run dev                     # http://localhost:3000
```

**`.env.local`**

| Variable | Required | Purpose |
|---|---|---|
| `AUTH_SECRET` | yes | Session signing secret, at least 32 characters. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DEMO_PASSWORD` | yes | Password shared by the demo accounts (at least 8 characters) |
| `ANTHROPIC_API_KEY` | recommended | Live Claude agents and translation. Without it, TrustLens uses built-in demo agents |
| `ELEVENLABS_API_KEY` | recommended | Real agent voices. Without it, the browser's own voices are used |

**Demo accounts** (password = your `DEMO_PASSWORD`):

| Account | Role | Clients |
|---|---|---|
| `lotte@sdworx.demo` | Payroll consultant | Brouwerij De Klok (BE, PC 200), Van Damme Logistics (BE), LuxTech (LU) |
| `pieter@sdworx.demo` | Payroll consultant | Other portfolio (used to show access isolation) |
| `sarah@sdworx.demo` | Expert: Belgian payroll, PC 200 | |
| `marc@sdworx.demo` | Expert: cross-border mobility | |
| `ines@sdworx.demo` | Expert: tax & allowances | |

### Demo script (3 minutes)
1. Sign in as **Lotte** and ask *"An employee at De Klok resigned in August. Do they still get a year-end bonus?"*. TrustLens checks 6 sources, sets aside the superseded 2021 rule, an unverified Teams message, a Dutch document and a construction-sector document, and answers **Use with caution (72)** with a knowledge gap.
2. Click **see why** → **Listen to the debate**: Nova, Rex and Sage argue it out in three voices.
3. Click **Ask Sarah to confirm** → sign in as **Sarah** → answer in the **Expert inbox**.
4. Sign in as **Lotte** again and ask the same question. It is now **Trusted (98)**, backed by Sarah's captured answer.
5. Open **Sources map** and **Knowledge health** to explore the graphs, and switch the result to **NL** or **FR**.

Other questions to try:
- *"What is the maximum tax-free telework allowance I can pay at Van Damme this year?"* → **Trusted**
- *"Can a LuxTech employee living in Belgium telework 40 days from home this year?"* → **Trusted**
- Anything off-topic → **Ask an expert**

## 7. Security

- **Authentication:** HS256-signed session JWT in an `httpOnly`, `SameSite=Lax` cookie with an 8-hour lifetime. Passwords are bcrypt-hashed and compared in constant time, even for unknown accounts. Login is rate-limited per IP and per account.
- **Authorization on every API route (no IDOR):**
  - Consultants can only query clients in their own portfolio, and client-specific knowledge is filtered by portfolio.
  - Only the expert a question was routed to can answer it, and only once.
  - Users only see their own questions and analyses. Translation only ever touches the caller's own latest analysis.
- **CSRF defence:** an Origin check on every state-changing request.
- **Input validation:** Zod schemas and length limits on all input. Per-user rate limits on the AI and voice endpoints.
- **Secrets stay on the server:** API keys never reach the browser, and ElevenLabs voice IDs are allow-listed server-side.
- **Security headers:** Content-Security-Policy, `frame-ancestors 'none'`, `nosniff`, HSTS, and a restrictive Permissions-Policy.
- **Prompt-injection hygiene:** source text is passed to the model as delimited data, with instructions to ignore any instructions inside it.

## 8. Project structure

```
src/
  data/knowledge.ts          fictional SD Worx knowledge base: sources, clients, experts, users
  lib/trust.ts               retrieval, trust signals, conflicts, gaps, expert routing, overall score
  lib/agents.ts              Scout → Critic → Scout → Arbiter pipeline (Claude, with demo fallback)
  lib/llm.ts                 Claude client (structured outputs, refusal fallback)
  lib/translate.ts           translates a full result into NL / FR
  lib/elevenlabs.ts          text-to-speech and debate dialogue
  lib/auth.ts, session.ts    authentication; middleware.ts protects every route
  lib/store.ts               expert questions, captured knowledge, recent analyses
  app/api/*                  ask (streaming), tts, dialogue, translate, questions, auth
  app/(app)/*                Ask, Sources map, Knowledge health, Expert inbox
  components/*               UI: answer card, debate panel, reasoning map, sources map
```

## 9. How it scales to SD Worx

- **Connectors instead of seed data:** SharePoint, Teams and Outlook through Microsoft Graph, with embeddings in a vector store.
- **Continuous checking:** claim extraction at ingestion time, so conflict detection runs across the whole knowledge base, not just per question.
- **Signals from existing metadata:** modified dates, owners from the HR system, country and joint-committee tags.
- **Knowledge that compounds:** every expert answer is captured once and reused by everyone, so experts get their time back.

## 10. Limitations / not finished

- All knowledge, people, clients, amounts and rules are **fictional** demo data. This is not payroll or legal advice.
- Retrieval is topic- and keyword-based; production would use semantic search.
- Runtime data is a local JSON file and the rate limiter is in-memory (single instance).
- Demo accounts share one password taken from the environment.
- Some browsers (Firefox, Brave) may block auto-play. Press ▶ on the "Now speaking" bar to start the voices.
