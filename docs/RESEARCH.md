# Research and design decisions

Researched 26 November 2026 for Ryan’s live Codex agent office.

## Reference: Agent Quest

[Original Reddit post](https://www.reddit.com/r/LocalLLaMA/comments/1stda86/opensource_dashboard_to_visualize_ai_coding/) and [Agent Quest source](https://github.com/FulAppiOS/Agent-Quest).

Agent Quest visualizes local Claude Code and Codex session logs as characters moving around a fantasy village. The useful pattern is to make activity legible through a place and character, while keeping an underlying log for precision. Ryan HQ applies that pattern to a compact office. This is an original implementation, with no reused code or game assets.

## Two complementary views

The office provides ambient state: who is working, idle, offline, or needs attention. The workflow map shows the structure of each agent’s responsibilities. A separate searchable log preserves timestamps. A visually moving character alone cannot establish that an email was delivered or that a CRM update succeeded, so the UI reports session/tool activity rather than inventing business metrics.

[React Flow documentation](https://reactflow.dev/learn) informed the editable node map: custom nodes, handles, viewport controls and a minimap. A saved map is deliberately separate from the runtime agent configuration. It is local to this browser.

## Runtime boundary

The actual agents run in Codex chats and automations on Ryan’s Mac. A hosted dashboard has no direct access to that desktop runtime. A local bridge tails only explicitly selected JSONL session files, translates documented/observed lifecycle and tool-event records into an allowlisted schema, and sends a snapshot to a private store. The parser was checked against the local session record structures. These file formats are implementation details and may change; unknown events are ignored rather than exported.

The dashboard reflects these sessions, not all ChatGPT custom GPTs or all Codex chats. Starting another chat requires mapping its file. Activity freshness and bridge freshness are distinct: heartbeats establish the bridge is online, not that an agent is actively executing. The UI expires the bridge after 90 seconds and turns a prolonged working state into waiting after 10 minutes.

## n8n and GoHighLevel

[n8n API docs](https://docs.n8n.io/api/) describe programmatic workflow control, but these agents are not running in n8n. It would be misleading to pretend a diagram edit controls them. The map remains a planning view. The gamified revision adds a separate authenticated prompt queue and a manager planner that delegates to existing Codex chats.

[HighLevel webhook guide](https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide/) supports event-driven integrations, but a separate GHL webhook subscription is unnecessary for observing the existing Codex contact agent. Its GHL tool events are categorized locally. Direct CRM record synchronization would be a distinct future integration requiring its own credentials and webhook verification.

## Storage, authentication and privacy

[Vercel Blob SDK reference](https://vercel.com/docs/vercel-blob/using-blob-sdk) supports private objects read through authenticated server code. One bounded snapshot avoids an unbounded event archive. Bridge writes use a dedicated secret. Viewer reads use a different access key and secure HttpOnly cookie. No runtime tokens are embedded in client assets. Activity labels are reconstructed from a server allowlist. The gamified revision also stores bounded final answers, dashboard prompts, replies and manager assignments in private Blob storage, behind the same viewer authentication. No raw tool results or reasoning are exported. See README for retention and runtime boundaries.

## Visual direction

MapleStory-inspired proportions and side-view staging, translated into an original office: warm wood, slate walls, Singapore evening light, plants, desk lamps and three small workstations. The office fills the viewport; charcoal floating panels appear only on demand. Amber identifies navigation; lavender, sand and sage identify the three workers. A fourth Ryan in a black suit and white polo manages work from the lounge floor. Ryan’s existing Maple Ryan pet supplies the recognizable blazer, quiff and expressive animation. Its 1536×2288 sheet uses 192×208 cells, with status-mapped rows and transparent unused columns. CSS animates only used frames and honors reduced motion.

The default production state is live but locked; demo is opt-in and prominently labelled. No synthetic event is mixed with a live feed. Animations can pause independently of real agents, and the control is explicitly labelled that way.
