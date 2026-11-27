# Ryan HQ

A full-screen, playable-feeling office for Ryan’s Codex agents. Built with Next.js, React Flow and private Vercel Blob storage. Live at [ryancagents.vercel.app](https://ryancagents.vercel.app).

## The office

- **Inbox Ryan** — incoming email and calendar scheduling.
- **Outreach Ryan** — outbound campaigns.
- **Network Ryan** — contact research, contact maps and GoHighLevel.
- **Proposal Ryan** — creates, edits and maintains proposals in the existing Proposal Agent chat and local Proposal Studio.
- **Manager Ryan** — black suit, white polo; summarizes reported work and delegates requested tasks to the appropriate existing Codex chats.
- **Designer Ryan** — glasses, brown overshirt and ivory tee; design and development in this dashboard’s original Codex chat.

The two-storey office has four occupied worker desks downstairs and two upstairs for Manager and Designer. Both floors fit the viewport; narrower screens retain horizontal scrolling. Proposal Ryan uses the fourth downstairs desk and the original Proposal Agent chat (`01a2171e-4186-74d2-a950-e074cd6f060b`). Proposal Studio shortcuts open `http://127.0.0.1:4174` on this Mac; the local editor must be running and is not hosted by Ryan HQ or accessible from a phone.

Click a Ryan to open their chat. Idle Ryans wander; working Ryans return to their desks. `!` marks a reported error or request for input. A newly observed completion gets a six-second `yay!` burst, then the Ryan resumes walking, blinking, waving and looking around. A quiet star remains until **Mark done** is clicked. Old completions do not replay on page load, reconnect or polling. Reviews are saved privately and survive reloads. New work takes priority over an older review badge. Quiet `DONT_NOTIFY` automation heartbeats return the agent to idle without generating review items or replacing the last actionable result. `NOTIFY` heartbeat messages render their human-readable content. Working agents show concise thought bubbles based on observed activity categories, not private reasoning.

Activity, workflow map, reviews and settings live behind floating icon buttons. The stats sheet opens to pending reviews, attention items, and shortcuts for services, agents, workflows, and activity. Each completion can be marked done independently; a Done tab keeps acknowledged items accessible. Current results include their own email, calendar, and document links. Older completion details open in the original Codex chat. Agent replies render readable Markdown with safe links; workflow steps display local service logos. Demo mode is opt-in, visibly labelled, and cannot dispatch real work. Pause affects animation only. The office pans horizontally on narrow screens; avatar shortcuts select the appropriate Ryan.

The workflow map is an editable **planning map**, not an execution engine. Editing nodes does not change Codex instructions. Chat prompts, including Manager assignments, are the execution entry point. Activity reflects observed Codex turns and tool categories, not independently verified email delivery or CRM outcomes.

## Prompt and manager behavior

The authenticated dashboard queues a message in private storage. The Mac bridge uses the installed `codex queue --thread … --message … --resume` command to submit it to the mapped original chat. **Queued in Codex** means the CLI accepted it; **Delivered** appears only when its exact prompt is observed in the session. A subsequent final answer appears as the reply. If Codex cannot resume automatically, open the linked original chat. Failed/ambiguous dispatch is never automatically retried. Unclaimed messages expire after one hour.

Manager Ryan is linked on this Mac to the persistent **Agent Manager** chat (`01a216eb-566e-7dd1-ab32-f5adc3c57f89`). Its `manager` entry in `.local/bridge.json` routes dashboard prompts to that chat and reads its activity and final replies. The same mapping is installed in the running Mac bridge. Requests in the manager chat govern any delegation.

Without a mapped manager chat, the fallback is an ephemeral, read-only Codex planner using the Mac’s existing sign-in. It sees the configured workers’ current status, latest final answer, recent activity categories, and its last five conversations. Summary requests produce no assignments. Explicit work requests can produce up to three assignments to the known workers, including Designer and Proposal when configured. Dependent work queues only the prerequisite. Existing agents retain their own instructions and approval requirements. The manager does not continuously invent or start tasks.

The bridge keeps heartbeats running during manager planning. Manager replies and assignments appear in its chat. An interrupted or uncertain manager request is marked for attention rather than silently submitted again.

## Run locally

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Unlock first to use the dashboard, including demo. Copy `.env.example` to `.env.local` and supply secrets for live mode. Set `OFFICE_PERSONAL_KEY` to your separate personal credential. Viewer and bridge keys must be different random secrets; use at least 32 random bytes. Never commit these files.

## Live Mac bridge

Create `.local/bridge.json` with filesystem mode 0600 (add the manager chat mapping when available):

```json
{
  "url": "https://your-project.vercel.app",
  "bridgeKey": "same value as OFFICE_BRIDGE_KEY on Vercel",
  "codexPath": "/absolute/path/to/codex",
  "agents": [
    { "id": "scheduler", "threadId": "existing-codex-thread-id", "file": "/absolute/path/to/scheduler-session.jsonl" },
    { "id": "outreach", "threadId": "existing-codex-thread-id", "file": "/absolute/path/to/outreach-session.jsonl" },
    { "id": "contacts", "threadId": "existing-codex-thread-id", "file": "/absolute/path/to/contacts-session.jsonl" }
  ]
}
```

```sh
npm run bridge
node scripts/bridge.mjs --once
node scripts/install-bridge.mjs
```

The bridge reads only the configured agent JSONL files, initially up to 4 MiB from each tail, then incrementally. It samples session logs every second and checks the prompt queue every two seconds, publishes changed state at most once every three seconds, and retains a sixty-second heartbeat when nothing changes. The dashboard refreshes activity every ten seconds and polls messages every 1.5 seconds while a reply is pending (ten seconds idle). Hidden tabs suspend network polling. Unchanged reads use ETags and return body-free 304 responses. Storage failures use bounded exponential backoff and honor Retry-After; recovery restores normal polling. Latest 100 activity events are retained. A missing file becomes offline. A working session without a categorized event for ten minutes is labelled waiting (an inference). Heartbeats older than 150 seconds mark the bridge offline. The Mac must be awake, online and signed into Codex. New/forked chats require updating the mapping.

**Data boundary:** activity labels are fixed categories. For chat, summaries and review, the latest final answers (bounded to 4,000 UTF-8 bytes per agent), dashboard prompts, replies and manager assignments are also stored privately on Vercel. Raw tool arguments/results, reasoning and full session files are never uploaded. The public shell contains no real activity. Terminal message history is pruned from the active state after seven days during writes, while undelivered commands and review acknowledgements are retained. The viewer receives the latest 50 messages. Legacy pre-migration objects remain untouched; this is not a storage-wide deletion policy. Local dispatch journals remain on the Mac. `--dry-run` prints the private snapshot, including final answers; do not share its output.

### Installed service

LaunchAgent `com.ryanc.agent-office` starts at login and restarts after failure. Its plist is `~/Library/LaunchAgents/com.ryanc.agent-office.plist`; runtime, config and logs are under `~/Library/Application Support/RyanHQ/`. Re-run the installer after updating bridge code/config. The runtime lives outside Documents to avoid macOS background-process restrictions.

```sh
launchctl print gui/$(id -u)/com.ryanc.agent-office
launchctl bootout gui/$(id -u)/com.ryanc.agent-office
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ryanc.agent-office.plist
```

Unlock with `.local/access-key.txt` on this Mac. Every page load or refresh starts frozen and requires **both** the office key and personal key. The UI stores its signed session token only in React memory, never cookies or browser storage, and the token expires after eight hours. Legacy cookies no longer authorize APIs. Rotate either `OFFICE_ACCESS_KEY` or `OFFICE_PERSONAL_KEY` to invalidate tokens. The configured keys are required; missing configuration fails closed.

## Deploy

1. Connect this GitHub repository to Vercel as a Next.js project.
2. Create a **private** Vercel Blob store and connect it.
3. Set `OFFICE_ACCESS_KEY`, `OFFICE_PERSONAL_KEY` and `OFFICE_BRIDGE_KEY`; Vercel supplies `BLOB_READ_WRITE_TOKEN`.
4. Push production code and configure/install the Mac bridge.

All activity, messages and reviews require authentication and use `private, no-store` responses. Viewer writes check same-origin. Bridge ingest, receipts and manager assignment writes require a separate bearer key. Message IDs make retries idempotent; a local journal prevents duplicate CLI dispatch after a restart. Credentials, `.local`, `.env.local` and session files are excluded from Git.

## Verification

```sh
npm test
npm run build
```

Tests cover telemetry validation, review/completion states, bounded prompts, literal CLI arguments, duplicate/restarted/ambiguous dispatch, reply correlation, expired work, nonblocking summaries, manager assignment routing and concurrent journal persistence. Browser checks cover desktop/mobile office, floating panels, attention, review and manager chat. Real campaign/email/CRM mutations are not used as test fixtures.

See [research](docs/RESEARCH.md) and [asset provenance](docs/ASSETS.md). No MapleStory assets or Agent Quest code are copied.

## Bot protection

Vercel BotID Basic protects unlock, prompt submission and review writes. Browser instrumentation starts before hydration; server checks reject bots and fail closed when verification is unavailable. Both credentials are still required after a successful check. The separate bearer-authenticated Mac bridge retains machine access. Basic is the free tier; OIDC is enabled on the Vercel project. Local development follows BotID’s documented development behavior and is not evidence of a production bot check.

[Official BotID setup](https://vercel.com/docs/botid/get-started).

## Prompt latency

Prompt pickup, local log observation, receipts and snapshot uploads run independently. A 500ms receipt loop sends only dirty status changes, with one flush batch in flight at a time. Queue checks read the known private `office/state-v2.json` object with a conditional ETag; unchanged reads have no body. Queue membership and its revision commit atomically. Recovery uses the same object and never scans Blob listings. Receipts record Mac pickup, CLI queue acceptance, observed delivery and final-reply timestamps, separating transport delay from Codex generation time.

## Storage and migration

Commands, receipts and review acknowledgements share an authoritative private state object. ETag compare-and-swap writes merge concurrent updates, so one request cannot silently overwrite another. Routine APIs and bridge loops perform no Blob LIST operations. Missing/corrupt storage fails visibly and does not create an empty replacement.

For an existing v1 deployment, stop the old bridge, deploy the new API, then run `node --env-file=PATH_TO_PRIVATE_ENV scripts/migrate-storage.mjs --apply`. This is the only listing-based import. It copies recent legacy messages/receipts and all acknowledgements, creates the new object only when absent, verifies it, and preserves old objects. Re-running is a read-only check. Then reinstall the bridge. `scripts/verify-storage-cas.mjs` checks provider concurrency and conditional-read behavior using an isolated temporary object, never the real queue.

## Spending alerts

Ryan HQ has a native Vercel project usage budget of **US$10**, with notifications at **US$5, US$7.50 and US$10**. Project budgets measure usage before credits, separately from the Pro subscription. Automatic project pause is disabled; the existing team budget remains unchanged.

Vercel posts signed `budget.reached` events to `/api/spending`. Set the sensitive `OFFICE_SPENDING_WEBHOOK_SECRET` to the webhook secret in production. The endpoint verifies raw-body HMAC-SHA1, project/team scope, timestamps and bounded numeric values before queuing a deterministic Manager message. Duplicate events reuse the existing command. Alerts remain deliverable for seven days if the Mac is offline. Manager is asked to summarize the alert and suggest reductions; changing plans, budgets, credentials or availability requires a separate user request. The Mac must be awake for Manager to respond; native Vercel notifications remain independent.

[Official Vercel spend management documentation](https://vercel.com/docs/spend-management).
