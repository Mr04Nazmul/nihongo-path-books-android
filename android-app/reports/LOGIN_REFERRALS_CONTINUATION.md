# Login and referrals continuation — 29 October 2026

APK source: a6717d9e7771730b0959d93a3b18a963c869ac5c (main).
Version: 1.4.1-test, versionCode 8. Debug-signed APK for testing.
Build: https://github.com/Mr04Nazmul/nihongo-path-books/actions/runs/40882737134
APK SHA256: f6070990d33b6e489465fb1a5de9bfea943da3acd48ab5934266a3ef767592d3

## Changes

- Fixed preview collection after Gradle uninstalls instrumented APKs. CI reinstalls and runs the account capture before removal; rejects a non-PNG auth capture.
- Added signup preview and adjustResize assertion. Password masking and FLAG_SECURE remain enforced.
- Signup and resend use an explicit app confirmation return. Android opens login on that return without trusting its contents as authentication. Server continues to check verified identity.
- Narrow app callback/recovery/confirmation redirects added to Supabase; existing Site URL preserved. Google enabled and Confirm email true observed in dashboard.
- Checkpoint OAuth rate limits and referral retention disclosure deployed. Edge v12 includes confirmation redirect and accurate Supabase/About privacy text. Same function and project; no migrations replayed.

## Evidence and limits

| Check | Result |
| --- | --- |
| Local backend suite | PASS 20; SKIP 2 requiring external PostgreSQL; FAIL 0 |
| New CI backend | PASS, including PostgreSQL job |
| New APK unit/lint/build/signature/alignment | PASS |
| Old 1.4 API23/29/33/35 instrumentation | PASS, but screenshot artifact invalid |
| New API23/29/33/35 device test steps | PASS all four complete emulator jobs |
| Login/signup previews | PASS valid PNGs; API23 login/signup and API35 signup 320×640 visible Bengali layout inspected |
| Keyboard interaction | adjustResize policy assertion PASS; IME-open/scroll and physical usability UNVERIFIED |
| Live v12 health | PASS 200 |
| Live unauthenticated /me | PASS rejected 401 |
| Live malformed PKCE exchange | PASS rejected 400 |
| Live privacy | PASS Supabase/referral-retention/About disclosure |
| Referral table RLS / RPC ACL | PASS both RLS enabled; RPC postgres/service_role only |
| Referral valid/invalid/self/concurrent/replay/existing-account | PASS isolated PGlite tests; not real inbox onboarding |
| Google provider / email confirmation / redirect list | PASS configuration inspection; not end-to-end login |
| Real Google login, cold start callback and Google-only account | UNVERIFIED; needs installed Android and chosen test identity |
| Real signup email, confirmation, resend, login/logout | UNVERIFIED inbox/device workflow |
| Real invite to verified account to 5 credits | UNVERIFIED onboarding; prior disposable server test is documented separately |
| Earned test-ad to Google SSV to credit | UNVERIFIED; sample ads cannot configure personal SSV callback |
| N5 missing audio / rights | UNRESOLVED mlc-n5-l2-30; commercial/app scope not independently verified |
| Full lexical review / physical device / native admin | UNVERIFIED |
| Release signing / Play | NOT COMPLETE; CI signing secrets absent; no public release |

N5–N2, N5-only listening, N1 lock, server access checks and FLAG_SECURE preserved. devnazu.online and old nihongo-path untouched. No production ads enabled, payment made or public Play publishing performed. No service-role or signing credentials included in source/APK.
