# Dispatch for Explorer Retry 1

Target: Design remediation for Concurrency (reservedPackages lock, 72h TTL, cancel/refund API) and Split-Brain (differential SeedMovement sync, physical priority dispute rules) in docs/SHUMEI_SEED_BANK_COLLABORATION.md
Working Directory: /Users/tsaisungen/Sites/shumei/.agents/explorer_retry_1
Required Reading:
- /Users/tsaisungen/Sites/shumei/.agents/ORIGINAL_REQUEST.md
- /Users/tsaisungen/Sites/shumei/PROJECT.md
- /Users/tsaisungen/Sites/shumei/.agents/reviewer_2/handoff.md
- /Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md

## 2026-09-18T02:27:00Z
You are explorer_retry_1.
Your working directory is: /Users/tsaisungen/Sites/shumei/.agents/explorer_retry_1
You are an Explorer subagent in a multi-agent orchestration team.

Read the authoritative inputs:
1. /Users/tsaisungen/Sites/shumei/.agents/ORIGINAL_REQUEST.md
2. /Users/tsaisungen/Sites/shumei/PROJECT.md
3. /Users/tsaisungen/Sites/shumei/.agents/reviewer_2/handoff.md (Read Finding 1 and Finding 2 carefully!)
4. /Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md

Your mission:
Formulate the exact architectural and text remediation for:
1. Finding 1: Concurrency Race Condition & Inventory Reservation:
   - Introduce `reservedPackages` in Firestore `Seed` model.
   - Update `POST /api/v1/seeds/claim` transaction logic to verify `(packages - reservedPackages) >= requestedPackages` and atomically increment `reservedPackages += requestedPackages`.
   - Update Sequence Diagram 2 (Figure 2) to clearly illustrate the two-phase lock (`reservedPackages += 1`).
   - Define a claim cancellation and rollback mechanism: `POST /api/v1/seeds/claim/{claimId}/cancel` and `onClaimRejected` trigger that refunds Karma and decrements `reservedPackages`.
   - Define a 72-hour claim expiration TTL that automatically triggers rollback.
2. Finding 2: Contradictory Split-Brain Protocol & Physical Deficit Handling:
   - Remove `outgoingPackageUpdates` and `newPackages` absolute count from `POST /api/v1/sync/seeds`.
   - Enforce strictly differential `SeedMovement` entries (`deltaPackages: -N`) for all inventory changes.
   - Specify a concrete Physical Priority Dispute Resolution Policy: offline physical distributions take priority; online claims that cannot be fulfilled are flagged for priority restocking or automated Karma refund with bonus Karma compensation.

Document the exact text replacements, section updates, and revised diagram code in:
/Users/tsaisungen/Sites/shumei/.agents/explorer_retry_1/handoff.md
Send completion message to parent with send_message.
