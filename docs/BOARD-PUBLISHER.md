# Calendar → today's blackboard

The board is a private display and a personal checklist. Checking a Calendar note changes only its acknowledgement on the board: it never edits an event, RSVP, Scheduler attention record, contact, or GHL record.

## Source and cadence

Use the existing `ryan-s-work-email-scheduling-agent` 15-minute cycle, after its pause/recovery checks. Reuse its already-fetched **complete** events for today's Singapore date when possible. Otherwise read only that day's primary work Calendar using the connected Calendar tool. The exact account and Calendar are `ryanchin@verticalinstitute.com`, timezone `Asia/Singapore`. Do not substitute free/busy results, email guesses, personal calendars, holidays, or a partial page.

The publisher is a script called by that existing cycle, not a new background worker. Content changes publish at the next eligible cycle; unchanged content gets at most one hourly freshness publication. The dashboard reads on unlock, board open, manual refresh, and tab return, with no board polling interval. A paused/unavailable Scheduler or sleeping Mac can leave the board stale; the UI shows the last successful source observation. GHL propagation remains unverified: these are Calendar notes, not a claim of a direct GHL connection.

## Private input

Atomically replace `.local/board-calendar-input.json` (mode `0600`, ignored by Git). The directory is private and ignored. Never write real event details into repository docs, fixtures, public assets, or general worker reports. The user has authorized source descriptions and meeting links on this private board. Include title, stable event ID, start/end, all-day flag, source Calendar URL, readable description in `body`, and optional safe `links`. Do not independently copy attendee lists, phone fields or physical locations. Contact information already inside an authorized source description remains source text; it is not synthesized or enriched.

Search results can contain empty descriptions even when the full event has booking notes. Reuse a full event response when available; otherwise read each relevant event with the connector's `read_event`/`batch_read_event` before publishing. If that required detail read fails, publish an error snapshot and keep the last good board rather than replacing notes with incomplete details. Full event responses may use `url` for the Google Calendar source link while search results use `web_link`; preserve the actual Google Calendar URL and stable ID.

Use `extractCalendarDetails(event)` from `lib/calendar-details.mjs` to produce `{body, links}`. The publisher runs directly from the repository; the helper has no external package dependencies. It removes active HTML blocks, extracts readable text up to 2,000 characters and at most eight HTTPS links, and does not fetch or click anything. Source anchors and short preceding labels distinguish Agenda, Reschedule and Cancel; fallback labels use the URL host. HTTPS Google Meet URLs can be labeled Google Meet. Never invent meeting minutes, attendee acceptance, or a “Join meeting” action for a booking/cancel URL. Source `url` remains separate from `links`. See [the exact validation contract](./BOARD-CONTRACT.md).

```json
{
  "version": 1,
  "day": "YYYY-MM-DD",
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

Read every page before setting `complete: true`. Include confirmed/tentative, non-cancelled events intersecting `[00:00 Singapore today, 00:00 tomorrow)`, including an event that began yesterday. Preserve the original event ID so two representations of a synced event do not create two notes. Google all-day end dates are exclusive. Empty `events` is valid only after a verified complete empty Calendar read. Meeting status `confirmed` does not mean its attendees accepted.

If a scoped read fails or is incomplete, publish an error snapshot with the same version/day/timezone/account/calendar, `observedAt` equal to the actual attempted source-read timestamp, `status: "error"`, and `reason: "unavailable"`, `"authentication"`, or `"partial"`. Do not include `events` or `complete`. A failed read must never erase last-known notes or advance their successful observation time. Do not fabricate a fresh snapshot when the cycle is paused.

## Publish

```sh
node scripts/publish-board.mjs --dry-run
node scripts/publish-board.mjs
```

The script validates scope and schema before networking. It reuses the existing ignored `.local/bridge.json` URL and bridge credential (`OFFICE_BRIDGE_CONFIG` can point at another private config for development). Credentials never enter the browser. The destination is `PUT /api/board/calendar`; it uses the existing bridge bearer authorization. The response/log includes only date, status, count, and success metadata.

The private `.local/board-publish-state.json` keeps only a content hash, publication timestamp and retry state. `.local/board-publish.lock` prevents overlapping publishers. Source content is compared independently of event order/observation timestamp. Unchanged content is coalesced for one hour, errors back off from five minutes up to one hour, and HTTP 401/403 waits one hour. There is one request per eligible invocation and no retry loop. A failed publish is not a successful sync.

## Storage and editing

The server stores board data separately from agent activity at the known private Blob path `office/board-v1.json`, using conditional writes. No Blob LIST operation or existing office-state migration is required. Viewer routes enforce the office session and same-origin/BotID protection for writes. Calendar title/time/source fields cannot be edited through viewer routes. Notes use per-note versions; concurrent updates return a conflict rather than silently losing another device's changes.

Manual notes persist across dates/devices, and users can reopen completed notes. Calendar acknowledgements survive a source refresh with the same stable event ID. A verified complete source snapshot removes cancelled, deleted, or moved-out-of-day source events from that day's board; manual notes are untouched. Opening the board does not schedule work or contact a customer.
