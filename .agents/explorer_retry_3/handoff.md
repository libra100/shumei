# Handoff Report: Architectural & Text Remediation for Finding 5 (Codebase Ground-Truth Disconnects)

- **Agent**: `explorer_retry_3`
- **Role**: Explorer / Investigator & Synthesizer
- **Working Directory**: `/Users/tsaisungen/Sites/shumei/.agents/explorer_retry_3`
- **Target Deliverable**: Complete architectural and verbatim text remediation for Finding 5 in `/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md`
- **Date**: 2026-09-18
- **Status**: COMPLETE

---

## 1. Observation

Direct forensic inspection of the codebase across `/Users/tsaisungen/Sites/shumei/` and `/Users/tsaisungen/Sites/Seed-Bank/` established the following verified observations:

### 1.1 Shumei Karma Ledger is Pure Client-Side `localStorage`
- **File**: `/Users/tsaisungen/Sites/shumei/public/js/natural-farm.js`
- **Line 137**:
  ```javascript
  let userKarma = parseInt(localStorage.getItem('shumei_user_karma') || '380', 10);
  ```
- **Lines 536–538**:
  ```javascript
  userKarma -= cost;
  localStorage.setItem('shumei_user_karma', userKarma.toString());
  updateKarmaDisplay();
  ```
- **Line 139**:
  ```javascript
  let userVouchers = JSON.parse(localStorage.getItem('shumei_user_vouchers') || '[]');
  ```
- **Finding**: There is no Firestore collection or document `/users/{uid}/karma`. Karma points, vouchers, and transactions are stored entirely in the browser's `window.localStorage`. Consequently, the proposed Cloud Function `POST /api/v1/seeds/claim` has no server-side ledger to query or atomically deduct within Firestore transactions.

### 1.2 Shumei Volunteer CRM is an In-Memory Mock Array
- **File**: `/Users/tsaisungen/Sites/shumei/public/js/natural-farm-admin.js`
- **Lines 92–98**:
  ```javascript
  let volunteerList = [
    { id: 'v1', name: '陳美玲', phone: '0911-222-333', stage: '新申請', skills: '攝影紀錄、外語翻譯', note: '可支援假日市集', hours: 0 },
    { id: 'v2', name: '李冠宇', phone: '0922-333-444', stage: '新申請', skills: '農事好手 (割草機經驗)', note: '可支援水稻田區', hours: 0 },
    { id: 'v3', name: '趙子瑄', phone: '0933-444-555', stage: '面談評估', skills: '廚藝研發、無菜單料理', note: '光之餐桌主廚助理', hours: 12 },
    { id: 'v4', name: '郭俊傑', phone: '0955-666-777', stage: '已認證', skills: '現場交管、活動策劃', note: '市集機動組長', hours: 36 },
    { id: 'v5', name: '許雅琪', phone: '0977-888-999', stage: '活躍奉仕', skills: '自家採種師、食育講師', note: '資深活動核心幹部', hours: 120 }
  ];
  ```
- **Lines 672–680**:
  ```javascript
  function generateVolunteerCert(name, hours) {
    document.getElementById('certVolunteerName').innerText = name;
    document.getElementById('certVolunteerHours').innerText = hours;
    document.getElementById('certSerialCode').innerText = `SHUMEI-VOL-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    document.getElementById('certIssueDate').innerText = `${new Date().getFullYear()} 年 ${new Date().getMonth() + 1} 月 ${new Date().getDate()} 日`;

    const modal = new bootstrap.Modal(document.getElementById('volunteerCertModal'));
    modal.show();
  }
  ```
- **Finding**: Volunteer profiles, hour counters, stage progressions, and certificates exist solely in client memory and ephemeral DOM innerText. The blueprint's claim in Section 3.2.3 and 4.4.1 (Task 2.2) that a Cloud Function trigger (`onVolunteerUpdated`) listens to Firestore hour milestones is impossible without first migrating volunteer data to a persistent Firestore collection (`/volunteers/{uid}`).

### 1.3 Target DOM ID Mismatch & Missing Client-Side Router
- **In Document**: `/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md`
  - Line 198: `https://shumei-2025.web.app/farm/natural-farm.html?trace=SO-LY-S-TW01-2506-001#grain-memory`
  - Line 465: `- 302 Found: 瀏覽器一般造訪時，自動導向 https://shumei-2025.web.app/farm/natural-farm.html?trace=SO-LY-S-TW01-2506-001#grain-memory。`
  - Line 653: `Cam->>FarmPage: 開啟 natural-farm.html?trace=SO-LY-S-TW01-2506-001#grain-memory`
