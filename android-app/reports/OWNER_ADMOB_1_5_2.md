# Owner AdMob delivery — 30 October 2026 (JST)

The user explicitly authorized enabling their own production advertisements and verified rewarded credits. This supersedes earlier reports saying production ads were not authorized. Play/public publishing and spending are still not authorized.

## Implementation

Source: f7d9ccc68fd8d9957f289420e062905ced904f34. Workflow: https://github.com/Mr04Nazmul/nihongo-path-books/actions/runs/40969528844 . VersionCode11; delivered owner build1.5.2. Default development/emulator build remains1.5.2-test with official demo identifiers. Set BOOKS_LIVE_ADS=true to build the owner configuration. The workflow creates a separate owner-AdMob APK; CI never requests or clicks live advertisements.

Account console directly confirmed Nihongo Path Books / Android, App ID ca-app-pub-3728341118830943~7145978290, rewarded unit ca-app-pub-3728341118830943/5055001578 (JLPT Level Credit Rewarded), reward1 / JLPT credit, and the saved callback https://vjygltfnrmyghlwyjtwu.supabase.co/functions/v1/nihongo-books-v1/ssv . No console setting was changed because these values were already correct.

The native owner build uses those actual identifiers. Consent still precedes loading; ads initialize only on an explicit user ad request. Ad dismissal refreshes the snapshot immediately and at3/10/30/60/120 seconds. The success message requires the server reward history to contain that exact ad_session, so another balance change cannot masquerade as an earned ad. Restart/sign-in and the manual refresh retrieve persistent server balances. No client grants, no reward for merely closing an ad, no referral/ad ledger mixing.

## Backend evidence

Supabase Edge updated fromv13 tov14 to support Google’s documented numeric ad_unit form as well as the exact approved full unit ID. Only an approved unit’s exact numeric suffix is accepted, after signature verification. Other numeric units, tampering and invalid signatures are rejected. No database migrations were applied. The function verifies Google signatures before calling reward. Live books.config rewards_enabled=true. The deployed RPC was exercised inside BEGIN/ROLLBACK with a disposable app identity/session: owner-unit N5 reward credited1, repeated transaction duplicate=true, different transaction on same ad session rejected400, snapshot balance1 and matching ad_session, N1 ad session rejected403. Transaction rolled back, no fixture reward persisted. This is a transactional backend test, not a real Google ad event.

Local suite22 tests:20 passed,2 external-Postgres tests skipped. CI backend full PostgreSQL suite passed. Generated-key full/numeric owner-unit allowlist, foreign-unit rejection, signature/tampering and the previously captured Google console-probe signature tests passed. Current production rewarded ledger has zero earned events; do not call the actual earned-ad roundtrip verified.

## Ad serving limitation

The account itself is approved, but this app shows Requires review / Limited ad serving / Add store to lift limit. It is not linked to a store. Owner IDs are configured; availability/no-fill remains controlled by Google. Do not publish a store release or claim unrestricted serving without the user's separate authorization. No real live ad was requested or clicked by this work. Real phone consent/load/display/completion/Google SSV/credit roundtrip remains UNVERIFIED. Do not bypass Google SSV or fabricate credit to hide that limit.

The APK uses the existing CI debug signature (private install), not a Play release signature. The new Figma theme remains preview-only. Existing crash protections, FLAG_SECURE, N5–N2 active, N5-only listening, N1 locked, server access control, unchanged website and old repository are preserved.

## Delivered artifact

Nihongo-Path-Books-1.5.2.apk,9735946 bytes. SHA256 cbde825d6d1981b75bea1c799c0159141430aa6b755cf4ae3d4c7c20db40e4cf . ZIP/DEX and binary manifest checks confirm the actual owner rewarded ID/App ID and version1.5.2; the demo App ID is absent from the manifest. Library delivery libfile_892e85b8815c8191babd5e4fe6810962.

CI debug certificate differs from the earlier1.5.1-test APK. Android cannot install it as an in-place update over that certificate. The user must retain their app email/password, uninstall the earlier private test APK if update fails, install1.5.2 and sign in again. Server account/credits persist; unsynced local preferences/state may be lost. A stable release-signing setup is still pending.

After Edge14 deploy: live health200; captured Google-signed console probe200 with credited0; tampered signature403. This verifies the deployed signature path, not earned-ad completion.

Backend numeric-unit compatibility source: acfb1f75f418a1e92b9ca62e0e92f66710de03ac. Native APK source remains f7d9ccc68fd8d9957f289420e062905ced904f34.

## Final CI result

Run40969528844 completed all SIX jobs successfully: backend, APK/unit/lint/signature/alignment, API23, API29, API33 and API35. Emulator tests exercise the shared native code with demo ad configuration; the separate owner APK compiled and signature verification passed. Actual live advertising/earned SSV roundtrip remains UNVERIFIED. Backend numeric-unit follow-up was locally tested with22 tests (20pass,2external-Postgres skips) and deployed asEdge14; this backend follow-up does not change the native APK.
