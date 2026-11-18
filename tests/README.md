# Browser checks

Serve this static project with `python3 -m http.server 8020`, then run:

```sh
APP_URL=http://localhost:8020 node tests/run-access.cjs
APP_URL=http://localhost:8020 node tests/run-offline.cjs
APP_URL=http://localhost:8020 node tests/run-offline-sdk.cjs
node tests/run-tutorial.cjs
```

The runners require Playwright and Chromium (`CHROMIUM_PATH` overrides `/usr/bin/chromium`). They create isolated browser profiles and never send real invitations or write to production Supabase.

- `run-access.cjs`: actual app UI with an isolated SDK fixture; login, invitation/password setup, mandatory document confirmations, server-stamped receipt, expired links, retained local data, logout, offline eligibility, revocation, tutorial restart and account-switch races. Snapshot and legal RPC mocks implement the pinned SDK's request-header API so captured bearer ownership can be checked.
- `run-offline.cjs`: actual service-worker cache and Chromium network-offline mode with the isolated SDK; all core/legal assets cached, account data preserved and tutorial restart offline.
- `run-offline-sdk.cjs`: actual bundled SDK and actual service worker; synthetic previously confirmed session and local account data, followed by a fully offline reload. No SDK mock is injected.
- `run-tutorial.cjs`: complete guided flow, invalid sample input, sandbox isolation, duplicate start, button/Escape skipping and forced closure without persisting a decision.

The database migration's RLS/privilege and invitation checks are separate from browser mocks. Real invitation mail delivery and the hosting provider's redirect/email settings must be verified through the Supabase dashboard; these runners do not send emails.