- **In Codebase**: `/Users/tsaisungen/Sites/shumei/public/farm/natural-farm.html`
  - Line 133–135:
    ```html
    <button class="filter-chip interactive" onclick="switchMainTab('seeds', this)">
      <i class="fa-solid fa-dna"></i> 粒籽記憶庫與水稻認養
    </button>
    ```
  - Line 214:
    ```html
    <section id="tab-seeds" class="tab-pane-content" style="display:none;">
    ```
  - Line 219:
    ```html
    <h3 class="h4 fw-bold text-white mb-1">粒籽記憶庫 (Seed DNA Traceability)</h3>
    ```
- **In Script**: `/Users/tsaisungen/Sites/shumei/public/js/natural-farm.js`
  - Lines 143–151:
    ```javascript
    document.addEventListener('DOMContentLoaded', () => {
      updateKarmaDisplay();
      updateMyBookingsBadge();
      renderVouchersList();
      renderEvents();
      renderFeedPosts();
      renderReviews();
      fetchFirestoreData();
    });
    ```
  - Lines 202–215:
    ```javascript
    function switchMainTab(tabName, btnElement) {
      document.querySelectorAll('.tab-pane-content').forEach(pane => {
        pane.style.display = 'none';
      });
      const targetPane = document.getElementById(`tab-${tabName}`);
      if (targetPane) {
        targetPane.style.display = 'block';
      }
      if (btnElement) {
        document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
        btnElement.classList.add('active');
      }
    }
    ```
- **Finding**:
  1. Neither `#grain-memory` nor `#dna-bank` exists in `natural-farm.html`. The actual DOM container ID is `#tab-seeds`.
  2. `natural-farm.js` contains zero URL query parameter parsing (`?trace=`) or hash routing on initialization. Scanning the QR code lands the user on Tab 1 (`tab-events`), leaving Tab 3 (`tab-seeds`) hidden (`style="display:none;"`). No trace rendering function (`renderSeedTrace`) exists.

### 1.4 Seed-Bank Phase 1 Claims Dependency Disconnect
- **File**: `/Users/tsaisungen/Sites/Seed-Bank/package.json`
  - Lines 13–26: `dependencies` list includes `@google/genai`, `@tailwindcss/vite`, `@vitejs/plugin-react`, `@yudiel/react-qr-scanner`, `dotenv`, `express`, `lucide-react`, `motion`, `qrcode.react`, `react`, `react-dom`, `vite`. **`firebase` is NOT installed.**
- **File**: `/Users/tsaisungen/Sites/Seed-Bank/src/App.tsx`:
  - Storage is entirely offline / `localStorage` (`OFFGRID_*`).
- **In Document**: Section 4.4.1 (Lines 721, 728):
  - Line 721 (Phase 1.4): `● 1.4 Seed-Bank 索取清單 (ClaimRequestsTable) 增加即時 Karma 標記與過濾視圖。`
  - Line 728 (Phase 2.1): `● 2.1 Seed-Bank 狀態全面對接 Firestore：以 onSnapshot 取代純 LocalStorage，實現跨設備即時共筆。`
- **Finding**: Phase 1 promises real-time Karma claim markers and filtering in `ClaimRequestsTable`, yet Seed-Bank does not integrate Firestore until Phase 2. The document fails to explain how Seed-Bank ingests Shumei claims during Phase 1 without a full Firestore architectural migration.

