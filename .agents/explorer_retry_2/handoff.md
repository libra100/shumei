# Handoff Report: Architectural Remediation for Finding 3 (IETF Idempotency) & Finding 4 (API Security, Status Harmonization, RFC 7807)

- **Author**: `explorer_retry_2` (Explorer, Architectural Analyst)
- **Target Audience**: `worker_m1` (Document Author & Implementer), Orchestrator (`parent`), Reviewers
- **Target Document**: `/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md` & `/Users/tsaisungen/Sites/shumei/PROJECT.md`
- **Date**: 2026-09-18
- **Handoff Type**: Hard (Task Complete)

---

## 1. Observation

Direct forensic inspection of `/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md`, `/Users/tsaisungen/Sites/shumei/PROJECT.md`, `/Users/tsaisungen/Sites/shumei/.agents/reviewer_2/handoff.md`, and the codebase repositories (`shumei` and `Seed-Bank`) revealed the following specific textual and architectural defects:

### 1.1 Observation 1: Idempotency Key Semantics Violation (Finding 3)
- In `docs/SHUMEI_SEED_BANK_COLLABORATION.md`:
  - **Line 316**: `X-Idempotency-Key: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d (選填，防止重複提交)`
  - **Line 364**: `- 409 Conflict: ERR_IDEMPOTENT_REPLAY（偵測到重複發送的等冪性單號）。`
- **Verbatim Defect**:
  1. `X-Idempotency-Key` is marked optional ("選填") on a state-mutating transaction endpoint (`POST /api/v1/seeds/claim`) that deducts user Karma points and locks biological inventory.
  2. Returning `409 Conflict` on a replayed key directly violates the IETF specification (`draft-ietf-httpapi-idempotency-key-header`). On spotty mobile networks (e.g. farmers/volunteers in agricultural fields), network drops during response transmission trigger client retries. Returning 409 displays an error to the user even though their Karma was already deducted and their order created.

### 1.2 Observation 2: Client-Side Price Tampering & IDOR Vulnerabilities (Finding 4.1, 4.2)
- In `docs/SHUMEI_SEED_BANK_COLLABORATION.md`:
  - **Lines 319–333**:
    ```json
    {
      "userId": "usr_c87a29f1",
      "seedId": "S-001",
      "seedCode": "SO-LY-S-TW01-2506-001",
      "requestedPackages": 1,
      "redeemType": "karma",
      "karmaDeducted": 200,
      ...
    }
    ```
  - **Line 297 (Table 4.1.3)**:
    `| **扣減 Karma 點數** | karmaDeducted | karmaDeducted | number | Shumei | 點數兌換時固定為 200 點 |`
- In `PROJECT.md` (Lines 66–79):
  `"userId": "string"`, `"karmaDeducted": "number"` are defined in the request payload.
- **Verbatim Defect**:
  1. **Price Tampering**: Allowing the client to send `"karmaDeducted": 200` enables any attacker to send `karmaDeducted: 0` or negative numbers, claiming seeds for free or fraudulently inflating their balance.
  2. **IDOR**: Passing `"userId"` in the body alongside `Authorization: Bearer <token>` allows an attacker with a valid token for User A to forge requests debiting User B's account.

### 1.3 Observation 3: Status Enum Collision with Seed-Bank Codebase (Finding 4.3)
- In `docs/SHUMEI_SEED_BANK_COLLABORATION.md`:
  - **Line 349**: `"status": "pending_approval"`
- In `Seed-Bank/src/types.ts`:
  - **Line 46**:
    `status: '待審核' | '已核准' | '已出貨' | '已送達' | '已結案';`
- In `Seed-Bank/src/components/legacy_shumei/ClaimRequestsTable.tsx`:
  - **Lines 80–115**:
    `claim.status === '待審核'` (renders blue "核准" button)  
    `claim.status === '已核准'` (renders green "出貨" button)  
    `claim.status === '已出貨'` (renders "運送中")  
    `claim.status === '已結案'` (renders closed badge)
- **Verbatim Defect**:
  Returning `"status": "pending_approval"` breaks Seed-Bank's TypeScript type check and causes the UI table to fail rendering approval buttons.

