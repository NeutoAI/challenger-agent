# AI Front Desk — Explainer

**Live app:** https://berryessa-ai-front-desk-unofficial.vercel.app · **Operator view:** `/operator` (password-protected)

## What this is

An AI front desk for Challenger School – Berryessa: a parent-facing chat that answers general center-policy questions (hours, tuition, uniforms, pickup, illness, etc.), and an operator control center where staff review what's being asked, publish new knowledge, and resolve items the assistant couldn't handle. It's an unofficial prototype built for a job-application exercise — not affiliated with, endorsed by, or operated by Challenger School — using the school's real, published policies as content so the demo reflects a genuine use case rather than invented data.

## The trust mechanic

The parent chat is powered by Anthropic Claude, but it never free-answers. Every model turn is forced through a single structured tool call (`respond_to_parent`) that must return one of three modes:

- **Policy** — grounded in a specific published record, always shown with a source citation and effective date.
- **Clarify** — asks one targeted follow-up (e.g. "which program?") before answering, using that record's own predefined options.
- **Handoff** — routed to staff, either because the topic is explicitly sensitive (injury, complaint, custody, billing) or because nothing in the published knowledge base covers it. The assistant is instructed never to guess or invent a specific fact (a price, date, or policy detail) it can't ground in the knowledge base.

The knowledge base, escalation rules, and calendar are assembled fresh on every chat request from the operator's current published content — so a policy an operator publishes is visible to parents on their very next question, no deploy needed.

This app started as a deterministic keyword matcher and was migrated to the LLM approach mid-project specifically because the matcher had no real conversational memory: a follow-up like "explain" or "why" after a correct answer would be scored independently and fall back to a generic "I don't know," even though the parent was just asking for clarification. The LLM's real thread memory fixed that class of bug outright, rather than patching around it with more keyword heuristics.

## What shipped in this pass