### 1.5 Seed-Bank QR Code Engines: Production React Component vs. Offline Mock Matrix
- **File**: `/Users/tsaisungen/Sites/Seed-Bank/package.json`
  - Line 22: `"qrcode.react": "^4.2.0"` is already installed.
- **File**: `/Users/tsaisungen/Sites/Seed-Bank/src/components/legacy_shumei/modals/Modal23852PrintLabel.tsx`
  - Lines 106–111:
    ```tsx
    <QRCodeSVG
      value={shumeiCode}
      size={92}
      level="M"
      includeMargin={false}
    />
    ```
- **File**: `/Users/tsaisungen/Sites/Seed-Bank/src/utils/qrCodeSvg.ts`
  - Lines 17–53:
    ```typescript
    export function generateQrCodeSvgString(text: string, size = 120): string {
      // 建立基於字串雜湊的確定性 21x21 QR 規格仿生矩陣
      ...
      matrix[r][c] = ((charCode + r * 7 + c * 13 + hash) % 3) === 0 || ((r + c) % 2 === 0 && (charCode % 2 === 0));
      ...
    }
    ```
- **Finding**:
  1. `Modal23852PrintLabel.tsx` already uses `QRCodeSVG` from `qrcode.react` (a real Reed-Solomon QR encoder), BUT its `value` prop currently passes the raw string `shumeiCode` (e.g. `SO-LY-S-TW01-2506-001`) rather than the target web URL `https://shumei-2025.web.app/trace/{shumeiCode}`. Standard smartphone cameras scanning this will display raw text rather than launching the web browser.
  2. `qrCodeSvg.ts` (`generateQrCodeSvgString`) is a pseudo-random hash generator without Reed-Solomon error correction. It cannot be scanned by optical barcode scanners. It was written as a zero-dependency placeholder for standalone offline bundle exports, but must NOT be used for physical thermal printing.

---

## 2. Logic Chain

```
[Observation 1.1: Shumei Karma is in localStorage]
  ├── Cloud Function POST /api/v1/seeds/claim requires server-side atomic points deduction.
  ├── Because Karma is only in browser localStorage, server-side transaction fails (balance not found).
  └── Conclusion: Roadmap must insert Phase 0.5 to migrate Karma ledger to Firestore /users/{uid}/karma
      with /karma_transactions audit subcollection.

[Observation 1.2: Volunteer CRM is in-memory mock]
  ├── Section 3.2.3 and Phase 2.2 specify Cloud Function onVolunteerUpdated (120h -> Level 3).
  ├── volunteerList is an in-memory JS array; generateVolunteerCert creates ephemeral DOM strings.
  └── Conclusion: Phase 0.5 must migrate Volunteer CRM to Firestore /volunteers/{uid} and
      /certificates/{certId} before trigger functions can be deployed.

[Observation 1.3: Target DOM ID Mismatch & Missing Client Router]
  ├── Blueprint specifies redirect to natural-farm.html?trace={shumeiCode}#grain-memory.
  ├── natural-farm.html uses id="tab-seeds"; #grain-memory does not exist.
  ├── natural-farm.js does not parse window.location.search or window.location.hash on load.
  └── Conclusion: Redirect target must be changed to #tab-seeds; Section 3.3.1 and Phase 1.2 must
      specify adding URL query/hash parsing to natural-farm.js to trigger switchMainTab('seeds')
      and renderSeedTrace(shumeiCode).

[Observation 1.4: Seed-Bank has no Firebase SDK in Phase 1]
  ├── Phase 1.4 promises Karma claim markers in ClaimRequestsTable; Phase 2.1 introduces Firestore.
  ├── Without an ingestion bridge, Phase 1 ClaimRequestsTable cannot access cloud claims.
  └── Conclusion: Clarify that Phase 1 uses a lightweight authenticated REST polling hook
      (GET /api/v1/seeds/claims) or Firebase Firestore Lite read client before Phase 2 real-time sync.

[Observation 1.5: QR Code Value & Generator Roles]
  ├── Modal23852PrintLabel uses QRCodeSVG (qrcode.react) but encodes raw shumeiCode instead of URL.
  ├── qrCodeSvg.ts generates a fake pseudo-random matrix that cannot be decoded by scanners.
  └── Conclusion: Update specification so Modal23852PrintLabel encodes the full URL
      https://shumei-2025.web.app/trace/${shumeiCode}; clearly define qrCodeSvg.ts as strictly
      an offline survival bundle visual stub to be upgraded in Phase 3.
```

