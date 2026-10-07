# Reviewer 2 Adversarial Challenge & Audit Report: Shumei ↔ Seed-Bank Collaboration Blueprint

**Task Target**: Deep Adversarial Review & Forensic Stress-Testing of `/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md`  
**Agent**: `reviewer_2` (Roles: Reviewer, Adversarial Critic)  
**Working Directory**: `/Users/tsaisungen/Sites/shumei/.agents/reviewer_2`  
**Date**: 2026-09-18  
**Verdict**: **REQUEST_CHANGES**  
**Overall Risk Assessment**: **HIGH** (Severe cross-system concurrency race conditions, contradictory offline reconciliation, RFC idempotency violations, API security vulnerabilities, and major gaps with actual codebases)

---

## 1. Observation

Direct inspection and forensic cross-examination of `/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md`, `/Users/tsaisungen/Sites/shumei/PROJECT.md`, `/Users/tsaisungen/Sites/shumei/` (public JS/HTML, functions), and `/Users/tsaisungen/Sites/Seed-Bank/` (src/types, components, utils) revealed the following concrete, verifiable facts:

### 1.1 Concurrency & Asynchronous Inventory Deduction (Lines 607–620 vs Lines 753–755)
- In Figure 2 (Sequence Diagram, Line 607-610):
  ```
  CF->>DB: 執行 runTransaction (原子交易)
  Note over CF,DB: 1. 檢核 User.karma >= 200
                   2. 扣減 User.karma -= 200
                   3. 檢核 Seed.packages >= 1
                   4. 建立 exchange_claims (CLM-2026-0892, pending)
  ```
- In Figure 2 (Line 618-620), the actual deduction of seed inventory:
  ```
  SB->>DB: 寫入出庫扣減更新：
  Note over SB,DB: 1. seeds/S-001: packages -= 1, quantityGrams -= 5
                   2. storage/ST-01: occupiedGrams -= 5
                   ...
  ```
- **Direct Observation**: The Cloud Function in Step 3 only *checks* `Seed.packages >= 1`, but **DOES NOT decrement or reserve `Seed.packages`**. The decrement only occurs when a human steward reviews and ships the claim in Seed-Bank (minutes, hours, or days later).
- **Codebase Reality**: There is no `reservedPackages` field in `Seed-Bank/src/types.ts` (Line 20: only `packages?: number; gramsPerPackage?: number;`).

### 1.2 Offline Split-Brain & Append-Only Contradiction (Line 756 vs Lines 490–496)
- In Section 4.4.3 R2 (Line 756):
  > 「採用 只增調撥日誌 (Append-Only Movement Log) 與版本向量（Vector Clock）架構。離線操作記錄為 SeedMovement 單據，連線時以單據流水號進行重播合併（Replay & Settle），而非覆寫實體絕對值。」
- In Section 4.2.4 (Lines 490–496), the API specification for `POST /api/v1/sync/seeds`:
  ```json
  "outgoingPackageUpdates": [
    {
      "seedId": "S-001",
      "newPackages": 17,
      "clientVersion": 4
    }
  ]
  ```
- **Direct Observation**: Section 4.4.3 claims the system *never overwrites absolute values*, but Section 4.2.4 explicitly introduces `outgoingPackageUpdates` which transmits an **absolute package count** (`newPackages: 17`). Furthermore, line 521 states:
  > `- 409 Conflict: 偵測到寫入衝突（伺服器端版本高於客戶端）。回傳伺服器端權威資料與衝突欄位清單，觸發客戶端三方合併。`
  A software three-way merge cannot resolve physical stock deficits when aggregate physical and digital deductions exceed warehouse capacity.

### 1.3 Idempotency Key Specification Violation (Lines 316, 364)
- In Section 4.2.1:
  - Header: `X-Idempotency-Key: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d (選填，防止重複提交)` (Line 316)
  - Error code: `409 Conflict: ERR_IDEMPOTENT_REPLAY (偵測到重複發送的等冪性單號)` (Line 364)
