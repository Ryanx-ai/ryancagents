# Verification — 26 November 2026

38 automated tests pass. Production build passes. Browser checks covered desktop and mobile, activity bubbles, mixed idle/walking/looking poses, quiet review stars, review acknowledgement, two-key unlock, incorrect credentials, and frozen reload behavior.

Production checks: legacy viewer cookies receive 401 on activity/messages/reviews. An unverified scripted unlock receives 403 from bot protection. A normal browser passes bot verification and still rejects incorrect credentials. Both saved credentials are configured on production and preview; their values are excluded from Git.

## Manager latency checks

Tests used the linked persistent **Agent Manager** chat. All completed probes requested only status or acknowledgement, with no delegation or business changes.

| Probe | Queue to Mac pickup | Queue to visible reply |
| --- | ---: | ---: |
| Original status-summary baseline | 18.9 s | 50.7 s |
| Optimized acknowledgement | 2.8 s | 11.3 s |
| Optimized same status-summary | 2.6 s | 24.1 s |

Baseline timing begins at HTTP acceptance; optimized probes begin after their canonical message is persisted to the same private queue, with the same revision signal. Optimized probes use the private storage SDK so the transport measurement excludes browser/BotID and HTTP submission overhead. These are individual observations, not a latency guarantee; prompt complexity and an already-busy chat affect end-to-end response time.

The final implementation further separates receipt publishing: local session logs are sampled every second, the queue every two seconds, and dirty receipts every 500ms. No receipt request is made when nothing changed. Single-flight flushing and its failure paths are covered by regression tests. A final repeat queued behind an already-active manager task is excluded from idle-manager response comparisons.