---

## 3. Caveats

1. **Read-Only Scope**: In compliance with Explorer role constraints, this report analyzes the codebase and formulates the exact architectural and textual fixes. It does not directly write to `SHUMEI_SEED_BANK_COLLABORATION.md` or implementation files.
2. **Cloud Functions Deployment**: While Firebase project credentials (`shumei-2025`) exist in `natural-farm.js`, live Cloud Functions endpoints were not invoked directly. All API contracts and schemas are derived from codebase analysis and existing project architecture.
3. **Seed-Bank Dependency Policy**: Seed-Bank currently adheres to an offline-first, zero-runtime-server philosophy. Introducing full Firestore in Phase 1 would jeopardize this architecture; hence, a lightweight REST polling or modular Firestore Lite read client is the recommended pragmatic bridge for Phase 1.

---

## 4. Conclusion: Actionable Remediation Plan & Exact Text Replacements

The following sections provide the **verbatim, ready-to-apply text replacements and section updates** for `/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md`.

---

### Remediation Item 1: Roadmap Phase 0.5 Prerequisites in Section 4.4.1

#### Target File:
`/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md`
**Location**: Section 4.4.1 (Lines 711–724)

#### Replacement Content:
Replace Section 4.4.1 roadmap ASCII block with:

```markdown
#### 4.4.1 四階段推進時程規劃 (含前置基建整備)

```
====================================================================================================
[階段 0.5：前置基建整備與核心資料雲端化] (Phase 0.5: 0~1 個月 / 實施前置必備條件)
目標：消除單機雛型依賴，建立 Shumei 雲端點數帳本與志工 CRM 真理源，為跨系統對接奠定地基
----------------------------------------------------------------------------------------------------
  ● 0.5.1 Shumei Karma 點數帳本雲端化 (Firestore Migration)：
    - 將 public/js/natural-farm.js 原先儲存於前端瀏覽器 localStorage（shumei_user_karma、shumei_user_vouchers）之資料全面遷移至 Cloud Firestore。
    - 建立用戶點數主文檔 /users/{uid}/karma，定義規格：{ balance: number, updatedAt: Timestamp }。
    - 建立不可變稽核流水帳子集合 /users/{uid}/karma_transactions/{txId}，記錄每次點數變動：{ txId, amount, type: 'EARN'|'REDEEM'|'REFUND', reason, referenceId, createdAt, balanceAfter }。
    - 更新 natural-farm.js 前台邏輯，以 Firestore SDK 及 Cloud Functions 取代本機 localStorage 讀寫。
  ● 0.5.2 Shumei 志工 CRM 人才庫雲端化 (Volunteer Cloud Migration)：
    - 將 public/js/natural-farm-admin.js 內之靜態 JavaScript 陣列 volunteerList 遷移至 Cloud Firestore /volunteers/{uid} 集合。
    - 建立正式志工結構化欄位：{ uid, name, phone, stage: '新申請'|'面談評估'|'已認證'|'活躍奉仕', skills, note, hours: number, certId: string|null, certIssuedAt: Timestamp|null, updatedAt: Timestamp }。
    - 升級 generateVolunteerCert 邏輯，將產製之榮譽證書持久化存入 /certificates/{certId}，並自動寫入對應志工文檔，提供 Phase 2 志工 120h 自動晉升觸發器 (onVolunteerUpdated) 實體資料源。
  ● 0.5.3 基礎安全規則與複合索引佈署 (Security Rules & Indexes)：
    - 佈署 Firestore Security Rules：嚴格限制 /users/{uid}/karma 僅本人可讀、寫入僅限 Cloud Functions Admin SDK 執行原子扣減；限制 /volunteers/{uid} 僅供本人及授權幹部存取。
  ● 交付成果：完成 Karma 帳本與志工 CRM 雲端化，確保 POST /api/v1/seeds/claim 具備可交易之伺服器真理源。

