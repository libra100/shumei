# Dispatch for Explorer Retry 2

Target: Design remediation for IETF Idempotency (mandatory UUIDv4, cached 200 OK replay), API security (server-side points calculation, auth UID binding, 422 status), status enum harmonization ('待審核'), and RFC 7807 error envelopes in docs/SHUMEI_SEED_BANK_COLLABORATION.md
Working Directory: /Users/tsaisungen/Sites/shumei/.agents/explorer_retry_2
Required Reading:
- /Users/tsaisungen/Sites/shumei/.agents/ORIGINAL_REQUEST.md
- /Users/tsaisungen/Sites/shumei/PROJECT.md
- /Users/tsaisungen/Sites/shumei/.agents/reviewer_2/handoff.md
- /Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md

## 2026-09-18T02:27:00Z

Formulate the exact architectural and text remediation for:
1. Finding 3: IETF Idempotency Key Semantics:
   - Make `X-Idempotency-Key: <UUIDv4>` mandatory (REQUIRED) on `POST /api/v1/seeds/claim`.
   - Define IETF-compliant replay behavior: if an idempotency key matches an existing successful claim with identical body hash, return the original cached 200 OK response payload (do NOT return 409).
   - Return 409 Conflict / 425 Too Early only if the key is currently being processed concurrently. Return 422 Unprocessable Entity if the key is reused with a different payload.
2. Finding 4: API Security & Schema Inconsistencies:
   - Remove client `karmaDeducted` and `userId` from `POST /api/v1/seeds/claim` request body; server calculates cost based on item catalog and binds `userId` strictly from `context.auth.uid`.
   - Harmonize status enum between Shumei and Seed-Bank: Seed-Bank uses `'待審核' | '已核准' | '已出貨' | '已送達' | '已結案'`. Standardize the API return value or define an explicit bi-directional status mapping table (`status: '待審核'`, `statusCode: 'pending_approval'`).
   - Replace `X-Shumei-Service-Key` with Firebase Auth ID Token containing Custom Claims `level >= 3`, since Seed-Bank is a React SPA and cannot hold server secrets.
   - Use `422 Unprocessable Entity` (instead of 403) for insufficient Karma balance.
   - Add a standardized RFC 7807 structured error response envelope schema to Section 4.2.

Document the exact text replacements, schema updates, and revised JSON code in:
/Users/tsaisungen/Sites/shumei/.agents/explorer_retry_2/handoff.md