### 1.4 Observation 4: Insecure Shared Secret in Client SPA (Finding 4.4)
- In `docs/SHUMEI_SEED_BANK_COLLABORATION.md`:
  - **Line 369**: `- **認證要求**: 雙向 API Key 簽名驗證或內部 Service Token (X-Shumei-Service-Key: <HMAC_SECRET>)`
  - **Line 410**: `- 401 Unauthorized: 伺服器簽名無效。`
- **Codebase Reality**:
  `Seed-Bank` is a pure client-side React 19 SPA bundled by Vite. A frontend web app running in browser sandboxes cannot securely store HMAC secret keys; bundling them in JavaScript exposes them to extraction via DevTools.

### 1.5 Observation 5: Inappropriate HTTP Status Codes & Missing Error Envelopes (Finding 4.5, 4.6)
- In `docs/SHUMEI_SEED_BANK_COLLABORATION.md`:
  - **Line 362**: `- 403 Forbidden: ERR_INSUFFICIENT_KARMA（會員 Karma 餘額低於 200 點）。`
  - **Lines 305–523**: Across Section 4.2, there is zero standardized error envelope schema. Errors are listed only as informal bullet points.
- **Verbatim Defect**:
  1. Status `403 Forbidden` indicates authorization failure (lack of permission), not insufficient balance. Insufficient Karma is a semantic validation failure on an authenticated user, which RFC 9110 / RFC 4918 designates as `422 Unprocessable Entity`.
  2. Lack of RFC 7807 Problem Details leaves frontend error handling completely ad-hoc and brittle.

---

## 2. Logic Chain

The reasoning from observed defects to required architectural remediation follows an unbroken chain:

```
[Observation 1.1: Optional Idempotency Key & 409 on Replay]
  ──> 1. Clients on rural spotty networks retry upon timeout.
  ──> 2. Returning 409 Conflict treats successful prior claims as errors.
  ──> 3. Omitting the key entirely results in duplicate Karma deduction and double booking.
  ──> Remediate (Finding 3):
      - Make `X-Idempotency-Key: <UUIDv4>` mandatory (REQUIRED).
      - On identical replay (matching SHA256 body hash): Return cached original 200 OK + `Idempotency-Replay: true`.
      - On concurrent in-flight request: Return 409 Conflict / 425 Too Early.
      - On key reuse with different payload: Return 422 Unprocessable Entity.

[Observation 1.2: Client-Supplied userId and karmaDeducted]
  ──> 1. Client can manipulate `karmaDeducted` to 0 or negative values (Price Tampering).
  ──> 2. Client can supply another user's `userId` in request body (IDOR).
  ──> Remediate (Finding 4.1, 4.2):
      - Strip `karmaDeducted` and `userId` from request body entirely.
      - Server binds identity strictly from decoded `context.auth.uid`.
      - Server calculates deduction cost dynamically via `karmaPointsPerPackage * requestedPackages`.

[Observation 1.3: Status Enum Mismatch with Seed-Bank UI]
  ──> 1. Seed-Bank `LegacyClaimRequest.status` is strictly `'待審核' | '已核准' | '已出貨' | '已送達' | '已結案'`.
  ──> 2. Seed-Bank React components filter and render buttons using these exact Chinese strings.
  ──> 3. Returning `"status": "pending_approval"` causes TypeScript failure and broken UI.
  ──> Remediate (Finding 4.3):
      - Standardize response with dual status fields:
        `status: '待審核'` (Chinese, Seed-Bank UI native)
        `statusCode: 'pending_approval'` (English snake_case, API machine standard)
      - Provide an explicit bi-directional status mapping table.

[Observation 1.4: Client-Side SPA Shared HMAC Secret]
  ──> 1. Seed-Bank is a React 19 SPA running in user browsers.
  ──> 2. Hardcoding or storing `X-Shumei-Service-Key` in SPA bundles exposes root signing secrets.
  ──> Remediate (Finding 4.4):
      - Remove `X-Shumei-Service-Key` completely.
      - Seed-Bank stewards authenticate via Firebase Authentication.
      - Cloud Functions verify caller possesses Firebase Auth Custom Claims `seedBankLevel >= 3`.

[Observation 1.5: 403 Conflation & Missing RFC 7807 Envelope]
  ──> 1. 403 Forbidden implies lack of authorization, confusing balance shortage with permission denial.
  ──> 2. Missing structured error envelope prevents robust frontend error rendering.
  ──> Remediate (Finding 4.5, 4.6):
      - Use `422 Unprocessable Entity` for `ERR_INSUFFICIENT_KARMA` and `ERR_INSUFFICIENT_STOCK`.
      - Introduce Section 4.2.0 defining RFC 7807 `application/problem+json` standard envelope.
```