- **Direct Observation**: `X-Idempotency-Key` is marked optional on a critical points deduction / inventory claim endpoint. Returning `409 Conflict` on a replayed key violates IETF HTTP Idempotency specifications (`draft-ietf-httpapi-idempotency-key-header`), which mandate returning the original cached successful response (`200 OK` with original `claimId`).

### 1.4 API Contract & Status Code Anomalies
- In `POST /api/v1/seeds/claim`:
  - Request schema (Line 325): `"karmaDeducted": 200` is submitted by client.
  - Request schema (Line 320): `"userId": "usr_c87a29f1"` is passed in body alongside `Authorization: Bearer <Firebase_ID_Token>`.
  - HTTP Status (Line 360, 362): `400 Bad Request` is assigned to `ERR_INSUFFICIENT_STOCK`, whereas `403 Forbidden` is assigned to `ERR_INSUFFICIENT_KARMA`.
  - Response schema (Line 349): `"status": "pending_approval"`.
  - **Codebase Reality**: In `Seed-Bank/src/types.ts` (Line 46), `LegacyClaimRequest.status` is strictly `'待審核' | '已核准' | '已出貨' | '已送達' | '已結案'`. In `Seed-Bank/src/components/legacy_shumei/ClaimRequestsTable.tsx` (Line 91), the UI renders action buttons matching exact Chinese strings: `claim.status === '待審核'`. The English status `"pending_approval"` will break rendering and TypeScript compilation.
- In `POST /api/v1/members/verify-qualification`:
  - Header (Line 369): `X-Shumei-Service-Key: <HMAC_SECRET>`.
  - **Codebase Reality**: `Seed-Bank` is a static React SPA (`package.json`, Vite 6). A client-side browser application cannot securely store an HMAC secret key without exposing it in the bundled JavaScript.
- In all endpoints (4.2.1 – 4.2.4):
  - No standardized error JSON schema is specified.

### 1.5 Ground-Truth Gaps with Existing Codebases
1. **Shumei Karma Storage**:
   - In `shumei/public/js/natural-farm.js` (Line 137, 536–538):
     `let userKarma = parseInt(localStorage.getItem('shumei_user_karma') || '380', 10);`
     `userKarma -= cost;`
     `localStorage.setItem('shumei_user_karma', userKarma.toString());`
     Vouchers are stored in `localStorage.getItem('shumei_user_vouchers')`.
     There is NO server-side `users/{uid}/karma` ledger in Firestore.
2. **Shumei Volunteer CRM**:
   - In `shumei/public/js/natural-farm-admin.js` (Lines 92–98, 661–680):
     `volunteerList` is a hardcoded in-memory JavaScript array (`let volunteerList = [...]`).
     `generateVolunteerCert` merely updates DOM innerText (`SHUMEI-VOL-2026-${Math.floor(...)}`) and opens a Bootstrap modal. It writes nothing to Firestore.
     The blueprint's claim of an automated `onVolunteerDocUpdated` Cloud Function trigger has no backend data source.
3. **Redirect URL & DOM Target Mismatch**:
   - In document (Lines 198, 465): `https://shumei-2025.web.app/farm/natural-farm.html?trace={shumeiCode}#grain-memory`.
   - In `shumei/public/farm/natural-farm.html` (Line 214): The DOM element is `<section id="tab-seeds" class="tab-pane-content" style="display:none;">`.
   - There is NO `#grain-memory` or `#dna-bank` ID in the HTML.
   - In `shumei/public/js/natural-farm.js`: There is zero URL query parameter parsing (`?trace=`) or hash-based tab navigation. Scanning the QR code leaves the user on Tab 1.
4. **Seed-Bank Firebase Integration & Hosting**:
   - In `Seed-Bank/package.json`: Firebase is not installed.
   - In `Seed-Bank/src/App.tsx`: Persistence is 100% `localStorage` (`OFFGRID_*`).
   - Phase 1 (0–3m) promises "即時 Karma 標記與過濾視圖", but Seed-Bank has no Firestore connection until Phase 2.
