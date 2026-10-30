# Latest owner AdMob delivery — 1.5.2 / code11

User explicitly authorized their own live advertisements and verified credit issuance. See OWNER_ADMOB_1_5_2.md. Source f7d9ccc68fd8d9957f289420e062905ced904f34, CI40969528844 all SIX jobs PASSED (backend/APK/API23/29/33/35). Backend numeric-unit follow-up acfb1f75f418a1e92b9ca62e0e92f66710de03ac deployed asEdge14. Owner App ID/rewarded unit and saved Supabase SSV confirmed in console; Edge14 deployed to accept the documented numeric form of the exact allowed unit as well; signature/foreign-unit checks passed. rewards_enabled=true. New owner APK uses actual IDs, default CI/dev uses demo IDs. Confirmation UI requires exact server ad_session history; polls through120s. Transactional live RPC test credited1/dedup/replay/N1 checks passed and rolled back. Real earned Google event remains unverified. AdMob app shows Requires review / Limited ad serving / Add store to lift limit; no store publication authorized. Earlier prohibitions on enabling production ads are superseded only for this owner-ad configuration; no fees or public release authorized. Figma remains preview-only.

# Latest native stability delivery - 1.5.1-test / code10

User supplied IMG_0149.mp4 showing unexpected exits after launch/account navigation. Read ANDROID_CRASH_1_5_1.md for evidence and limitations. Source6edaac783491088248fe193dd28a0934c6e5675a, CI40893295986 all SIX jobs PASSED incl API23/29/33/35 and new signed-in/snapshot-error regressions. Main UI response failures are handled, server time validated, advertising startup deferred until ad request, local non-sensitive crash signature can be copied from About when available. API29 diagnostic confirms the old numeric-offset timestamp parser fails; the replacement passed. No exact physical-device exception was obtained; do not claim definitive video root cause or guaranteed reproduction. Direct signup/support policy from1.5 remains unchanged. New Figma theme still preview only.

# Latest delivery: 1.5.0-test / direct signup

Source f5fe0bc2819b7b7545369e3b96e033219b9cfb21. CI40888179488 all SIX jobs SUCCESS (backend, APK, API23/29/33/35). Live Edge v13 direct signup/login, duplicate rejection, bad password, invite5/repeat0, logout and disabled mail endpoints passed using two disposable identities; both cleaned. Detailed report: DIRECT_SIGNUP_AND_THEME_PREVIEW.md. User superseded confirmation requirement as documented below. Figma theme PDF is preview ONLY, await user decision before adding its styling. All older real Google/device/audio/rights/release-signing limitations still apply.

# Current user policy change — 2026-10-29

The user explicitly replaced the earlier email-confirmation requirement: new accounts must be usable immediately without links/codes, and forgotten-password UI must direct users to support. Implemented narrow server-only Supabase admin createUser(email_confirm=true), followed by password login and opaque app session. It only creates NEW identities; duplicate email is rejected, never auto-confirms/overwrites an existing identity. Shared global Auth confirmation settings remain unchanged. App recover/resend/reset endpoints now reject with410 and send nothing. Passwords stay hashed in Supabase Auth, never readable in app/GitHub/admin lists. This is auto-confirmation policy, not proof of mailbox ownership. Google PKCE remains.

Removed exactly the repository/listening availability paragraph shown by the user, Android only. Version1.5.0-test/code9. New theme is PREVIEW ONLY: user wants a PDF before approving app integration. Do not merge Figma prototype styling into the app yet. Previous reports below describe older behavior.

# Latest verified delivery — 2026-10-29

- APK 1.4.1-test/code8 source a6717d9e7771730b0959d93a3b18a963c869ac5c.
- Run40882737134: backend, APK and all API23/29/33/35 emulator jobs completed SUCCESS.
- Actual PNGs now valid; API23 login/signup and API35 signup inspected at320x640. Lower form scroll and IME-open interaction remain unverified; adjustResize policy assertion passed.
- Same Supabase Edge function now version12. Live health200, missing-session401, malformed-PKCE400, corrected privacy confirmed.
- Dashboard confirmed Google enabled, Confirm email true; saved app callback?flow=*, recovery, confirmed redirects. Shared Site URL preserved.
- Detailed honest result matrix: LOGIN_REFERRALS_CONTINUATION.md. Do not upgrade configuration/mock tests to real account/device/earned-ad proof.

# Continuation update — 2026-10-29

