# Nihongo Path Books adaptive learning upgrade

## Baseline audit

- Android package is online.devnazu.books. The requested GitHub main at 20774510982e61427ba1ac2653e1f3e2caa6e892 declares 1.14.0 and code 22. The separate Books and Next repositories are older or have a different package.
- The retained 1.19.3/code 33 Gradle candidate is reconstructed Java based on 1.19.1/code 31, with documented runtime and UI checks incomplete. The public listing mirror reports 1.19.3. The current Play Console release code and the exact installed production source remain unverified.
- The Books Supabase project exposes an Edge API backed by a private books schema. It uses Supabase identity, then its own expiring opaque app session. The live books schema contains premium assets, study_state, unlocks, rewards and sessions with RLS enabled. No production rows or settings were changed.
- The current reader uses native WebView content gates. A live entitlement is required to load premium content. Existing bookmarks and learned flags are not outcome evidence.
- The Sakura project is separate. The retained audit counts 8,717 questions across 133 papers, with 17 reviewed samples, 7,626 language reviews pending and 1,074 flagged. A reviewed sample is insufficient to establish reuse authorization or content validity. No Sakura question text is imported.
- AdMob SDK, rewarded ID and SSV paths exist in source. Live console configuration and real-device Google reward credit remain unverified.

## Implementation sequence

1. Verify a runnable baseline against the current Play version and screenshots, including sign-in, board Undo, access expiry, AdMob/SSV and update-in-place data. Record commit and artifact checksums. Integrate the portable engine from this branch into that baseline.
2. Keep the existing screens and access checks. Add only Smart Review, My Progress and Daily Smart Study entry points. Wire real grade/answer events to the engine. Compare path geometry against existing KanjiVG references after order-preserving resampling. Validate handwriting feedback thresholds against labelled traces before converting it to a scored event.
3. Validate versioned curriculum IDs and independently reviewed prerequisites. Build typed edges only for established relationships. Keep original mock papers immutable and route authorized, language-reviewed questions through a separate practice pool.
4. Add a per-user native SQLite event store and transactional outbox. Persist projections locally and replay immutable events in timestamp/ID order. Authenticate sync through the existing Edge API and hash-backed session check. Use server ingestion cursors for pull and idempotent UUIDs for push. Never store premium content payloads in the learning log. Keep premium fetch behind its current entitlement gate.
5. The daily planner derives retention from FSRS prediction, mastery from a shared BKT/HMM state, and exam-practice value from expected information gain for eligible exam-aligned questions. Integrate it at session start and after new outcomes. Calibrate planner weights and item priors against actual outcomes before release. Thompson sampling requires a measurable delayed mastery-gain objective. PID will select a bounded IRT practice target, never an official exam target.
6. Connect Hawkes scheduling to the existing reminder channel through one idempotent native alarm per local date, with permission and quiet-hour checks at scheduling and delivery. Use the existing default when history is sparse. Run MDL on linguist-verified reversible grammar candidates at build time. Preserve source grammar and report proposed compressions for review.
7. Run database isolation, cross-device replay, same-signature migration, Android UI comparison, old-feature regression and low-end-device profiling. Build a test APK only after the baseline is established. Establish a new Play version code against all tracks before assigning a release number. This branch contains no production rollout.
