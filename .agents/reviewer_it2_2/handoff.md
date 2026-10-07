# Hard Handoff Report: Adversarial Review & Forensic Audit of Shumei ↔ Seed-Bank Collaboration Blueprint

- **Task Target**: Adversarial audit of all 5 findings from Reviewer 2 against the revised `/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md`
- **Agent**: `reviewer_it2_2` (Roles: Reviewer, Adversarial Critic)
- **Working Directory**: `/Users/tsaisungen/Sites/shumei/.agents/reviewer_it2_2`
- **Date**: 2026-09-18
- **Handoff Type**: Hard (Audit Complete)
- **Verdict**: **APPROVE**

---

## 1. Observation

Direct forensic inspection and cross-verification were conducted against the target specification `/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md` (1159 lines), the test harness `/Users/tsaisungen/Sites/shumei/scripts/verify-collaboration-doc.js`, and the source codebases (`/Users/tsaisungen/Sites/shumei` and `/Users/tsaisungen/Sites/Seed-Bank`).

### 1.1 Empirical Verification Test Results
Command executed:
```bash
node /Users/tsaisungen/Sites/shumei/scripts/verify-collaboration-doc.js
```
Tool result:
- **Total Tests Executed**: 136
- **Passed**: 136
- **Failed**: 0
- **Exit Code**: 0

Forbidden placeholder / anti-cheating audit executed:
```bash
node -e '
const fs = require("fs");
const content = fs.readFileSync("docs/SHUMEI_SEED_BANK_COLLABORATION.md", "utf8");
const forbidden = ["TODO", "TBD", "FIXME", "Lorem", "placeholder", "待定", "待補"];
forbidden.forEach(term => {
  const count = (content.match(new RegExp(term, "gi")) || []).length;
  console.log(`${term}: ${count}`);
  if (count > 0) process.exit(1);
});
console.log("All clean!");
'
```
Tool result: All 7 forbidden keywords report exactly 0 occurrences (`TODO: 0`, `TBD: 0`, `FIXME: 0`, `Lorem: 0`, `placeholder: 0`, `待定: 0`, `待補: 0`).

---

### 1.2 Finding 1: Concurrency Race Condition & Inventory Reservation Audit
**Target Claim**: Implementation of `reservedPackages` two-phase reservation lock, cancellation endpoint, 72-hour TTL expiration, and revised sequence diagram.

**Direct Observations**:
1. **Model Definition**:
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:98`:
     > `Seed`: `... packages, reservedPackages, quantityGrams, storageLocationId ... 其中 reservedPackages（預約凍結包數）作為分散式兩階段庫存鎖，線上索取單建立時原子累加，實體核准出庫時轉化扣減，訂單取消或過期時全額釋放。淨可用包數計算公式為 packages - reservedPackages。`
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:101`:
     > `LegacyClaimRequest`: `... reservedPackages: number, expiresAt: string ...`
2. **Two-Phase Transaction Mechanism**:
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:135-140` (Section 3.1.1):
     > 第一階段（預約凍結）：在單一 Firestore `runTransaction` 內，同時驗證 `User.karma >= 200` 且 `(Seed.packages - Seed.reservedPackages) >= requestedPackages`。驗證通過後，原子扣減會員 200 Karma，並立即將種子實體之 `reservedPackages += requestedPackages` 進行鎖定，並寫入 `/exchange_claims/{claimId}`（狀態為 `待審核`，賦予 72 小時過期時限 `expiresAt = now + 72h`）。
     > 第二階段（履約轉化或自動回滾）：保種幹部出庫時執行 `Seed.packages -= requestedPackages` 且 `Seed.reservedPackages -= requestedPackages`；取消/拒絕/逾期時執行補償交易返還 200 Karma 並扣減 `reservedPackages`。
3. **Cancellation Endpoint Specification**:
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:559-593` (Section 4.2.1.1):
     > 端點：`POST /api/v1/seeds/claim/{claimId}/cancel`
     > 邏輯：讀取 `/exchange_claims/{claimId}`，驗證 `status === '待審核'`（若已核准或已出貨則回傳 `409 Conflict: ERR_CLAIM_ALREADY_PROCESSED`）。在 `runTransaction` 內執行 `reservedPackages -= claim.requestedPackages`，`User.karma += claim.karmaDeducted`，並寫入 `karma_transactions`（`type: 'REFUND'`），狀態改為 `'已取消'` / `'cancelled'`。
