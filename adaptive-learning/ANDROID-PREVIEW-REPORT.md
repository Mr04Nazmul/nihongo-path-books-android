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

14 Node tests passed, including the reader action-to-bridge flow and
the PostgreSQL migration integration. AdaptiveHistory independently
compiled against Android API 36. The synthetic desktop benchmark ran
4,800 reviews and 240 candidates. Median replay was 25.4 ms and median
planning was 52.5 ms. No physical Android device measurement is claimed.

The full read-only MDL audit covered 792 grammar entries and 787 formation
clauses across N5–N1. Twelve formations recurred. The checked plain-clause
rule reduced total description length from 192861 to 192359 bits. No
grammar was rewritten. Automatic curriculum relationships and three
source-aligned hard prerequisite edges are wired into the reader.
Cross-level prerequisite curation, remaining Sakura question review, production sync
and Android device end-to-end verification remain pending.

The user-authorized preview includes 17 reviewed stand-alone questions from
the first free N5 Sakura paper, with original answer keys and reading
passages. They are used only in Adaptive Practice. The public source
branch includes the import tool; the question data is in the supplied
Android source archive. The source archive records NihongoMock provenance.
No additional Sakura papers were imported.
