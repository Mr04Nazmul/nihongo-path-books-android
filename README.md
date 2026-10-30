# Nihongo Path Books — Android

Separate Android app repository. The original `Mr04Nazmul/nihongo-path-books` and older `nihongo-path` repositories are not deployment targets for this project.

Sakura splash, dark library/account screens and cream study screens. N5, N4, N3 and N2 each offer the first five canonical vocabulary entries, five grammar entries and five kanji free without sign-in. Full books retain the existing verified rewarded-ad level access. N1 remains locked; listening is N5 only.

## Reward rules

| Level | 5 hours | 24 hours | 3 days | 7 days |
|---|---:|---:|---:|---:|
| N5 | 2 | 5 | 10 | 20 |
| N4 | 3 | 8 | 12 | 24 |
| N3 | 4 | 10 | 16 | 30 |
| N2 | 5 | 12 | 20 | 36 |

Existing backend remains the source of truth for credits and timed unlocks. This repository does not deploy or migrate that backend automatically. CI builds Android artifacts only and runs backend tests in a disposable database. The website remains unchanged.

## Build

Requires JDK 17 and Android SDK 36.

```sh
cd android-app
./gradlew testDebugUnitTest lintDebug assembleDebug
```

The build reads the existing public website for its reader shell and canonical preview data. Paid books, PDFs and audio are not bundled. Free files contain exactly five entries per subject.

## Validation

```sh
python3 android-app/scripts/prepare_reader.py
node --test android-app/test/free-preview.test.cjs
```

GitHub Actions runs APK builds and Android device checks. A generated source change is not proof of a working APK: inspect workflow results and artifacts before distributing. Visual comparison against the supplied reference remains part of release QA.
