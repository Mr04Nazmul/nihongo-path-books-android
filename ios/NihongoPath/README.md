# Nihongo Path iOS 1.0.0 — native development edition

Native SwiftUI application targeting iOS16+, iPhone and iPad. Bundle ID online.devnazu.books.ios is provisional until Apple registration. Current work is a development port, not full Android parity or an installable signed IPA.

## Implemented

- Native N5–N1 vocabulary/grammar/kanji browsing and search, Bengali meanings and examples, Japanese speech via AVSpeechSynthesizer.
- Existing owner-provided bundled previews: 5 vocabulary + 5 grammar per level, 10 kanji and stroke assets per level. Native PencilKit handwriting board and local favourites/learned state. KanjiVG attribution and CC BY-SA notice retained.
- Existing email/password registration/login API, Keychain-protected app sessions, existing server entitlement checks for full online curriculum, no protected content persisted. Expired/background protected views are cleared.
- Existing app-data deletion endpoint with explicit warning that shared Android Books profile/access/credits are also deleted, while shared sign-in identity is preserved. No deletion, registration, login or reward transaction was executed by the agent.
- Optional on-device daily notification at19:00 only after user authorisation. No microphone/camera/location permission. Native navigation supports Dynamic Type and system light/dark appearance.

- Native Smart Study and Smart Review reuse the Android scheduler and planner through JavaScriptCore. Attempts stay on-device and are scoped to the Books account or guest. Protected lesson text is held in memory. Kanji handwriting uses the shared DTW code. Opt-in daily reminders use the shared Hawkes scheduler when sufficient history is available. Production MDL evaluation is still outstanding.

To rebuild the committed JavaScript resource, extract the `adaptive-learning` directory from commit `e5780b44e59e1789f83ea1df0d0e12ad8d3dff53` into the checkout root, and run `npm ci` in that directory and in `android-app/backend`. From the checkout root run:

```sh
NODE_PATH="$PWD/android-app/backend/node_modules" npx esbuild@0.28.2 ios/NihongoPath/Adaptive/engine.mjs --bundle --format=iife --global-name=NihongoPractice --target=safari16 --minify --legal-comments=eof --outfile=ios/NihongoPath/Resources/AdaptiveEngine.js
```

## Not yet enabled / blocking upload

- No Apple Developer membership, registered app identifier, signing certificate or provisioning profile is available. No App Store Connect app or TestFlight upload exists. Apple membership normally costs99USD/year; no purchase is authorised or performed. Uptodown iOS catalog listing does not provide Apple signing.
- Google sign-in uses a native AuthenticationServices session and the existing Books Supabase PKCE routes. Live sign-in and eligibility for store distribution still require verification.
- iOS AdMob app/unit and consent messages are not configured. The Android unit is not reused. This edition does not load ads, issue rewards or debit credits. Existing active entitlements can be read. Ads-only monetisation parity remains a release blocker; no claim of full access or unlimited free books.
- Written JLPT mock exams use the existing entitled Books catalogue and paper routes. The native flow validates the paper, times attempts and displays per-section scores and explanations. A live signed-in exam, Android markup fidelity and persistent attempt history still require verification or implementation.
- Privacy policy must be updated for iOS-specific behaviour before submission; current shared policy still mentions Android and ads. Review shared profile deletion and required-reason API privacy declarations against actual final release.
- Screenshot protection cannot be replicated as Android FLAG_SECURE on iOS; no unsupported guarantee is made. Protected curriculum stays in memory; screen recording/screenshot resistance is not certified.
- Original complete latest Kotlin source is not in GitHub main. Preview assets came from prior1.19.3 recovered local build, native iOS code is newly authored.

## Build

On a Mac with Xcode16+ and XcodeGen: `xcodegen generate`, then open NihongoPath.xcodeproj and run schemeNihongoPath. CI on the ios feature branch builds and tests the simulator target without certificates. Simulator.zip is not an IPA and cannot be installed directly on an iPhone. Inspect CI results before claiming a successful build.

For a later signed archive, set DEVELOPMENT_TEAM to the owner's verified Apple team, register bundle ID, enable only tested services, finish privacy/monetisation/login gates, then archive using the owner's signing credentials. Never commit certificates, private keys or App Store Connect API keys. Do not upload publicly without owner approval of platform, build, costs and permissions.

## Primary references checked16November2026

https://developer.apple.com/help/account/membership/program-enrollment
https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds
https://developer.apple.com/app-store/review/guidelines/
https://developers.google.com/admob/ios/quick-start
https://developers.google.com/admob/ios/ssv

The 1.20.3 development branch also compiles the unsigned iPhone Release target and retains a verified unsigned development IPA in CI. The check uses the native development baseline until Android feature parity and physical-device signing are verified.
