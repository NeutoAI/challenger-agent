# AI Front Desk — Explainer

**Live app:** https://berryessa-ai-front-desk-unofficial.vercel.app · **Operator view:** `/operator` (password-protected)
**Source:** https://github.com/NeutoAI/challenger-agent

## What this is

An AI front desk for Challenger School – Berryessa: a parent-facing chat that answers general center-policy questions (hours, tuition, uniforms, pickup, illness, etc.), and an operator control center where staff review what's being asked, publish new knowledge, and resolve items the assistant couldn't handle. It's an unofficial prototype built for a job-application exercise — not affiliated with, endorsed by, or operated by Challenger School — using the school's real, published policies as content so the demo reflects a genuine use case rather than invented data.

I picked Challenger School – Berryessa specifically instead of a hypothetical school because it's personal: my own child is starting Kindergarten there on August 17, and the questions this prototype answers — pickup times, late fees, what happens if we forget lunch, and so on — are exactly the ones we'd otherwise be asking a teacher directly. Building against a real school's real policies made this feel like solving an actual problem rather than a synthetic exercise.

## The trust mechanic

The parent chat is powered by Anthropic Claude, but it never free-answers. Every model turn is forced through a single structured tool call (`respond_to_parent`) that must return one of three modes:

- **Policy** — grounded in a specific published record, always shown with a source citation and effective date.
- **Clarify** — asks one targeted follow-up (e.g. "which program?") before answering, using that record's own predefined options.
- **Handoff** — routed to staff, either because the topic is explicitly sensitive (injury, complaint, custody, billing) or because nothing in the published knowledge base covers it. The assistant is instructed never to guess or invent a specific fact (a price, date, or policy detail) it can't ground in the knowledge base.

The knowledge base, escalation rules, and calendar are assembled fresh on every chat request from the operator's current published content — so a policy an operator publishes is visible to parents on their very next question, no deploy needed.

This app started as a deterministic keyword matcher and was migrated to the LLM approach mid-project specifically because the matcher had no real conversational memory: a follow-up like "explain" or "why" after a correct answer would be scored independently and fall back to a generic "I don't know," even though the parent was just asking for clarification. The LLM's real thread memory fixed that class of bug outright, rather than patching around it with more keyword heuristics.

## What shipped

**Parent experience** — segment picker (prospective/enrolled), bilingual chat (EN/ES), source-cited policy answers, one-question clarify flow, CTA handling (tour scheduling), thumbs up/down feedback with optional detail on a thumbs-down.

**Operator control center** — a knowledge-base editor (add/edit/delete records, escalation rules), an attention queue for unanswered or sensitive questions (publish as new FAQ, update an existing policy, or resolve privately), a question log, prototype usage metrics, and question clustering ("what families are asking about") that surfaces recurring gaps.

**LLM migration** — real conversational memory, structured-output grounding, source citations, and honest handoffs, replacing the original deterministic matcher (see "The trust mechanic" above).

