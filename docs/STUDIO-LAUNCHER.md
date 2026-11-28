# Proposal Studio launch

The Proposal chat CTA and Manager resource tile can start the existing local Studio after a Mac login. Studio remains at `http://127.0.0.1:4174`; no proposal API is exposed through HQ, and the worker/chat stays unchanged.

## Click flow

1. An unlocked user clicks **Launch Studio**. No local requests or startup occur on mount.
2. HQ issues a short-lived ticket, after viewer authentication, same-origin and BotID checks. It is restricted to the configured installation, exact page origin and the fixed Studio action.
3. The browser sends that ticket to `http://127.0.0.1:4175/studio/launch`. The installed bridge checks Host, Origin, ticket, expiry and an empty JSON body. It accepts no shell command, file path, URL, arguments or proposal content.
4. The launcher identifies an already-running Studio using its installed page bytes and the small configuration response. Otherwise it starts the fixed Node entry point in the configured Studio directory and waits for readiness. Concurrent clicks share one launch; duplicate tickets reuse their receipt. An unrelated service on the Studio port is left alone.
5. HQ verifies the signed local receipt before the browser opens the fixed Studio URL. If a browser blocks the new tab, the ready state supplies an explicit **Open Studio** link. A failed check never becomes a successful connection indication.

macOS detection is only a UI hint. A valid receipt proves possession of the key for the pinned local installation, not hardware attestation. Another Mac without that installation cannot produce it. Copying the installation config/key to another device also copies its identity; do not do that.

Tickets and receipts are memory-only, time-bounded and domain-separated from viewer tokens and bridge ingestion. The feature adds no Blob writes, model calls, background website polling or remote command queue.

## Setup and restart behavior

The existing ignored `.local/bridge.json` needs a `studio` object with `installationId`, absolute `studioDirectory`, `port: 4175`, and exact `origins`. The currently supported production origins are `https://www.ryancagents.app`, `https://ryancagents.app` and `https://ryancagents.vercel.app`. Put the same non-secret ID in the Vercel production variable `OFFICE_STUDIO_INSTALLATION_ID`; the existing bridge key remains private.

Run `node scripts/install-bridge.mjs` after updating code/config. The installer copies the launcher and protocol module into the existing RyanHQ runtime and reloads `com.ryanc.agent-office`. Its `RunAtLoad`/`KeepAlive` behavior restores the local listener after login. Studio itself starts only on a valid click and is reused when already running. The Mac must be on, logged in and awake. This does not wake a powered-off Mac, run before login, or host Studio for phones.

The Studio directory remains in Documents. macOS may restrict a background process from accessing it; failure is reported with the existing manual launcher as fallback. Do not grant broader filesystem access or relocate proposal data merely to hide this error. Node and the Studio dependencies must already be installed; the service never runs a package installation.

Some browsers require local/loopback network permission. Denial, unsupported access, a missing launcher, a mismatched installation, a busy port or failed startup produce an unavailable state and manual instructions. Browser permission is independent of HQ login. See [Chrome local network access](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access) and [MDN targetAddressSpace](https://developer.mozilla.org/en-US/docs/Web/API/Request/targetAddressSpace).

Manual fallback on the office Mac: open **Start Proposal Editor.command** from the existing Proposal Studio directory in Finder, then open the local Studio URL. A phone or other computer must use HQ on the configured Mac to launch/open this local editor.

## Verification boundaries

Automated fixtures cover ticket/receipt forgery, expiry and origin/installation binding; local endpoint input restrictions; stopped, already-running and simultaneous startup; wrong services; and platform/failure cases. Real service-context checks must separately verify startup from a stopped server, repeat-click process reuse and bridge reload. A reload is not a physical reboot or an OS permission reset; report that distinction when testing.

### Checked on Ryan's Mac, 28 November 2026

- Installed bridge service started the previously stopped real Studio and returned a verified receipt in 1.57 seconds.
- A second signed request took 45 ms and reused the same Studio process.
- Reloading the installed LaunchAgent restored the listener and reused that same Studio process.
- All 17 files under the existing Studio data directory were byte-for-byte unchanged.
- Desktop Manager resources and narrow-phone Proposal chat were visually checked; an unpaired development origin correctly showed the unavailable/manual fallback.
- A physical shutdown/login and an unlocked production-browser permission flow were not exercised. Service reload verifies installation/recovery mechanics, not every OS/browser permission state.
