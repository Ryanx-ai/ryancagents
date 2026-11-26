# Ryan HQ

A living office for Ryan’s three Codex agents, using his original **Maple Ryan** animated pet. Built with Next.js, React Flow, and a private Vercel Blob store.

## What works

- Animated side-view office with original Maple Ryan sprites, day/night scenery, reduced-motion support and selectable agents.
- Live status for Inbox Ryan (email/calendar), Outreach Ryan (mass outreach), and Network Ryan (contact map/GoHighLevel).
- Searchable activity log, agent filtering, timestamps and stale-bridge detection.
- Draggable workflow map with editable step names, custom connections, added/deleted steps, zoom, minimap and browser-local save/reset.
- Access-key protected telemetry; the public shell contains no real agent activity.
- Explicit demo mode. Demo data never reaches storage or runs real actions.

The workflow editor is a **planning map**, not an execution engine. It does not modify Codex instructions, send email, run campaigns, create calendar events, or change CRM records. Use each original Codex chat for those actions. Activity describes observed tool categories, not verified email delivery or business outcomes. The “sessions done” count is limited to the last 100 retained events.

## Run locally

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. The demo works without credentials. Copy `.env.example` to `.env.local` and supply secrets for live mode. The viewer key and bridge key must be different random secrets; use at least 32 random bytes. Never commit these files.

## Live Codex bridge

Vercel cannot read a Mac’s Codex logs. `scripts/bridge.mjs` runs on the Mac and reads only three explicitly configured session files. It sends fixed, allowlisted activity labels over HTTPS every 20 seconds. No prompt text, message bodies, contact details, commands, tool arguments, tool results or reasoning are transmitted. It never writes to a Codex session or an agent’s application data.

Create `.local/bridge.json` with filesystem mode 0600:

```json
{
  "url": "https://your-project.vercel.app",
  "bridgeKey": "same value as OFFICE_BRIDGE_KEY on Vercel",
  "agents": [
    { "id": "scheduler", "file": "/absolute/path/to/email-scheduler-session.jsonl" },
    { "id": "outreach", "file": "/absolute/path/to/email-outreach-session.jsonl" },
    { "id": "contacts", "file": "/absolute/path/to/contact-list-session.jsonl" }
  ]
}
```

```sh
npm run bridge                 # continue syncing while this process is running
node scripts/bridge.mjs --once # sync once
node scripts/bridge.mjs --dry-run # inspect sanitized telemetry without uploading
```

The initial connection reads up to 4 MiB from each file’s tail; future reads are incremental. The latest 100 events are retained. A missing session file becomes offline. A working session without a new categorized event for 10 minutes is labelled waiting (an inference, not a verified approval request). A completed session becomes standby. If the bridge misses heartbeats for 90 seconds, all displayed agents become offline. The bridge must run while the Mac is awake and online. Forked/new chats require updating the selected paths.

### Installed Mac service

When installed for Ryan, the bridge runs as LaunchAgent `com.ryanc.agent-office`. Its plist is at `~/Library/LaunchAgents/com.ryanc.agent-office.plist`; its config and logs are in this checkout’s ignored `.local` directory. It starts at login and restarts after failure.

```sh
launchctl print gui/$(id -u)/com.ryanc.agent-office
launchctl bootout gui/$(id -u)/com.ryanc.agent-office # stop
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ryanc.agent-office.plist # start
```

Unlock the deployed office using `.local/access-key.txt` on this Mac. The viewer receives a secure, HttpOnly, same-site cookie lasting 30 days. Rotate `OFFICE_ACCESS_KEY` to invalidate existing sessions.

## Deploy

1. Push to GitHub and connect the repository to Vercel as a Next.js project.
2. Create a **private** Vercel Blob store and connect it to the project.
3. Set `OFFICE_ACCESS_KEY` and `OFFICE_BRIDGE_KEY` on the project. Vercel supplies `BLOB_READ_WRITE_TOKEN`.
4. Deploy production and configure the bridge URL.

`POST /api/ingest` requires the bridge bearer key, validates and strips payloads, and overwrites one private snapshot. `GET /api/activity` requires a viewer session and is never publicly cached. The snapshot is not stored in Git. Errors are surfaced without exposing infrastructure credentials.

## Verification

```sh
npm test
npm run build
npm audit
```

See [research and design decisions](docs/RESEARCH.md). The office art is original SVG; the supplied Maple Ryan sprite is used with its original frame grid. No MapleStory game assets or Agent Quest code are copied.