**Evals** (`npm run evals`) — a repeatable script exercising the actual production prompt and tool schema against seven fixed conversations: a normal answer, a genuinely unanswerable question (checked by an LLM judge for fabrication), a sensitive-topic escalation, the "explain" follow-up regression, a multi-turn clarify flow, a policy-precedence check (see below), and a boundary probe (a parent asking about their own child's specific day) that must hand off rather than invent a personalized answer. It's a manual pre-deploy gate today, not wired into CI.

**Operator authentication** — `/operator` is gated by a shared password behind Next.js's request-level Proxy, with a signed, expiring session cookie.

**Degraded-mode fallback** — if Claude is unconfigured or unavailable (missing/invalid key, API error, malformed output), `/api/chat` falls back to a deterministic keyword-matching engine (`lib/matcher.ts`) instead of a single generic "can't answer" message. It's grounded in the same real, operator-published knowledge base, so confirmed answers and safe escalation stay available without the LLM — with the honest trade-off that it has no true multi-turn memory, doesn't translate, and has no real precedence logic between competing records.

**Google Drive policy sync** — a real integration, not a simulation. A Google Cloud service account (read-only, scoped to Drive) is shared as Viewer on one operator-designated Drive folder. Clicking **Sync now** in the "Policy source: Google Drive folder" card (Knowledge Base tab) calls `POST /api/drive-sync`, a server route that holds the service-account credentials and:

1. Lists every native Google Doc directly inside the configured folder (`lib/drive/client.ts`) — no recursion, so anything an operator wants excluded from consideration just lives outside this folder (e.g. a sibling `/Archive` folder not shared with the service account).
2. Exports each Doc as plain text and parses a required front-matter block off the top (`lib/drive/parser.ts`): `title`, `category` (must match an existing knowledge-base category), `effectiveDate` (`YYYY-MM-DD`), `audience`, and `status` (`approved`/`draft`) — everything after the closing `---` becomes the policy's answer text verbatim. A leading `---` and quoted values (`title: "Some Title"`) are both accepted.
3. Keeps only `status: approved` docs whose `effectiveDate` isn't in the future; anything with missing/invalid metadata is skipped and reported back as a warning rather than failing the whole sync (`lib/drive/sync.ts`).
4. Returns the resulting records to the browser, which upserts them by a stable `drive-<fileId>` id and removes any previously-synced record whose file is no longer present (archived, deleted, or moved out) — so the local knowledge base stays reconciled with the live folder contents (`lib/store.tsx`'s `applyDriveSync`).

If the sync fails for any reason (missing/invalid credentials, a Drive API error, the folder being unreachable), the card shows the error directly and the knowledge base is left untouched — it deliberately never falls back to placeholder data, since an operator relying on "what's currently approved" should see a clear failure, not something that quietly looks fine.

The system prompt separately instructs the model: when multiple approved records could plausibly answer the same question, prefer the one with the later effective date, and prefer the more specific record over a general one. This precedence logic is intentionally *not* duplicated in the sync route — `lib/drive/sync.ts` just gets the right records into the knowledge base with the right `effectiveDate`/`category`; picking which one wins for a given question is left entirely to the already-shipped, eval-tested (`policy-sync-precedence`) prompt instruction in `lib/llm/systemPrompt.ts`.

Document format an operator must follow when adding a policy to the folder:

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

**Version control & deploys** — the project is a git repo on GitHub (`NeutoAI/challenger-agent`); Vercel is connected to it and auto-builds/deploys production on every push to `main`, replacing the earlier no-git, manual-file-upload deploy path used mid-project.

## Known limitations

- **State lives in browser `localStorage`, not a shared database.** Two devices, or two operators, don't see each other's edits. This is a deliberate scope choice for a single-browser demo, not an oversight.
- **No audit trail beyond what's shown to parents.** The question log captures the exact answer a parent saw, but there's no durable record of raw model behavior over time for an operator to spot-check drift.
- **Auth is one shared password, not per-operator accounts** — adequate for closing the open-access gap, but there's no attribution of who published what.
- **Drive sync is manual and Google-Docs-only.** An operator has to click "Sync now" — nothing runs on a schedule or in response to a real-time Drive change yet — and only native Google Docs are supported (no PDF/Word upload parsing).

## What's left to explore in the next version

1. **Actual backend DB.** Move state to a real backend, replacing browser-local `localStorage` with a database such as Vercel Postgres plus Drizzle. This is required for shared knowledge, multi-device consistency, durable operator work, and server-side grounding.
2. **Mobile optimization.**
3. **Durable LLM audit logs.** Persist raw model outputs, tool decisions, failures, citations used, and fallback activation. The current parent-visible question log is useful, but it's insufficient for drift monitoring, compliance review, or debugging.
4. **Automate Drive ingestion.** Replace manual "Sync now" with scheduled polling or Drive change notifications, while retaining clear sync status and failure visibility.
5. **Support more source formats.** Add PDF and Word ingestion, then consider controlled recursive folders with explicit approved versus archive conventions.
6. **Use real operator identities.** Replace the shared password with individual accounts, roles, and attribution for publishing, editing, resolving, and syncing actions.
7. **Run evaluations in CI.** Make `npm run evals` a pull-request and pre-deploy gate, with failure blocking for fabrication, sensitive-topic handling, and policy-precedence regressions.
8. **Add production monitoring.** Track LLM error rate, fallback rate, handoff rate, unanswered-question rate, Drive-sync freshness, and time-to-resolution for queued questions.
9. **Test persistence and concurrency.** Once a database exists, add tests for simultaneous edits, publish-to-parent propagation, atomic queue-resolution workflows, and rollback/recovery behavior.
