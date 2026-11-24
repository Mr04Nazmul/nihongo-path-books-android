# Adaptive Android preview overlay

This overlay targets the recovered Nihongo Path Books Gradle source with
version 1.19.3 / code 33. The reconstruction baseline is supplied separately
by the app owner. Apply to a clean copy, using Node 24 and Python 3.

```sh
npm ci
npm test
npx --yes esbuild@0.28.2 android/reader.mjs --bundle --format=iife --target=chrome80 --minify --legal-comments=eof --outfile=android/adaptive-reader.js
python3 android/apply-overlay.py /absolute/path/to/android-source
```

The overlay adds Smart Review, Daily Smart Study and My Progress to the
existing curriculum reader. They use the currently accessible lesson data.
Answers are scored from unambiguous displayed curriculum meanings. The Java
bridge writes only results and item identifiers to account-scoped local
SQLite. It checks the same reader entitlement and credential before accepting
or loading an answer. Kanji handwriting compares ordered pen paths against the
existing visible stroke SVG and points out the largest deviation.

The version label is 1.20.0-adaptive-preview / code 34 for the test build.
Validate the highest Play version code again before assigning a release code.
The offline profile is level and access-scope specific. No content payloads
are copied to the adaptive database.

Supabase synchronization, learner reminder integration, reviewed hard
prerequisites, grammar-corpus validation, calibrated item difficulty and
reuse-approved Sakura question integration remain pending. Character
containment gives related-kanji suggestions. The bundled lesson questions
use a common cold-start difficulty, so PID does not yet move between a
calibrated range of questions in this preview.
