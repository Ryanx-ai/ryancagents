# Calendar → today's and upcoming blackboard

The board is a private display and a personal checklist. Checking a Calendar note changes only its acknowledgement on the board: it never edits an event, RSVP, Scheduler attention record, contact, or GHL record.

## Source and cadence

Use the existing `ryan-s-work-email-scheduling-agent` 15-minute cycle, after its pause/recovery checks. Reuse its already-fetched **complete, unfiltered** events for today and the next 13 Singapore dates when possible. Otherwise read that 14-day range from the primary work Calendar using the connected Calendar tool. The Scheduler's Ryan-organized/external-attendee attention subset is not complete board coverage. The exact account and Calendar are `ryanchin@verticalinstitute.com`, timezone `Asia/Singapore`. Do not substitute free/busy results, email guesses, personal calendars, holidays, or a partial page.

The publisher is a script called by that existing cycle, not a new background worker. Content changes publish at the next eligible cycle; unchanged content gets at most one hourly freshness publication. The dashboard reads on unlock, board open, manual refresh, and tab return. While the board is open and the page is visible, it also sends a conditional GET every 120 seconds using its current ETag; interval reads stop when the board is closed or the page is hidden. This refreshes only the published board, with no additional source polling or worker. A paused/unavailable Scheduler or sleeping Mac can leave the board stale; the UI shows the last successful source observation. GHL propagation remains unverified: these are Calendar notes, not a claim of a direct GHL connection.

## Private input

Atomically replace `.local/board-calendar-input.json` (mode `0600`, ignored by Git). The directory is private and ignored. Never write real event details into repository docs, fixtures, public assets, or general worker reports. The user has authorized source descriptions and meeting links on this private board. Include title, stable event ID, start/end, all-day flag, source Calendar URL, readable description in `body`, and optional safe `links`. Do not independently copy attendee lists, phone fields or physical locations. Contact information already inside an authorized source description remains source text; it is not synthesized or enriched.

Search results can contain empty descriptions even when the full event has booking notes. Reuse a full event response when available; otherwise read each relevant event with the connector's `read_event`/`batch_read_event` before publishing. If that required detail read fails, publish an error snapshot and keep the last good board rather than replacing notes with incomplete details. Full event responses may use `url` for the Google Calendar source link while search results use `web_link`; preserve the actual Google Calendar URL and stable ID.

Use `extractCalendarDetails(event)` from `lib/calendar-details.mjs` to produce `{body, links}`. The publisher runs directly from the repository; the helper has no external package dependencies. It removes active HTML blocks, extracts readable text up to 2,000 characters and at most eight HTTPS links, and does not fetch or click anything. Source anchors and short preceding labels distinguish Agenda, Reschedule and Cancel; fallback labels use the URL host. HTTPS Google Meet URLs can be labeled Google Meet. Never invent meeting minutes, attendee acceptance, or a “Join meeting” action for a booking/cancel URL. Source `url` remains separate from `links`. See [the exact validation contract](./BOARD-CONTRACT.md).

```json
{
  "version": 2,
  "day": "YYYY-MM-DD",
  "rangeStart": "same date as day, inclusive",
  "rangeEnd": "day plus 13 calendar days, inclusive",
  "timeZone": "Asia/Singapore",
  "accountId": "ryanchin@verticalinstitute.com",
  "calendarId": "ryanchin@verticalinstitute.com",
  "observedAt": "ISO timestamp of the successful source read",
  "status": "ok",
  "complete": true,
  "events": [
    {
      "eventId": "original Google event ID",
      "title": "minimal event title",
      "body": "readable source description, when present",
      "links": [{"label": "Agenda", "url": "https://docs.example.com/agenda"}],
      "start": "ISO timestamp or all-day YYYY-MM-DD",
      "end": "ISO timestamp or exclusive all-day YYYY-MM-DD",
      "allDay": false,
      "url": "original Google Calendar event URL"
    }
  ]
}
```

Use `calendarSnapshotRange(day)` from `lib/board.mjs` for the exact inclusive date fields. For example, a source check on 2026-11-29 covers `rangeStart:2026-11-29` through `rangeEnd:2026-12-12`; the Calendar query window is `[2026-11-29T00:00:00+08:00, 2026-12-13T00:00:00+08:00)`. Read every page and required full event details before setting `complete: true`. Include confirmed/tentative, non-cancelled events intersecting this window, including an event that began before it. Keep each event once rather than repeating it per day, and use each recurring occurrence's original event ID. Google all-day end dates are exclusive. Empty `events` is valid only after a verified complete empty Calendar read. More than 200 events is a partial-capacity failure, not permission to truncate. Meeting status `confirmed` does not mean its attendees accepted.

If a scoped read fails or is incomplete, publish an error snapshot with the same version/day/rangeStart/rangeEnd/timezone/account/calendar, `observedAt` equal to the actual attempted source-read timestamp, `status: "error"`, and `reason: "unavailable"`, `"authentication"`, or `"partial"`. Do not include `events` or `complete`. A failed read must never erase last-known notes, replace their successful coverage or advance their successful observation time. Do not fabricate a fresh snapshot when the cycle is paused.

## Publish

```sh
node scripts/publish-board.mjs --dry-run
node scripts/publish-board.mjs
```

The script validates scope and schema before networking and bounds the input at 750 KB, matching the route limit. It reuses the existing ignored `.local/bridge.json` URL and bridge credential (`OFFICE_BRIDGE_CONFIG` can point at another private config for development). Credentials never enter the browser. The destination is `PUT /api/board/calendar`; it uses the existing bridge bearer authorization. The response/log includes only version, dates/coverage, status, count, and success metadata. Neither the bridge nor a new daemon watches the input file: the existing cycle invokes this repository script directly.

The private `.local/board-publish-state.json` keeps only a content hash, publication timestamp and retry state. `.local/board-publish.lock` prevents overlapping publishers. Source content is compared independently of event order/observation timestamp. Unchanged content is coalesced for one hour, errors back off from five minutes up to one hour, and HTTP 401/403 waits one hour. There is one request per eligible invocation and no retry loop. A failed publish is not a successful sync.

## Storage and editing

The server stores board data separately from agent activity at the known private Blob path `office/board-v1.json`, using conditional writes. No Blob LIST operation or existing office-state migration is required. Viewer routes enforce the office session and same-origin/BotID protection for writes. Calendar title/time/source fields cannot be edited through viewer routes. Notes use per-note versions; concurrent updates return a conflict rather than silently losing another device's changes.

Manual notes persist across dates/devices, and users can reopen completed notes. Calendar acknowledgements survive a source refresh with the same stable event ID. A verified complete source snapshot removes cancelled, deleted, or moved-out-of-range source events; manual notes are untouched. The Calendar view exposes the actual successful coverage, and dates outside it are unsynced rather than verified empty. A legacy v1 source retains honest one-day coverage until upgraded; after the first v2 success the server rejects v1 success with `CALENDAR_RANGE_REQUIRED` so an older cycle cannot erase upcoming notes. Opening the board does not schedule work or contact a customer.
