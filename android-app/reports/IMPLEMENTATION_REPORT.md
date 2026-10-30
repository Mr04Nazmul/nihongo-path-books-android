# Implementation verification — 2026-10-29

This is a test release, not a completed production launch. Android1.3 APK/AAB were built from commit cdaf5f380b242ddf221d5a1acc89fb2ba1cab46a. GitHub workflow40874946098 completed successfully: backend PostgreSQL tests, APK unit/lint/signature/alignment, and install/launch plus two capture-protection instrumentation tests on each of API23/29/33/35. An earlier lint failure was fixed by explicitly pinning Fragment1.8.9; no lint checks were disabled.

Latest backend source additionally allows the registered rewarded unit in the server SSV allowlist and fixes privacy/support/deletion relative links and shared-identity disclosure. Edge version8 is deployed; these backend changes passed local regression tests and live public-page checks. Android source/binary is unchanged from the fully passed workflow.

## Passed

- Local backend suite: 21 tests, 19 passed, zero failures, two PostgreSQL-dependent tests skipped locally. The actual PostgreSQL GitHub backend job passed.
- Approved Supabase project vjygltfnrmyghlwyjtwu: private app schema deployed; Edge nihongo-books-v1 version8 active. Existing website and other app tables preserved. Admin snapshots/revisions/private audio bucket deployed; bucket is not public; anon/authenticated cannot execute privileged asset RPC.
- Real Supabase password login with a freshly created confirmed disposable test identity, opaque app session and student identity isolation passed. Test account/app records cleaned up; zero remaining diagnostic Auth identities. Owner's password/auth role untouched; app-only owner admin granted to confirmed owner.
- Live unauthorized access denied; student admin API denied; N1 content/ad sessions denied; forged client credit field stripped; cross-user state isolated; logout-all invalidates prior token; app-only deletion invalidates session without deleting shared global Auth identity.
- Test-only temporary entitlements fetched all twelve active text categories and N5 MP3 bytes. After expiry the same protected content returned403. No fake earned ad credits were granted.
- Google AdMob existing rewarded unit SSV URL saved to this Supabase endpoint; Google's console reported verified. Actual Google-signed synthetic probe returns200 and credited0. Both raw and form-urlencoded signed bytes have regression tests; duplicates/tampering rejected. This is not an earned advertisement event.
- Immutable manual-reviewed publication pipeline tested locally: students and incomplete reviews denied, snapshots survive draft edits, unpublish retains history. Private audio drafts require reviewed distribution/hosting/advertising rights before serving.
- Earlier Android CI builds passed unit/lint/APK/signature and API23/29/33/35 launch/FLAG_SECURE assertions. New1.3 native admin compilation, unit tests and lint passed after pinning Fragment1.8.9. API23/29/33/35 actual capture-output and FLAG_SECURE instrumentation passed (2 tests per emulator), followed by delivered-APK installation/launch.
- Original website files unchanged; prior13 website/reader regression tests passed.

## Inventory

|Level|Vocabulary|Grammar|Kanji|Listening|
|---|---:|---:|---:|---|
|N5|1052|110|110|100 records,99 MP3s|
|N4|1128|113|200|Absent|
|N3|1260|144|336|Absent|
|N2|1197|208|400|Absent|
|N1|Locked|Locked|Locked|Absent|

Free Hiragana, Katakana and basic numbers are provided. Counts describe source entries, not exhaustive or teacher-certified JLPT coverage. Full Japanese/Bengali lexical review remains incomplete; pending notices stay visible and existing translations are preserved.

## Remaining unverified or blocked

- Real Android test-ad load/display and earned SSV-to-credit round trip. Sample ad completion does not mint client-side credits. Production advertisements remain disabled.
- Missing N5 mlc-n5-l2-30 MP3; full physical listening output/attribution and app-distribution/audio-hosting/advertising rights scope. Owner phone attestation is not independent rights verification. No public listening publication/monetization until resolved.
- New native admin UI/device interaction, animations, actual screenshot/recording output on physical hardware; FLAG_SECURE cannot protect modified OS or external cameras.
- Recovery email deep-link allowlist/delivery and native reset device test. Password reset changes the shared Supabase identity. Offline retry queue and simultaneous-device merge are not implemented (last-write-wins).
- Live upload/publish administrator interaction has not been exercised; local publication tests passed and live overview passed.
- Release signing credentials, Play account/store listing/Data Safety/content rating/Ads declaration, physical device matrix, production policy/rights review and explicit public-publishing approval. AAB without supplied signing secrets is unsigned.

No paid resources, public Play publication, production ads or live website deployment were performed. Remaining items are not represented as passed.

## Delivered artifacts

- Nihongo-Path-Books-1.3.0-test.apk — debug-signed,9722127 bytes; SHA2562796896c8fce0bad8e3850026843bbaa9e5dce0b28aa0578a00c85e7641b2215.
- Nihongo-Path-Books-1.3.0-unsigned.aab — unsigned,7184883 bytes; SHA256c6ca64e1cf6b037a27e08f27411ad369a2227ace0ad6671c306e5e0510c7499f.
- Install the APK on Android6+ by allowing installation for the trusted file source, opening it, then disabling that installation permission afterward. This is a debug test build, not a Play release. Existing differently signed installs may need removal; cloud account state remains server-side.
- Backend privacy/support/deletion pages returned200 with corrected relative links. Final cleanup check: zero temporary application/Auth users, one confirmed owner app admin, zero fabricated rewarded credits.
- Release checklist: reports/PLAY_RELEASE_CHECKLIST.md. Real ad completion, listening rights/missing file, physical device matrix/recovery and release signing remain required before public launch.
