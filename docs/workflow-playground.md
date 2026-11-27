# Workflow playground

Workflows contains a separate **Dummy Ryan** selection, represented by a silhouette. It is not an AgentId, worker, chat, seat, bridge mapping or executable workflow. Nothing in its graph is sent to Codex or to a connector.

Add Trigger, Action, Review and Output nodes. Drag them, edit their name/type/notes, connect handles or choose endpoints in the inspector. Delete nodes or connections; deleting a node removes its incident links. Clear canvas is reversible with Undo. Undo retains 30 recent changes for the open editor session. Valid inspector edits save immediately; an empty name keeps its last valid saved value and shows a warning.

The versioned graph is saved under `ryan-workflow-sandbox-v1` in this browser. It supports at most 40 nodes and 80 edges, rejects orphan/duplicate connections, and strips unsupported node fields. Corrupt or future-version saved content is preserved; editing then remains session-only with a visible warning. This is a UI sandbox, not shared cloud storage or an execution API.

Real agent guides retain their documented stages and branches. Dotted connections move only when the bridge reports that the selected agent is working. They indicate agent-level activity; individual steps are not tracked. Pause and reduced-motion settings stop the flow animation. Dummy graphs never animate as if they were executing.