---

## 3. Caveats

1. **Scope Boundary**: This remediation plan covers the architectural, textual, and schema definitions for Finding 3 and Finding 4. Finding 1 and Finding 2 (Concurrency Reservation & Split-Brain Reconciliation) are handled by `explorer_retry_1`; Finding 5 (Codebase Ground-Truth & Phase 0.5) is handled by `explorer_retry_3`.
2. **Backward Compatibility**: To prevent breaking existing Seed-Bank React SPA code while simultaneously providing clean OpenAPI interfaces for Shumei Cloud Functions, the dual status strategy (`status` + `statusCode`) is adopted.
3. **Storage Overhead**: Maintaining idempotency keys in Firestore with a 24-hour TTL requires negligible storage (approx. 500 bytes per claim record) and should be configured with Firestore TTL policies on the `expiresAt` field.

---

## 4. Conclusion & Concrete Remediation Specifications

Below are the exact, verbatim text replacements, schema models, and JSON payloads to be integrated by `worker_m1` into `/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md` and `/Users/tsaisungen/Sites/shumei/PROJECT.md`.

---

### 4.1 Exact Text Replacements for `docs/SHUMEI_SEED_BANK_COLLABORATION.md`

#### (A) Update Section 4.1.3: Data Mapping Table (Lines 290–302)
Replace Table 4.1.3 with the following hardened schema:

```markdown
#### 4.1.3 索取兌換與流通交易模型映射表
| 領域維度 | Shumei 欄位 (`exchange_claims`) | Seed-Bank 欄位 (`LegacyClaimRequest`) | 資料型別 | 權威 (SSOT) | 轉換與同步規則 |
|---|---|---|---|---|---|
| **索取單號流水號** | `claimId` | `claimSeq` | `string` | 共享規則 | 格式 `CLM-2026-XXXX` |
| **申請人唯一識別碼** | `userId` | `applicantUid` | `string` | Shumei | 強制由伺服端 `context.auth.uid` 綁定，嚴禁前端傳入 |
| **關聯種子長編碼** | `seedCode` | `seedCode` | `string` | Seed-Bank | NamingRule 14~18 碼 |
| **索取分裝包數** | `requestedPackages` | `requestedPackages` | `number` | Shumei | 預設為 1 包 |
| **折算公克總重** | `totalGrams` | `totalGrams` | `number` | 共享規則 | `requestedPackages * 5` (g) |
| **兌換交易類型** | `redeemType` | `redeemType` | `string` | Shumei | `'karma'` (點數) / `'free'` (額度) / `'swap'` (以種換種) |
| **扣減 Karma 點數** | `karmaDeducted` | `karmaDeducted` | `number` | Shumei | **由伺服端動態計算並記錄（預設 200 點/包），嚴禁前端傳入以防價格篡改** |
| **扣點兌換憑證碼** | `voucherCode` | `voucherCode` | `string?` | Shumei | 格式 `SHUMEI-REWARD-XXXXXX`，伺服端核銷折扣 |
| **實體扣庫儲位** | `allocatedStorageId` | `storageLocationId` | `string` | Seed-Bank | 出庫時保種人選定（`ST-01` ~ `ST-04`） |
| **單據流通狀態 (中文)**| `status` | `status` | `enum` | 共享狀態 | Seed-Bank 原生列舉：`'待審核' → '已核准' → '已出貨' → '已送達' → '已結案'` |
| **單據流通狀態 (代碼)**| `statusCode` | `statusCode` | `enum` | 共享狀態 | API 標準列舉：`'pending_approval' → 'approved' → 'shipped' → 'delivered' → 'closed'` |
| **物流掛號單號** | `trackingNumber` | `trackingNumber` | `string?` | Seed-Bank | 出庫時配發中華郵政單號（`POST-TW-XXXXXX`） |
```

