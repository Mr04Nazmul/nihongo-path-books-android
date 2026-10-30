# Android exit report and 1.5.1 stability patch

## Evidence

The user's IMG_0149.mp4 shows the app launch, briefly display Home, then return to the launcher; another launch opens Account before returning to the launcher. The video does not provide Android's fatal exception or OS version. Do not claim that this proves an unsupported phone or a specific timestamp/SDK crash.

A signed-in profile rendering/repeated navigation regression was added first on source6002c39d64322c2cec1334061e19d505c6a88432, run40891713291. All six jobs passed, including API23/29/33/35. That isolated UI test did NOT reproduce the physical-device exit. Earlier1.5 tests exercised only the signed-out account form.

## Patch

- Main UI success callbacks now catch response-application failures on the UI thread; previously those exceptions escaped the worker's try/catch and could terminate the app. Finishing/destroyed activities ignore late responses.
- Server clock validates before applying new account state. PostgreSQL numeric offsets/fractional seconds use ISO_OFFSET_DATE_TIME; malformed timestamps leave the previous accepted snapshot/access/credit state intact. API29 device artifact clock-compatibility.txt reports legacyNumericOffsetSupported=false for the exact PostgreSQL-shaped timestamp; the new parser passed with the expected milliseconds. Thus a concrete older-Android compatibility bug was demonstrated. The physical phone's exact exception/OS is still unavailable, so this is not proof of its sole cause.
- Advertising consent/SDK initialization is deferred from app startup until a user requests an advertisement. Consent still precedes ad requests, and only Google SSV can issue credits. Home and Account no longer initiate the advertising SDK. This removes a startup dependency but does not establish that UMP caused the device crash.
- Local-only crash diagnostics save exception class names and stack frame locations, excluding messages, email, password, tokens, request bodies and book content. About shows a copy-for-support button only when a crash report exists. Nothing is uploaded or sent automatically. Android's original fatal-exception handler remains active.
- Added signed-in navigation, actual PostgreSQL-shaped server time, malformed sync and failed UI callback instrumentation coverage. Included clock compatibility diagnostic in device artifacts.

Source:6edaac783491088248fe193dd28a0934c6e5675a.
App:online.devnazu.books,1.5.1-test,code10.
Build:https://github.com/Mr04Nazmul/nihongo-path-books/actions/runs/40893295986

Backend/Auth/referral policy, N5-N2, N5-only listening, N1 lock, FLAG_SECURE, server access control and test ad identifiers preserved. No new theme was integrated. devnazu.online and the old nihongo-path repository untouched. No production ads, paid service or public Play publishing.

## Verification

All six jobs passed: backend, APK/unit/lint/signature/alignment and API23/29/33/35 emulator jobs. Each emulator ran FIVE instrumentation tests (zero failures), including signed-in navigation and snapshot/callback-error regressions. API29 report and clock diagnostic were downloaded and inspected. APK SHA256:49c30dd37ceb37c9cdae1784e24c53e281dec0c07d9fc55280aa2b14bb1a8bd2. Downloaded binary contains1.5.1-test and local crash-copy support; no service-role/private-key markers found. The physical device crash's exact cause remains unverified until a device exception is available. This is a tested stability patch for concrete failure paths, not a claim that the user's phone was reproduced in CI.