- Read the original checkpoint below in full. Prior 1.4 run 40880227534 finished all six jobs successfully.
- IMPORTANT: its auth-preview.png was NOT an image: 46 bytes containing `run-as: unknown package: online.devnazu.books`. Gradle removed the package before capture. Do not claim visual UI verification from that run.
- Fixed CI: explicitly reinstall app and instrumentation APK, rerun account UI test, capture before uninstall, validate PNG signature. Added signup preview and explicit keyboard adjustResize assertion; FLAG_SECURE remains on.
- Android version 1.4.1-test / code 8: confirmation callback only opens login, never trusts callback as proof of verified identity. Signup/resend explicitly request app confirmation redirect; verification still enforced by Supabase /user.
- Supabase dashboard became signed in. Original redirect list was empty, shared Site URL http://localhost:3000. Added only callback?flow=*, recovery and confirmed app URLs; preserved Site URL. Verify final persisted list in browser. Google OAuth actual account round trip is still UNVERIFIED.
- Checkpoint rate-limit/privacy files deployed as Edge v10, then email redirect fix as v11. Same function/project. No migrations reapplied. Final privacy correction deployment is tracked in continuation report.
- Fresh local suite: 20 passed, 2 PostgreSQL-dependent skips. CI on source 469424ab1bd130358d3c1b43fc2735e7633619c5 started as run 40882461436; subsequent capture test commit supersedes it.
- Live referral table RLS true on both tables; referral RPC ACL postgres/service_role only. Advisors' other-app warnings left untouched.
- Prior 1.4 APK downloaded from artifact12900181694, source8daf5f2f8a6c388c5d5ca0f3b738a8f88fea8aa6, SHA2564075eb93be767f1c6c4c78fb34e07912656d062cc39091aa621fa7f4274bfb86. This APK does NOT contain the new1.4.1 fixes.
- Remaining real tests must not be marked complete: Google/account callback on installed Android, inbox confirmation/resend, actual referral onboarding, earned test-ad/SSV, physical device playback/keyboard/animations, full lexical review, missing mlc-n5-l2-30 audio/rights, release signing. No production ads, fees or public release authorized.

---

# Continue account / Google login / referral work — 2026-10-29

The user requested a checkpoint and continuation prompt, so implementation was paused. Do not restart the Android project or redo completed work.

## Sources and live state

- Repository: https://github.com/Mr04Nazmul/nihongo-path-books , branch main. Android project: android-app/ . Preserve devnazu.online and the older nihongo-path repository.
- Native1.4.0-test versionCode7 UI and auth/referral source commit: 8daf5f2f8a6c388c5d5ca0f3b738a8f88fea8aa6. Follow-up checkpoint contains HTTP rate limits, a positive PKCE exchange regression test and referral retention disclosure. These small follow-up source edits were locally tested but are NOT in deployed Edge version9.
- Android workflow for1.4: https://github.com/Mr04Nazmul/nihongo-path-books/actions/runs/40880227534 . APK/unit/lint and backend jobs passed. Four emulator jobs were running at checkpoint; inspect their final results and download artifacts rather than assume success. A new third instrumentation test checks account UI/password masking and produces auth-preview.png in device report artifacts for visual inspection.
- Previous1.3 workflow40874946098 passed APK/backend and API23/29/33/35 capture tests. Earlier delivered1.3 APK is not the newly redesigned1.4 app.
- Approved Supabase shared project: vjygltfnrmyghlwyjtwu . API https://vjygltfnrmyghlwyjtwu.supabase.co/functions/v1/nihongo-books-v1 . Deployed function version9, verify_jwt=false because its body validates opaque app sessions and signed SSV.
- Private books schema. Migrations edge-schema.sql, edge-backend.sql, admin-assets.sql, storage-bootstrap.sql and new referrals.sql are already applied on this project. Do NOT blindly rerun non-idempotent CREATE POLICY/table migrations. Inspect remote state first. Shared public.profiles and other app data were not changed.

## Implemented in1.4

