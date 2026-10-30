# Deployment checklist

## Repository and build
- [x] Separate `android-app/` source; older `nihongo-path` repository untouched.
- [x] Existing live site's content files unchanged by this work.
- [x] Android-only commits ignored by the existing Pages trigger after the initial workflow-guard change. The initial guard commit ran the existing site checks/published the same unchanged site files.
- [x] Kotlin native account/rewards/settings/navigation; original study reader retained in Android assets without protected content.
- [x] Google test rewarded SDK and UMP integrated; production ad IDs disabled.
- [x] FLAG_SECURE and restrictive WebView origin allowlist.
- [x] PostgreSQL migrations, RLS, atomic credits/redemption, SSV signature validation and duplicate protection.
- [x] Connected live-website build and Android emulator workflow succeeded: run 40833019485. APK artifact is available.

## Neon and API (provisioned and connected)

The live database/API are deployed; see LIVE_DEPLOYMENT.md. The numbered steps below are reproducible setup instructions, not a current connection blocker.
1. Create/select a dedicated Neon project at https://console.neon.tech/. Choose a region near users/API. Do not reuse another app's production schema.
2. Place the migration connection string in the API host's **private** `MIGRATION_DATABASE_URL`; runtime string in **private** `DATABASE_URL`. Never paste passwords in GitHub source, public variables or chat.
3. Run `npm ci` and `npm run migrate` in `android-app/backend/`. Migration requires creating NOLOGIN roles. Grant both generated roles to your runtime login when it differs from the migration login.
4. The Neon Function hosts the API directly. For an alternate Docker host, build `android-app/backend/Dockerfile` from the repository root. CONTENT_ROOT=https://devnazu.online/ enables protected retrieval from the actual website.
5. Set `CONTENT_ROOT=https://devnazu.online/`, allowed rewarded unit IDs, `REWARDS_ENABLED`, and the server-only DB environment. Verify `/health`.
6. Set repository variable `BOOKS_API_URL=https://YOUR-API` at https://github.com/Mr04Nazmul/nihongo-path-books/settings/variables/actions and rebuild Android. Empty API URL intentionally leaves secure features unavailable.
7. Create the owner account in-app; promote only that verified account with privileged SQL as documented. Open `https://YOUR-API/admin` to configure tiers and inspect events.
8. Test two users/devices: sign-in, isolation, refresh/restart, earned credits, redemption retries, expiry, offline errors, logout and deletion.

## AdMob verification (external publisher setup required)
- [x] Registered Nihongo Path Books Android app and its rewarded unit in the publisher account.
- [x] Configured public HTTPS `/ssv` callback and server unit allowlist. Google publisher-console verification succeeded; its synthetic probe grants zero credits.
- [ ] Register a test device. Shared Google sample IDs cannot be configured with your personal callback; do not issue credits merely because a sample ad finished.
- [ ] Run AdMob's callback test and real device test-mode SSV end to end. Confirm exactly one credit after callback and zero for unfinished/no-fill/failed/tampered ads.
- [ ] Resolve the existing listening collection's `commercialUse: false` before advertising-supported release. Do not change rights flags as a substitute for permission.
- [ ] Configure UMP privacy messages/target audience and app privacy URL.
- [ ] Only after approvals/policy checks and test results, review a code change that selects your production App ID/unit. This initial build cannot enable production IDs remotely.

## Play release
- [ ] Add account email verification/recovery and production abuse monitoring.
- [ ] Publish app-specific privacy policy and account-deletion webpage; finish Play Data Safety/ads/target audience declarations.
- [ ] Supply four Android signing secrets listed in README; preserve the keystore backup privately.
- [x] Generated and signature-verified a signed test AAB locally; private signing backup delivered. Future CI-signed AABs require the repository signing secrets. Debug APK is for testing, not Play submission.
- [ ] Test physical Android devices: install, native TTS Japanese voice, PDF page animation, listening audio, ad consent/no-fill, capture protection, background/resume/expiry and low-memory recovery.
- [ ] Import remaining N4–N1 listening collections when actually supplied; no complete listening coverage is currently claimed.
