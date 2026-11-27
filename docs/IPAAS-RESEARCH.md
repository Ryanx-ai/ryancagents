# Workflow builder research and implementation

Reviewed 27 November 2026 against official n8n, Make and Zapier documentation. This research concerns editor interactions. Ryan’s Office remains a dashboard for existing Codex chats; Dummy Ryan is a browser-local practice canvas.

## What “create a node” means

There are two different jobs: adding an instance of an existing integration to a canvas, and implementing a new integration. n8n’s node-development guidance requires JavaScript/TypeScript, packaging, understanding its data model and testing. A card with a logo does not supply those capabilities. [n8n node development](https://docs.n8n.io/connect/create-nodes/overview.md)

Make describes modules by their actual API behavior: actions, searches, polling triggers, instant triggers and other specialized types. Zapier’s action implementation similarly combines input fields, API requests and structured outputs. Dummy Ryan’s templates implement none of those execution contracts. [Make module development](https://developers.make.com/custom-apps-documentation/app-components/modules), [Zapier action development](https://docs.zapier.com/integrations/build/action)

## Editor patterns compared

| Product | Discovery and placement | Configuration | Relevant design choice |
| --- | --- | --- | --- |
| n8n | Search or browse from the initial step or a node’s add connector; choose a service and operation. | Open a node to inspect or change its parameters; rename, duplicate and delete are explicit operations. | Searchable app/action picker, contextual next-step control, separate inspector. |
| Make | Select an app, then an appropriate module type. Routers can be inserted between modules or appended with a plus control. | Module inputs are configured and, in a functioning scenario, mapped from prior output bundles. | Insert on an existing connection; distinguish a trigger, action, review and output. |
| Zapier | Search for an app and select its action event. The graph remains visible alongside the selected step’s sidebar. | Setup, Configure and Test are separate stages; publish changes the live workflow. | Keep discovery separate from example settings, preserve the canvas context and provide Undo. |

Sources: [n8n node controls](https://docs.n8n.io/build/understand-workflows/workflow-components/work-with-nodes.md), [Make module types](https://help.make.com/types-of-modules), [Make router placement](https://help.make.com/step-2-add-a-router), [Zapier action setup](https://help.zapier.com/hc/en-us/articles/8496257774221-Set-up-your-Zap-action), [Zapier editor](https://help.zapier.com/hc/en-us/articles/16722578092429-Use-the-editor-to-build-and-view-your-Zap-workflows).

n8n makes connections discoverable through output-to-input dragging. Its lines route real data; Dummy Ryan uses the same spatial gesture only to describe a proposed sequence. A second, labeled From/To form supports users who cannot comfortably drag small handles. [n8n connections](https://docs.n8n.io/build/understand-workflows/workflow-components/connect-nodes-together.md)

Make’s mapping interface uses fields from actual module output bundles. There are no sampled execution outputs in this dashboard, so the implementation deliberately uses plain example settings rather than invented variables, successful test records or data mappings. [Make mapping](https://help.make.com/mapping)

Zapier’s Test action can perform the action in the connected application. A cosmetic test button would misrepresent what this dashboard can do. Dummy Ryan therefore has no Test, Run, Publish, Connect account or credential controls. [Zapier action testing](https://help.zapier.com/hc/en-us/articles/8496257774221-Set-up-your-Zap-action)

## Implemented in Dummy Ryan

1. **Discover.** Add step opens a focused, searchable picker. Browse All, Triggers, Apps or Flow tools; choose an app, then its action. Search matches app names, action names, descriptions and step types. The picker is a native modal with Escape, backdrop dismissal and focus restoration.
2. **Place.** A node-side plus adds a connected next step. If that node already has a successor, the new step creates another outgoing branch and preserves the existing one. A plus on a connection inserts a step between its endpoints. These are separate gestures because branching and insertion have different effects.
3. **Configure.** Selecting a step opens its name, template identity, example fields and notes. Fields are specific to the chosen action: for example, a draft email has an example recipient, subject and body. All valid edits save locally; a temporarily blank name keeps the last valid saved name and displays a message.
4. **Revise.** Duplicate copies a step’s settings under a new identity without duplicating connections. Delete removes incident connections. Undo restores a whole insertion, deletion, drag or grouped inspector edit. Clear canvas is also undoable during the current session.
5. **Connect.** Drag output to input, or use the From/To form. Self-connections are rejected, duplicate connections are a no-op, and cycles are permitted as diagrams. No branch condition is evaluated.

The 18 templates cover manual and scheduled starts; Gmail discovery, search, drafting and sending; Calendar availability and events; Sheets lookups and rows; contact research; a GHL contact update; a Codex brief; a Proposal Studio handoff; condition, wait, review and output steps. These names describe possible designs. GHL is explicitly unconnected; Codex templates do not call a model; Studio templates do not create a proposal; wait and schedule templates do not register timers.

## Boundaries and compatibility

The six real-agent guides and the previous saved map are read-only. Users can inspect documented stages, tools, history and chat links. Dragging, connecting, reconnecting, renaming, deleting and saving changes to those maps are disabled. Legacy map data is read without rewriting it.

Dotted connections move only when the bridge is online, the corresponding agent reports `working`, and animation is not paused. Reduced-motion preferences stop the animation. This signals agent-level activity; individual stage execution is unknown because the bridge has no per-node execution telemetry. Cross-agent links in the saved map remain still because no transfer is tracked. Dummy Ryan’s edges are always static. In Demo mode, the existing runtime badge says `Demo` and displayed states/history are demo data; any working animation follows those simulated states and is not evidence of a live agent task.

Sandbox storage keeps the existing `ryan-workflow-sandbox-v1` key and graph version 1. Old generic nodes retain their exact label, kind, notes and geometry. New template nodes add optional `templateId` and allowlisted string `config` fields; they do not add execution state. Unknown versions, unsupported templates or corrupt saved data are preserved without being overwritten. Graphs remain bounded to 40 nodes, 80 edges and a serialized storage limit.

Insertion validates the entire new graph before committing it, so a capacity error cannot disconnect an existing graph. Undo stores local snapshots; the sandbox does not use dashboard APIs, cloud storage, account credentials, business-agent prompts or execution requests. Example settings are ordinary browser storage, so the inspector asks for sample data.

## Verification

`tests/workflow-sandbox.test.mjs` covers immutable editing, incident-edge cleanup, existing-v1 round trips, supported and rejected template settings, append versus insert behavior, atomic insertion failure at capacity, independent duplicate settings, bounds and storage preservation. All 14 tests pass. TypeScript and whitespace checks pass. Release browser checks passed for app/action selection, sample settings, search, edge insertion, duplicate/delete/undo, saved graph restoration, and the locked real-agent guide. The picker and canvas were checked at desktop width and 320px phone width. Activity motion is guarded by online + working + not paused, and reduced-motion CSS. No claim of per-step execution is made.