- Redesigned native login/signup cards, prominent Google option, distinct forms, masked password and show/hide control, inline status, confirmation/resend flow.
- Existing accounts may sign in with a shorter legacy password; only NEW accounts require10 characters. Never disable shared Supabase email verification to hide the confirmation problem.
- Google provider is already enabled in Supabase. New /auth/google/start generates a Supabase OAuth PKCE authorization URL; /auth/exchange validates the code through Supabase and verified /user before issuing the app session. Android stores verifier/flow/time/referral encrypted, checks matching callback flow and expiry, uses system browser for essential Google auth and never embeds Google login in WebView.
- Android callback: nihongopathbooks://auth/callback?flow=UUID . Recovery callback remains nihongopathbooks://auth/recovery . Google return URL allowlist/configuration and real end-to-end Google account sign-in are NOT verified.
- About is a top header option. Support and Ad privacy choices moved there. Native account Privacy policy button removed as requested; native support dialog no longer includes the website URL. Public policy pages remain separate.
- Invitation link nihongopathbooks://join?ref=CODE opens an installed app; manual code input also works. This is not deferred Play-install attribution. Account shows/share invitation code. New confirmed identities within24h using another user's valid code receive FIVE N5 credits ONCE; referrer is not given another bonus. Terms visible before signup.
- New books.referral_codes and books.referral_claims plus service-role-only RPC. Reuses existing public.profiles.referral_code when available. Does NOT call public.award_referral_reward or change other-app points (the old function grants10000 points, unrelated to book credits).
- Credits go into N5 balance; invitation ledger/events distinguish them from earned AdMob rewards. Unique one-way identity digest and row locking prevent replay, self-referral and another claim after app-data deletion. Digest-only bonus history remains for anti-abuse and is disclosed in latest source policy/deletion UI. No emails/names in that retained ledger.

## Verified

- Local suite22 tests:20 pass,2 PostgreSQL-dependent skips,0 failures. CI backend job passed actual PostgreSQL tests. Additional positive PKCE/mock transport and rate-limit source edits passed targeted HTTP/referral tests.
- Live disposable referral test: first claim credited5 N5; repeat credited0; self-referral credited0. HTTP /referrals and /me showed claimed=true/balance5. This is a disposable server test, not real Google OAuth or real user referral onboarding.
- Real Supabase password sign-in and opaque app session self-test passed again on version9 with a newly created confirmed disposable Auth identity; identity/app rows removed afterward.
- All temporary app/Auth identities, test bonus ledger and test balances were removed. Cleanup reported zero temporary app users and zero temporary Auth users. No owner password or global Auth role was changed.

## Next steps

1. Inspect1.4 CI emulator results and auth-preview.png. Fix any UI/capture failure; do not weaken tests or disable FLAG_SECURE. Inspect layout visually, including signup, long Bengali labels and small-screen keyboard handling. Build/download a fresh1.4+ APK and save persistent delivery artifact.
2. Test Google OAuth end-to-end with the user's chosen account. Supabase dashboard browser tab was signed OUT at /dashboard/sign-in, so callback URL configuration could not be inspected. MCP does not expose Auth URL settings. Use secure browserAuth for sign-in; never ask for passwords/OTP in chat and never use a password visible in a user photo. Preserve every existing redirect URL and the Site URL. If needed add only the app callback/recovery redirect patterns, including flow query support, under the applicable browser confirmation policy. Do not change unrelated Auth configuration or credentials. Do not claim Google sign-in works merely because its button/provider/API exists.
3. Verify email signup -> confirm email -> sign in; resend, existing Google-only account, invalid credentials, app cold-start OAuth callback, wrong/missing flow, expiry/cancel and logout/login persistence. Do not auto-confirm actual users to bypass verification.
4. Inspect current deployed code, test and deploy checkpoint-only rate-limit/privacy source edits to the SAME Edge function. Keep service key server-side. Check referral RLS/ACL/security advisors. Do not redeploy the website.
5. Test actual invite -> verified new account ->5 N5 bonus, invalid/self/repeated codes, existing-account ineligibility, code reuse, logout/login and app-data deletion/rejoin. No client balance mutations, no bonus recorded as AdMob credit. Clean only explicitly disposable test data.
6. Finish relevant regression tests, commit fixes, build APK/AAB and report passed/failed/unverified results accurately. No production ads, charges or public Play release without explicit approval.

## Earlier mission items still pending

- Real Android test ad display and earned Google SSV -> level credit round trip. Google console callback verification passed; that synthetic probe credited0 and is NOT an earned ad event. Main app uses official sample IDs. Registered rewarded unit ca-app-pub-3728341118830943/5055001578 has callback /ssv configured. Never issue client/fake ad credits.
- N5 listening100 records/99MP3; missing mlc-n5-l2-30. App-distribution/hosting/advertising rights scope and physical playback remain unverified. Do not invent an audio file or claim independent rights verification.
- Full Japanese/readings/Bengali lexical review, physical device animations/playback/screenshot/recording/recovery, native admin upload/publish interaction, release signing and Play checklist.
- N5–N2 vocab/grammar/kanji active; only N5 listening; N1 always locked; free basics. Preserve exact reward tiers and existing earned time. Do not modify verified source translations with guesses.
