# Nihongo Path Books adaptive preview

The owner-supplied 1.19.3/code 33 Gradle recovery is the baseline. The
development source declares 1.20.0-adaptive-preview/code 34. The earlier
1.19.3 evidence in the baseline directory refers to that earlier build.

The recovered Android reader now exposes Smart Review, Daily Smart Study
and My Progress. Real answer taps feed FSRS and IRT/BKT/HMM. They persist in
SQLite and change future scheduling and planning. Thompson sampling
breaks information-gain ties using observed outcomes at least a day
apart. PID adjusts the target for forward and reverse exercise selection
using stated cold-start priors. The handwriting panel compares ordered
paths to the existing KanjiVG animation. Hawkes fitting uses on-device
study sessions and hooks into the daily reminder.

The staging sync code uses the existing app session flow and an account
scoped SQLite outbox, plus a private, deduplicated PostgreSQL event table.
Cross-account isolation, duplicate pushes, cursors, cascading deletion and
service-only RPC permission passed in a PGlite integration test. Production
sync is off. No migration or Edge updates were deployed.

12 Node tests passed, including the reader action-to-bridge flow and
the PostgreSQL migration integration. AdaptiveHistory independently
compiled against Android API 36. The synthetic desktop benchmark ran
4,800 reviews and 240 candidates. Median replay was 25.4 ms and median
planning was 52.5 ms. No physical Android device measurement is claimed.

The MDL preview audit covers 25 grammar rows and 28 formation clauses.
None of the checked rewrites reduced description length. No source
grammar was changed. Full curriculum graph coverage, full-corpus
linguistic validation, Sakura content clearance, Android rendering
comparison and live device end-to-end verification are still required.
