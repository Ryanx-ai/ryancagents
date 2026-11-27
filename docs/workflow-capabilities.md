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
| Inbox | Existing cycle/request → pause/recovery → intent-based triage, eligible scheduling and unresolved meeting review; separately selected RSVP reminders and read-only Calendar-to-Blackboard projection | `workspace:scheduling-agent/WORKER.md`, `ATTENTION.md`, `UNSUBSCRIBES.md`, `REMINDER-CONTRACT.md`; [board publisher contract](./BOARD-PUBLISHER.md) |
| Network | Research brief → public company research → live-map/company/domain/group deduplication → evidenced contact enrichment → Contact Map with Review/unchecked status → Ryan review and explicit handoff | `workspace:OUTREACH-PREFERENCES.md`; `workspace:expansion-2026-11-27-500/research.py`; `workspace:expansion-2026-11-26-200/EOD-HANDOFF.md` |
| Outreach | Standing eligible cycle or scoped release → pause/quota/shared lease → initial or single due follow-up → fresh exclusions/history → preparation/send → actual Sent read-back and reconciliation, or retained hold | `workspace:OUTREACH-PREFERENCES.md`; `workspace:outreach-agent/WORKER.md`, `SHARED-SEND-GUARD.md`; existing campaign records for bounded historical evidence |
| Proposal | MEETING NOTES/refinement → read selected template/current draft → Codex drafting → revision-checked local save as In review → Ryan review/edit → explicit PDF export | `workspace:proposal-editor/CHAT-INTAKE.md`, `README.md`, `server.mjs`, `scripts/chat-draft.mjs`; inspected desktop launcher behavior |
| Manager | Brief/status question → reported office context → role/scope/dependency checks → explicitly requested assignments → summary and handoff | [README](../README.md); [`scripts/manager.mjs`](../scripts/manager.mjs); [`scripts/prompt-relay.mjs`](../scripts/prompt-relay.mjs); [`lib/spending.mjs`](../lib/spending.mjs) |
| Designer | Scoped UI/platform brief → inspect current product and instructions → implement → appropriate checks and refinement → authorized publishing or reviewable handoff | [`lib/model.ts`](../lib/model.ts); [`AGENTS.md`](../AGENTS.md); [`package.json`](../package.json); [README](../README.md) |

## Scope decisions

**Inbox.** The worker documents work Gmail and the primary work Calendar only. Personal accounts are excluded. The latest attention instructions explicitly require unresolved meeting cancellations, declines and reschedules to alert on every existing 15-minute cycle. A past appointment or read label is not resolution. These changes remain manual unless current instructions independently authorize them. Unsubscribe processing updates shared-sheet exclusions with a six-calendar-month review date; it does not send an acknowledgement or automatically re-enrol a contact. A source document describing activation is not proof that the worker is currently active.

Scheduler alone owns selected-meeting RSVP reminders. Explicit enrollment does not waive due-time, live RSVP, exclusion or conversation checks, and calendar searches do not enroll every event. The board projection reads a complete Singapore day and full event details; it does not create bookings or resolve attention. Network owns shared-sheet schema/backfill; Outreach and Scheduler project only their assigned activity fields after current schema-readiness and identity checks. Schema readiness is not permission to send.

**Network and GoHighLevel.** Later standing instructions supersede the earlier requirement for full-team GHL clearance before adding researched contacts: Ryan authorized continued research and additions for his review while acknowledging that GHL visibility covers his own leads. The map therefore does not invent a GHL sync step or claim team-wide duplicate clearance. The EOD handoff assigns GHL reconciliation to a separate integration chat. A generic GHL logo/link is not evidence of an authenticated or complete integration here.

The displayed research handoff retains the batch's Review/unchecked state and explicit release gate. This is distinct from Outreach's separately authorized standing eligible-prospect entry. Neither path releases explicit rejected marks, specific account holds or uncertain contact evidence.

**Outreach.** The later 27 November standing instruction authorizes eligible new prospects and exactly one unanswered follow-up after five Monday–Friday business days, preserving the original verified Gmail send time in Singapore. It supersedes prior blanket no-auto-resume/generic-follow-up holds, while explicit rejected marks, opt-outs, ownership restrictions, active relationships and campaign reservations remain binding. Blank review alone is not a rejection under that standing instruction; the worker must still establish genuine eligibility. Specific campaigns retain their own scope. Pause, actual provider retry gates, shared lease, fresh exclusions/history and uncertain-send reconciliation apply to both entry paths. Unchanged gate states stay quiet under the worker's notification rules. No follow-up 2 or blind retry is implied. Historical counts and retry timestamps remain outside this static catalog. Gmail Sent verification establishes sending evidence, not delivery or engagement.

**Proposal.** The operational path is the existing Codex chat drafting against the local Studio API. Creating a base record in Studio does not generate proposal content. The optional in-app `/api/generate` connection is documented as disconnected and tested with simulated responses, so it is not shown as an operational node. Studio is loopback-only and rejects foreign origins; Ryan HQ opens the local editor instead of directly fetching its API from the hosted browser. The desktop launcher can start Studio, while an ordinary web link cannot. Notes remain private and are excluded from PDFs. Review before export is an agent/user workflow rule, not a server-side export lock; clicking Export PDF is an explicit export action. Nothing in this flow authorizes sending the proposal.

**Manager.** The installed path uses the existing Agent Manager chat. The source-coded fallback applies only when no manager chat is mapped: it is a read-only planner, returns no assignments for status questions and limits a plan to three assignments. Those fallback limits are not represented as a new universal implementation of the persistent chat. Signed spending alerts are bounded summary requests, not permission to change billing or availability.

All five worker cards are eligible requested-assignment destinations. Opening a card only navigates to its guide. Static return links represent available reports, not automatic result collection or dependent execution. The queued-handoff route can complete before any worker; status-only questions bypass delegation.

**Designer.** The catalog describes the established design/development role and available repository commands. It does not manufacture a live build/deploy pipeline or claim authentication to GitHub/Vercel. Actual task authorization governs publishing; validations must report observed results.

## Maintenance

The **Rules** tab reads [`lib/workflow-rules.ts`](../lib/workflow-rules.ts): 45 documented requirements across the six existing agents. Rules are grouped into checks, review gates and scope, each with a requirement, a hold condition, related stages and a logical source reference. The top Rules control shows the full list; node shield counts open the applicable subset. These counts are not passed checks. No worker settings, execution gates, API calls or polling are added by this view.

Network's Contact Map rules distinguish normal research operations from activity-field writes. The latter require current schema/backfill readiness, native tab/header and row-identity checks, field ownership, correct validation, formula-view preservation and readback. Research completion, valid structure and human review remain separate from outreach release.

Update the catalog and rules only when source instructions or implementation change, record the source-review date, and retain material limitations. Do not copy live credentials, private client data, full local paths or transient campaign state into these client-visible modules. Keep prospective integrations explicitly planned or outside the operational stages until evidence supports them. The focused rules tests verify complete agent coverage and valid stage mappings; they do not execute or certify the underlying worker checks.
