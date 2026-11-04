# Listening practice implementation

Base: Android source 549bd72 (1.10.0), isolated feature/listening-picture-player branch. Build: 1.12.0-test (versionCode 20), test ads. No Play Console release.

Mock Test opens the level's Listening practice catalogue. Original 2012 and 2018 official practice papers supply matching year/level/group MP3, source question crops, and answer keys. A group has one continuous audio file: navigation changes the question without seeking/restarting audio. No guessed per-question timestamps or generated question illustrations are used.

| Level | Scored 2012+2018 questions | Complete audio groups | App access |
|---|---:|---:|---|
| N5 | 48 | 8 | First 2 groups free; existing level reward for the rest |
| N4 | 56 | 8 | First 2 groups free; existing level reward for the rest |
| N3 | 55 | 10 | First 2 groups free; existing level reward for the rest |
| N2 | 63 | 10 | First 2 groups free; existing level reward for the rest |
| N1 | 73 | 10 | Prepared assets only; locked |

N5–N2 contain 222 scored questions in 36 complete scored audio groups (8 source listening papers). N1's ten complete groups are prepared but inaccessible. Total prepared media: 46 MP3s. All five 2009 partially covered sample sets and their media have been removed from the current deliverable and allowlist. The app also rejects sample-kind sections in cached or stale catalogues.

Practice supports replay, seek, speed, answer selection, flags, question navigation, saved local attempts per profile/section/mode, restart and raw scoring. Exam practice permits one audio play through per attempt, without seek/speed, and supports pause/resume. It is group-based practice, not a timed full JLPT examination or official scaled-score simulation.

Images are original source question crops or shared question pages. Audio-only questions have no invented illustrations. N1/N2 group 5 questions 3(1) and 3(2) intentionally share the final source page. Source attribution remains visible.

## Backend and access

`nihongo-listening-v1` is a new read-only Edge Function; the existing books function is unchanged. It validates existing opaque books session tokens against the existing `allowed` RPC and forwards byte-range requests from a private Storage bucket. No privileged key is shipped in the app. Paid audio, images and answers are excluded from the production APK. Metadata catalogues and exactly the complete 2012 groups 1–2 per available level are packaged as free previews. N1 and cross-level media requests are denied.

The read-only service was deployed and its health, anonymous rejection (401), and N1 rejection (403) checked. The remaining private media upload is PENDING: automatic approval review rejected the proposed temporary privileged import service. Do not claim live authenticated playback or publish the app before private upload and an authenticated end-to-end test succeed. The current deployed service has no import/write route.

The intended media is supplied separately in the delivery ZIP alongside its SHA-256 allowlist. Never commit an upload nonce, service-role key or transient import deployment file. Private media deployment needs a specifically approved upload mechanism. Restore/retain the read-only gateway after any approved import.

## Verification

Node tests cover source path isolation, catalogue validation, time/attempt keys. JVM tests cover protected listening level/preview boundaries. Gateway request tests cover anonymous/denied/allowed authorization and range forwarding. Android debug and instrumentation APKs build offline with the cached Android toolchain. Device UI verification uses test-only original-source fixtures and does not prove production reward/session playback.

Lint could not run because the required lint-gradle artifact was absent from the offline cache.

## Complete-content audit (2026-11-02)

Removed all five incomplete 2009 sample sets from media, catalogues and the deployed read-only gateway allowlist (version 2). The controller discards stale sample entries, then validates exact group identities and question counts for both complete source papers before rendering. A missing/duplicate/incorrect group prevents the catalogue from opening.

All 391 current assets passed existence and SHA-256 checks; every image decoded; every audio file has valid positive duration and is byte-identical to its corresponding original paper/year/level/group source. All 295 prepared question entries have matching answer-key lengths and valid option values; N5–N2 expose 222 of those, while N1 remains locked. Four Node regression tests, eight JVM tests, gateway authorization/range/removal tests, and Android debug/instrumentation builds passed. Existing controls were previously exercised successfully in Android UI instrumentation; live authenticated playback remains pending private media upload.

## Ordered integration / two free groups (2026-11-02)

The existing review source bundle was recovered and extended; no 2009 samples or incomplete mini papers were reintroduced. Lists sort by level, then ascending year (2012, 2018), then original group number. Each level has continuous visible serials 01–08 or 01–10. Source question numbers remain unchanged.

Exactly 2012 groups 1–2 of N5/N4/N3/N2 are free in Practice and Exam practice; all remaining groups use the unchanged existing level reward. The full title/count catalogue is available without sign-in. The native interceptor serves free media from isolated packaged assets, supports byte ranges, denies cross-level/2009/N1 requests, and requires the original session and expiry check for paid media. No credit prices, balances, sessions, login, books gateway or database schema were modified.

Set `BOOKS_LISTENING_MEDIA_DIR` to the review ZIP's `media` directory when building. The build refuses to silently omit the free media. N1 source assets remain prepared but unavailable in the app. The APK deliberately contains about 72 MiB of original free media to make both free groups playable without sign-in/network.

A live read-only check found the private bucket and a partial set of uploaded assets; remaining uploads and authenticated paid playback are not verified. The media ZIP contains all 391 audited assets. No privileged import endpoint was added or redeployed.

### Exact delivery status

43 Node tests, 8 Android JVM tests and the actual API29 ListeningUiTest passed. The device test uses the production interceptor and real packaged media (no fixture intercept): original question images decoded, audio durations loaded, byte-range requests returned 206/32 bytes, and paid/2009/N1 requests returned 403 while signed out. This does not certify authenticated paid playback.

The read-only live audit found version 3 differs from the recovered source: it has a blanket N5 free rule and an expired temporary import route. The reviewed local gateway now exposes only 2012 groups 1–2 per available level, preserves paid token/RPC checks, and has no import route. Deploying that correction was rejected by automatic approval review because replacing production access control needs explicit authorization for this exact backend deployment. No workaround was attempted. The deployed function remains version 3; the private bucket contains only 36 of the reviewed files. Backend deployment authorization and a supported private-media upload route are still required before claiming full live readiness.

## 1.13.0 integration — 4 November 2026

The existing app now includes N1 in all five level selectors. The private content database contains the complete five-level curriculum and 2,088 distinct stroke characters. The books API reads these assets after the original token/level/expiry check, removing the dependency on the custom domain for these requests. N1 uses the existing disabled tiers, now enabled without changing their prices.

Missing listening pages and answer keys were recovered from the supplied repaired source PDFs. All 295 answer counts and option ranges were checked. When an exact question crop was unavailable, the catalogue shows the original group source pages rather than assigning a guessed picture. First-two-group audio files were downloaded from the official source and matched all ten existing allowlist hashes. Paid audio remains behind the same entitlement check and is streamed from fixed official URLs; the media service has no import/write endpoint.

The minimal build snapshot and bounded previews are now checked in; no full premium JSON is bundled in the APK. Final APK installation/emulator results must be checked in the new workflow before calling the release complete.
