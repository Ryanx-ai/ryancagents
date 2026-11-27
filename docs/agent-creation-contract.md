# Agent draft creation contract

The **Create a Ryan** dialog is a local draft builder. It does not call an AI model, create a Codex chat, connect an account, register an executable agent, or run its workflow. The six existing agents and their bridge mappings are unchanged.

## UI integration

```tsx
import AgentCreator from './AgentCreator';
import type {AgentDraft} from '../lib/agent-drafts.mjs';

<AgentCreator
  onClose={() => setCreatorOpen(false)}
  onSaved={(draft: AgentDraft) => { /* Optional notification after local save. */ }}
  // initialDraft={existingDraft} // Optional validated draft to edit.
/>
```

The component supplies a native modal dialog, Escape/backdrop close, focus restoration, unsaved-change confirmation and a saved-draft library. The parent should pause office motion while it is open. An authentication failure must still immediately relock the dashboard and unmount the dialog; recovery never bypasses authentication.

The four steps are Describe, Workflow, Outfit & name and Review. All workflow fields are editable. Requested connectors are visibly unverified. Outfit selection reuses the existing standard, manager and designer sprite sheets; no artwork is generated.

The library supports editing, deletion, JSON export and import. Import always creates a new local ID, so a backup cannot overwrite its source. `onSaved` is called after a successful library write and carries an inactive draft.

## Storage and recovery

- Local library: `localStorage['ryan-agent-drafts-v1']`, with `{version: 1, drafts: AgentDraft[]}`. A maximum of 50 drafts is allowed. Read, upsert and deletion validate the entire envelope and every draft before writing. Invalid, unknown-version, duplicate-ID or unknown-field data is preserved, with a recoverable error.
- Unfinished form: `sessionStorage['ryan-agent-draft-recovery-v1']`, with `{version: 1, form: DraftInput, editing: AgentDraft | null, step, unlocked}`. This bounded checkpoint permits empty fields and preserves input whitespace. It remains separate from the saved library and restores after a refresh or automatic relock when the creator is reopened in the same tab. The UI says **Unfinished changes are kept in this tab** and **Recovered unfinished draft in this tab**. Save or explicit discard clears it. Session storage follows browser tab-session behavior, including browser session restoration where enabled.
- Storage errors do not imply a successful save or recovery. A completed draft can still be exported when storage is blocked or full. Unsaved forms also register the browser's `beforeunload` warning while dirty, subject to browser support.
- Neither storage is cloud-synced or an authorization store. The builder sends no entered text or configuration over the network.

## Draft schema

The exported file wraps the following draft in `{kind: 'ryan-agent-draft', version: 1, draft}`. JSON imports are limited to 64 KB. Text is rendered through React as text, never interpreted as HTML or code.

```json
{
  "schemaVersion": 1,
  "id": "draft_5f985267-8eef-4eb7-a3a9-73211a491e08",
  "status": "draft",
  "name": "Research Ryan",
  "description": "Prepare a research summary for review.",
  "workflow": {
    "trigger": "When requested",
    "input": "A research question",
    "steps": ["Read the question", "Gather relevant information", "Prepare a summary"],
    "output": "A summary for review"
  },
  "outfit": "standard",
  "requestedConnectors": ["codex"],
  "connectorVerification": "not_verified",
  "activation": "unavailable",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

Field limits: name 60 characters, description 2,000, trigger 300, input/output 1,500 each, 1–12 steps with up to 500 characters each. A saved/exported draft requires all textual fields and steps to be nonempty. Outfits are `standard`, `manager`, `designer`. Connector IDs are `gmail`, `calendar`, `contacts`, `sheets`, `gohighlevel`, `studio`, `codex`; duplicates and unknown IDs are rejected.

`validateAgentDraft` returns a normalized clone or throws. `createAgentDraft(input, previous?)` creates a draft or preserves the previous ID/creation time for an edit. `readAgentDrafts`, `saveAgentDraft`, `deleteAgentDraft`, `exportAgentDraft` and `importAgentDraft` are the shared library API. Recovery uses `readAgentDraftRecovery`, `saveAgentDraftRecovery` and `clearAgentDraftRecovery`. All storage helpers accept an injected storage implementation for testing.

## Future activation boundary

`canActivateAgentDraft()` always returns `false`. The client rejects imported active states, connector verification claims, executable fields, credentials, and unsupported fields. Selected connector identities are requests, never evidence of a grant.

A future integration needs a separate authenticated server flow that validates the draft, provisions a unique agent identity, maps it to an authorized Codex chat/bridge handler, verifies connector grants independently, and explicitly enables execution. Saving this JSON must never be treated as that flow. The present prompt API accepts only the existing six agent IDs and does not accept this draft as an executable registration.

Tests cover validation, inactive-state enforcement, export/import identity, edit/delete isolation, corrupt-data preservation, storage failures, library limits and unfinished-form recovery. They use synthetic content and make no network or business calls.

## Clothing colors

A draft may optionally contain `palette: {jacket: '#465575', shirt: '#eee7d6', pants: '#303741'}`. Each value must be a complete six-digit hex color; validation normalizes it to lowercase. Unknown color fields and non-color values are rejected. The field is optional within version 1, so existing drafts, exports and unfinished recovery checkpoints continue to use their outfit's original colors without migration. Changing the outfit or choosing **Reset colors** removes the override. Export/import and recovery preserve valid custom colors.

Live-agent wardrobe preferences are separate from draft data in `localStorage['ryan-wardrobe-v1']`, using `{version: 1, agents: {agentId: Palette}}`. They only change appearance. `WardrobeProvider` reads this store after mount and shares updates across the office; `useWardrobe(agentId)` returns a saved override or `undefined`. The renderer accepts an explicit palette for draft/editor previews, with `null` meaning the original outfit independent of live-agent preferences. The wardrobe's **Apply colors** saves its preview; **Reset original** previews the original colors and removes that agent's override only after Apply. Cancel preserves the previous saved colors. Other agents and other browser settings are preserved. Stored colors never change an agent's outfit silhouette, chat mapping, permissions or workflow.