---

#### (B) Insert Section 4.2.0: RFC 7807 Structured Error Envelope Specification
Insert this new subsection immediately before Section 4.2.1:

```markdown
#### 4.2.0 RFC 7807 標準化錯誤回應規格 (Problem Details for HTTP APIs)

跨專案所有 RESTful 端點（`/api/v1/*`）之錯誤回應均嚴格遵循 RFC 7807 (`application/problem+json`) 規範，提供結構化、機器可讀且具備完整除錯上下文的錯誤信封 (Error Envelope)。

##### 標準錯誤信封資料結構 (TypeScript Definition)
```typescript
export interface ProblemDetails {
  /** 錯誤類型識別 URI，指向錯誤代碼定義手冊 */
  type: string;
  /** 簡短人類可讀之 HTTP 狀態說明 (如 'Unprocessable Entity') */
  title: string;
  /** HTTP 狀態碼 (如 400, 401, 403, 404, 409, 422, 500) */
  status: number;
  /** 系統定義之標準業務錯誤代碼 (如 'ERR_INSUFFICIENT_KARMA') */
  code: string;
  /** 針對此特定錯誤發生實例的詳細人類可讀說明 */
  detail: string;
  /** 指向本次錯誤發生端點與單次請求識別碼之 URI (便於 Cloud Logging / Sentry 溯源) */
  instance: string;
  /** 欄位級驗證錯誤清單 (選填，用於參數錯誤或餘額不足之詳細比對) */
  invalidParams?: Array<{
    name: string;
    reason: string;
  }>;
  /** 錯誤發生之 UTC 時間戳 (ISO 8601) */
  timestamp: string;
}
```

##### 跨系統標準業務錯誤代碼註冊表 (Standard Error Code Registry)
| HTTP 狀態碼 | 業務錯誤代碼 (`code`) | 觸發原因與語意 | 建議客戶端動作 |
|---|---|---|---|
| `400 Bad Request` | `ERR_MISSING_IDEMPOTENCY_KEY` | 缺少必填之 `X-Idempotency-Key` 請求標頭 | 生成 UUIDv4 後重新發送 |
| `400 Bad Request` | `ERR_INVALID_PAYLOAD` | 請求 JSON 語法錯誤或缺少必要欄位 | 依欄位校驗修正請求內容 |
| `401 Unauthorized` | `ERR_UNAUTHORIZED` | 缺少 Authorization 標頭或 Firebase Token 無效/過期 | 重新登入刷新 ID Token |
| `403 Forbidden` | `ERR_FORBIDDEN_INSUFFICIENT_LEVEL` | 呼叫者身分位階不足（需 Level 3 認證保種人以上） | 申請志工認證以晉升權限 |
| `403 Forbidden` | `ERR_ACCOUNT_SUSPENDED` | 會員帳號已遭管理員停權 | 聯繫 Shumei 平台客服 |
| `404 Not Found` | `ERR_SEED_NOT_FOUND` | 指定之種子 ID 不存在或已完全下架 | 重新整理品種列表 |
| `404 Not Found` | `ERR_USER_NOT_REGISTERED` | 查無指定 UID 之會員基本資料 | 先行完成 Shumei 前台註冊 |
| `409 Conflict` | `ERR_IDEMPOTENCY_CONCURRENT_REQUEST`| 相同等冪鍵請求正由伺服端並行處理中（In-flight） | 依 `Retry-After` 標頭間隔稍後重試 |
| `422 Unprocessable Entity` | `ERR_INSUFFICIENT_KARMA` | 會員 Karma 點數餘額不足（原 403 正名為 422） | 參與食育活動累積點數 |
| `422 Unprocessable Entity` | `ERR_INSUFFICIENT_STOCK` | 在庫可用包數不足（`packages - reservedPackages < req`） | 減少索取包數或等待補貨 |
| `422 Unprocessable Entity` | `ERR_IDEMPOTENCY_PAYLOAD_MISMATCH`| 重複使用等冪鍵但傳入相異之請求酬載 | 更換全新 UUIDv4 等冪鍵 |
| `500 Internal Server Error` | `ERR_TRANSACTION_FAILED` | Firestore 原子交易衝突或未捕捉之底層例外 | 採用指數退避演算法重試 |
```

