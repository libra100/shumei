## 2026-09-18T02:31:43Z
You are worker_2.
Your working directory is: /Users/tsaisungen/Sites/shumei/.agents/worker_2
You are a Worker subagent in a multi-agent orchestration team.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

You MUST read the following authoritative inputs before editing:
1. /Users/tsaisungen/Sites/shumei/.agents/ORIGINAL_REQUEST.md
2. /Users/tsaisungen/Sites/shumei/PROJECT.md
3. /Users/tsaisungen/Sites/shumei/.agents/reviewer_2/handoff.md (Reviewer 2's 5 findings)
4. /Users/tsaisungen/Sites/shumei/.agents/explorer_retry_1/handoff.md (Exact solutions for Findings 1 & 2)
5. /Users/tsaisungen/Sites/shumei/.agents/explorer_retry_2/handoff.md (Exact solutions for Findings 3 & 4)
6. /Users/tsaisungen/Sites/shumei/.agents/explorer_retry_3/handoff.md (Exact solutions for Finding 5)
7. /Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md

Exclusive Write Ownership:
You exclusively own and must revise:
/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md

Implementation Instructions:
Synthesize and apply all solutions from the 3 retry explorers into `docs/SHUMEI_SEED_BANK_COLLABORATION.md`:

1. Fix Concurrency & Inventory Reservation (Finding 1):
   - Add `reservedPackages` to Seed model (Section 2.3, 4.1.1).
   - In `POST /api/v1/seeds/claim` (Section 3.1.1, 4.2.1), enforce two-phase locking in `runTransaction`: verify `(packages - reservedPackages) >= requestedPackages`, atomically increment `reservedPackages += requestedPackages`, and deduct points.
   - Specify claim cancellation endpoint: `POST /api/v1/seeds/claim/{claimId}/cancel` and `onClaimRejected` trigger that refunds Karma and decrements `reservedPackages`.
   - Specify Cloud Scheduler 72-hour expiration TTL for unfulfilled claims.
   - Update Figure 2 (Sequence Diagram 2) to clearly reflect `reservedPackages += 1` in Step 3, physical decrement on shipping, and the automated rollback branch.

2. Reconcile Split-Brain & Differential Sync (Finding 2):
   - In `POST /api/v1/sync/seeds` (Section 4.2.4), completely remove `outgoingPackageUpdates` and `newPackages` absolute count.
   - Enforce strictly differential `outgoingMovements` (`deltaPackages: -N`).
   - In Section 4.4.3 (R2), detail the Physical Priority Dispute Resolution Policy: offline physical handovers take precedence; conflicting online claims receive 100% Karma refund (200 pts) + 50 Bonus Karma apology credit + priority restock voucher.

3. Correct IETF Idempotency Key Semantics (Finding 3):
   - In `POST /api/v1/seeds/claim` (Section 4.2.1), make `X-Idempotency-Key: <UUIDv4>` REQUIRED.
   - Define IETF-compliant cached 200 OK replay behavior with `Idempotency-Replay: true` header when the same key and payload hash are resubmitted.
   - Return 409 Conflict / 425 Too Early only if the key is currently in-flight; return 422 Unprocessable Entity if reused with a different payload.

4. Harden API Contracts & Harmonize Status (Finding 4):
   - Remove client `karmaDeducted` and `userId` from request body in Section 4.2.1 (server calculates price; binds to `context.auth.uid`).
   - Use `422 Unprocessable Entity` (code `ERR_INSUFFICIENT_KARMA`) instead of 403 for balance shortages.
   - Harmonize claim status: Seed-Bank UI and TypeScript use `'待審核' | '已核准' | '已出貨' | '已送達' | '已結案'`. Standardize the response to include both: `"status": "待審核"` and `"statusCode": "pending_approval"`, and document the bi-directional state machine table.
   - In Section 4.2.2 (`verify-qualification`), replace `X-Shumei-Service-Key` with Firebase Auth ID Token containing Custom Claims `seedBankLevel >= 3`.
   - Add Section 4.2.0 with a standardized RFC 7807 problem details error response schema.

5. Ground in Codebase Reality (Finding 5):
   - In Section 4.4.1 (Roadmap), add **Phase 0.5 (0~1m) 基礎設施與單一真理源整備**: Migrate Shumei Karma ledger from `localStorage` to Firestore `/users/{uid}/karma` with `/karma_transactions`, and migrate Volunteer CRM to Firestore `/volunteers/{uid}`.
   - Correct redirection URL target from `#grain-memory` to `#tab-seeds` (matching `natural-farm.html:214`).
   - In Section 3.3.1 and Phase 1.2, add the client-side router specification in `natural-farm.js` to parse `?trace={shumeiCode}#tab-seeds`, trigger `switchMainTab('seeds')`, and call `renderSeedTrace(shumeiCode)`.
   - In Section 3.1.2.1 and Phase 1.4, clarify that Seed-Bank Phase 1 ingests claims via REST polling / modular read client before Phase 2's full real-time `onSnapshot`.
   - In Section 3.1.4 and 3.3.1.1, clarify the role of `qrcode.react` (`QRCodeSVG`) for genuine scannable QR encoding `https://shumei-2025.web.app/trace/{shumeiCode}` vs offline fallback.

Verification:
- Run `node /Users/tsaisungen/Sites/shumei/scripts/verify-collaboration-doc.js` and ensure all assertions pass.
- Write handoff report to `/Users/tsaisungen/Sites/shumei/.agents/worker_2/handoff.md`.
- Send completion message to parent with send_message.