4. **Cloud Firestore Rejection Trigger & 72h TTL Cron**:
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:595-602`: `onClaimRejected` 觸發器捕獲 `status` 躍遷至 `'已拒絕'`，自動執行補償交易退點與解鎖。
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:603-613`: `expirePendingClaimsJob` 由 Cloud Scheduler 每 15 分鐘（Cron: `*/15 * * * *`）定時觸發，查詢 `status === '待審核'` 且 `expiresAt <= now` 的單據執行批次回滾。
5. **Figure 2 Sequence Diagram**:
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:952`:
     `Note over CF,DB: 1. 解析 context.auth.uid (防止 IDOR)<br/>2. 檢核 X-Idempotency-Key (命中則回傳 200 快取)<br/>3. 伺服端計算需扣 Karma (200 點，防篡改)<br/>4. 檢核 User.karma >= 200 並扣減 -= 200<br/>5. 檢核 (Seed.packages - Seed.reservedPackages) >= 1<br/>6. 鎖定庫存：Seed.reservedPackages += 1<br/>7. 建立 exchange_claims (CLM-2026-0892, 待審核, pending_approval, expiresAt: +72h)`
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:966`:
     `Note over SB,DB: 1. Seed.packages -= 1 (實體庫存扣減)<br/>2. Seed.reservedPackages -= 1 (解除預約鎖定)<br/>3. Seed.quantityGrams -= 5, Storage.ST-01.occupiedGrams -= 5<br/>4. 新增 seed_movements (MOV-905, 出庫調撥, deltaPackages: -1)<br/>5. exchange_claims: status = '已出貨', statusCode = 'shipped', tracking = 'POST-TW-889922'`
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:977-994`: Clearly models Path B for cancellation, rejection, and 72h TTL expiration rollback.

---

### 1.3 Finding 2: Split-Brain Protocol & Physical Deficit Arbitration Audit
**Target Claim**: Absolute `newPackages` eliminated, purely differential `SeedMovement` enforced, and Physical Priority Dispute Resolution Policy defined.

**Direct Observations**:
1. **Elimination of Absolute Package Overwrites**:
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:302`:
     > `嚴禁覆寫實體絕對值：跨端同步時，系統徹底廢除傳輸 newPackages 絕對包數的作法。所有離線或線上的庫存異動，必須具象化為帶有時間戳記與設備簽名的 SeedMovement 增量單據（例如 deltaPackages: -3）。`
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:731-749`:
     In `POST /api/v1/sync/seeds`, the request body strictly contains `outgoingMovements` with relative deltas (`deltaPackages: -3`, `deltaGrams: -15`).
     Explicit confirmation note at Line 749:
     `*(註：已徹底移除 outgoingPackageUpdates 與 newPackages 絕對包數欄位，全量改以相對增減值 deltaPackages 傳輸。)*`
2. **Physical Priority Dispute Resolution Policy**:
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:812-865` (Section 4.2.4.1):
     - **Axiom 1**: 物理現實不可逆原則 (Axiom of Physical Reality Precedence): 種子已入農友之手，土地生長不容中斷；物理物權絕對優先，線下實體分發無條件確認生效。
     - **Deficit Formula**: $\text{Deficit} = \text{Seed.reservedPackages} - \text{Seed.packages}$.
     - **Preemption Rule**: LIFO (Last-In, First-Preempted) 依 `createdAt` 倒序篩選線上待審核訂單，讓位給現地農友。
     - **Dual Compensation Workflow**:
       1. 軌道一：100% 全額返還 200 Karma + 額外致贈 **+50 Bonus Karma** 道義補償金，扣除佔用之 `Seed.reservedPackages`，發送 LINE Flex Message。
       2. 軌道二：核發次世代優先採收兌換券 (Priority Restock Voucher)，F-Gen+1 入庫時優先保留配額。

---

