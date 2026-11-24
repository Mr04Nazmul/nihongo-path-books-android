# Adaptive engine development verification

- Node 24.22.3. Run `npm ci`, `npm test`, and `node benchmark.mjs` in this directory.
- Ten tests passed. They cover FSRS schedule fixtures, HMM and BKT consistency, IRT and information gain, cycle rejection, stroke alignment, duration and load budgets, an event replay and replanning integration, bounded PID, Hawkes likelihood and reminder constraints, reversible MDL fixtures and Thompson posterior sampling.
- Synthetic desktop benchmark with 4,800 events and 240 tasks. Five measured runs after one warmup gave 36.2 ms median replay and 54.6 ms median planning. These are workstation measurements.
- The staging SQL has not been applied or tested against PostgreSQL. Android integration, runtime UI comparison, real handwriting threshold validation, grammar corpus linguist validation, authenticated cross-device sync and Google ad playback remain pending. No APK or Play version was built from this change.

## Change log

- Introduce a portable learning engine and package lock with MIT-licensed ts-fsrs.
- Compute skill states from accountable outcomes and derive plan candidates from retention, mastery and expected information gain.
- Add graph validation, handwriting alignment, adaptive controller, session point-process fitting and grammar coding-cost analysis.
- Add an unapplied service-only event-sync migration draft. The Android and Edge runtime call sites remain pending.