5. **Seed-Bank Dummy QR Code Engine**:
   - In `Seed-Bank/src/utils/qrCodeSvg.ts` (Lines 18–54): `generateQrCodeSvgString` produces a fake 21x21 matrix using mathematical modulo (`(charCode + r * 7 + c * 13 + hash) % 3 === 0`) with zero Reed-Solomon encoding.
   - In `Seed-Bank/src/components/legacy_shumei/modals/Modal23852PrintLabel.tsx` (Lines 106–111): The label embeds raw `shumeiCode` instead of the web URL `https://shumei-2025.web.app/trace/{shumeiCode}`.

---

## 2. Logic Chain

```
[Observation 1.1: Asynchronous Deduction without Stock Reservation]
  ├── POST /api/v1/seeds/claim checks packages >= 1, deducts Karma, marks pending.
  ├── Does NOT decrement packages or create a reservation lock.
  └── Multiple concurrent claims on stock=1 all succeed -> Overclaiming / Overselling.
  └── When claim cannot be fulfilled, Karma is lost with no rollback/refund protocol.
                           │
                           ▼
[Observation 1.2: Split-Brain & Inventory Mutation Contradiction]
  ├── Section 4.4.3 claims "Append-only, never overwrite absolute values".
  ├── Section 4.2.4 specifies absolute `newPackages: 17` in outgoingPackageUpdates.
  └── Conflict resolution via "client 3-way merge" cannot resolve physical inventory deficits.
                           │
                           ▼
[Observation 1.3: Faulty Idempotency Key Semantics]
  ├── Optional idempotency key on mutation endpoint invites duplicate charges on network retries.
  ├── Returning 409 Conflict on retransmitted key breaks IETF standards.
  └── Client receives failure error despite successful order creation -> severe UX confusion.
                           │
                           ▼
[Observation 1.4: API Contract & Security Vulnerabilities]
  ├── Client submits `karmaDeducted` (price tampering vulnerability).
  ├── Client submits `userId` in body alongside Bearer token (IDOR vulnerability).
  ├── Status codes conflate balance shortage (403) with permission denial.
  ├── Seed-Bank SPA cannot hold HMAC secret key for `verify-qualification`.
  └── English enum `pending_approval` breaks Seed-Bank UI and TypeScript types.
                           │
                           ▼
[Observation 1.5: Disconnect with Actual Codebases]
  ├── Shumei Karma and Volunteer CRM are client-side prototypes (localStorage / in-memory).
  ├── Blueprint assumes existing Firestore collections that do not exist.
  ├── Redirect URL target `#grain-memory` does not exist in DOM; natural-farm.js has no router.
  └── Phase 1 cannot achieve "realtime Karma claim view" without Seed-Bank Firestore connection.
                           │
                           ▼
[Conclusion: REQUEST_CHANGES]
  └── Document requires substantial architectural amendments before approval.