### 1.4 Finding 3: IETF Idempotency Specification Audit
**Target Claim**: Mandatory `X-Idempotency-Key`, cached 200 OK replay behavior, and 409 restricted exclusively to in-flight requests.

**Direct Observations**:
1. **Mandatory Header**:
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:433`:
     `X-Idempotency-Key: <UUIDv4> (**REQUIRED (必填)**，遵循 IETF draft-ietf-httpapi-idempotency-key-header 規範)`
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:488`: Missing header immediately returns `400 Bad Request: ERR_MISSING_IDEMPOTENCY_KEY`.
2. **IETF Cached 200 OK Replay Behavior**:
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:456`: Response headers include `Idempotency-Replay: true` on cache hits.
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:490-493`:
     > 若傳入的 `request_hash` 與快取記錄完全一致：**伺服端直接回傳原 200 OK 快取回應內容**，並附加 `Idempotency-Replay: true` 標頭。**嚴禁回傳 409 Conflict**，嚴禁重複扣除 Karma 點數或增扣庫存！
3. **Conflict & Mismatch Semantics**:
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:494-495`:
     > 並行請求鎖定 (In-Flight Lock)：若該 Key 存在且狀態為 `in_progress`，回傳 `409 Conflict` (或 `425 Too Early`) 與 `Retry-After: 2` 標頭，錯誤代碼為 `ERR_IDEMPOTENCY_CONCURRENT_REQUEST`。
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:493`:
     > 若傳入的 `request_hash` 與快取記錄不一致：判定為等冪鍵遭重用於相異操作，立即拒絕並回傳 `422 Unprocessable Entity` (`ERR_IDEMPOTENCY_PAYLOAD_MISMATCH`)。

---

### 1.5 Finding 4: API Security & Status Harmonization Audit
**Target Claim**: Client `userId` and `karmaDeducted` removed, 422 status used for point shortage, dual status harmonized (`待審核` vs `pending_approval`), Firebase Auth Custom Claims enforced, RFC 7807 error envelope present.

**Direct Observations**:
1. **Removal of Client `userId` & `karmaDeducted`**:
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:435-453`:
     Request body of `POST /api/v1/seeds/claim` contains only `seedId`, `seedCode`, `requestedPackages`, `redeemType`, `voucherCode`, `fulfillmentMethod`, `shippingAddress`, `recipient`.
     Explicit security callout at Lines 450-453:
     - 移除 `userId`：身分全由 Firebase ID Token (`context.auth.uid`) 解析，防止 IDOR。
     - 移除 `karmaDeducted`：扣減點數由 Cloud Functions 依目錄價格於伺服端計算扣除，杜絕前端篡改。
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:356, 362`: Data mapping table explicitly documents server binding for `userId` and server calculation for `karmaDeducted`.
2. **Status Code Harmonization for Karma Shortage**:
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:420`: `422 Unprocessable Entity` mapped to `ERR_INSUFFICIENT_KARMA` (原 403 正名為 422).
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:520`: `422 Unprocessable Entity` returned for `ERR_INSUFFICIENT_KARMA` and `ERR_INSUFFICIENT_STOCK`.
3. **Dual Status Harmonization**:
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:476-477`:
     `"status": "待審核"`, `"statusCode": "pending_approval"`.
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:485`:
     > 雙狀態欄位設計：`status: "待審核"` 100% 相容 Seed-Bank React SPA `ClaimRequestsTable.tsx` 之 UI 判斷與按鈕渲染；`statusCode: "pending_approval"` 供 Shumei 與外部系統進行機器判讀。
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:498-509`: Complete 8-stage bi-directional status mapping table provided.
4. **Firebase Auth Custom Claims**:
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:618`:
     `Authorization: Bearer <Firebase_ID_Token> (權限要求: 呼叫者 Token 必須包含 Custom Claims seedBankLevel >= 3 或 admin: true。全面廢除前端 SPA 無法安全保密之 X-Shumei-Service-Key HMAC 密鑰)`
5. **RFC 7807 Error Envelope**:
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:379-406` (Section 4.2.0):
     Standard `ProblemDetails` TypeScript interface defined with `type`, `title`, `status`, `code`, `detail`, `instance`, `invalidParams`, `timestamp`.
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:408-424`: Standard Error Code Registry table mapping 13 standard error codes.