- **The LLM migration** — real conversational memory, structured-output grounding, source citations, and honest handoffs, replacing the earlier deterministic matcher.
- **Evals** (`npm run evals`) — a repeatable script exercising the actual production prompt and tool schema against seven fixed conversations: a normal answer, a genuinely unanswerable question (checked by an LLM judge for fabrication), a sensitive-topic escalation, the "explain" follow-up regression, a multi-turn clarify flow, a policy-precedence check (see below), and a boundary probe (a parent asking about their own child's specific day) that must hand off rather than invent a personalized answer. It's a manual pre-deploy gate today, not wired into CI, since the repo has no git remote yet.
- **Operator authentication** — `/operator` previously had no access control at all; it's now gated by a shared password behind Next.js's request-level Proxy, with a signed, expiring session cookie.
- **Degraded-mode fallback** — if Claude is unconfigured or unavailable (missing/invalid key, API error, malformed output), `/api/chat` now falls back to a restored deterministic keyword-matching engine instead of a single generic "can't answer" message. It's grounded in the same real, operator-published knowledge base, so confirmed answers and safe escalation stay available without the LLM — with the honest trade-off that it has no true multi-turn memory and doesn't translate. Verified working end-to-end in production via Vercel runtime logs during testing.
- **Google Drive policy sync** — see below.

## Policy freshness: keeping answers current as documents change

> Operators continue using the Drive folder where they already maintain approved center policies. The Front Desk monitors that folder, ingests new versions automatically, and prioritizes approved policies by effective date and specificity. Claude is not retrained on each upload; it retrieves the current approved policy content at response time.

That last sentence is the important one: this app never "retrains" anything. Every chat request already rebuilds its grounding fresh from the operator's current published records (see "The trust mechanic" above) — so once a new policy exists in the knowledge base, the very next parent question uses it. The only real product gap was *how a new document gets into that knowledge base in the first place*, and that a newer, more specific policy should be preferred over an older, more general one covering the same ground.

**What's actually built:** a real integration, not a simulation. A Google Cloud service account (read-only, scoped to Drive) is shared as Viewer on one operator-designated Drive folder. Clicking **Sync now** in the "Policy source: Google Drive folder" card (Knowledge Base tab) calls `POST /api/drive-sync`, a server route that holds the service-account credentials and:

1. Lists every native Google Doc directly inside the configured folder (`lib/drive/client.ts`) — no recursion, so anything an operator wants excluded from consideration just lives outside this folder (e.g. a sibling `/Archive` folder not shared with the service account).
2. Exports each Doc as plain text and parses a required front-matter block off the top (`lib/drive/parser.ts`): `title`, `category` (must match an existing knowledge-base category), `effectiveDate` (`YYYY-MM-DD`), `audience`, and `status` (`approved`/`draft`) — everything after the `---` separator becomes the policy's answer text verbatim.
3. Keeps only `status: approved` docs whose `effectiveDate` isn't in the future; anything with missing/invalid metadata is skipped and reported back as a warning rather than failing the whole sync (`lib/drive/sync.ts`).
4. Returns the resulting records to the browser, which upserts them by a stable `drive-<fileId>` id and removes any previously-synced record whose file is no longer present (archived, deleted, or moved out) — so the local knowledge base stays reconciled with the live folder contents (`lib/store.tsx`'s `applyDriveSync`).

If the sync fails for any reason (missing/invalid credentials, a Drive API error, the folder being unreachable), the card shows the error directly and the knowledge base is left untouched — it deliberately never falls back to placeholder data, since an operator relying on "what's currently approved" should see a clear failure, not something that quietly looks fine.

The system prompt separately instructs the model: when multiple approved records could plausibly answer the same question, prefer the one with the later effective date, and prefer the more specific record over a general one. This precedence logic is intentionally *not* duplicated in the sync route — `lib/drive/sync.ts` just gets the right records into the knowledge base with the right `effectiveDate`/`category`; picking which one wins for a given question is left entirely to the already-shipped, eval-tested (`policy-sync-precedence`) prompt instruction in `lib/llm/systemPrompt.ts`.

**Document format** an operator must follow when adding a policy to the folder:

```
title: Emergency Lunch Policy Update
category: meals
effectiveDate: 2026-09-01
audience: enrolled
status: approved
---
If your child doesn't have a lunch on a given day, call the front office by 9:00 a.m. and
we'll provide a simple meal from the campus kitchen for a $6 fee, added to your account.
```

**Ingestion trigger**: sync is manual (an operator clicks "Sync now") — matches today's UX and needs no new infrastructure. A production version would add scheduled polling (e.g. every 5–10 minutes via the Drive API, comparing `modifiedTime`) or push-based ingestion via the Drive Changes API's `changes.watch()`, so a new document is picked up without anyone needing to remember to click the button.

## Known limitations

- **State lives in browser `localStorage`, not a shared database.** Two devices, or two operators, don't see each other's edits. This is a deliberate scope choice for a single-browser demo, not an oversight.
- **No audit trail beyond what's shown to parents.** The question log captures the exact answer a parent saw, but there's no durable record of raw model behavior over time for an operator to spot-check drift.
- **Auth is one shared password, not per-operator accounts** — adequate for closing the open-access gap, but there's no attribution of who published what.
- **Drive sync is manual and Google-Docs-only.** An operator has to click "Sync now" — nothing runs on a schedule or in response to a real-time Drive change yet — and only native Google Docs are supported (no PDF/Word upload parsing).

## Recommended production next steps

**Server-side LLM audit logging.** A durable, operator-reviewable log of raw model responses — success and failure — independent of the parent-facing question log, so drift in grounding behavior is visible over time rather than only discoverable by manually clicking through the UI. Shape: one new `llm_logs` table, a non-blocking write on both paths of `/api/chat`, a simple viewer panel in `/operator`.

**A real backend.** Replacing per-browser `localStorage` with Vercel Postgres + Drizzle (rejected a KV-blob approach — every write would read-and-rewrite the entire state with no real concurrency safety, and rejected log-drain-only observability — it doesn't give a reviewable UI surface). Per-record updates instead of whole-state overwrites; the operator's current publish→resolve→announce chain folded into one transactional route to avoid a new partial-failure class; short-interval polling to preserve the "operator publishes → parent sees it without a refresh" property; and, as a natural side effect, moving grounding to be read server-side instead of trusted from the client request, closing a low-stakes but real trust-boundary gap in `/api/chat` today.

Both share the same dependency — standing up a production database — which is why they're scoped as next steps here rather than built into this pass.