```

---

## 3. Detailed Findings & Adversarial Challenges

### Finding 1 (Critical): Overclaiming Race Condition & Lack of Inventory Reservation / Refund Protocol
- **Location**: Section 3.1.1, 4.2.1, 4.3.2 (Figure 2), 4.4.3 (R1)
- **Assumption Challenged**: That executing `runTransaction` in `POST /api/v1/seeds/claim` to check `packages >= 1` prevents concurrency race conditions.
- **Attack Scenario**:
  1. Variety `SO-LY-S-TW01-2506-001` has only 1 package remaining (`packages: 1`).
  2. At 10:00:00, User A submits claim via `POST /api/v1/seeds/claim`. Cloud Function checks `packages >= 1` (Pass), deducts 200 Karma from User A, and writes `exchange_claims` record `CLM-001` with `status: 'pending'`. `Seed.packages` remains `1`.
  3. At 10:00:05, User B submits claim for the same seed. Cloud Function checks `packages >= 1` (Pass, still 1!), deducts 200 Karma from User B, and writes `CLM-002` with `status: 'pending'`.
  4. At 10:00:10, User C does the same. All three users have 200 Karma deducted.
  5. At 14:00, Steward logs into Seed-Bank, approves `CLM-001`, and sets `packages -= 1` (now 0).
  6. Steward opens `CLM-002` and `CLM-003`. There is no physical inventory left.
- **Blast Radius**: Systemic overclaiming, user points confiscated without delivery, no automated refund or cancellation mechanism, loss of trust.
- **Required Mitigation**:
  1. **Two-Phase Inventory Lock**: Introduce `reservedPackages`. In `POST /api/v1/seeds/claim`, transaction must atomically verify `(packages - reservedPackages) >= requestedPackages` AND increment `reservedPackages += requestedPackages`.
  2. **Compensating Transaction & Refund API**: Define `POST /api/v1/seeds/claim/{claimId}/cancel` and `onClaimRejected` trigger that automatically restores 200 Karma to `User.karma` and decrements `reservedPackages`.
  3. **Claim Expiration TTL**: Unapproved claims must expire after 72 hours, automatically releasing reserved stock and refunding Karma.

---

### Finding 2 (High): Contradictory Split-Brain Protocol & Physical Deficit Infeasibility
- **Location**: Section 3.4.2, 4.2.4, 4.4.3 (R2)
- **Assumption Challenged**: That offline split-brain can be handled by "pure append-only logs" while simultaneously exposing absolute `newPackages` updates, resolved by "client 3-way merge".
- **Attack Scenario**:
  1. Mountain warehouse has 5 packages of heirloom squash. Device goes offline.
  2. Offline steward physically distributes 3 packages to local farmers, recording offline movements.
  3. Meanwhile, online platform receives claims for 4 packages. Server decrements stock from 5 to 1.
  4. Total demand is 3 + 4 = 7 packages. Only 5 existed physically.
  5. Offline device reconnects and calls `POST /api/v1/sync/seeds`. Server detects version conflict and returns `409 Conflict`.
- **Blast Radius**: Deadlock between offline reality and cloud ledger; negative physical inventory cannot be merged by software algorithms.
- **Required Mitigation**:
  1. **Remove `outgoingPackageUpdates`**: Delete `newPackages` absolute count from `POST /api/v1/sync/seeds`. All inventory adjustments must be expressed strictly as differential `SeedMovement` entries (e.g. `deltaPackages: -3`).
  2. **Physical Priority Dispute Resolution Policy**: Specify explicit business rules for over-allocation: Physical handovers documented offline take precedence; server must flag conflicting digital claims for priority reallocation or automated Karma refund with bonus apology points.

---

### Finding 3 (High): IETF Idempotency Violation & Duplicate Charge Vulnerability
- **Location**: Section 4.2.1 (Lines 316, 364)
- **Assumption Challenged**: That `X-Idempotency-Key` should be optional, and retransmissions should return `409 Conflict`.
- **Attack Scenario**:
  1. Mobile user taps "兌換 200 Karma" on a spotty 3G connection in a rural farm.
  2. Cloud Function executes the transaction, creates `CLM-2026-0892`, and deducts 200 Karma.
  3. The cellular tower drops the TCP connection before the HTTP response reaches the mobile browser.
  4. The browser/client automatically retries the request with the same `X-Idempotency-Key`.
  5. Server returns `409 Conflict: ERR_IDEMPOTENT_REPLAY`.
  6. The client displays "兌換失敗：重複請求！".
  7. The user believes the transaction failed, but their 200 Karma is gone and the order is already placed.
  8. If the user did not include an idempotency key (because it was marked "選填"), the retry will charge another 200 Karma and create a duplicate claim!
- **Blast Radius**: Duplicate billing, broken retries on unstable networks, angry users.
- **Required Mitigation**:
  1. **Mandatory Idempotency Key**: Make `X-Idempotency-Key: <UUIDv4>` mandatory for all `POST /api/v1/seeds/claim` requests.
  2. **Standard IETF Replay Behavior**: If an idempotency key matches a previously completed request with identical body hash, return the **original cached 200 OK response payload**, not a 409 error.
  3. **In-Flight Lock**: Return `409 Conflict` (or `425 Too Early`) only if a request with the same key is *currently executing*. Return `422 Unprocessable Entity` if the key is reused with a *different payload*.

---

### Finding 4 (Medium): API Security Flaws & Schema Inconsistencies
- **Location**: Section 4.1.3, 4.2.1, 4.2.2
- **Details**:
  1. **Client-Side Price Tampering**: `POST /api/v1/seeds/claim` request body accepts `"karmaDeducted": 200`. The server must calculate and enforce the cost server-side; client input must never dictate deduction amounts.
  2. **IDOR on User ID**: `POST /api/v1/seeds/claim` accepts `"userId"` in body. The server must ignore `body.userId` and bind exclusively to `context.auth.uid`.
  3. **Shared Secret in Frontend SPA**: `POST /api/v1/members/verify-qualification` requires `X-Shumei-Service-Key: <HMAC_SECRET>`. Because Seed-Bank is a React SPA, secrets cannot be stored in client bundles. Seed-Bank users must authenticate using Firebase Auth Token, and Cloud Functions must read user claims directly from Firestore or custom claims.
  4. **Status Code Semantics**: Change `403 Forbidden` for `ERR_INSUFFICIENT_KARMA` to `422 Unprocessable Entity` (or `400 Bad Request`). Status 403 should be reserved for authorization failures.
  5. **Status Value Type Mismatch**: The API returns `"status": "pending_approval"`, while Seed-Bank `types.ts` and `ClaimRequestsTable.tsx` require `'待審核'`. Standardize either on English enums (`pending_approval`, `approved`, `shipped`, `delivered`, `closed`) across both codebases or define an explicit bi-directional adapter.
  6. **Missing Error Envelope**: Add a standardized RFC 7807 / structured error schema:
     ```json
     {
       "success": false,
       "error": {
         "code": "ERR_INSUFFICIENT_STOCK",
         "message": "在庫分裝包數不足",
         "details": { "available": 0, "requested": 1 },
         "timestamp": "2026-09-18T02:20:00Z"
       }
     }
     ```

---

### Finding 5 (Medium): Codebase Ground-Truth Disconnects & Missing Implementation Prerequisites
- **Location**: Section 3.2.1, 3.2.3, 3.3.1, 4.4.1 (Roadmap)
- **Details**:
  1. **Shumei Karma & Volunteer CRM are Mock Prototypes**:
     - `shumei_user_karma` is in client `localStorage`.
     - `volunteerList` in `natural-farm-admin.js` is an in-memory JS array; certificates are transient DOM manipulations.
     - **Impact**: The roadmap must insert **Phase 0.5 Prerequisites**: Migrate Shumei's Karma ledger to Firestore `/users/{uid}/karma` (with `karma_transactions` subcollection) and migrate Volunteer CRM to Firestore `/volunteers/{uid}` before attempting Cloud Function triggers or cross-system authorization.
  2. **Broken Trace URL Redirection**:
     - Document routes QR code to `natural-farm.html?trace={shumeiCode}#grain-memory`.
     - In reality, `natural-farm.html` uses `id="tab-seeds"`, not `#grain-memory`.
     - `natural-farm.js` lacks URL parameter parsing. Scanning the QR code fails to activate Tab 3 or display trace data.
     - **Impact**: Roadmap Phase 1.2 must explicitly specify adding query/hash routing in `natural-farm.js` to parse `?trace=` and activate `switchMainTab('seeds')`.
  3. **Phase 1 Dependency on Seed-Bank Firestore**:
     - Phase 1 claims `ClaimRequestsTable` will display realtime Karma claim flags, but Seed-Bank does not adopt Firestore until Phase 2.
     - **Impact**: Clarify whether Phase 1 uses a REST polling endpoint (`GET /api/v1/claims`) or move Firestore SDK integration into Phase 1.
  4. **Dummy QR Code Generator in Seed-Bank**:
     - `Seed-Bank/src/utils/qrCodeSvg.ts` contains an un-scannable fake matrix generator.
     - Ensure all components strictly use `QRCodeSVG` from `qrcode.react` (or replace `generateQrCodeSvgString` with a genuine Reed-Solomon QR encoder), and ensure `value` encodes the full URL `https://shumei-2025.web.app/trace/{shumeiCode}`.

