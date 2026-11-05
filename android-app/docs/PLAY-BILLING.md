# Google Play Billing — pending setup, NOT live

Package `online.devnazu.books`; product `nihongo_premium`; base plan `monthly`.
Auto-renewing one calendar month. Bangladesh BDT 99; Japan JPY 199.
All other supported countries: use Play Console's converted local prices from JPY 199, then review tax/price limits and rounding before activation. No external payment gateways.

## Verified Console blocker (5 November 2026)
Subscriptions page says: “You need to set up a Google Payments merchant account to access this page.”
Owner must complete merchant registration, legal/identity/tax/bank steps. The agent did not create a financial account, create the subscription, save prices or activate a plan.

## Draft implementation
- Native Google Billing Library 8, subscriptions only. Profile menu opens existing themed dialog; no learning/UI redesign.
- Google localized monthly price, account-bound checkout, pending payment handling, foreground restore. No client Premium flag or client acknowledgement.
- Independent Supabase `nihongo-play-billing` function. Credentials stay server-side.
- Authoritative subscriptionsv2 check for exact product/base plan and account; server acknowledgement.
- Separate `books.play_subscriptions` ledger; combines valid paid access with existing reward/manual access, never overwrites those grants.
- Per-token verification lease; OIDC-authenticated RTDN; scheduled reconciliation; voided-purchase checks; account hold and pause deny access. Cancellation retains paid-through access.
- Fail closed if verification is older than 20 minutes. Run reconciliation at least every 10 minutes; monitor failures. Deploying without reconciliation will interrupt Premium access.
- `BOOKS_PLAY_MODE` defaults to disabled. `test` accepts only Google `testPurchase` receipts; `live` needs explicit owner approval.

## Required setup before a license purchase
1. Owner finishes merchant setup. Prepare product and base plan with the IDs above, benefits and monthly billing period. Review country prices. Obtain approval before any irreversible product creation or live plan activation.
2. Enable Android Publisher API. Create/configure a server identity with the minimum Play permissions for purchase verification/acknowledgement. Creating credentials or expanding access requires confirmation. Put JSON in Supabase secret `BOOKS_PLAY_SERVICE_ACCOUNT`, never Git/app/chat.
3. Review and apply `supabase/sql/play-billing.sql` transaction. It verifies existing authorization snippets before changing only the subscription entitlement reads. Do not blindly reapply. Record original function definition for rollback.
4. Deploy `supabase/functions/nihongo-play-billing` with platform JWT verification disabled; routes implement app-session, OIDC or cron authentication themselves. Set `BOOKS_PLAY_MODE=test` initially.
5. Pub/Sub topic publisher: `google-play-developer-notifications@system.gserviceaccount.com`. Configure authenticated push `/rtdn` with audience `BOOKS_PLAY_RTDN_AUDIENCE` and service identity email `BOOKS_PLAY_RTDN_EMAIL`. Enable subscription and voided-purchase events; send test notification.
6. Schedule POST `/reconcile` every 10 minutes with secret bearer `BOOKS_PLAY_CRON_SECRET` kept in server/Vault. Monitor non-2xx, retry with backoff. The function processes pages of 100; for larger customer volumes use durable queue/batched cursors to fit Edge execution limits.
7. Upload a signed billing build to a test track after approval. Add license tester(s) in Console; install via Play opt-in link using that account. Debug sideload is not a Play purchase test.
8. Test successful purchase, pending→paid, decline, cancel checkout, restoration/reinstall, account mismatch, renewal, grace, hold/recovery, expiry, cancellation paid-through, revoke/refund, missed-RTDN reconciliation, unavailable Google API and duplicate callbacks. Confirm the sheet explicitly says test payment and no real charge. Verify server ledger and content access after each case.
9. Only after all checks pass, obtain owner approval for live activation and change mode to live. Do not merge/release or activate based on unit tests alone.

## Evidence and limits
Policy tests cover allowed/denied lifecycle states, expiry, wrong account/product/base plan and test-only gating. They are not end-to-end payment tests. Merchant setup, prices, service credentials, RTDN, database deployment and actual test purchases remain pending. New backend is NOT deployed; existing production remains unchanged.
Premium currently means N5–N1 complete learning access; existing voluntary rewarded-ad credit feature is preserved. No unrequested promise of ad removal is made.
