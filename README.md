# Nihongo Path Books — original Android app

This repository builds the existing app `online.devnazu.books`. Version 1.13.0 continues the recovered 1.12.0 source; existing users, login, Google sign-in, saved progress, reward credits and AdMob configuration are retained.

- N5–N1 vocabulary, grammar and kanji use the authenticated premium content API. Home/bookmark study shortcuts require active access; the separately labelled five-entry previews remain limited.
- Kanji animations offer the first ten entries per level free. Full catalogues and stroke assets are delivered after the existing server-side level/expiry check.
- Listening mock practice includes the complete 2012 and 2018 source groups: 295 scored questions in 46 audio groups. Exactly the 2012 groups 1–2 of each level are free; remaining groups require the same level's reward access.
- Original question-paper pages are shown. Some questions share the group's source pages; match the printed question number. Audio-only questions receive no invented image. These are listening group practices, not full-length JLPT examinations.
- Full N1 content: 3,476 vocabulary entries, 217 grammar entries and 1,232 kanji. Existing N1 credit prices are 6/15/25/45 for 5 hours/24 hours/3 days/7 days.
- Owner ads: `ca-app-pub-3728341118830943~7145978290`, rewarded unit `ca-app-pub-3728341118830943/5055001578`. CI verification uses sample ads and separately builds the owner-configured APK; rewards require verified Google SSV.

## Build

Requires JDK 17, Android SDK 36, Python 3 and Node 22+. Run `npm ci` in `android-app/backend`, then `./gradlew testDebugUnitTest lintDebug assembleDebug assembleDebugAndroidTest` in `android-app`.

The minimal reader shell, fonts and bounded previews are checked in, so building does not depend on the custom website's DNS. `ensure_free_audio.py` downloads only the ten free original groups from fixed official URLs and checks their SHA-256 hashes. Paid images and answers stay in the protected database; paid audio is streamed through the entitlement-checking gateway from fixed official sources.

Run `node --test android-app/test/*.test.cjs` after preparing the reader. Backend authorization tests include N1 credit cost, duplicate-reward prevention, expiry and cross-account isolation. A successful source/test checkpoint does not establish an installable APK: inspect the latest Actions build and emulator jobs.

No Play Console release is performed by this change.