---

### 1.6 Finding 5: Codebase Reality Grounding Audit
**Target Claim**: Phase 0.5 migration included, DOM target `#tab-seeds` with client router, Seed-Bank Phase 1 ingestion clarified.

**Direct Observations**:
1. **Phase 0.5 Implementation Prerequisite**:
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:1077-1094` (Section 4.4.1):
     - `0.5.1 Shumei Karma 點數帳本雲端化 (Firestore Migration)`: Migrating `localStorage` (`shumei_user_karma`, `shumei_user_vouchers`) to Firestore `/users/{uid}/karma` and `/users/{uid}/karma_transactions/{txId}`.
     - `0.5.2 Shumei 志工 CRM 人才庫雲端化 (Volunteer Cloud Migration)`: Migrating in-memory array `volunteerList` to Firestore `/volunteers/{uid}` and `/certificates/{certId}`.
     - `0.5.3 基礎安全規則與複合索引佈署`: Setting up rules and composite indexes.
2. **DOM Target `#tab-seeds` & Client-Side Router**:
   - Verified against `shumei/public/farm/natural-farm.html:214`: `<section id="tab-seeds" class="tab-pane-content" style="display:none;">`.
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:225, 230-243`: Redirection target is explicitly `https://shumei-2025.web.app/farm/natural-farm.html?trace={shumeiCode}#tab-seeds`. Client-side router code provided for `natural-farm.js` using `URLSearchParams` to invoke `switchMainTab('seeds', seedsBtn)` and `renderSeedTrace(traceCode)`.
3. **Seed-Bank Phase 1 Ingestion Architecture**:
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:150-162` (Section 3.1.2.1) & Line 1105-1107 (Phase 1.4):
     Specifies that Seed-Bank Phase 1 avoids full WebSocket `onSnapshot` dependencies by using an authenticated lightweight REST endpoint (`GET /api/v1/seeds/claims?status=pending`) or `firebase/firestore/lite`, with an adapter in `ClaimRequestsTable.tsx` and a manual polling button.
4. **QR Code Engine Disambiguation**:
   - `docs/SHUMEI_SEED_BANK_COLLABORATION.md:179-183, 251-258`: Table 3.3.1.1 strictly delineates production printing to `Modal23852PrintLabel.tsx` using `qrcode.react` (`QRCodeSVG`) with ISO/IEC 18004 Reed-Solomon encoding, while declaring `src/utils/qrCodeSvg.ts` as strictly an offline survival bundle visual stub.

---

## 2. Logic Chain

```
[Observation 1.1: Empirical & Anti-Cheating Verification]
  ├── verify-collaboration-doc.js executes 136 tests -> 136 PASS, 0 FAIL.
  └── 0 occurrences of placeholder tokens (TODO, TBD, FIXME, etc.) -> genuine completion.
                            │
                            ▼
[Observation 1.2: Finding 1 Verified]
  ├── Seed model introduces reservedPackages; available stock = packages - reservedPackages.
  ├── POST /api/v1/seeds/claim atomically verifies stock and increments reservedPackages.
  ├── POST /api/v1/seeds/claim/{claimId}/cancel + onClaimRejected + expirePendingClaimsJob (72h TTL)
  │   guarantee zero lost points and zero permanent lockouts.
  └── Figure 2 reflects Step 3 reservation and Path A / Path B rollback flows.
                            │
                            ▼
[Observation 1.3: Finding 2 Verified]
  ├── outgoingPackageUpdates and newPackages absolute counts completely eliminated.
  ├── Outgoing inventory mutations restricted to differential SeedMovement (deltaPackages).
  └── Physical Priority Dispute Resolution Policy enforces physical reality precedence,
      LIFO preemption, and dual compensation (100% refund + 50 Karma bonus + next-gen voucher).
                            │
                            ▼
[Observation 1.4: Finding 3 Verified]
  ├── X-Idempotency-Key is mandatory (missing -> 400 Bad Request).
  ├── Replayed completed key returns cached 200 OK + Idempotency-Replay: true (no 409 error).
  └── 409 is strictly reserved for concurrent in-flight requests; 422 for payload mismatch.
                            │
                            ▼
