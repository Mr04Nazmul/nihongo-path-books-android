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

The preview can schedule one adaptive reminder through the existing daily
notification channel. It uses existing permission checks and an 08:00–21:00
local window. With sparse session history it keeps the 19:00 default.
Vocabulary and kanji can use both answer directions. Their difficulty values
are cold-start exercise priors. They still need on-device calibration.

The Android sync client, Edge route and SQL migration are supplied for
staging. The migration was tested with PostgreSQL-compatible PGlite.
Leave `BOOKS_ADAPTIVE_SYNC` unset until the matching migration and Edge
route have been tested together. The integration does not enable live sync
or change the existing study-state and reward APIs.

Run `node android/grammar-audit.mjs /path/to/lessons-*.json` with approved
curriculum inputs for the MDL report. The supplied run examined the 25
free preview grammar entries across N5–N1. It found 28 formation clauses and
no description-length improvement with the checked rule set. It does not
rewrite grammar. The prerequisite set includes three source-matched
grammar edges and separate kanji-to-vocabulary relationships. The full
prerequisite map and the linguistic review of the full premium corpus
remain pending. Sakura papers remain separate because the available audit
does not clear them for this practice pool.
