# Voice input feasibility

Research checked 27 November 2026. Plan only: workflow diagrams remain the priority. No microphone access, transcription service, credentials, or agent behavior changed.

Voice input is feasible as an optional way to fill HQ's existing prompt. Recommended interaction: **select Ryan → Record → Stop → review/edit transcript → Send**. Recognition must never submit automatically, interpret spoken text as permission to bypass approvals, or trigger customer actions before Send.

## Existing foundation

[`Dashboard.tsx`](../components/Dashboard.tsx) already keeps editable prompts per selected agent and sends bounded text to [`/api/messages`](../app/api/messages/route.ts). That route applies the office session, same-origin and bot checks. [`prompt-relay.mjs`](../scripts/prompt-relay.mjs) then queues text into the configured Codex chat. Its queued, delivered and replied states remain useful after adding voice; recognition success is not agent delivery.

Repository inspection found no microphone/transcription implementation or OpenAI SDK integration. The existing signed-in Codex relay is not a transcription API. A server transcription option would need separately configured API access, following the [official quickstart](https://developers.openai.com/api/docs/quickstart).

## Options

| Consideration | Browser speech recognition | Record audio → server transcription |
| --- | --- | --- |
| Integration | Feature-detect `SpeechRecognition` or `webkitSpeechRecognition`; receive text in the browser. | `getUserMedia` + `MediaRecorder`; upload a bounded clip to an authenticated endpoint that returns text. |
| Desktop/phone coverage | Uneven. Current compatibility data includes Chrome desktop/Android and prefixed Safari macOS/iOS, while Firefox Android is unsupported. API presence alone does not prove the recognition service works. | Audio capture is more widely available, making this the stronger candidate for consistent phone support. Recording format must be negotiated at runtime. Physical-device tests are still required. |
| Latency | Interim text can appear while speaking; finalization depends on the implementation, language and network. | Adds upload and transcription after Stop. Streaming the completed file can show partial text, but is distinct from live audio streaming. |
| Cost | No HQ transcription API call; availability and terms depend on the browser's service. Do not describe it as unlimited. | Adds transcription and hosting/network usage. Choose a budget and check current model pricing before implementation; do not assume the existing office spending alert covers this provider. |
| Network/offline | Often sends audio to the browser vendor's service. On-device support and language packs vary; offline recognition cannot be promised. | Server transcription requires a connection. A captured clip is not a completed transcript; do not silently retain it for later upload. |
| Privacy/security | Browser permission and a clear explanation of vendor processing are required. HQ does not control that vendor's retention policy. | HQ controls its upload endpoint and local retention, but audio also reaches the transcription provider. Adds credentials, abuse protection and budget controls. |

Sources: [MDN recognition behavior](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition), [MDN compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/SpeechRecognition.json), [microphone capture](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [recording format detection](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static), and [OpenAI file transcription](https://developers.openai.com/api/docs/guides/speech-to-text). WebKit's [Safari announcement](https://webkit.org/blog/11648/new-webkit-features-in-safari-14-1/) also documents a Siri-enabled prerequisite; verify actual current devices rather than assuming Safari availability.

The current OpenAI guide recommends `gpt-transcribe` for completed recordings via `/v1/audio/transcriptions`; a live voice session is unnecessary for the proposed interaction. The [data-controls table](https://developers.openai.com/api/docs/guides/your-data) currently lists no training use, abuse-monitoring retention or application-state retention for that endpoint. Recheck applicable settings and policy before launch; HQ must still disclose transmission and avoid its own audio/body logs. A sent transcript enters the existing prompt history.

## Phased plan

1. **After workflow work: a small browser-dictation trial.** Show Record only after capability checks and a user gesture; preserve typing as the fallback. Test Mac Safari/Chrome, iPhone Safari and Android Chrome. Treat embedded browsers as unverified. Stop/cancel must release the mic; closing, locking, switching agents or backgrounding must invalidate late recognition results. Preserve existing typed text and require an explicit choice before replacing it.
2. **If phone reliability warrants it: bounded server transcription.** Prefer short clips with duration/byte limits below both hosting and provider limits. Keep audio in memory only, discard on cancel, release mic tracks after Stop, and never place recordings in Blob storage. The new endpoint would require the existing session/origin/bot checks plus rate limits, content validation, timeouts and a server-only credential. Do not bypass office authentication to accommodate voice. Document provider processing before the user starts.
3. **Validate before release.** Measure mic start, Stop-to-editable-transcript, and Send-to-delivered/replied separately. Test Singapore English, names, email addresses, dates, numbers, noise, silence, denied permission, network loss, session expiry and double clicks. Keep the 4,000-character prompt limit and existing idempotent Send behavior. Recognition errors must leave an editable draft, not silently send or retry a task.

For a public-ready feature, server transcription is the more controllable eventual option; browser dictation is a smaller initial experiment. Neither has an HQ-measured latency guarantee. Realtime conversation, spoken replies and automatic dispatch are separate future decisions.
