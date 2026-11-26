# Ryan HQ

A full-screen, playable-feeling office for Ryan’s Codex agents. Built with Next.js, React Flow and private Vercel Blob storage. Live at [ryancagents.vercel.app](https://ryancagents.vercel.app).

## The office

- **Inbox Ryan** — incoming email and calendar scheduling.
- **Outreach Ryan** — outbound campaigns.
- **Network Ryan** — contact research, contact maps and GoHighLevel.
- **Manager Ryan** — black suit, white polo; summarizes reported work and delegates requested tasks to the appropriate existing Codex chats.

Click a Ryan to open their chat. Idle Ryans wander; working Ryans return to their desks. `!` marks a reported error or request for input. A completed turn loops a `yay!` celebration until **Reviewed** is clicked. Reviews are saved privately and survive reloads. New work takes visual priority over an older, unreviewed completion.

Activity, workflow map, statistics and settings live behind floating icon buttons. Demo mode is opt-in, visibly labelled, and cannot dispatch real work. Pause affects animation only. The office pans horizontally on narrow screens; avatar shortcuts select the appropriate Ryan.

The workflow map is an editable **planning map**, not an execution engine. Editing nodes does not change Codex instructions. Chat prompts, including Manager assignments, are the execution entry point. Activity reflects observed Codex turns and tool categories, not independently verified email delivery or CRM outcomes.

## Prompt and manager behavior

The authenticated dashboard queues a message in private storage. The Mac bridge uses the installed `codex queue --thread … --message … --resume` command to submit it to the mapped original chat. **Queued in Codex** means the CLI accepted it; **Delivered** appears only when its exact prompt is observed in the session. A subsequent final answer appears as the reply. If Codex cannot resume automatically, open the linked original chat. Failed/ambiguous dispatch is never automatically retried. Unclaimed messages expire after one hour.

Manager Ryan runs an ephemeral, read-only Codex planner using the Mac’s existing sign-in. It sees the three selected agents’ current status, latest final answer, recent activity categories, and its last five conversations. Summary requests produce no assignments. Explicit work requests can produce up to three assignments to the known agents. Dependent work queues only the prerequisite. Existing agents retain their own instructions and approval requirements. The manager does not continuously invent or start tasks.

The bridge keeps heartbeats running during manager planning. Manager replies and assignments appear in its chat. An interrupted or uncertain manager request is marked for attention rather than silently submitted again.

## Run locally

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Demo works without credentials. Copy `.env.example` to `.env.local` and supply secrets for live mode. Viewer and bridge keys must be different random secrets; use at least 32 random bytes. Never commit these files.

## Live Mac bridge

Create `.local/bridge.json` with filesystem mode 0600:

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

The bridge reads only the three configured JSONL files, initially up to 4 MiB from each tail, then incrementally. It publishes a private snapshot every 20 seconds; the dashboard polls every 10 seconds. Latest 100 activity events are retained. A missing file becomes offline. A working session without a categorized event for ten minutes is labelled waiting (an inference). Heartbeats older than 90 seconds mark the bridge offline. The Mac must be awake, online and signed into Codex. New/forked chats require updating the mapping.

**Data boundary:** activity labels are fixed categories. For chat, summaries and review, the latest final answers (bounded to 4,000 UTF-8 bytes per agent), dashboard prompts, replies and manager assignments are also stored privately on Vercel. Raw tool arguments/results, reasoning and full session files are never uploaded. The public shell contains no real activity. Private message history returned by the API covers seven days, up to the latest 50 for the viewer; this is a display window, not automatic deletion. Local dispatch journals remain on the Mac. `--dry-run` prints the private snapshot, including final answers; do not share its output.

### Installed service

LaunchAgent `com.ryanc.agent-office` starts at login and restarts after failure. Its plist is `~/Library/LaunchAgents/com.ryanc.agent-office.plist`; runtime, config and logs are under `~/Library/Application Support/RyanHQ/`. Re-run the installer after updating bridge code/config. The runtime lives outside Documents to avoid macOS background-process restrictions.

```sh
launchctl print gui/$(id -u)/com.ryanc.agent-office
launchctl bootout gui/$(id -u)/com.ryanc.agent-office
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ryanc.agent-office.plist
```

Unlock with `.local/access-key.txt` on this Mac. The viewer gets a secure, HttpOnly, same-site cookie for 30 days. Rotate `OFFICE_ACCESS_KEY` to invalidate sessions.

## Deploy

1. Connect this GitHub repository to Vercel as a Next.js project.
2. Create a **private** Vercel Blob store and connect it.
3. Set `OFFICE_ACCESS_KEY` and `OFFICE_BRIDGE_KEY`; Vercel supplies `BLOB_READ_WRITE_TOKEN`.
4. Push production code and configure/install the Mac bridge.

All activity, messages and reviews require authentication and use `private, no-store` responses. Viewer writes check same-origin. Bridge ingest, receipts and manager assignment writes require a separate bearer key. Message IDs make retries idempotent; a local journal prevents duplicate CLI dispatch after a restart. Credentials, `.local`, `.env.local` and session files are excluded from Git.

## Verification

```sh
npm test
npm run build
```

Tests cover telemetry validation, review/completion states, bounded prompts, literal CLI arguments, duplicate/restarted/ambiguous dispatch, reply correlation, expired work, nonblocking summaries, manager assignment routing and concurrent journal persistence. Browser checks cover desktop/mobile office, floating panels, attention, review and manager chat. Real campaign/email/CRM mutations are not used as test fixtures.

See [research](docs/RESEARCH.md) and [asset provenance](docs/ASSETS.md). No MapleStory assets or Agent Quest code are copied.
