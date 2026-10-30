# Google Play release checklist

Application: Nihongo Path Books. Package: online.devnazu.books. Test version:1.3.0-test. Target SDK36.

- [x] Separate native Android source and repeatable GitHub build workflow.
- [x] Supabase authenticated API; server-side protected content, balances/redemption and private app storage.
- [x] N5–N2 text library; only N5 listening; N1 blocked in both client and server.
- [x] Official rewarded SDK and optional reward disclosure; no client balance grants.
- [x] Google SSV console verification, signature regression tests and transactional deduplication.
- [ ] Real test-device rewarded display and earned Google callback-to-credit test.
- [ ] Confirm complete Japanese/Bengali lexical review; preserve uncertain labels until reviewed.
- [ ] Obtain clear listening distribution/hosting/advertising rights and required attribution; restore missing N5 audio.
- [ ] Physical-device reading, animation, background/resume expiry, progress, audio and secure screenshot/recording checks.
- [ ] Verify recovery email delivery and deep-link allowlist without disturbing shared Auth settings.
- [ ] Native administrator device testing and live draft/upload/publication testing with authorized content.
- [ ] Create/reuse protected release upload key, configure GitHub signing secrets, retain secure backup and enable Play App Signing. Never commit key/password.
- [ ] Confirm Play Console developer identity/account and required testing eligibility.
- [ ] Prepare app icon, feature graphic, store screenshots, Bengali/English descriptions and support details.
- [ ] Review public privacy/support/account-deletion pages for accuracy; explain app-only deletion and shared account semantics.
- [ ] Complete Data Safety declarations for account/profile/progress, ad identifiers/consent and analytics according to actual collection.
- [ ] Set ads declaration, audience/content rating, consent messages and applicable regional privacy requirements.
- [ ] Verify current Play target SDK/policy requirements at submission and final signed AAB validation.
- [ ] Obtain explicit approval before public publishing, production ad activation or paid resources. No public publication is part of test CI.

Unsigned AAB artifacts are preparation outputs and cannot be submitted as signed releases. Emulator FLAG_SECURE results do not guarantee protection on modified devices or against external cameras.