---

## 4. Caveats

- **Scope Boundary**: This review evaluated the architectural blueprint document (`SHUMEI_SEED_BANK_COLLABORATION.md`) and verified claims against the static source code of `shumei` and `Seed-Bank`. Live Firebase deployment environments (`shumei-2025.web.app`) and deployed Cloud Functions were not invoked directly.
- **Role Limits**: Per Teamwork protocol, `reviewer_2` does NOT modify implementation files directly. All corrections are detailed in this report for author revision.

---

## 5. Conclusion & Actionable Next Steps

### Final Verdict: **REQUEST_CHANGES**

While `docs/SHUMEI_SEED_BANK_COLLABORATION.md` provides an expansive and visionary blueprint with commendable breadth, it exhibits critical vulnerabilities in distributed transaction safety, edge-case failure modes, API protocol standards, and alignment with the current state of both codebases. Approving it in its current form would embed severe architectural defects into subsequent implementation phases.

### Actionable Remediation Checklist for Author (`worker_m1`):
1. [ ] **Fix Concurrency**: Update Figure 2 and Section 4.2.1 to incorporate `reservedPackages` in `POST /api/v1/seeds/claim`, and add specifications for claim cancellation, expiration TTL (72h), and automated Karma rollback.
2. [ ] **Reconcile Split-Brain**: Delete absolute `newPackages` from `POST /api/v1/sync/seeds`, enforce purely differential `SeedMovement` sync, and specify physical priority dispute resolution rules.
3. [ ] **Correct Idempotency**: Make `X-Idempotency-Key` mandatory, and replace `409 Conflict (ERR_IDEMPOTENT_REPLAY)` with IETF-compliant cached 200 OK replay behavior.
4. [ ] **Harden API Contracts**: Remove client `karmaDeducted` and `userId` from request body; change `403` to `422` for insufficient balance; harmonize status enum (`'待審核'` vs `'pending_approval'`); replace `X-Shumei-Service-Key` with Firebase Auth claims; add standardized error envelope schema.
5. [ ] **Ground in Codebase Reality**: Add Phase 0.5 in the roadmap for migrating Shumei's Karma and Volunteer CRM to Firestore; correct DOM target to `tab-seeds`; add `natural-farm.js` URL parameter router specification; clarify Phase 1 Seed-Bank claim data ingestion.