---

#### (C) Overhaul Section 4.2.1: `POST /api/v1/seeds/claim` (Lines 310–366)
Replace lines 310–366 with this complete, hardened OpenAPI specification:

```markdown
#### 4.2.1 `POST /api/v1/seeds/claim`
- **功能說明**: Shumei 前台會員以 Karma 點數、免費額度或現場換種登記索取種子包。系統在單一 Firestore 原子交易內驗證點數、鎖定可用庫存配額並建立待審核索取單。本端點嚴格遵循 IETF HTTP Idempotency 規範與零信任 API 安全原則。
- **認證要求**: `Authorization: Bearer <Firebase_ID_Token>` (**強制綁定**: 伺服端嚴格由 `context.auth.uid` 提取會員識別碼，徹底杜絕 IDOR 越權風險)。
- **Request Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <Firebase_ID_Token>` (REQUIRED)
  - `X-Idempotency-Key: <UUIDv4>` (**REQUIRED (必填)**，遵循 IETF `draft-ietf-httpapi-idempotency-key-header` 規範，例如 `9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`)
- **Request Body Schema (JSON)**:
  ```json
  {
    "seedId": "S-001",
    "seedCode": "SO-LY-S-TW01-2506-001",
    "requestedPackages": 1,
    "redeemType": "karma",
    "voucherCode": "SHUMEI-REWARD-98A1B2",
    "fulfillmentMethod": "pickup",
    "shippingAddress": "台北市北投區大屯自然農場志工服務處",
    "recipient": {
      "name": "陳小明",
      "phone": "0912-345-678"
    }
  }
  ```
  > **⚠️ 安全強化說明**：
  > 1. **移除 `userId`**：客戶端禁止自選使用者身分，身分全由 Firebase ID Token 解析。
  > 2. **移除 `karmaDeducted`**：扣減點數嚴格由 Cloud Functions 依種庫品項目錄（`pointsPerPackage * requestedPackages`）於伺服端計算並直接扣除，徹底杜絕前端竄改兌換價格。

- **Response Headers**:
  - `Content-Type: application/json`
  - `Idempotency-Replay: true` *(僅在命中等冪性快取重播時回傳)*
  - `X-Cache-Lookup: HIT-IDEMPOTENT | MISS`

