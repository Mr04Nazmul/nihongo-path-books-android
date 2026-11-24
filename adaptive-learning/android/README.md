# Adaptive Android preview overlay

This overlay targets the recovered Nihongo Path Books Gradle source with
version 1.19.3 / code 33. The reconstruction baseline is supplied separately
by the app owner. Apply to a clean copy, using Node 24 and Python 3.

```sh
npm ci
npm test
npx --yes esbuild@0.28.2 android/reader.mjs --bundle --format=iife --target=chrome80 --minify --legal-comments=eof --outfile=android/adaptive-reader.js
npx --yes esbuild@0.28.2 android/reminder-worker.mjs --bundle --format=iife --target=chrome80 --minify --legal-comments=eof --outfile=android/adaptive-reminder-worker.js
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
Vocabulary and kanji can use both answer directions. Japanese-only vocabulary reading questions are generated from unambiguous course entries. Their difficulty values
are cold-start exercise priors. They still need on-device calibration.

The Android sync client, Edge route and SQL migration are supplied for
staging. The migration was tested with PostgreSQL-compatible PGlite.
Leave `BOOKS_ADAPTIVE_SYNC` unset until the matching migration and Edge
route have been tested together. The integration does not enable live sync
or change the existing study-state and reward APIs.

Run `node android/grammar-audit.mjs /path/to/lessons-*.json` with approved
curriculum inputs for the MDL report. The full read-only audit covered 792
grammar entries in Supabase, with 787 clauses. It shortlisted a 502-bit
reduction for the plain-clause rewrite without changing the source grammar.
Kanji-to-word and exact example-word-to-grammar relationships operate across
all five level readers. Three source-matched grammar prerequisites are
enforced. Relationships are restricted to the currently authorized lesson
payload, and full cross-level prerequisite curation remains pending.

The owner-authorized Android source archive includes 17 language-reviewed
stand-alone questions from the first free N5 Sakura paper with their source
provenance. It imports no other paper. To regenerate the app asset privately,
run:
```sh
python3 android/import-sakura.py /path/to/Sakura-JLPT-Question-Audit.zip   /path/to/android-source/app/src/main/assets/reader/sakura-adaptive.json
```
The existing Sakura paper is untouched. Adapted question history is scoped
by the active Books account and uses the same local review and sync route.
