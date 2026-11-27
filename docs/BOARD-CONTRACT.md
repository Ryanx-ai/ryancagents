# Manager's blackboard

The board stores manual post-it notes and a read-only copy of the configured work Google Calendar. **Done/Reopen affects the board only.** This feature does not create, edit, cancel or delete calendar events, and does not claim an independent GoHighLevel connection.

## Storage and cost

Production uses one private Blob object, `office/board-v1.json`. It is created only by the first successful write. Initialization uses create-if-absent; later writes use strong ETag compare-and-swap. A losing first writer re-reads the known path and merges. Corrupt existing data fails closed. There are no Blob LIST operations, per-note objects or board polling loops.

Read on board open, explicit refresh or a relevant tab return. GET supports ETags/304; the representation includes the requested SGT day and a one-minute freshness bucket so an old 304 cannot preserve a stale “current” label indefinitely. Each read uses one known object path. Viewer responses remain authenticated and `private, no-store`; the client keeps its ETag only in the unlocked session.

The board retains up to 200 manual notes. Open notes never expire. Completed manual notes older than 90 days are pruned on creation of another note; the limit otherwise produces an explicit capacity error. Create-ID idempotency applies while that note is retained. The current calendar snapshot contains at most 200 events. Removed calendar entries retain their board acknowledgement/version for up to 180 days, bounded to 2,000 entries; reaching that bound fails visibly rather than silently dropping acknowledgements.

For isolated local QA only, `OFFICE_BOARD_DEV_STORE=1` **and** `NODE_ENV=development` select process-memory storage. It survives hot reload through a global singleton but is not durable across process restarts. Production ignores this switch. Authentication, same-origin checks, BotID and calendar bearer checks remain enforced. Never use this mode as a production persistence claim.

## Viewer API

All viewer operations require the existing office session, issued after both access keys. Writes additionally require the same origin and BotID verification. No new credential is introduced.

`GET /api/board?day=YYYY-MM-DD` defaults to today's `Asia/Singapore` date. It returns **all retained manual notes across dates**, plus the current calendar snapshot rows; the UI can filter Today/Open/Done. A note's `date` is not inferred from browser timezone.

```ts
type BoardResponse = {
  version: 1;
  day: string;
  timeZone: 'Asia/Singapore';
  notes: BoardNote[];
  calendar: {
    status: 'unconfigured' | 'waiting' | 'current' | 'stale' | 'error';
    observedAt: string | null; // last successfully published source check
    lastAttemptAt: string | null;
    day: string | null;       // day covered by that successful snapshot
    reason?: 'unavailable' | 'authentication' | 'partial';
  };
};
```

`BoardNote` fields are `id`, `source` (`manual`/`calendar`), `date`, `title`, `body`, `color`, `done`, `version`, `createdAt`, `updatedAt`, and optional `calendar`. Colors: `yellow`, `peach`, `mint`, `blue`, `lavender`. Titles allow 1–160 characters; bodies 0–2,000. Dates must be valid ISO dates in 2000–2099. Shared types live in [`lib/board.d.mts`](../lib/board.d.mts).

`POST /api/board` accepts `{id, date, title, body, color}`. Generate a UUID v4 once in the browser and reuse it after ambiguous failures. New notes start open at version 1. Response: `201 {note}`; repeating the original create returns `200 {note}` even if that note was subsequently edited. Reusing its ID for different initial content returns 409.

`PATCH /api/board` accepts `{id, version, patch}`. Manual patches may change `title`, `body`, `date`, `color`, `done`; calendar patches permit only `color` and `done`. Response: `{note}`. Stale versions return `409 {error, code:'NOTE_CONFLICT', current}`. Preserve the user's unsaved form and explicitly reconcile it with `current`; do not automatically overwrite the newer note. No-op updates perform no write. A calendar item removed by a complete source refresh returns 404 when updated.

## Calendar publisher contract

`PUT /api/board/calendar` accepts only the existing `OFFICE_BRIDGE_KEY` bearer credential. Viewer tokens are insufficient. The server uses its explicitly configured work account/calendar; optional `OFFICE_BOARD_CALENDAR_ACCOUNT` and `OFFICE_BOARD_CALENDAR_ID` override the server defaults. Both IDs must match exactly. Never substitute another account or a display title.

Use the existing Inbox/Scheduler cycle to read the **whole SGT day**, finish all pages, then atomically write one ignored local snapshot for the publisher. There is no new worker or calendar mutation. The snapshot is authoritative only after every page succeeds. On partial coverage, publish an error instead of an incomplete event list.

Successful wire shape (replace the example date/times and account IDs with the actual check):

```json
{
  "version": 1,
  "status": "ok",
  "day": "2026-11-27",
  "timeZone": "Asia/Singapore",
  "accountId": "<configured work account ID>",
  "calendarId": "<configured work calendar ID>",
  "observedAt": "2026-11-27T03:00:00.000Z",
  "complete": true,
  "events": [
    {
      "eventId": "stable-google-event-or-occurrence-id",
      "title": "Example meeting",
      "body": "",
      "start": "2026-11-27T11:30:00+08:00",
      "end": "2026-11-27T12:00:00+08:00",
      "allDay": false
    }
  ]
}
```

Optional `url` must be an HTTPS Google Calendar event link. Timed events need explicit timezone offsets; all-day events use ISO dates with an **exclusive** end date. Every active event must overlap the specified SGT day. Use each recurring occurrence's stable event ID, not its title or only its series ID. Identical titles do not identify events. An explicit cancelled record may be `{eventId, status:'cancelled'}`; absent/cancelled/moved-out events disappear when the next complete snapshot replaces the previous rows. Board acknowledgement flags remain keyed by account + calendar + event ID, so title changes and later reappearance do not reset them.

`observedAt` must be timezone-qualified, at most two hours old or one minute ahead, and describe today's SGT day. An older observation than the latest persisted attempt is rejected. Different content at the same observation time is rejected. The pure `validateCalendarSnapshot(value, scope, now?)` export returns a normalized **wire-safe** snapshot; publishers may serialize that return value.

For a failed read, send the same version/day/timezone/scope/observedAt fields with `status:'error'` and `reason:'unavailable'`, `'authentication'` or `'partial'`. Omit `events` and `complete`. Never upload raw exception logs or credentials. Error publication preserves the last successful event list and `observedAt`; `lastAttemptAt` identifies the failed check.

Upload changed content immediately. Unchanged success/error publications are deduplicated for up to one hour; a freshness heartbeat after an hour updates the observation without resetting per-note versions or Done marks. The source becomes stale after 90 minutes without a successful published observation, or when its day is no longer today. A recorded failure is shown as an error. The publisher should keep its own last successful fingerprint and bounded retry policy, avoiding repeated uploads or retry loops when storage is unavailable. Maximum request body: 750 KB.
