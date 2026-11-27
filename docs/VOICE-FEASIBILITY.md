# Designer voice input experiment

Research rechecked 27 November 2026. The Designer-only trial is implemented with browser controls and an injectable recognition controller. Eleven simulated lifecycle tests and browser UI/scope checks pass. Actual microphone recognition and physical-device latency remain **unverified**; no microphone was activated during these checks.

Browser dictation is feasible as an optional input for **Designer Ryan only**. The trial uses: **Start → Stop → edit transcript → Use text → existing Send**. It fills a draft, never sends automatically. No paid transcription backend, new API key, audio Blob, recording archive, wake word or spoken reply is needed. Other agents keep their existing text input.

## Fit with HQ

[`Dashboard.tsx`](../components/Dashboard.tsx) keeps editable drafts per agent and submits bounded text to [`/api/messages`](../app/api/messages/route.ts). [`prompt-relay.mjs`](../scripts/prompt-relay.mjs) queues that text into the configured Codex chat. The voice module returns text only to the Designer composer. It does not call the message API or change approvals, authentication, bot checks or relay behavior. Send is disabled while recording/finalizing; Use text appends to the existing draft. Transcript readiness is separate from queued, delivered and replied.

Feature-detect `window.SpeechRecognition || window.webkitSpeechRecognition` in the browser. Construct a recognizer only after the user's Start action. Browser recognition manages microphone capture; this approach needs no second `getUserMedia` stream or `MediaRecorder`. Preserve typing if detection or recognition fails. [MDN interface](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition), [Chrome's recognition example](https://developer.chrome.com/blog/voice-driven-web-apps-introduction-to-the-web-speech-api).

## Compatibility and privacy

| Target | Evidence | Trial requirement |
| --- | --- | --- |
| Chrome desktop and Android | Recognition is represented in current compatibility data; advanced options differ across platforms. | Test the actual device, permissions and complete utterance. |
| Safari macOS and iPhone/iPad | Prefixed recognition is represented. WebKit's launch documentation describes a Siri-enabled prerequisite. | Check actual browser/Siri settings and cancellation; constructor presence alone is insufficient. |
| Other browsers and webviews | MDN still marks recognition limited availability; Firefox Android is listed unsupported. | Feature-detect, keep text fallback, and label untested devices unverified. |

Sources: [current MDN compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/SpeechRecognition.json), [WebKit Safari documentation](https://webkit.org/blog/11648/new-webkit-features-in-safari-14-1/). Older vendor articles explain integration; their historical version claims do not replace current compatibility checks.

Default recognition may send audio to a browser vendor's service. HQ not storing an audio file does **not** mean recognition stays on-device. Before Start, disclose: “Your browser may send audio to its speech service. Review the text before sending.” No HQ transcription API call is made, but vendor availability and terms still apply. Do not promise offline operation or a vendor retention policy. [MDN recognition behavior](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

On-device recognition is a separate capability: `processLocally: true` needs compatible support and a suitable language pack. It is not a universal desktop/mobile switch. Do not silently fall back from a claimed local mode to cloud processing; the initial trial need not install language packs. [MDN on-device guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API).

## Lifecycle requirements

1. Start only from an explicit action while Designer is selected and HQ is unlocked. Show Starting until the recognition `start` event, then visible Listening. Catch synchronous `start()` exceptions, including already-started and inactive-document errors. Prevent double starts and bound session duration. Set an explicit BCP-47 language. [MDN start](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/start).
2. Stop calls `stop()` and briefly waits for final results. Cancel calls `abort()`. Close, lock, agent change, backgrounding and unmount also abort and invalidate the session **before** late callbacks can change a draft. Never restart automatically on `end`. Startup/stop watchdogs recover from missing events. [MDN stop](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/stop), [abort](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/abort), [end](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/end_event).
3. Keep interim text provisional. Reconcile result indexes instead of appending every callback; interim phrases can change. Provide editable preview and explicit Use text. Append to the current Designer draft without overwriting text typed during recognition; stop at the 4,000-character transcript limit with a visible notice. If the transcript exceeds the space left in the typed prompt, retain it for editing and disable Use text until it fits. Render transcript as text. [Chrome result handling](https://developer.chrome.com/blog/voice-driven-web-apps-introduction-to-the-web-speech-api).
4. Distinguish denied/restricted service (`not-allowed`, `service-not-allowed`), microphone failure (`audio-capture`), network failure, no speech and unsupported language. Expected cancellation should not show a failure. A later `end` event must not erase a meaningful error. Keep the typed draft intact; no automatic retry. [MDN error values](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionErrorEvent/error).
5. Keep preview state in memory and do not log audio/transcript content. Use text only changes the composer. A deliberate Send follows existing message storage and execution. Office access keys do not automatically grant microphone permission.

## Acceptance before calling it reliable

Mocked recognizers should cover repeated Start, revised interim results, duplicate finals, Stop/Cancel, late callbacks after lifecycle changes, missing events and errors. Confirm no microphone request on load and no message API call from Start, Stop or Use text. Controls and status must work with keyboard and screen readers.

Then, with the user deliberately starting the microphone, test Mac Chrome/Safari and available iPhone/Android devices: Singapore English, names/numbers, silence, denied permission, network loss, backgrounding and cancellation. Until then, report UI/mock tests separately from real dictation. Measure Start-to-listening and Stop-to-editable-text separately from Send-to-Codex-delivery/reply. Voice does not itself remove Mac bridge latency; no exact latency guarantee is supported yet.
