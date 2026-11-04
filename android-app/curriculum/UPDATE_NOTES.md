# N2 and navigation update — source only

Prepared on 2026-11-01 (Japan). No APK/AAB was built, no Play release was uploaded, and the live backend has not been deployed for this change.

- The corrected owner PDF's 2,273 vocabulary notes are covered once each. Existing extra reference entries are preserved: 1,250 added, four duplicate word rows merged, 2,443 unique vocabulary entries in total.
- Stable IDs remain; merged IDs are retained in `alias_ids` so bookmarks can resolve to the canonical entry.
- N2 grammar retains 208 entries / 403 examples; kanji retains 400 entries. Spelling substitutions are recorded in `n2-corrections.json`.
- Japanese wording/kana and coverage were compared with the supplied corrected PDF. Bengali was transcribed using a rendered-text OCR pass; the newly added 1–1300 range received a targeted spelling review and explicit corrections. This is not a claim of independent dictionary/teacher verification for every meaning, example or reading.
- The full N2 curriculum is server-side source, not packaged in the APK. Only the first five entries per subject form the free preview. The backend still checks sign-in and timed level access before reading the new N2 data.
- Home cards lead to Books, Bookmarks, Reading settings and Reward Center rather than directly to subject readers. The original PDF menu/reader route is removed.
- Bottom tabs: Home, Books, Mock Test, Kanji, Profile. Mock Test and Kanji are empty themed shells with headings and disabled level controls; no examination or animation is implemented.

## Validation

`node --test android-app/test/*.test.cjs` and `node --test android-app/backend/test/n2-content.test.mjs` pass (13 tests). No Android artifact build or device visual QA was performed, as requested.

## Before a future release

Deploy the reviewed N2 backend source and build/test the Android app together. An app-only update will otherwise still fetch the previous live full N2 data. Keep the existing application ID and signing key; the staged Android version is 1.10.0 / versionCode 18. Confirm the versionCode exceeds the most recent Play release when actually building.


## Kanji animation follow-up — 2026-11-02

- The Kanji tab now opens a themed animation reader containing the 901 distinct KanjiVG characters from the existing 1,046 N5–N2 kanji entries. The prior Mock Test placeholder remains empty.
- Each level exposes only its first 10 canonical kanji and those exact stroke files to the free reader. Full catalogs and the other stroke geometry remain server-side and require the existing level-specific timed reward entitlement. No full catalog or paid stroke archive is copied to Android assets.
- The server checks sign-in and current level access on every catalog/geometry request. A stroke ID must belong to the requested level. Native requests are tied to the opened reader's level and immutable preview mode, with an additional expiry check. Paid DOM and animations are cleared on expiry, and the native expiry handler closes the reader.
- A no-result search now clears the previous selected character and animation. Play/pause/replay, stepping and three speed options are included. Required KanjiVG attribution and license are retained.
- PDF menus, the standalone PDF reader source and PDF service routes are removed or denied. N5–N2 regular book previews stay at five entries per subject; the ten-entry rule applies to the Kanji Animation screen.
- Validation: 33 tests pass across curriculum, animation geometry, free asset inventory, hidden paid search/results, expiry, reward verification and backend gates. Native access unit tests are prepared but no Android build/device run has been performed.
- This is still source-only: do not deploy or build automatically. The matching backend changes need deployment before the future APK/AAB is tested; existing installed apps have not received this source patch.