---

## 6. Verification Method

To independently verify the observations and code claims in this report:

1. **Verify Shumei Karma is client-side `localStorage`**:
   ```bash
   grep -n "shumei_user_karma" /Users/tsaisungen/Sites/shumei/public/js/natural-farm.js
   ```
2. **Verify Shumei Volunteer CRM is in-memory mock**:
   ```bash
   grep -n "let volunteerList" /Users/tsaisungen/Sites/shumei/public/js/natural-farm-admin.js
   ```
3. **Verify DOM tab ID mismatch**:
   ```bash
   grep -n "grain-memory" /Users/tsaisungen/Sites/shumei/public/farm/natural-farm.html
   grep -n 'id="tab-seeds"' /Users/tsaisungen/Sites/shumei/public/farm/natural-farm.html
   ```
4. **Verify Seed-Bank status enum mismatch**:
   ```bash
   grep -n "pending_approval" /Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md
   grep -n "status:" /Users/tsaisungen/Sites/Seed-Bank/src/types.ts
   grep -n "待審核" /Users/tsaisungen/Sites/Seed-Bank/src/components/legacy_shumei/ClaimRequestsTable.tsx
   ```
5. **Verify Seed-Bank dummy QR code algorithm**:
   ```bash
   grep -n "仿生矩陣" /Users/tsaisungen/Sites/Seed-Bank/src/utils/qrCodeSvg.ts
   ```
