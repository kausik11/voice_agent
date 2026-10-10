# Verification record and launch checklist

## Automated verification

Verified on 2026-10-10:

| Check                                          | Result                                          |
| ---------------------------------------------- | ----------------------------------------------- |
| Unit and mocked integration tests              | 55 passed across 4 files                        |
| Chromium desktop/mobile workflow tests         | 3 passed                                        |
| TypeScript type check                          | Passed                                          |
| ESLint                                         | Passed                                          |
| Prisma schema formatting and client generation | Passed                                          |
| Next.js production build                       | Passed                                          |
| Whitespace/diff checks                         | Passed                                          |
| Live Gemini and MongoDB Atlas verification     | Not run; credentials were not supplied          |
| Dependency audit                               | Outstanding upstream advisories, detailed below |

Tests use mocked infrastructure where noted. Production builds retain the installed Next.js 16.4 Cache Components conventions, with runtime work inside Suspense boundaries.

The browser suite starts a separate demo server on port 3100 and saves desktop/mobile screenshots in ignored `artifacts/`. No production records are touched. Test traces on failure are in ignored `test-results/`.

## Live verification checklist

Use an isolated MongoDB replica set and a restricted Gemini project. Mark items complete only after observing real behavior.

- [ ] Synchronize schema with `db:push`; create an admin with a unique password. Confirm plaintext passwords and permanent API keys do not appear in database records, bundles, API responses or logs.
- [ ] Anonymous requests to every `/api/admin/*` endpoint return 401. A viewer role and a demo cookie cannot authorize live requests. All admin pages redirect when signed out.
- [ ] Login rate limits hold across two application instances. Session cookies are HttpOnly and Secure on the deployed HTTPS origin. Public registration is disabled.
- [ ] Configure verified non-sample FAQs and an approved welcome/instruction set. Confirm missing facts are referred to staff, not invented.
- [ ] Deny microphone permission: show an actionable error, create no provider connection, and permit explicit retry after permissions change.
- [ ] Start a real English conversation: input/output audio streams, user and assistant transcripts appear, and ACTIVE state persists.
- [ ] Test Bengali and Hindi with fluent speakers; verify script display, intelligibility and language switching. Do not infer quality from the language selector alone.
- [ ] Interrupt a long assistant answer: all queued playback stops immediately, capture continues, and the assistant takes the new turn.
- [ ] Mute and unmute: microphone tracks disable/re-enable; no audio chunks are sent while muted. End disables the microphone and closes all audio/network resources.
- [ ] End while the permission dialog or token request is still pending. Resolving it later must never restart capture.
- [ ] Disconnect the network during a turn. Confirm clear error handling, track cleanup, no automatic restart, persisted earlier transcript and eventual server expiration.
- [ ] Delay connection until the 30-second token start window expires. Confirm provider rejection and user-visible retry guidance.
- [ ] Reach maximum duration and provider `goAway`. Confirm provider token expiry, client teardown and EXPIRED state. Start again only by explicit user action.
- [ ] Open more concurrent sessions than allowed from separate browser clients/application instances; verify the shared admission transaction prevents oversubscription.
- [ ] Retry identical transcript/usage requests. Verify one document per stable event ID, one finalized transcript segment, and no duplicated costs.
- [ ] Inspect raw usage metadata and actual provider billing evidence. Determine accounting periods and cache/thinking/tool billing treatment. Keep UNKNOWN periods incomplete until verified.
- [ ] Create immutable historical pricing with real source/effective date. Use reviewed reconciliation data; verify exact decimal math, pricing reference and deduplication. Unknown/missing category data must not look like zero spend.
- [ ] Verify dashboard refresh every 30 seconds, date/status/search filters, daily/weekly buckets, pagination, timezone, details and CSV. Check formula injection strings are safely escaped.
- [ ] Configure low budget thresholds in the isolated environment. Verify alerts, new-session blocking, unknown-spending fail-closed behavior, optional INR effective date, and separate hosting/telephone expenses.
- [ ] Advance a test session's transcript expiry; invoke authenticated cleanup. Confirm transcripts are removed, raw audio was never stored, metadata remains, and batches progress across more than 500 sessions.
- [ ] Delete an ended test session; confirm associated transcript and usage documents are gone. Active session deletion must be rejected.
- [ ] Stop MongoDB/Gemini access in the isolated environment. Confirm database/provider errors are visible and credentials/raw payloads are not logged.
- [ ] Test keyboard-only navigation, native FAQ dialog focus/escape, narrow mobile viewport, reduced motion and screen-reader labels.
- [ ] Restore a backup into a separate replica set and repeat admin/session-read checks.

## Dependency audit

The audit performed during implementation reported 8 high-severity dependency-chain findings, representing two root advisories:

- `braces <=3.0.3`: deeply nested pattern stack exhaustion, through ESLint's globbing dependencies. The registry reported 3.0.3 as the latest version at the time of checking. Application requests are not passed into these build/lint glob patterns.
- `deepmerge-ts <8.0.0`: recursive object merge stack exhaustion, through the pinned Prisma configuration tooling. A major override is available but was not applied without compatibility verification. Prisma's configuration is developer-controlled; untrusted request objects are not passed to its configuration loader.

`npm audit --omit=dev` still reports the Prisma configuration chain because Prisma is also an optional peer of Prisma Client. Treat this as an outstanding dependency-maintenance issue; this project does not claim a clean audit. Review patched upstream releases and rebuild/test before upgrading. The build, lint and application test results are separate from the audit result.
