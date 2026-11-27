import type {AgentId} from './model';
import type {IntegrationName} from '../components/IntegrationLogo';

/** Where a documented step happens, not a live connection or execution status. */
export type WorkflowCapability = 'codex' | 'local' | 'manual' | 'planned';
export type WorkflowStage = {
  id: string;
  kind: 'trigger' | 'action' | 'review' | 'output';
  label: string;
  detail: string;
  connector?: IntegrationName;
  inputs: string[];
  outputs: string[];
  reviewGate: string | null;
  capability: WorkflowCapability;
};
export type WorkflowEvidence = {label: string; source: string};
export type WorkflowDefinition = {
  agentId: AgentId;
  trigger: string;
  intent: string;
  inputs: string[];
  outputs: string[];
  stages: WorkflowStage[];
  accountScope: string;
  limitations: string[];
  evidence: WorkflowEvidence[];
  /** Date the source documents/code were reviewed, not a live service check. */
  lastVerified: string;
};

/** Static capability descriptions. Editing this map never changes worker instructions. */
export const workflowCatalog: Record<AgentId, WorkflowDefinition> = {
  scheduler: {
    agentId: 'scheduler',
    trigger: 'The existing 15-minute worker cycle, or your request in Inbox Ryan.',
    intent: 'Triage work email, arrange eligible meetings and keep unresolved meeting changes visible.',
    inputs: ['Complete work email threads', 'Primary work Calendar availability', 'Worker state and live outreach exclusions'],
    outputs: ['Verified scheduling replies and bookings', 'Unsubscribe exclusions pending review', 'Unresolved meeting-change alerts'],
    accountScope: "Ryan's configured work Gmail and primary work Calendar; the shared Contact Map for exclusions. Personal accounts are outside this worker's scope.",
    lastVerified: '2026-11-27',
    limitations: [
      'A schedule or logo does not confirm that the worker is currently active or authenticated; pause and recovery checks still apply.',
      'Changes to existing events, substantive business questions and ambiguous requests need Ryan. No automatic cancellation or duplicate booking.',
      'Unresolved cancellations, declines and reschedules alert each cycle until positive evidence or Ryan resolves them.',
    ],
    evidence: [
      {label: 'Scheduling worker protocol', source: 'workspace:scheduling-agent/WORKER.md'},
      {label: 'Every-cycle meeting attention', source: 'workspace:scheduling-agent/ATTENTION.md'},
      {label: 'Unsubscribe scope and review', source: 'workspace:scheduling-agent/UNSUBSCRIBES.md'},
    ],
    stages: [
      {id: 'scheduler-trigger', kind: 'trigger', label: 'Cycle or request', capability: 'codex', connector: 'codex',
        detail: 'Check pause, account scope and unresolved write intents before reading new work.',
        inputs: ['Existing schedule or your prompt', 'Local worker state'], outputs: ['Eligible run or an explicit hold'], reviewGate: null},
      {id: 'scheduler-read', kind: 'action', label: 'Read & triage', capability: 'codex', connector: 'gmail',
        detail: 'Read complete current conversations, check whether Ryan already replied, and classify scheduling, opt-outs and meeting changes.',
        inputs: ['Work threads and Sent history'], outputs: ['Scheduling requests', 'Opt-outs', 'Meeting issues'], reviewGate: 'Incomplete or ambiguous threads stay on hold.'},
      {id: 'scheduler-exclusions', kind: 'action', label: 'Apply opt-outs', capability: 'codex', connector: 'sheets',
        detail: 'For genuine removal requests, update exclusions and matching map rows, then read the changes back. Send no acknowledgement.',
        inputs: ['Verified opt-out request', 'Live map and exclusions'], outputs: ['Scoped exclusion pending Ryan review'], reviewGate: 'Six months is a review date, never automatic re-enrolment; stronger holds remain.'},
      {id: 'scheduler-availability', kind: 'action', label: 'Check availability', capability: 'codex', connector: 'calendar',
        detail: 'Check the requested time first, then a free same-day alternative within the configured booking rules.',
        inputs: ['Eligible scheduling request', 'Fresh primary-calendar availability'], outputs: ['Verified slot or a hold'], reviewGate: 'No suitable same-day slot or changes to an existing event require Ryan.'},
      {id: 'scheduler-book', kind: 'action', label: 'Book & confirm', capability: 'codex', connector: 'calendar',
        detail: 'For an authorized booking, create and read back the event before sending a threaded Gmail confirmation. Requests for options receive options only.',
        inputs: ['Current thread', 'Verified slot and recipient scope', 'Fresh live-exclusion check'], outputs: ['Read-back event and confirmation, or offered slots'], reviewGate: 'Recheck live exclusions before any scheduling write; excluded contacts need Ryan. Reconcile uncertain creation or sending before retrying.'},
      {id: 'scheduler-attention', kind: 'review', label: 'Resolve meeting changes', capability: 'manual', connector: 'gmail',
        detail: 'Keep genuine unresolved cancellations, declines and reschedules in the attention queue and report them on each existing cycle.',
        inputs: ['Open meeting issues', 'Fresh thread and original-event evidence'], outputs: ['Ryan action or positively verified resolution'], reviewGate: 'A read label, saved draft or elapsed appointment does not resolve the issue.'},
      {id: 'scheduler-output', kind: 'output', label: 'Report outcome', capability: 'codex', connector: 'codex',
        detail: 'Report meaningful results and attention items. Quiet no-change heartbeats create no completion review.',
        inputs: ['Verified outcomes and remaining holds'], outputs: ['Reply, relevant links and review items'], reviewGate: null},
    ],
  },
  contacts: {
    agentId: 'contacts',
    trigger: 'Your research brief or an explicit Manager assignment.',
    intent: 'Find relevant companies and verified contact routes, then prepare the Contact Map for your review.',
    inputs: ['Research criteria', 'Public company sources', 'Live Contact Map, existing prospects and exclusions'],
    outputs: ['Sourced, deduplicated contact rows', 'Review status and unchecked review marks', 'Caveats for the outreach handoff'],
    accountScope: "The shared work Contact Map and public company sources. Available GHL opportunity visibility is documented as Ryan's own leads, not the full team's.",
    lastVerified: '2026-11-27',
    limitations: [
      'New research does not authorize outreach. Ryan reviews and explicitly releases the intended contacts to Outreach Ryan.',
      'A GoHighLevel connection or sync from this dashboard is not verified. GHL reconciliation belongs to the separate integration chat.',
      'Limited GHL visibility cannot establish team-wide duplicate clearance; record uncertainty instead of claiming it.',
    ],
    evidence: [
      {label: 'Research, review and outreach rules', source: 'workspace:OUTREACH-PREFERENCES.md'},
      {label: 'Company and domain screening code', source: 'workspace:expansion-2026-11-27-500/research.py'},
      {label: 'Contact handoff and GHL ownership', source: 'workspace:expansion-2026-11-26-200/EOD-HANDOFF.md'},
    ],
    stages: [
      {id: 'contacts-trigger', kind: 'trigger', label: 'Research brief', capability: 'codex', connector: 'codex',
        detail: 'Use the requested company criteria, geography and exclusions to define the research batch.',
        inputs: ['Your scoped research request'], outputs: ['Research criteria'], reviewGate: null},
      {id: 'contacts-research', kind: 'action', label: 'Find companies', capability: 'codex',
        detail: 'Research relevant companies using public company sites and directories, retaining source evidence.',
        inputs: ['Research criteria', 'Public sources'], outputs: ['Candidate companies and sources'], reviewGate: null},
      {id: 'contacts-deduplicate', kind: 'action', label: 'Check duplicates', capability: 'codex', connector: 'sheets',
        detail: 'Compare the live map, company aliases, domains, groups and exclusions before adding a prospect.',
        inputs: ['Candidates', 'Live map and exclusions'], outputs: ['Screened candidates and documented holds'], reviewGate: 'Do not label a company clear across the whole team from limited GHL visibility.'},
      {id: 'contacts-enrich', kind: 'action', label: 'Verify contact routes', capability: 'codex',
        detail: 'Find evidenced company or named contact routes and record source, relevance and uncertainty.',
        inputs: ['Screened candidates', 'Public contact evidence'], outputs: ['Enriched contacts with caveats'], reviewGate: 'Unknown or unverified contact details stay flagged, not invented.'},
      {id: 'contacts-map', kind: 'output', label: 'Update Contact Map', capability: 'codex', connector: 'sheets',
        detail: 'Add the researched batch with Review status and an unchecked review mark, preserving the live sheet structure.',
        inputs: ['Verified contact routes and sources'], outputs: ['Contact Map rows pending review'], reviewGate: null},
      {id: 'contacts-review', kind: 'review', label: 'Ryan reviews & releases', capability: 'manual', connector: 'sheets',
        detail: 'Ryan reviews the intended rows and explicitly hands off a released batch to Outreach Ryan.',
        inputs: ['Pending contact rows and caveats'], outputs: ['Reviewed, released batch or retained holds'], reviewGate: 'Research completion or a review mark alone is not a new permission to send.'},
    ],
  },
  outreach: {
    agentId: 'outreach',
    trigger: 'Your explicit release of a reviewed audience or authorized campaign continuation.',
    intent: 'Send the requested outreach to eligible contacts and reconcile every outcome with the map and send records.',
    inputs: ['Reviewed and released contacts', 'Approved campaign scope and copy', 'Live exclusions, Gmail history and send records'],
    outputs: ['Verified Sent records', 'Updated contact dates and campaign outcomes', 'Held, failed or quota-pending recipients'],
    accountScope: "Ryan's configured work Gmail and shared Contact Map, limited to the explicitly released audience. No alternate sending account or route to bypass limits.",
    lastVerified: '2026-11-27',
    limitations: [
      'Reviewed contacts still require a sending instruction and fresh eligibility checks; a research batch is not automatically a campaign.',
      'Provider quotas, opt-outs, active conversations and existing ownership holds remain binding. A pending queue is not an automatic resume instruction.',
      'A verified Sent message is not proof of delivery or a positive human reply; later failures and automated responses need their own outcome.',
    ],
    evidence: [
      {label: 'Audience releases and standing restrictions', source: 'workspace:OUTREACH-PREFERENCES.md'},
      {label: 'Campaign send and reconciliation report', source: 'workspace:campaign-2026-11-26-wave5/RESULTS.md'},
      {label: 'Scoped follow-up and uncertainty protocol', source: 'workspace:ooo-followups-2026-11-27/WORKFLOW.md'},
    ],
    stages: [
      {id: 'outreach-trigger', kind: 'trigger', label: 'Released audience', capability: 'manual', connector: 'sheets',
        detail: 'Start with the exact reviewed contacts and campaign that Ryan has authorized.',
        inputs: ['Reviewed rows', 'Explicit sending scope'], outputs: ['Authorized audience'], reviewGate: 'Unreleased research and unrelated campaigns remain excluded.'},
      {id: 'outreach-checks', kind: 'review', label: 'Exclusions & history', capability: 'codex', connector: 'gmail',
        detail: 'Re-read live exclusions, complete threads and Sent history; remove duplicates, opt-outs, active conversations and held routes.',
        inputs: ['Authorized audience', 'Live map, exclusions and Gmail history'], outputs: ['Eligible recipients and reasoned holds'], reviewGate: 'Existing holds and newer human replies take precedence over an old queue.'},
      {id: 'outreach-draft', kind: 'action', label: 'Prepare outreach', capability: 'codex', connector: 'gmail',
        detail: 'Use the authorized message focus, verified recipient name and work signature; check any new funding claims before using them.',
        inputs: ['Eligible recipients', 'Campaign instructions'], outputs: ['Prepared campaign messages'], reviewGate: 'Keep audience, claims and follow-up scope within the current instruction.'},
      {id: 'outreach-send', kind: 'action', label: 'Send within limits', capability: 'codex', connector: 'gmail',
        detail: 'Recheck exclusions immediately before sending, retain send intents or campaign records, and stop when the connector blocks sending.',
        inputs: ['Prepared messages', 'Fresh eligibility and available send allowance'], outputs: ['Send result or retained pending item'], reviewGate: 'Respect actual retry guidance; an uncertain send must be reconciled before any retry.'},
      {id: 'outreach-verify', kind: 'action', label: 'Verify & record', capability: 'codex', connector: 'sheets',
        detail: 'Read back actual Gmail Sent evidence, then update matching contact rows and the campaign ledger. Record later delivery failures separately.',
        inputs: ['Actual send evidence', 'Matching live contact rows'], outputs: ['Verified send record and updated map'], reviewGate: 'Do not mark a quota rejection, uncertain result or draft as sent.'},
      {id: 'outreach-output', kind: 'output', label: 'Report sent & held', capability: 'codex', connector: 'codex',
        detail: 'Summarize confirmed sends, exclusions, failures and remaining work without silently starting another wave.',
        inputs: ['Campaign ledger and verified outcomes'], outputs: ['Outcome summary and next-action holds'], reviewGate: null},
    ],
  },
  proposal: {
    agentId: 'proposal',
    trigger: 'MEETING NOTES or a refinement request in the existing Proposal Ryan chat.',
    intent: 'Turn your notes into an editable local proposal, refine it with you, then export a PDF when requested.',
    inputs: ['Meeting notes and drafting instructions', 'Selected template or existing proposal', 'Confirmed facts and clearly marked assumptions'],
    outputs: ['Saved proposal marked In review', 'Local editor link and review flags', 'PDF after review and an explicit export action'],
    accountScope: 'The existing Proposal Agent chat and local Studio drafts/templates on this Mac. No cloud document account is connected by this map.',
    lastVerified: '2026-11-27',
    limitations: [
      'Studio is local to this Mac and must be running. A web link opens it but cannot run its desktop launcher.',
      'Codex-assisted drafting is operational without an API key. The optional in-app AI generation connection is not verified and is not this workflow.',
      'The PDF review gate is an agent/user workflow rule, not a server lock. No automatic email, WhatsApp, enrolment or external send.',
    ],
    evidence: [
      {label: 'Meeting notes to review workflow', source: 'workspace:proposal-editor/CHAT-INTAKE.md'},
      {label: 'Studio capabilities and local storage', source: 'workspace:proposal-editor/README.md'},
      {label: 'Chat-assisted save helper', source: 'workspace:proposal-editor/scripts/chat-draft.mjs'},
      {label: 'Local API, revisions and PDF export', source: 'workspace:proposal-editor/server.mjs'},
    ],
    stages: [
      {id: 'proposal-trigger', kind: 'trigger', label: 'MEETING NOTES', capability: 'manual', connector: 'codex',
        detail: 'Paste the notes and requested emphasis into Proposal Ryan, identifying the current proposal when asking for a refinement.',
        inputs: ['Your meeting notes or edit request'], outputs: ['Scoped drafting brief'], reviewGate: null},
      {id: 'proposal-template', kind: 'action', label: 'Read template or draft', capability: 'local', connector: 'studio',
        detail: 'List the saved proposals and read the selected clean template or current draft before changing it.',
        inputs: ['Selected template or proposal identity'], outputs: ['Current editable source and revision'], reviewGate: 'Resolve an ambiguous target; do not overwrite an unrelated client proposal.'},
      {id: 'proposal-draft', kind: 'action', label: 'Draft in Codex', capability: 'codex', connector: 'codex',
        detail: 'Translate the notes into editable slides, retain private source notes and separate stated facts, suggestions and items to confirm.',
        inputs: ['Notes', 'Current template or draft'], outputs: ['Prepared proposal and review flags'], reviewGate: 'Unknown fees, eligibility or dates remain unconfirmed; use the local calculator for arithmetic.'},
      {id: 'proposal-save', kind: 'action', label: 'Save In review', capability: 'local', connector: 'studio',
        detail: 'Save with revision checks, reopen the draft and inspect editable and print layouts without automatically creating a PDF.',
        inputs: ['Prepared proposal and current revision'], outputs: ['Saved In review proposal and editor link'], reviewGate: 'Re-read after a save conflict; reconcile uncertain creation before retrying.'},
      {id: 'proposal-review', kind: 'review', label: 'Ryan reviews & edits', capability: 'manual', connector: 'studio',
        detail: 'Edit directly in Studio or send refinements to the same Proposal Ryan chat and saved draft.',
        inputs: ['Saved proposal', 'Missing facts and assumptions'], outputs: ['Reviewed proposal or requested refinements'], reviewGate: 'Review the content and assumptions before asking for export.'},
      {id: 'proposal-output', kind: 'output', label: 'Export PDF', capability: 'local', connector: 'studio',
        detail: 'Export on your request or explicit Export PDF click. Direct export uses Chrome and blocks overflowing slides; browser Print is also available.',
        inputs: ['Reviewed proposal', 'Explicit export action'], outputs: ['Client-facing PDF without private notes'], reviewGate: 'Export creates a file; sending it is a separate action.'},
    ],
  },
  manager: {
    agentId: 'manager',
    trigger: 'Your brief, status question or a verified Ryan HQ spending alert.',
    intent: 'Summarize reported work and route requested tasks to the appropriate existing Ryan chats.',
    inputs: ['Your request and scope', 'Reported agent activity and replies', 'Known worker roles and task dependencies'],
    outputs: ['Office summary', 'Scoped assignments to existing agents', 'Unresolved dependencies and review needs'],
    accountScope: 'The mapped Agent Manager Codex chat and existing office workers. It does not create a new connector account, worker identity or access grant.',
    lastVerified: '2026-11-27',
    limitations: [
      'A summary question should not start assignments. The map does not continuously invent or execute work.',
      'Reported worker activity is not independent verification of email delivery, CRM changes or task completion.',
      'The unmapped-manager fallback is a read-only planner with up to three assignments; the persistent mapped chat retains its own instructions.',
    ],
    evidence: [
      {label: 'Persistent Manager and prompt behavior', source: 'README.md'},
      {label: 'Fallback role and delegation guard', source: 'scripts/manager.mjs'},
      {label: 'Existing-chat routing and receipts', source: 'scripts/prompt-relay.mjs'},
      {label: 'Verified project spending alert scope', source: 'lib/spending.mjs'},
    ],
    stages: [
      {id: 'manager-trigger', kind: 'trigger', label: 'Receive brief', capability: 'codex', connector: 'codex',
        detail: 'Read the request in the existing Agent Manager chat and distinguish a status question from requested work.',
        inputs: ['Your request or verified system alert'], outputs: ['Task intent and scope'], reviewGate: null},
      {id: 'manager-context', kind: 'action', label: 'Summarize the office', capability: 'codex', connector: 'codex',
        detail: 'Use available agent reports and replies, keeping reported outcomes distinct from independently checked facts.',
        inputs: ['Available office context'], outputs: ['Concise status and outstanding work'], reviewGate: null},
      {id: 'manager-plan', kind: 'review', label: 'Check scope & dependencies', capability: 'codex', connector: 'codex',
        detail: 'Match requested work to Inbox, Outreach, Network, Proposal or Designer. Keep prerequisite work ahead of dependent tasks.',
        inputs: ['Explicit work request', 'Worker roles and dependencies'], outputs: ['Scoped assignment plan or clarification'], reviewGate: 'Do not turn a summary into work, expand scope or override a worker’s existing holds.'},
      {id: 'manager-delegate', kind: 'action', label: 'Delegate to a Ryan', capability: 'codex', connector: 'codex',
        detail: 'Send requested assignments to the existing mapped Codex chats; each worker keeps its own operating rules.',
        inputs: ['Authorized assignment plan'], outputs: ['Assignments or dependency holds'], reviewGate: 'Queued acceptance is not proof that the worker has executed the task.'},
      {id: 'manager-output', kind: 'output', label: 'Return the handoff', capability: 'codex', connector: 'codex',
        detail: 'Explain who owns the next step and what still needs evidence or Ryan’s decision.',
        inputs: ['Summary and assignment outcomes'], outputs: ['Manager reply with owners and next actions'], reviewGate: null},
    ],
  },
  designer: {
    agentId: 'designer',
    trigger: 'Your UI or platform change request, directly or through Manager Ryan.',
    intent: 'Design, implement and validate requested platform changes, then publish within the authorized scope.',
    inputs: ['Your brief and visual references', 'Current repository and local instructions', 'Observed UI behavior and relevant source code'],
    outputs: ['Implemented changes', 'Validation results and remaining limitations', 'Deployment or handoff when requested'],
    accountScope: 'The existing Designer Codex chat and task-authorized workspace/project. This catalog does not grant GitHub, Vercel or other account access.',
    lastVerified: '2026-11-27',
    limitations: [
      'Workflow edits do not run a build, change the repository or deploy a site.',
      'Available tool access and publishing authority depend on the actual task and environment, not a service logo.',
      'Checks and deployment results must come from execution evidence; a working character does not identify a particular build stage.',
    ],
    evidence: [
      {label: 'Designer role and original chat', source: 'lib/model.ts'},
      {label: 'Local framework instructions', source: 'AGENTS.md'},
      {label: 'Build and test commands', source: 'package.json'},
      {label: 'Verification and deployment workflow', source: 'README.md'},
    ],
    stages: [
      {id: 'designer-trigger', kind: 'trigger', label: 'Design brief', capability: 'codex', connector: 'codex',
        detail: 'Read the requested experience, references and constraints in the existing Designer chat.',
        inputs: ['Your change request'], outputs: ['Scoped design or development task'], reviewGate: null},
      {id: 'designer-inspect', kind: 'action', label: 'Inspect & design', capability: 'codex', connector: 'codex',
        detail: 'Review the existing UI, source and project instructions before choosing the implementation.',
        inputs: ['Current product and repository', 'Brief and references'], outputs: ['Design direction and implementation approach'], reviewGate: null},
      {id: 'designer-build', kind: 'action', label: 'Implement changes', capability: 'codex', connector: 'codex',
        detail: 'Edit the relevant platform files while preserving unrelated work and existing integration boundaries.',
        inputs: ['Scoped implementation approach'], outputs: ['Reviewable code and UI changes'], reviewGate: null},
      {id: 'designer-check', kind: 'review', label: 'Check & refine', capability: 'local', connector: 'codex',
        detail: 'Run appropriate type, test, build and browser checks; fix observed regressions and report what was actually verified.',
        inputs: ['Changed code and UI'], outputs: ['Validation evidence and refinements'], reviewGate: 'Unverified or failing behavior stays explicit; publishing follows the user’s authorized scope.'},
      {id: 'designer-output', kind: 'output', label: 'Publish or hand off', capability: 'codex', connector: 'codex',
        detail: 'When authorized, push and deploy the validated change, then check the resulting site; otherwise return the reviewable work.',
        inputs: ['Validated changes', 'Task-specific publishing authority'], outputs: ['Verified deployment or code handoff'], reviewGate: 'A diagram connection never grants permission to publish.'},
    ],
  },
};