- **Response Schema (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "claimId": "CLM-2026-0892",
      "claimSeq": "CLM-2026-0892",
      "userId": "usr_c87a29f1",
      "seedCode": "SO-LY-S-TW01-2506-001",
      "cropName": "黑柿自然留種番茄",
      "packages": 1,
      "allocatedBatch": "2506-001",
      "storageLocationId": "ST-01",
      "karmaDeducted": 200,
      "karmaRemaining": 180,
      "status": "待審核",
      "statusCode": "pending_approval",
      "labelReady": true,
      "createdAt": "2026-09-18T02:15:30Z"
    },
    "message": "索取單建立成功，已自會員帳戶扣除 200 Karma 點數，等待種庫幹部核准出貨。"
  }
  ```
  > **雙狀態欄位設計**：`status: "待審核"` 100% 相容 Seed-Bank React SPA `ClaimRequestsTable.tsx` 之 UI 判斷與按鈕渲染；`statusCode: "pending_approval"` 供 Shumei 與外部系統進行機器判讀。

- **IETF 等冪性與重播處理語意 (Idempotency Semantics)**:
  1. **強制標頭檢驗**: 若請求缺少 `X-Idempotency-Key`，立即拒絕並回傳 `400 Bad Request` (`ERR_MISSING_IDEMPOTENCY_KEY`)。
  2. **正規化酬載雜湊**: 伺服端將 Request Body 進行 JSON 鍵排序序列化後計算 `SHA-256` 雜湊 (`request_hash`)，記錄於 `idempotency_keys/{auth.uid}_{key}`。
  3. **IETF 標準重播機制 (Replay)**:
     - 若該 Key 在 24 小時內已存在且狀態為 `completed`：
     - 若傳入的 `request_hash` 與快取記錄完全一致：**伺服端直接回傳原 200 OK 快取回應內容**，並附加 `Idempotency-Replay: true` 標頭。**嚴禁回傳 409 Conflict**，嚴禁重複扣除 Karma 點數或增扣庫存！
     - 若傳入的 `request_hash` 與快取記錄不一致：判定為等冪鍵遭重用於相異操作，立即拒絕並回傳 `422 Unprocessable Entity` (`ERR_IDEMPOTENCY_PAYLOAD_MISMATCH`)。
  4. **並行請求鎖定 (In-Flight Lock)**:
     - 若該 Key 存在且狀態為 `in_progress`（另一筆相同 Key 之請求正在執行交易），伺服端回傳 `409 Conflict` (或 `425 Too Early`) 與 `Retry-After: 2` 標頭，錯誤代碼為 `ERR_IDEMPOTENCY_CONCURRENT_REQUEST`。
  5. **生命週期 (TTL)**: 等冪紀錄設定 24 小時（86,400 秒）TTL，過期自動由 Firestore 淘汰。

- **HTTP 狀態碼與錯誤處理 (遵循 RFC 7807)**:
  - `200 OK`: 索取單建立成功，或等冪鍵快取重播成功。
  - `400 Bad Request`:
    - `ERR_MISSING_IDEMPOTENCY_KEY`: 未提供必填之 `X-Idempotency-Key`。
    - `ERR_INVALID_PAYLOAD`: 參數格式無效（如 requestedPackages <= 0）。
  - `401 Unauthorized`: 未攜帶 Token 或 Token 驗證失敗 (`ERR_UNAUTHORIZED`)。
  - `403 Forbidden`: `ERR_ACCOUNT_SUSPENDED`（會員帳號遭停權，禁止兌換）。
  - `404 Not Found`: `ERR_SEED_NOT_FOUND`（查無此種子品項或已下架）。
  - `409 Conflict`: `ERR_IDEMPOTENCY_CONCURRENT_REQUEST`（相同等冪鍵正由伺服器並行處理中）。
  - `422 Unprocessable Entity`:
    - `ERR_INSUFFICIENT_KARMA`：會員 Karma 餘額不足（原 403 正名為 422 語意錯誤）。
    - `ERR_INSUFFICIENT_STOCK`：在庫可用分裝包數不足（`packages - reservedPackages < requestedPackages`）。
    - `ERR_IDEMPOTENCY_PAYLOAD_MISMATCH`：等冪鍵遭重用於不同之請求內容。
  - `500 Internal Server Error`: `ERR_TRANSACTION_FAILED`（Firestore 交易併發衝突回滾）。
```

---

#### (D) Update Section 4.2.2: `POST /api/v1/members/verify-qualification` (Lines 367–413)
Replace authentication and error handling with Firebase Auth Custom Claims:

```markdown
#### 4.2.2 `POST /api/v1/members/verify-qualification`
- **功能說明**: Seed-Bank 管理介面調用此端點，驗證指定會員在 Shumei 志工體系的時數與證書，動態授予對應之 4 級 RBAC 位階。
- **認證要求**: `Authorization: Bearer <Firebase_ID_Token>` (**權限要求**: 呼叫者 Token 必須包含 Custom Claims `seedBankLevel >= 3` 或 `admin: true`。**全面廢除前端 SPA 無法安全保密之 `X-Shumei-Service-Key` HMAC 密鑰**)。
- **Request Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <Firebase_ID_Token>` (REQUIRED)
- **Request Body Schema (JSON)**:
  ```json
  {
    "uid": "usr_c87a29f1",
    "email": "volunteer.shumei@gmail.com"
  }
  ```
