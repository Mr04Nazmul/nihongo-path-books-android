# Current deployment note — 30 October2026 JST

The active Android API is Supabase nihongo-books-v1 version14, not the historical Neon backend described below. User authorized the owner AdMob APK1.5.2; see reports/OWNER_ADMOB_1_5_2.md for actual IDs, SSV checks, limited-ad-serving status and unverified physical earned-ad test. Default development APK still uses demo IDs; the separate owner artifact uses BOOKS_LIVE_ADS=true. Public Play publishing and charges remain unauthorized.

# Live Android backend — 29 October 2026

The educational source is **https://devnazu.online/**. The Android build downloads a verified reader-shell snapshot from that website. The backend also retrieves protected JSON/PDF/audio from that website after authenticating the user and checking the database expiry. It never changes the live website, and there is no public-site fallback inside the Android reader when access fails.

- Neon project: `dry-sky-43438327` (Nihongo Path Books), Singapore, PostgreSQL 17.
- Production branch: `br-royal-poetry-ao0544wq`.
- Deployed Neon Function: `booksapi`, Node.js 24.
- API origin: `https://br-royal-poetry-ao0544wq-booksapi.compute.c-2.ap-southeast-1.aws.neon.tech`.
- Health: `/health`; administrator sign-in: `/admin`.
- App privacy policy: `/privacy`; support: `/support`; deletion instructions: `/delete-account`.
- SSV callback: `/ssv`.

The runtime database credential is held only in the Neon Function environment. It uses the `books_runtime` login with the application/service roles. The APK and repository contain only the public API origin. All 10 application tables have RLS enabled; balance, unlock and history policies only expose the current authenticated user.

Live verification used disposable test accounts and explicitly labelled fixture credits (not fabricated ad earnings). Checks passed for signup/login, unauthorized admin access, locked content, insufficient credits, idempotent redemption, active-access preservation, cross-user isolation, all N5–N1 current text curricula, original N2 PDF, N5 listening JSON and MP3, and forged SSV rejection. The website has 100 N5 listening rows. Its N4–N1 listening JSON URLs currently return 404; the app preserves that unavailable state.

AdMob account configuration:

- App: Nihongo Path Books / Android.
- Publisher App ID: `ca-app-pub-3728341118830943~7145978290`.
- Rewarded unit: `ca-app-pub-3728341118830943/5055001578` (JLPT Level Credit Rewarded).
- Reward: one JLPT credit.

These publisher IDs are configuration records, **not activated in the shipped development app**. The development APK/AAB continue to use Google's sample App ID and rewarded unit. A shared sample unit cannot be assigned your publisher SSV callback; sample completions therefore do not mint unverified credits. Test the publisher unit only on registered test devices, then review production activation after app approval, consent and content rights checks.

The signed release AAB and private signing backup are delivered privately to the owner. No keystore, signing password, session token or database password is in Git. For future CI-signed bundles, place the backup's values in GitHub Actions secrets using the names in README. Current GitHub CI always produces the installable debug APK; it only produces a signed release AAB when those secrets are set.

## Completed verification

- GitHub Actions run `40833019485`, code commit `2509624abf0884b2d4a6cacdc54874ab32438182`: success (backend, APK/lint/unit tests, Android emulator/FLAG_SECURE).
- Google AdMob publisher-console callback verification: **Success**, saved on the rewarded unit. The console's fixed synthetic ad unit `1234567890` is accepted only after Google signature verification and always returns zero credits. It is not a watched-ad reward.
- Live expiry blocks educational requests while retaining unused credits. Administrator overview returns 403 for students and 200 after an explicit server-side admin role assignment.
- Disposable test accounts, fixture balances and their histories were removed after validation. Production starts with no fabricated ad rewards.
- Signed release AAB: `Nihongo-Path-Books-v1.0.1-test.aab`, signature verified; signing key/password backup delivered privately. The AAB retains Google's sample ads.

The shared Google test ad unit does not send publisher-configured SSV to this API. A physical-device test using the publisher unit on a registered test device, and subsequent production activation after approval, remain separate release gates. Do not count a sample-ad completion as a server-verified credit.
