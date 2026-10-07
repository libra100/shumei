# BRIEFING — 2026-09-18T02:30:00Z

## Mission
Formulate exact architectural and text remediation for Finding 3 (IETF Idempotency Key Semantics) and Finding 4 (API Security, Schema Inconsistencies, Status Harmonization, RFC 7807 Error Envelopes) for docs/SHUMEI_SEED_BANK_COLLABORATION.md.

## 🔒 My Identity
- Archetype: explorer
- Roles: Explorer, Architectural Analyst
- Working directory: /Users/tsaisungen/Sites/shumei/.agents/explorer_retry_2
- Original parent: d3fb908c-af3a-4fac-ac09-4c016032507e
- Milestone: Retry M1 - Finding 3 & Finding 4 Remediation

## 🔒 Key Constraints
- Read-only investigation — do NOT modify source code or docs/SHUMEI_SEED_BANK_COLLABORATION.md directly (write all proposed changes and remediations to .agents/explorer_retry_2/handoff.md)
- Strictly comply with IETF HTTP Idempotency draft specification
- Enforce Zero-Trust API design (no client pricing, no client user ID injection, no client-side shared HMAC secrets in SPA)
- Ensure exact TypeScript/React compatibility with Seed-Bank ('待審核' | '已核准' | '已出貨' | '已送達' | '已結案')

## Current Parent
- Conversation ID: d3fb908c-af3a-4fac-ac09-4c016032507e
- Updated: 2026-09-18T02:30:00Z

## Investigation State
- **Explored paths**:
  - `docs/SHUMEI_SEED_BANK_COLLABORATION.md` (Lines 265-530, 580-650)
  - `.agents/reviewer_2/handoff.md` (Finding 3 & Finding 4)
  - `PROJECT.md` (Interface contracts Lines 60-106)
  - `Seed-Bank/src/types.ts` (LegacyClaimRequest, StorageSpace, SeedMovement)
  - `Seed-Bank/src/components/legacy_shumei/ClaimRequestsTable.tsx` (Status rendering & actions)
  - `Seed-Bank/package.json` (SPA client architecture)
- **Key findings**:
  - Finding 3: Made `X-Idempotency-Key: <UUIDv4>` mandatory (REQUIRED). Defined SHA256 canonical body hashing. Specified cached 200 OK replay with `Idempotency-Replay: true` header (NEVER 409). Defined 409/425 for concurrent execution, 422 for payload mismatch, and 400 for missing key.
  - Finding 4: Removed client `karmaDeducted` (price tampering prevention) and `userId` (IDOR prevention) from request body. Replaced `X-Shumei-Service-Key` HMAC with Firebase Auth ID Token + Custom Claim `seedBankLevel >= 3`. Harmonized status with dual fields (`status: '待審核'`, `statusCode: 'pending_approval'`) and bi-directional mapping table. Changed balance failure from 403 to 422 Unprocessable Entity. Added comprehensive RFC 7807 problem details specification and error registry in Section 4.2.0.
- **Unexplored areas**: None within scope. Complete text replacements provided in handoff.md.

## Key Decisions Made
- Provided ready-to-apply markdown replacement blocks for Section 4.1.3, Section 4.2.0, Section 4.2.1, Section 4.2.2, Section 4.3.2, and PROJECT.md.

## Artifact Index
- `.agents/explorer_retry_2/DISPATCH.md` — Inbound instructions log
- `.agents/explorer_retry_2/BRIEFING.md` — Working memory
- `.agents/explorer_retry_2/progress.md` — Liveness heartbeat and step tracking
- `/Users/tsaisungen/Sites/shumei/.agents/explorer_retry_2/handoff.md` — Comprehensive 5-component deliverable for worker_m1
