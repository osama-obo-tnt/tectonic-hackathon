# TrustLens: Find it. Understand it. Trust it.

**Tectonic Hackathon 2026 · SD Worx challenge: "Unlock the Knowledge Within"**

> *Search finds answers. TrustLens tells you which one to trust, and why.*

At SD Worx, knowledge is scattered across policies, SharePoint, Teams chats, emails, handover notes and experts' heads. Finding information is easy. **Knowing whether it is reliable, current and applies to *this* client, country and joint committee is hard.** TrustLens turns that moment of doubt into confidence.

## The workflow we focused on
**One role:** a payroll consultant. **One moment:** an urgent client question, for example after inheriting a client portfolio from a colleague who left.

## What it does
| Brief's question | TrustLens answer |
|---|---|
| What is reliable? | Every source gets explainable **trust signals**: scope (country / joint committee / client), freshness, expert validation, ownership |
| What is current? | Superseded and outdated documents are detected and set aside |
| What applies in this context? | Sources for the wrong country or sector are flagged, never silently used |
| Where are the gaps? | **Conflict detection** (sources that contradict each other) and **gap detection** |
| Who has relevant expertise? | **Expert routing** with the full trust analysis attached. The expert's answer is **captured as validated knowledge**, so the next colleague gets a trusted answer instantly |

### A visible chain of reasoning: three AI agents debate
Click the verdict (**"see why"**) to open the full chain of reasoning:
- **Nova, the Scout**: finds and assembles the evidence
- **Rex, the Critic**: challenges every source (outdated? no owner? wrong country? contradicts another source?)
- **Sage, the Arbiter**: weighs both sides and gives the ruling

The trust score is **computed from transparent signals** (scope 35%, freshness 25%, validation 25%, ownership 15%, with penalties for close conflicts and gaps), **not by the LLM**. The agents explain it, so it is never a black box.

### Voice (ElevenLabs)
- **Listen to the answer** (narrator voice)
- **Listen to the debate**: each agent has its own distinct voice, and the speaker is highlighted as it plays
- **Debate podcast**: the whole debate rendered as one natural multi-speaker conversation with the Eleven v3 dialogue model
- **Ask by voice**: speech-to-text with ElevenLabs Scribe
- Answers in **English, Dutch or French** (multilingual voices)

### Knowledge health dashboard
Organisation-wide view of contradictions, outdated and unvalidated knowledge, and **handover risk** (documents whose owner left SD Worx).

## Tech stack
- **Next.js 15** (App Router, TypeScript), Tailwind CSS 4, Framer Motion
- **Claude (`claude-opus-5`, Anthropic SDK)** for the three agents, with Zod-validated structured outputs
- **ElevenLabs**: text-to-speech, text-to-dialogue (v3), speech-to-text (Scribe)
- Deterministic trust engine (`src/lib/trust.ts`) plus a file-backed store for captured knowledge

```
src/
  data/knowledge.ts     fictional SD Worx knowledge base (sources, clients, experts)
  lib/trust.ts          retrieval, trust signals, conflicts, gaps, expert routing
  lib/agents.ts         Scout → Critic → Scout rebuttal → Arbiter pipeline (Claude + demo fallback)
  lib/elevenlabs.ts     TTS, dialogue, STT
  lib/auth.ts, session.ts, middleware.ts   authentication & authorization
  app/api/*             ask (streaming), tts, dialogue, stt, questions, auth
  app/(app)/*           Ask, Knowledge health, Expert inbox
```

## Run it
```bash
npm install
cp .env.example .env.local   # then fill in AUTH_SECRET and DEMO_PASSWORD (keys optional)
npm run dev                  # http://localhost:3000
```
Sign in with a demo account (the password is your `DEMO_PASSWORD`):
- `lotte@sdworx.demo`: consultant (De Klok, Van Damme, LuxTech)
- `pieter@sdworx.demo`: consultant (other portfolio, used to show access isolation)
- `sarah@sdworx.demo`, `marc@sdworx.demo`, `ines@sdworx.demo`: experts

**Without API keys it still works:** built-in demo agents and browser speech take over. Add `ANTHROPIC_API_KEY` for live Claude agents and `ELEVENLABS_API_KEY` for real voices.

### Demo script
1. As Lotte, ask *"An employee at De Klok resigned in August. Do they still get a year-end bonus?"*. It finds 6 sources, sets aside the outdated 2021 rule, the Teams rumour, the Dutch and construction documents, and returns **Use with caution** with a gap.
2. Click **see why** → **Listen to the debate**.
3. Click **Ask Sarah to confirm**. Sign in as Sarah, then answer in the **Expert inbox**.
4. Sign in as Lotte again and ask the same question. The answer is now **Trusted**, backed by Sarah's captured answer.

## Security
- Session auth: HS256 JWT in an `httpOnly`, `SameSite=Lax` cookie; bcrypt-hashed passwords; constant-time behaviour for unknown accounts; login rate limiting
- **Authorization on every API route.** Consultants can only query clients in their own portfolio, and client-specific knowledge is filtered by portfolio. Only the expert a question was routed to can answer it, and only once (no IDOR). Users only see their own questions
- CSRF defence (Origin check on all state-changing requests), Zod validation and length limits on all input, per-user rate limits on AI and voice endpoints
- The ElevenLabs voice IDs are allow-listed server-side; API keys never reach the browser
- Security headers: CSP, frame-ancestors none, nosniff, HSTS, Permissions-Policy
- Source content is passed to the LLM as delimited data, with instructions to ignore any instructions inside it

## Scaling to SD Worx (10,000+ employees, 100+ countries)
- Replace the seed data with connectors (SharePoint / Graph API for Teams and Outlook), and store embeddings in a vector database (such as AlloyDB or Vertex AI Vector Search)
- Extract claims with an LLM at ingestion time, so conflict detection runs continuously rather than per question
- Trust signals come from metadata that already exists (modified date, owner in HR data, country and joint committee tags)
- Every expert answer compounds: fewer repeated questions, and experts get their time back

## Not finished / limitations
- The knowledge base is **fictional** demo data (amounts and rules are invented, not payroll advice)
- Retrieval is keyword and topic based. Production would use embeddings
- The store is a local JSON file and the rate limiter is in-memory (single instance)
- Demo accounts share one password taken from the environment