====================================================================================================
[階段一：輕量連結與憑證互通] (Phase 1: 0~3 個月)
目標：零破壞性整合，打通 QR Code 導流與基礎 Karma 索取憑證
----------------------------------------------------------------------------------------------------
  ● 1.1 統整 Firebase 專案設定：正式宣告 shumei-2025 統一託管配置與共用 Auth 身分識別。
  ● 1.2 升級 100x60mm 標籤 QR Code 協定與 Shumei 前台路由承接：
    - Seed-Bank Modal23852PrintLabel.tsx 採用 qrcode.react (QRCodeSVG) 生成指向完整動態 URL https://shumei-2025.web.app/trace/{shumeiCode} 之正統光學 QR Code (糾錯 Level M)。
    - 修正重定向導向錨點為 #tab-seeds (對齊 natural-farm.html:214 <section id="tab-seeds">)。
    - 於 public/js/natural-farm.js 實作 URL 查詢參數與 Hash 路由解析 (?trace={shumeiCode}#tab-seeds)，頁面加載時自動喚起 switchMainTab('seeds') 並調用 renderSeedTrace(shumeiCode) 動態定位並渲染批次生長縮時與農友手記。
  ● 1.3 實作 Cloud Function 基礎 Karma 兌換端點：POST /api/v1/seeds/claim (含 Phase 0.5 雲端點數校驗與扣減)。
  ● 1.4 Seed-Bank 索取清單 (ClaimRequestsTable) 輕量化接入 Shumei 兌換單：
    - 採用輕量化 REST Polling 或 Firebase Firestore Lite 讀取端點 (GET /api/v1/seeds/claims?status=pending)，於 ClaimRequestsTable 渲染 [Shumei Karma 兌換] 專屬標籤，提供「手動刷新雲端索取單」按鈕，供管理員審核出庫。
  ● 交付成果：完成實體標籤手機掃描直達 Shumei 粒籽記憶庫；Shumei 兌換單手動轉為 Seed-Bank 出庫單。

====================================================================================================
[階段二：雙向自動化串接與庫存連動] (Phase 2: 3~6 個月)
...
```

---

### Remediation Item 2: QR Redirection DOM Target & Router

#### Target File:
`/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md`

#### Updates across 4 Locations:

#### 1. Section 3.3.1 (Lines 193–199)
**Original Text**:
```markdown
#### 3.3.1 標籤 QR Code 動態導流協定
在過去，Seed-Bank 的標籤僅印製純文字長編碼。本整合方案將 100x60mm 標籤上的純向量 SVG QR Code 全面規格化為可解析的標準動態 URL：
- **動態 URI**: `https://shumei-2025.web.app/trace/{shumeiCode}`
- **解析轉向機制**:
  當消費者使用一般智慧型手機相機掃描標籤上的 QR Code 時，瀏覽器造訪該 URL，Cloud Functions 或 Hosting 轉向中繼層自動解析 `shumeiCode`（例如 `SO-LY-S-TW01-2506-001`），並重定向至：
  `https://shumei-2025.web.app/farm/natural-farm.html?trace=SO-LY-S-TW01-2506-001#grain-memory`
```

**Replacement Text**:
```markdown
#### 3.3.1 標籤 QR Code 動態導流協定與前台路由承接
在過去，Seed-Bank 的標籤僅印製純文字長編碼。本整合方案將 100x60mm 標籤上的純向量 SVG QR Code 全面規格化為可解析的標準動態 URL，並在前台實裝動態路由解析器：
- **動態 URI**: `https://shumei-2025.web.app/trace/{shumeiCode}`
- **解析轉向機制**:
  當消費者使用一般智慧型手機相機掃描標籤上的 QR Code 時，瀏覽器造訪該 URL，Cloud Functions 或 Firebase Hosting 轉向中繼層自動解析 `shumeiCode`（例如 `SO-LY-S-TW01-2506-001`），並重定向至前台真實對應的 DOM 錨點：
  `https://shumei-2025.web.app/farm/natural-farm.html?trace=SO-LY-S-TW01-2506-001#tab-seeds`
  *(註：此目標精確對應 `natural-farm.html:214` 的 `<section id="tab-seeds" class="tab-pane-content">`)*。

- **Shumei 前台用戶端路由與溯源渲染規格 (`public/js/natural-farm.js`)**:
  為解決使用者掃描後停留在首頁預設分頁之問題，`natural-farm.js` 於 `DOMContentLoaded` 生命週期內實裝 URL 參數與 Hash 路由監聽器：
  ```javascript
  // URL 溯源路由解析與自動切換分頁
  const urlParams = new URLSearchParams(window.location.search);
  const traceCode = urlParams.get('trace');
  const hashTarget = window.location.hash;

  if (traceCode || hashTarget === '#tab-seeds') {
    const seedsBtn = document.querySelector('.filter-chip[onclick*="\'seeds\'"]');
    switchMainTab('seeds', seedsBtn);
    if (traceCode) {
      renderSeedTrace(traceCode);
    }
  }
  ```
  - **`renderSeedTrace(shumeiCode)` 規格**:
    1. 驗證 `shumeiCode` 是否符合 NamingRule 14~18 碼正規表達式。
    2. 從 Firestore `/seeds/{shumeiCode}` 或靜態品種目錄拉取該批次風土縮時相片、種母世代（如 F12 代）、採收年份與農友手記。
    3. 動態在 `#tab-seeds` 頂部插入突顯之「🌱 掃碼批次溯源作物情報」高亮卡片。
    4. 自動執行平滑滾動：`document.getElementById('tab-seeds').scrollIntoView({ behavior: 'smooth' });`。
    5. 調用 `showToast('已為您成功載入【' + shumeiCode + '】自家採種溯源資訊！', 'success');` 強化互動反饋。
```

#### 2. Section 4.2.3 (Line 465)
**Original Text**:
```markdown
  - `302 Found`: 瀏覽器一般造訪時，自動導向 `https://shumei-2025.web.app/farm/natural-farm.html?trace=SO-LY-S-TW01-2506-001#grain-memory`。
```
**Replacement Text**:
```markdown
  - `302 Found`: 瀏覽器一般造訪時，自動導向 `https://shumei-2025.web.app/farm/natural-farm.html?trace=SO-LY-S-TW01-2506-001#tab-seeds`（精確指向前台 `<section id="tab-seeds">` 粒籽記憶庫分頁）。
```

#### 3. Section 4.3.3 / Figure 3 Sequence Diagram (Line 653)
**Original Text**:
```mermaid
    Cam->>FarmPage: 開啟 natural-farm.html?trace=SO-LY-S-TW01-2506-001#grain-memory
```
**Replacement Text**:
```mermaid
    Cam->>FarmPage: 開啟 natural-farm.html?trace=SO-LY-S-TW01-2506-001#tab-seeds
```

---

### Remediation Item 3: Seed-Bank Phase 1 Claim Ingestion Architecture

#### Target File:
`/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md`
**Location**: Section 3.1.2 & Section 4.4.1 (Task 1.4)

#### Architectural Specification to Add:
In Section 3.1.2 / 3.1.3 and Section 4.4.1 Task 1.4, explicitly document the **Phase 1 Ingestion Bridge Pattern**:

```markdown
#### 3.1.2.1 階段一輕量化索取單串接架構 (Phase 1 Lightweight Ingestion Bridge)
在 Phase 2 全面重構 Seed-Bank 狀態管理為 Firestore WebSocket 即時共筆 (`onSnapshot`) 之前，為確保 Seed-Bank 現有 React 19 + Vite 離線單檔方舟之架構純潔性與零破壞性發布，Phase 1 實施 **輕量化讀取橋接器 (Lightweight Ingestion Bridge)**：

1. **資料拉取機制**:
   - Seed-Bank 不在 Phase 1 引入重型 Firestore 雙向狀態樹，而是透過經認證的輕量化 REST 端點：
     `GET /api/v1/seeds/claims?status=pending` (由 Cloud Functions 提供)
     或引入模組化 `firebase/firestore/lite` SDK 僅執行唯讀拉取。
2. **UI 呈現與識別 (`ClaimRequestsTable.tsx`)**:
   - `ClaimRequestsTable` 引入資料轉接器（Adapter），將雲端 `exchange_claims` 映射為相容之 `LegacyClaimRequest` 物件。
   - 於表格中新增紫色狀態徽章：`<span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-purple-200">Karma 兌換 (200 pts)</span>`。
   - 在表格上方新增「🔄 重新整理雲端索取單 (Fetch Cloud Claims)」手動輪詢按鈕，亦可設定每 60 秒背景 Polling，使種庫管理員能無痛檢視並審核來自 Shumei 前台的 Karma 兌換單。
3. **推進至 Phase 2**:
   - 待 Phase 2.1 啟動後，此輪詢模式將平滑升級為全雙工即時監聽（WebSocket `onSnapshot`）與原子交易調撥。
```

---

### Remediation Item 4: QR Code Generation in Seed-Bank (`qrcode.react` vs. `qrCodeSvg.ts`)

#### Target File:
`/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md`
**Location**: Section 3.1.4, Section 3.3.1, and Section 4.4.3 (R3)

#### 1. Section 3.1.4 Point 2 Replacement:
**Original Text**:
```markdown
   - 右側：嵌入純向量 SVG QR Code，解析度 92×92，容錯級別 M。
```
**Replacement Text**:
```markdown
   - 右側：嵌入由 `qrcode.react` (`QRCodeSVG`) 生成之正統國際標準純向量 SVG QR Code，解析度 92×92，容錯級別為 `Level M (15%)`。
     - **編碼內容規格**：`value` 屬性必須嚴格編碼為前台完整動態溯源 URL：
       `value={`https://shumei-2025.web.app/trace/${shumeiCode}`}`
       （禁止僅傳入 `shumeiCode` 純文字，以確保手持裝置相機掃描能即時觸發瀏覽器跳轉）。
```

#### 2. Technical Specification on QR Engines Differentiation (to be added to Section 3.3.1):
```markdown
#### 3.3.1.1 雙 QR Code 引擎職責分工與相容性規範
為避免系統內部產生混淆，本架構明確劃分 Seed-Bank 內兩套 QR Code 產製模組之定位與職責：

| 模組名稱 | 實現方式 | 糾錯演算法 | 適用場景 | 規範要求 |
|---|---|---|---|---|
| **生產環境熱感標籤引擎 (`Modal23852PrintLabel.tsx`)** | `qrcode.react` 之 `<QRCodeSVG />` 組件 | ISO/IEC 18004 標準 Reed-Solomon 糾錯 (Level M 15% / Level Q 25%) | 100x60mm 實體熱感紙列印、出庫貼附、手機相機即時掃描 | **生產標準**。強制編碼完整跳轉 URL `https://shumei-2025.web.app/trace/${shumeiCode}`。任何光學掃描槍與手機相機 100% 瞬間解碼。 |
| **極限離線生存包輔助器 (`src/utils/qrCodeSvg.ts`)** | 純 JavaScript 字串模除仿生矩陣 (`generateQrCodeSvgString`) | 無 Reed-Solomon 糾錯 (字串雜湊視覺擬態) | 單檔 HTML 離線方舟 (OFFGRID VAC-1) 在無 npm runtime 之視覺呈現存根 | **離線備援專用**。嚴禁調用於實體標籤列印；規劃於 Phase 3.1 升級為零依賴之精簡版 Reed-Solomon 微型編碼器。 |
```

#### 3. Section 4.4.3 Risk Mitigation Matrix R3 Replacement:
**Original Text**:
```markdown
| **R3** | **熱感標籤在強光日照或高濕環境褪色與掃描失效**<br/>農場現場強烈紫外線或高濕度導致熱感貼紙文字淡化、QR 碼畸變無法被相機辨識。 | **Medium (中)** | 高 (High) | 1. 耗材規格強制規範採用「三防（防水、防油、防熱）頂級合成熱感紙」；<br/>2. QR Code 生成時容錯率固定為 `Level M (15%)` 或 `Level Q (25%)`；<br/>3. 標籤底部保留人眼可讀的 14~18 碼明碼，供手動輸入反查。 |
```
**Replacement Text**:
```markdown
| **R3** | **熱感標籤在強光日照或高濕環境褪色與掃描失效**<br/>農場現場強烈紫外線或高濕度導致熱感貼紙文字淡化、QR 碼畸變無法被相機辨識，或標籤編碼錯誤導致無法自動跳轉。 | **Medium (中)** | 高 (High) | 1. 耗材規格強制規範採用「三防（防水、防油、防熱）頂級合成熱感紙」；<br/>2. 實體列印組件 (`Modal23852PrintLabel.tsx`) 嚴格鎖定 `qrcode.react` 之 `QRCodeSVG`，容錯率設定為 `Level M (15%)` 或 `Level Q (25%)`，且 `value` 強制編碼完整 URL `https://shumei-2025.web.app/trace/{shumeiCode}`，禁止使用 `qrCodeSvg.ts` 仿生矩陣進行列印；<br/>3. 標籤底部保留人眼可讀的 14~18 碼明碼，供手動輸入反查。 |
```

---

## 5. Verification Method

To verify these findings and confirm the remediation against the codebase:

1. **Verify Shumei Karma Storage in `localStorage`**:
   ```bash
   grep -n "localStorage.getItem('shumei_user_karma')" /Users/tsaisungen/Sites/shumei/public/js/natural-farm.js
   # Expect match at Line 137
   ```
2. **Verify Volunteer CRM is Mock Array**:
   ```bash
   grep -n "let volunteerList" /Users/tsaisungen/Sites/shumei/public/js/natural-farm-admin.js
   # Expect match at Line 92
   ```
3. **Verify DOM Target ID in `natural-farm.html`**:
   ```bash
   grep -n 'id="tab-seeds"' /Users/tsaisungen/Sites/shumei/public/farm/natural-farm.html
   # Expect match at Line 214
   grep -n 'grain-memory' /Users/tsaisungen/Sites/shumei/public/farm/natural-farm.html
   # Expect NO MATCH (exit code 1)
   ```
4. **Verify Missing Router in `natural-farm.js`**:
   ```bash
   grep -n "URLSearchParams" /Users/tsaisungen/Sites/shumei/public/js/natural-farm.js
   # Expect NO MATCH (exit code 1)
   ```
5. **Verify Seed-Bank Dependencies**:
   ```bash
   grep -n "firebase" /Users/tsaisungen/Sites/Seed-Bank/package.json
   # Expect NO MATCH (exit code 1)
   grep -n "qrcode.react" /Users/tsaisungen/Sites/Seed-Bank/package.json
   # Expect match at Line 22
   ```
6. **Verify Label QR Generation Code**:
   ```bash
   grep -n -C 5 "QRCodeSVG" /Users/tsaisungen/Sites/Seed-Bank/src/components/legacy_shumei/modals/Modal23852PrintLabel.tsx
   # Expect value={shumeiCode} at Line 107
   ```
7. **Verify Bionic Mock Matrix in `qrCodeSvg.ts`**:
   ```bash
   grep -n "仿生矩陣" /Users/tsaisungen/Sites/Seed-Bank/src/utils/qrCodeSvg.ts
   # Expect match at Line 18
   ```
