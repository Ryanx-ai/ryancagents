# Agent draft creation contract

The **Create an agent** dialog starts with **Prompt → Connect**. A user can save a prompt and requested tools without entering a name, choosing an outfit, or writing workflow steps. After saving, **Customize Ryan** opens optional name, outfit, clothing colors and workflow notes. Saved drafts also expose customization from their library entry.

This is an inactive brief, not an AI-generated or executable agent. AI creation and connector grants are not connected. The dialog makes no model/API calls, creates no Codex chat, authenticates no account, and sends no customer messages. The six live agents remain unchanged.

## UI integration

```tsx
import AgentCreator from './AgentCreator';
import type {AgentDraft} from '../lib/agent-drafts.mjs';

<AgentCreator
  onClose={() => setCreatorOpen(false)}
  onSaved={(draft: AgentDraft) => { /* Optional notification after local save. */ }}
  // initialDraft={existingDraft}
/>
```

The component supplies a native modal dialog, Escape/backdrop close, focus restoration, unsaved-change confirmation and a saved-draft library. The parent pauses office motion while it is open. Authentication failure must still immediately relock the dashboard and unmount the dialog; recovery never bypasses authentication.

The Prompt step accepts the user's instructions. Connect records requested tools and clearly says that no accounts are connected. Requests remain `not_verified`. **Save draft** writes the inactive brief locally and shows its saved state. `onSaved` fires only after that write succeeds. No workflow is inferred or filled automatically.

Name and appearance are optional. An empty name displays **New Ryan** without inserting that label into the user's data. The original Ryan outfit is the default. Workflow notes are available only in optional customization: users may add an unfinished outline, and those notes never execute anything.

## Schema versions and preservation

New drafts use `schemaVersion: 2`:

```json
{
  "schemaVersion": 2,
  "id": "draft_5f985267-8eef-4eb7-a3a9-73211a491e08",
  "status": "draft",
  "name": "",
  "description": "Review new leads and prepare a summary for me.",
  "workflow": null,
  "outfit": "standard",
  "requestedConnectors": ["gmail", "contacts"],
  "connectorVerification": "not_verified",
  "activation": "unavailable",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

`description` is the required prompt. `workflow: null` explicitly means unconfigured. An optional user-written workflow retains the shape `{trigger, input, steps, output}`; in version 2 its strings and step list may be empty. No placeholder actions are inserted to satisfy validation.

Version 1 remains readable and retains its original validation: a nonempty name and complete workflow are required. Reading a version-one draft does not rewrite it. Importing an old export keeps its schema, workflow, outfit, colors and requested tools but gives the copy a new ID. Explicitly editing/saving an old draft upgrades that draft to version 2 while preserving its editable contents. Other library entries are untouched.

Limits: prompt 1–2,000 characters; optional name up to 60; workflow trigger up to 300, input/output up to 1,500 each, up to 12 steps of up to 500 characters each. Outfits are `standard`, `manager`, `designer`. Connector IDs are `gmail`, `calendar`, `contacts`, `sheets`, `gohighlevel`, `studio`, `codex`. Duplicate or unknown connector IDs, unknown fields, claimed active states and claimed verified grants are rejected.

## Library, import and recovery

- Library key: `localStorage['ryan-agent-drafts-v1']`. The original key is retained to discover existing data. Readers accept envelope versions 1 and 2 with `{version, drafts}`; new writes use version 2 and may contain both draft schema versions. The whole envelope and all drafts are validated before any write. The limit is 50 drafts. Corrupt data, unknown versions/fields and duplicate IDs are preserved with a recoverable error.
- Export format: `{kind: 'ryan-agent-draft', version: draft.schemaVersion, draft}`. Both supported versions import; the wrapper and draft versions must match. Imports are limited to 64 KB and always become new copies, so a backup cannot overwrite its source. Text is rendered as React text, never HTML or code.
- Recovery key: `sessionStorage['ryan-agent-draft-recovery-v1']`. Version 2 checkpoints contain `{version: 2, form, editing, step, unlocked, view}`, where `step`/`unlocked` are 0 or 1 and `view` is `builder` or `customize`. Empty fields and whitespace are preserved. Version-one checkpoints remain readable: old Prompt/Review stages map to the two-step builder, while unfinished Workflow/Outfit stages reopen optional customization. Their partial workflow and appearance data remain intact.
- Recovery is separate from the saved library. The UI explicitly says unfinished changes are kept in the tab and announces recovery. Save or explicit discard clears the checkpoint. Browser refresh/tab-close warnings apply while dirty, subject to browser support. Browser session restoration may also restore session storage.
- Storage errors never imply a successful save. A prompt draft can still be exported if browser storage is unavailable. Nothing is cloud-synced or transmitted by this component.

The shared API remains `validateAgentDraft`, `createAgentDraft(input, previous?)`, `readAgentDrafts`, `saveAgentDraft`, `deleteAgentDraft`, `exportAgentDraft`, `importAgentDraft`, and `canActivateAgentDraft`. Recovery uses `readAgentDraftRecovery`, `saveAgentDraftRecovery`, and `clearAgentDraftRecovery`. Storage helpers accept injected storage for tests.

## Clothing colors

Both draft versions may contain `palette: {jacket: '#465575', shirt: '#eee7d6', pants: '#303741'}`. Only complete six-digit hex colors are accepted and normalized to lowercase. Missing colors use the outfit's original appearance. Choosing a different outfit or **Reset colors** removes the override. Export/import and recovery preserve valid colors.

Live-agent wardrobe preferences remain separate in `localStorage['ryan-wardrobe-v1']`. `WardrobeProvider` shares these appearance-only overrides. Explicit `palette: null` in draft previews uses the original outfit independently of live-agent preferences. Wardrobe **Reset original** remains a preview until Apply; Cancel keeps the previous saved colors. Appearance never changes chat mappings, permissions or workflows.

## Future activation boundary

`canActivateAgentDraft()` always returns `false`. A future authenticated server flow must independently validate the brief, create an authorized agent/chat mapping, verify connector grants and explicitly enable execution. Saving or importing a draft is never that flow. The current prompt API still accepts only the six existing live agent IDs.

Tests cover prompt-only saving, inactive state enforcement, mixed-version libraries, legacy imports and recovery, optional outlines/colors, corrupt-data preservation, bounded storage and failure handling. All test content is synthetic; no business or network calls are made.
