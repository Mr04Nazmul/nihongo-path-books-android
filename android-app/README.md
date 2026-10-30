# Nihongo Path Books Android — 1.3.0 test edition

Native Kotlin Android app with restricted WebView book reader, official Google Mobile Ads rewarded ads, UMP consent and Supabase backend. The existing website and older repository are preserved.

## Live test backend

Approved shared Supabase project: `vjygltfnrmyghlwyjtwu`. API: `https://vjygltfnrmyghlwyjtwu.supabase.co/functions/v1/nihongo-books-v1` (Edge version 8). Android defaults to this HTTPS API; `BOOKS_API_URL` or CI variable `SUPABASE_BOOKS_API_URL` can override it. No service key is in the app.

Private `books` schema, RLS and service-only explicit RPCs isolate this application. Other application tables remain unchanged. Supabase email/password sign-in is validated through Auth, then a random opaque 30-day application session is stored hashed on the server and encrypted with Android Keystore. App account deletion removes Nihongo data only, preserving the shared Auth identity. Owner administrator permissions are stored in books.users, never user-editable metadata.

Live checks passed: anonymous denial, student/admin separation, cross-user progress isolation, stripping client balance fields, N1 denial, 12 protected N5–N2 text categories, N5 MP3 response, expired access denial and revoked sessions. A disposable confirmed Auth identity successfully completed actual Supabase password login and app-session verification; its Auth and app records were removed afterward (zero remaining diagnostic Auth users). No owner password was changed.

Deployment on a fresh project: apply `supabase/sql/edge-schema.sql`, then `edge-backend.sql`, `admin-assets.sql`, `storage-bootstrap.sql`; deploy the function directory with verify_jwt=false because opaque app authentication and signed SSV are checked internally. Automatic Supabase server environment provides URL/service/anon keys. Keep the books schema private. The legacy Node backend/migrations are a separate alternative, not the deployed architecture.

For email recovery, preserve existing shared-project settings and add only `nihongopathbooks://auth/recovery` to Auth redirect allowlists. Delivery/native recovery remains unverified. Password changes affect the shared Supabase identity; all Nihongo sessions are revoked before changing the password.

## Application features

N5–N2 vocabulary/grammar/kanji, N5 listening only, free basics and permanently denied N1 in this release. Cloud bookmarks/progress/settings are per-user; simultaneous device edits use last-write-wins and failed sync requires retry. Native administrator dashboard includes level settings, exact reward tiers, drafts, manually reviewed immutable publication snapshots/history, private MP3 uploads with rights review, balances/unlocks/redemptions and events. Unreviewed uploads are not served. N1 enabling requires a future reviewed app/backend release, preserving source data.

## Build and install

Use JDK17, SDK36, Node22 and the Gradle wrapper. In android-app run:

```sh
./gradlew testDebugUnitTest lintDebug assembleDebug assembleDebugAndroidTest
adb install app/build/outputs/apk/debug/app-debug.apk
./gradlew connectedDebugAndroidTest
```

GitHub workflow `.github/workflows/android.yml` runs PostgreSQL/backend tests, Android unit/lint/build/signature/alignment checks and emulator tests on API23/29/33/35. It generates a debug APK and unsigned AAB. Signed AAB requires ANDROID_KEYSTORE_BASE64, ANDROID_STORE_PASSWORD, ANDROID_KEY_ALIAS and ANDROID_KEY_PASSWORD secrets. No publishing is automated. Protected lesson data is fetched with server authorization rather than bundled in the APK. Default development builds retain Google sample IDs. The separately generated owner APK uses the actual Nihongo Path Books IDs when BOOKS_LIVE_ADS=true; see reports/OWNER_ADMOB_1_5_2.md.

## Rewards and secure access

| Level | 5 hours | 24 hours | 3 days | 7 days |
|---|---:|---:|---:|---:|
| N5 | 2 | 5 | 10 | 20 |
| N4 | 3 | 8 | 12 | 24 |
| N3 | 4 | 10 | 16 | 30 |
| N2 | 5 | 12 | 20 | 36 |
| N1 | Disabled | Disabled | Disabled | Disabled |

Each signed and verified Google reward adds one non-transferable credit for its server-created ad session's level. Credits persist until redeemed/account deleted. No cash value, transfers or client grant endpoint. Every ad is optional; disclosure precedes the user action. Users can close an ad without losing credits. Ads may be unavailable.

Redemption uses a user row lock, server DB time and a persisted request UUID. **While a level is active, redemption is rejected without deduction**. After expiry a new period starts from server time; existing time is never replaced. Each protected file fetch rechecks entitlement, level availability and expiry. The reader closes at server-derived expiry and revalidates on resume. This is not DRM: content still public on the preserved website can be accessed outside the app.

Google SSV validates ECDSA signatures, allowed units, session/user/timestamp association, transaction and session uniqueness, then credits atomically. Shared Google sample ad units cannot be configured with your own SSV callback: sample-ad completion does **not** automatically credit. The registered rewarded unit callback was saved and verified in Google AdMob against the Supabase endpoint. A real Google-signed console probe returned credited=0 as intended. This verifies callback delivery/signatures, not earned-ad credit. End-to-end testing requires your own AdMob unit configured in test-device mode and callback `/ssv`; The user authorized the owner-AdMob build on30 October2026; actual earned-ad delivery remains unverified and the app is currently subject to limited ad serving.

## Content and listening

`reports/content-audit.json` gives reproducible structural inventory, no dictionary/teacher certification. N5: 1052 vocabulary, 110 grammar, 110 kanji. N4: 1128/113/200. N3: 1260/144/336. N2: 1197/208/400. Counts are source entries, not an assertion of exhaustive JLPT coverage. Readings, Bengali spelling/meaning and lesson order still require full review; uncertain content has a review-pending notice. Verified source translations were not replaced.

N5 metadata has 100 lessons; current local checkout contains 99 final MP3s. App-distribution/audio-hosting/advertising rights are not independently verified; owner phone attestation exists but `commercialUse=false` and `verified=false`. Do not publicly publish or monetize listening until scope and attribution are resolved. Original attribution/license files remain. N4–N2 listening is neither offered in native library nor served by backend. N1 source retained.

## Verification and Play release

See `reports/IMPLEMENTATION_REPORT.md` for current results and limits. FLAG_SECURE is set on the activity, including protected screens. API23/29/33/35 instrumentation checks the window flag and that captured center pixels do not expose the app; physical screenshot/recording tests remain required. Modified OS/devices and external cameras cannot be fully prevented.

Before Play submission: recheck Supabase security advisors; email recovery redirect/device validation; Google test-device SSV round trip; physical device login/no-fill/expiry/resume/playback/capture tests; full content review and missing audio; rights/attribution confirmation; native admin device validation; privacy/support/account-deletion public URLs; Play developer account; signing backup/Play App Signing; store graphics, audience/content rating, Ads declaration and accurate Data Safety form. The owner-AdMob APK is authorized. Public Play publishing and charges still require explicit approval.

Current Play target requirement: API 36, verified 2026-10-29 at https://support.google.com/googleplay/android-developer/answer/11926878. This edition targets 36; the physical compatibility matrix and release review remain required.