- **Response Schema (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "uid": "usr_c87a29f1",
      "email": "volunteer.shumei@gmail.com",
      "name": "林健國",
      "volunteerHours": 136.5,
      "volunteerStage": "活躍奉仕",
      "certificateId": "SHUMEI-VOL-2026-88F4",
      "certificateIssuedAt": "2026-08-15T10:00:00Z",
      "grantedSeedBankLevel": 3,
      "grantedRole": "saver",
      "permissions": [
        "view_seeds",
        "claim_seeds",
        "write_forum",
        "provide_seeds",
        "scan_qr_check",
        "edit_packages",
        "approve_claims",
        "print_labels",
        "manage_storage",
        "approve_transfer"
      ]
    },
    "message": "會員資歷檢核通過，已依 136.5 小時奉仕授權為 Level 3 認證保種人。"
  }
  ```
- **HTTP 狀態碼與錯誤處理 (遵循 RFC 7807)**:
  - `200 OK`: 成功回傳資格與授權資訊。
  - `400 Bad Request`: `ERR_INVALID_PAYLOAD`（缺少 `uid` 欄位）。
  - `401 Unauthorized`: `ERR_UNAUTHORIZED`（Token 無效或過期）。
  - `403 Forbidden`: `ERR_FORBIDDEN_INSUFFICIENT_LEVEL`（操作者之 Firebase Auth Claim 未達 `seedBankLevel >= 3`，無權調閱志工 CRM 資格）。
  - `404 Not Found`: `ERR_USER_NOT_REGISTERED`（該 UID 尚未註冊 Shumei，預設回傳 Level 1 權限）。
  - `500 Internal Server Error`: `ERR_INTERNAL_SERVER_ERROR`。
```

---

#### (E) Bi-Directional Status Mapping Table (Insert into Section 4.2.1)
```markdown
##### 種庫索取單生命週期狀態雙向映射表 (Bi-directional Status Mapping Table)
| 種庫前端狀態 (`status`) | API / 系統代碼 (`statusCode`) | 業務生命週期與觸發點 | 允許操作角色與動作 |
|---|---|---|---|
| `待審核` | `pending_approval` | Shumei 會員提交兌換，Karma 已扣除，庫存配額已鎖定 (`reservedPackages += 1`) | 種庫 Level 3 幹部審查 |
| `已核准` | `approved` | 幹部點擊「核准」，指定實體儲位與批號，產生熱感標籤列印佇列 | 種庫 Level 3 幹部出庫備貨 |
| `已出貨` | `shipped` | 幹部點擊「出貨」，扣除實體庫存 (`packages -= 1`)，填寫掛號單號並寄出 | 實體交付 / 郵寄包裹 |
| `已送達` | `delivered` | 會員臨櫃簽收或郵政掛號簽收確認妥投 | 會員回報 / 系統更新 |
| `已結案` | `closed` | 會員完成回報發芽率或食育 UGC 發表，系統核發回饋 Karma 點數 | 系統自動結案 |
```

---

#### (F) Update Section 4.3.2 Figure 2 Sequence Diagram (Lines 605–610)
In Figure 2, update the sequence steps to accurately reflect the zero-trust token binding, mandatory idempotency key, server-side pricing, and status enum:

```mermaid
    User->>Front: 瀏覽「節氣食育與純淨風味」頁面
    User->>Front: 點擊「以 200 Karma 兌換自家採種番茄種子包」
    Front->>CF: POST /api/v1/seeds/claim (Bearer Token, X-Idempotency-Key, seedId, packages=1)
    activate CF
    CF->>DB: 執行 runTransaction (原子交易)
    Note over CF,DB: 1. 解析 context.auth.uid (防止 IDOR)<br/>2. 檢核 X-Idempotency-Key (命中則回傳 200 快取)<br/>3. 伺服端計算需扣 Karma (200 點，防篡改)<br/>4. 檢核 User.karma >= 200 並扣減 -= 200<br/>5. 檢核可用包數並鎖定 (reservedPackages += 1)<br/>6. 建立 exchange_claims (CLM-2026-0892, status: '待審核', statusCode: 'pending_approval')
    DB-->>CF: 交易確認成功 (Commit)
    CF-->>Front: 回傳 200 OK (單號 CLM-2026-0892, status: '待審核', 餘額 180 Karma)
    deactivate CF
    Front-->>User: 彈窗提示：「🎉 兌換成功！已為您排入種子庫出庫備貨」
```