[Observation 1.5: Finding 4 Verified]
  ├── Body userId & karmaDeducted stripped; server extracts auth.uid & calculates price.
  ├── Balance shortage returns 422 Unprocessable Entity (semantics corrected from 403).
  ├── Dual status (status: '待審核', statusCode: 'pending_approval') preserves Seed-Bank React SPA UI.
  ├── Insecure HMAC key replaced with Firebase Auth Custom Claims (seedBankLevel >= 3).
  └── RFC 7807 problem details error schema and registry table fully specified.
                            │
                            ▼
[Observation 1.6: Finding 5 Verified]
  ├── Phase 0.5 migration inserted for Shumei Karma and Volunteer CRM Firestore backends.
  ├── Redirection target aligned with existing DOM #tab-seeds (natural-farm.html:214).
  ├── Client-side router specified in natural-farm.js for ?trace={shumeiCode}#tab-seeds.
  ├── Seed-Bank Phase 1 lightweight REST polling ingestion decoupled from Phase 2 onSnapshot.
  └── qrcode.react (Reed-Solomon) separated from qrCodeSvg.ts disaster visual stub.
                            │
                            ▼
[Conclusion: APPROVE]
  └── All 5 Reviewer 2 findings are completely, genuinely, and rigorously addressed.
```

---

## 3. Caveats

1. **Static Specification Review Scope**: This adversarial audit examined the revised technical architecture specification (`docs/SHUMEI_SEED_BANK_COLLABORATION.md`), the automated test suite (`scripts/verify-collaboration-doc.js`), and their grounding in the source code files of `shumei` and `Seed-Bank`. It does not execute live Cloud Functions or deploy changes to the live Firebase staging project (`shumei-2025.web.app`), which will occur during Phase 0.5 through Phase 3 implementation.
2. **Reviewer Role Boundary**: As a reviewer and critic, this agent verified the work product without writing or modifying implementation code.

---

## 4. Conclusion

### Final Verdict: **APPROVE**

The revised document `/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md` has comprehensively resolved every architectural, concurrency, idempotency, security, and codebase discrepancy identified in Reviewer 2's previous findings. The solution design is structurally sound, resilient against distributed edge-case failures, fully grounded in the actual codebase layout, and ready to serve as the definitive blueprint for cross-project integration.

---

## 5. Verification Method

To independently reproduce and confirm the verification findings of this audit:

1. **Run Full Verification Harness**:
   ```bash
   node /Users/tsaisungen/Sites/shumei/scripts/verify-collaboration-doc.js
   ```
   *Expected Result*: 136 passed, 0 failed, exit code 0.

2. **Verify Anti-Cheating / Zero Placeholder Compliance**:
   ```bash
   node -e '
   const fs = require("fs");
   const content = fs.readFileSync("docs/SHUMEI_SEED_BANK_COLLABORATION.md", "utf8");
   const forbidden = ["TODO", "TBD", "FIXME", "Lorem", "placeholder", "待定", "待補"];
   forbidden.forEach(term => {
     const count = (content.match(new RegExp(term, "gi")) || []).length;
     console.log(`${term}: ${count}`);
     if (count > 0) process.exit(1);
   });
   console.log("All clean!");
   '
   ```

3. **Verify Ground-Truth Alignment with Existing Codebase**:
   - Confirm DOM ID `#tab-seeds` in Shumei:
     ```bash
     grep -n 'id="tab-seeds"' /Users/tsaisungen/Sites/shumei/public/farm/natural-farm.html
     ```
   - Confirm Seed-Bank Status Enum compatibility:
     ```bash
     grep -n "待審核" /Users/tsaisungen/Sites/Seed-Bank/src/types.ts
     grep -n "待審核" /Users/tsaisungen/Sites/Seed-Bank/src/components/legacy_shumei/ClaimRequestsTable.tsx
     ```
   - Confirm elimination of client `userId` and `karmaDeducted`:
     ```bash
     grep -n -C 5 "Request Body Schema (JSON)" /Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md
     ```
   - Confirm mandatory idempotency and replay behavior:
     ```bash
     grep -n -C 5 "Idempotency-Replay" /Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md
     ```
