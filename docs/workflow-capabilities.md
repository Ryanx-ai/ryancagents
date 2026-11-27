# Workflow capability catalog

Source review date: **27 November 2026**. This records documented behavior and implementation evidence, not a live authentication, schedule, delivery or task-status check.

[`lib/workflow-catalog.ts`](../lib/workflow-catalog.ts) exports `workflowCatalog: Record<AgentId, WorkflowDefinition>` for all six existing Ryans. Each definition contains its trigger, intent, inputs, outputs, typed stages, account scope, limitations, evidence and `lastVerified` source-review date. Stage IDs are globally unique and stable.

## How to read the map

- **Codex:** performed through the existing agent chat and its available tools, subject to its instructions.
- **Local:** implemented on the Mac, such as Studio persistence/export or repository checks.
- **Manual:** Ryan supplies the input, reviews or releases the work.
- **Planned:** reserved for a proposed capability; never evidence that it exists or runs. No current catalog stage uses this value.

Stage kinds (`trigger`, `action`, `review`, `output`) describe the workflow. A `reviewGate` states an applicable condition; it is not a claim that this dashboard or a service enforces that condition. A connector logo identifies a service only. The catalog contains no credential, connection-health or node-execution state. Editing a map changes neither agent instructions nor schedules. Actual execution starts through the existing chat/prompt path.

The bridge routes prompts to mapped original Codex chats and observes their session records. Queue acceptance, observed prompt delivery and a later final answer are separate receipts. Agent activity does not independently prove that an email arrived, a calendar change succeeded or a CRM record was synchronized. See [`scripts/prompt-relay.mjs`](../scripts/prompt-relay.mjs), [`scripts/bridge.mjs`](../scripts/bridge.mjs) and [README](../README.md).

## Source evidence

`workspace:` references below name existing sibling project documents inspected read-only in the local work workspace. They are not public URLs or files shipped with Ryan HQ. The catalog deliberately omits account addresses, profile IDs, client names, row contents, private notes and credentials.

| Ryan | Documented flow | Evidence reviewed |
| --- | --- | --- |
| Inbox | Existing cycle/request → pause and recovery checks → full work-thread triage → opt-out exclusions when applicable → primary-calendar availability → eligible booking/read-back/confirmation → unresolved meeting-change review | `workspace:scheduling-agent/WORKER.md`, `ATTENTION.md`, `UNSUBSCRIBES.md`; local scheduling README for implementation context |
| Network | Research brief → public company research → live-map/company/domain/group deduplication → evidenced contact enrichment → Contact Map with Review/unchecked status → Ryan review and explicit handoff | `workspace:OUTREACH-PREFERENCES.md`; `workspace:expansion-2026-11-27-500/research.py`; `workspace:expansion-2026-11-26-200/EOD-HANDOFF.md` |
| Outreach | Explicitly released reviewed audience → exclusions and complete mail-history checks → authorized copy → send within provider limits → actual Sent read-back → map and ledger reconciliation → sent/held summary | `workspace:OUTREACH-PREFERENCES.md`; `workspace:campaign-2026-11-26-wave5/RESULTS.md`; `workspace:ooo-followups-2026-11-27/WORKFLOW.md` for the separately scoped follow-up protocol |
| Proposal | MEETING NOTES/refinement → read selected template/current draft → Codex drafting → revision-checked local save as In review → Ryan review/edit → explicit PDF export | `workspace:proposal-editor/CHAT-INTAKE.md`, `README.md`, `server.mjs`, `scripts/chat-draft.mjs`; inspected desktop launcher behavior |
| Manager | Brief/status question → reported office context → role/scope/dependency checks → explicitly requested assignments → summary and handoff | [README](../README.md); [`scripts/manager.mjs`](../scripts/manager.mjs); [`scripts/prompt-relay.mjs`](../scripts/prompt-relay.mjs); [`lib/spending.mjs`](../lib/spending.mjs) |
| Designer | Scoped UI/platform brief → inspect current product and instructions → implement → appropriate checks and refinement → authorized publishing or reviewable handoff | [`lib/model.ts`](../lib/model.ts); [`AGENTS.md`](../AGENTS.md); [`package.json`](../package.json); [README](../README.md) |

## Scope decisions

**Inbox.** The worker documents work Gmail and the primary work Calendar only. Personal accounts are excluded. The latest attention instructions explicitly require unresolved meeting cancellations, declines and reschedules to alert on every existing 15-minute cycle. A past appointment or read label is not resolution. These changes remain manual unless current instructions independently authorize them. Unsubscribe processing updates shared-sheet exclusions with a six-calendar-month review date; it does not send an acknowledgement or automatically re-enrol a contact. A source document describing activation is not proof that the worker is currently active.

**Network and GoHighLevel.** Later standing instructions supersede the earlier requirement for full-team GHL clearance before adding researched contacts: Ryan authorized continued research and additions for his review while acknowledging that GHL visibility covers his own leads. The map therefore does not invent a GHL sync step or claim team-wide duplicate clearance. The EOD handoff assigns GHL reconciliation to a separate integration chat. A generic GHL logo/link is not evidence of an authenticated or complete integration here.

**Outreach.** Research completion and review marks do not themselves create a new sending instruction. Campaign releases are audience-specific and remain subject to fresh exclusions, history, ownership and provider-limit checks. Historical batch counts and retry times were intentionally excluded from this static catalog. The separately scoped follow-up protocol illustrates conservative send-intent/reconciliation behavior; its one-off campaign permissions are not generalized to all outreach. Gmail Sent verification establishes sending evidence, not recipient delivery or engagement.

**Proposal.** The operational path is the existing Codex chat drafting against the local Studio API. Creating a base record in Studio does not generate proposal content. The optional in-app `/api/generate` connection is documented as disconnected and tested with simulated responses, so it is not shown as an operational node. Studio is loopback-only and rejects foreign origins; Ryan HQ opens the local editor instead of directly fetching its API from the hosted browser. The desktop launcher can start Studio, while an ordinary web link cannot. Notes remain private and are excluded from PDFs. Review before export is an agent/user workflow rule, not a server-side export lock; clicking Export PDF is an explicit export action. Nothing in this flow authorizes sending the proposal.

**Manager.** The installed path uses the existing Agent Manager chat. The source-coded fallback applies only when no manager chat is mapped: it is a read-only planner, returns no assignments for status questions and limits a plan to three assignments. Those fallback limits are not represented as a new universal implementation of the persistent chat. Signed spending alerts are bounded summary requests, not permission to change billing or availability.

**Designer.** The catalog describes the established design/development role and available repository commands. It does not manufacture a live build/deploy pipeline or claim authentication to GitHub/Vercel. Actual task authorization governs publishing; validations must report observed results.

## Maintenance

Update the catalog only when source instructions or implementation change, record the source-review date, and retain material limitations. Do not copy live credentials, private client data, full local paths or transient campaign state into this client-visible module. Keep prospective integrations explicitly planned or outside the operational stages until evidence supports them.