---

### 4.2 Exact Text Replacements for `PROJECT.md`

In `/Users/tsaisungen/Sites/shumei/PROJECT.md`, update lines 63–90 to reflect the hardened API contract:

```markdown
### Shumei (Karma/Claim) ↔ Seed-Bank (Inventory/Fulfillment)
- Endpoint: `POST /api/v1/seeds/claim`
- Request Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <Firebase_ID_Token>` (REQUIRED, binds userId strictly to context.auth.uid)
  - `X-Idempotency-Key: <UUIDv4>` (REQUIRED, enforces IETF replay semantics)
- Request Payload:
  ```json
  {
    "seedId": "string",
    "seedCode": "string (NamingRule)",
    "requestedPackages": "number",
    "redeemType": "karma | free | exchange",
    "voucherCode": "string?",
    "fulfillmentMethod": "pickup | post",
    "shippingAddress": "string?",
    "recipient": {
      "name": "string",
      "phone": "string"
    }
  }
  ```
  *(Note: `userId` and `karmaDeducted` removed from request body to prevent IDOR and price tampering)*
- Response Payload (200 OK):
  ```json
  {
    "success": true,
    "claimSeq": "string",
    "storageLocationId": "string",
    "allocatedBatch": "string",
    "karmaDeducted": "number",
    "karmaRemaining": "number",
    "labelReady": true,
    "status": "待審核",
    "statusCode": "pending_approval"
  }
  ```

### Shumei (Volunteer CRM) ↔ Seed-Bank (RBAC Access Control)
- Endpoint: `POST /api/v1/members/verify-qualification`
- Request Headers:
  - `Authorization: Bearer <Firebase_ID_Token>` (REQUIRED, requires custom claim `seedBankLevel >= 3`)
- Request Payload:
  ```json
  {
    "uid": "string",
    "email": "string"
  }
  ```
- Response:
  ```json
  {
    "uid": "string",
    "volunteerHours": "number",
    "volunteerStage": "新申請 | 面談評估 | 已認證 | 活躍奉仕",
    "certificateId": "string?",
    "grantedSeedBankLevel": 1 | 2 | 3 | 4,
    "grantedRole": "consumer | grower | saver | admin"
  }
  ```
```

---

## 5. Verification Method

To independently verify these specifications against the codebases and standards:

1. **Verify Seed-Bank Status Enum Compatibility**:
   ```bash
   grep -n "status:" /Users/tsaisungen/Sites/Seed-Bank/src/types.ts
   grep -n "claim.status ===" /Users/tsaisungen/Sites/Seed-Bank/src/components/legacy_shumei/ClaimRequestsTable.tsx
   ```
   *Expected*: Line 46 in `types.ts` has `'待審核' | '已核准' | '已出貨' | '已送達' | '已結案'`. The dual field `status: '待審核'` guarantees TypeScript compilation and button rendering.

2. **Verify Client SPA Architecture (Absence of Node.js Server for Secrets)**:
   ```bash
   cat /Users/tsaisungen/Sites/Seed-Bank/package.json | grep -E "express|dotenv|vite"
   ```
   *Expected*: Seed-Bank is a pure Vite React SPA, validating the replacement of `X-Shumei-Service-Key` with Firebase Auth ID Token.

3. **Verify Removal of `karmaDeducted` and `userId`**:
   Compare the revised JSON schema with lines 319–333 of `docs/SHUMEI_SEED_BANK_COLLABORATION.md`. Both fields are absent from request payload.

4. **Verify IETF Idempotency & RFC 7807 Error Codes**:
   Ensure `X-Idempotency-Key` is marked `REQUIRED`, replay returns `200 OK` (with `Idempotency-Replay: true`), payload mismatch returns `422 Unprocessable Entity` (`ERR_IDEMPOTENCY_PAYLOAD_MISMATCH`), and concurrent requests return `409 Conflict` (`ERR_IDEMPOTENCY_CONCURRENT_REQUEST`).
