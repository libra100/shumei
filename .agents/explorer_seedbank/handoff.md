# Seed-Bank (秀明自家採種種子庫管理系統) 全面架構與核心模組深度探索報告

## 1. Observation (客觀觀察與實體代碼證據鏈)

本段落完整記錄對 `/Users/tsaisungen/Sites/Seed-Bank` 專案之源碼、配置、型別定義、工具函數與組件架構的直接觀察與代碼引用。

---

### 1.1 技術架構與套件配置 (Tech Stack & Configurations)

- **`package.json` (`/Users/tsaisungen/Sites/Seed-Bank/package.json:1-38`)**:
  - **核心框架**: React 19 (`"react": "^19.0.1"`, `"react-dom": "^19.0.1"`)
  - **語言與建構工具**: TypeScript 5.8 (`"typescript": "~5.8.2"`), Vite 6 (`"vite": "^6.2.3"`)
  - **樣式引擎**: Tailwind CSS v4 (`"@tailwindcss/vite": "^4.1.14"`, `"tailwindcss": "^4.1.14"`)
  - **附加函式庫**:
    - `@yudiel/react-qr-scanner: ^2.6.0`: 相機光學即時掃描 QR Code
    - `qrcode.react: ^4.2.0`: 純向量 SVG QR Code 渲染 (`QRCodeSVG`)
    - `lucide-react: ^0.546.0`: 向量圖標系統
    - `motion: ^12.23.24`: Framer 物理動效與平滑過渡
    - `@google/genai: ^2.4.0`: Gemini GenAI SDK
    - `express: ^4.21.2`, `dotenv: ^17.2.3`, `tsx: ^4.21.0`
  - **腳本 (Scripts)**:
    - `"dev": "vite --port=3000 --host=0.0.0.0"`
    - `"build": "vite build"`
    - `"preview": "vite preview"`
    - `"lint": "tsc --noEmit"`

- **`vite.config.ts` (`/Users/tsaisungen/Sites/Seed-Bank/vite.config.ts:1-23`)**:
  - 使用 `@tailwindcss/vite` 與 `@vitejs/plugin-react`。
  - 路徑別名：`'@': path.resolve(__dirname, '.')`。
  - 伺服器監聽：支援 `DISABLE_HMR` 環境變數。

- **`tsconfig.json` (`/Users/tsaisungen/Sites/Seed-Bank/tsconfig.json:1-27`)**:
  - `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `isolatedModules: true`, `jsx: "react-jsx"`, `allowImportingTsExtensions: true`, `noEmit: true`。

- **目錄架構與檔案佈局**:
  - 根目錄包含：`PROJECT.md`, `README.md`, `package.json`, `vite.config.ts`, `tsconfig.json`, `firebase.json`, `index.html`。
  - `src/` 目錄包含 39 個源碼檔案：
    - 頂層：`App.tsx`, `main.tsx`, `types.ts`, `data.ts`, `utils.ts`, `index.css`
    - 工具層 (`src/utils/`)：`namingRule.ts`, `qrCodeSvg.ts`
    - 經典秀明後台層 (`src/components/legacy_shumei/`)：
      - `LegacyShumeiView.tsx`, `ShumeiSidebar.tsx`, `ShumeiActionBar.tsx`, `ShumeiFilterCard.tsx`, `TablePress35090.tsx`, `ClaimRequestsTable.tsx`
      - 子視圖 (`src/components/legacy_shumei/views/`)：`ShumeiWarehouseView.tsx`, `ShumeiMembersView.tsx`, `ShumeiDccView.tsx`, `ShumeiAccessControlView.tsx`, `ShumeiLogisticsReportView.tsx`, `ShumeiRulesView.tsx`
      - 彈窗群 (`src/components/legacy_shumei/modals/`)：`Modal36122PackageEdit.tsx`, `Modal66281Provide.tsx`, `Modal66278Claim.tsx`, `Modal23852PrintLabel.tsx`, `ModalSeedEdit.tsx`
    - 次世代方舟層 (`src/components/`)：
      - `AnalyticsPanel.tsx`, `Banner.tsx`, `CsaMarketplace.tsx`, `CultivationForum.tsx`, `DisasterReadiness.tsx`, `EventExperience.tsx`, `FacilityLogistics.tsx`, `SeedStewardship.tsx`, `SeedSwapTracker.tsx`

---

### 1.2 雙視圖架構與狀態同步橋接 (Dual-View Architecture)

- **視圖切換與持久化 (`src/App.tsx:38-46, 325-351`)**:
  - 視圖狀態為 `'legacy'`（經典秀明後台）與 `'modern'`（次世代抗極端氣候種子方舟）。
  - 預設值為 `'legacy'`，持久化儲存於 `localStorage.getItem('APP_VIEW_MODE')`。
  - 頂層快速切換列具備雙向即時切換按鈕。
- **單一真理源（Shared Single Source of Truth, `src/App.tsx:48-145`）**:
  - 經典視圖與方舟視圖共享同一組 React 狀態：`seeds`, `storage`, `movements`, `exchangeLogs`, `posts`, `products`, `personnel`, `currentUser`, `events`, `knowledge`。
  - 任意視圖內之資料異動（如雙擊修改包數、登記提供、索取扣減、實體庫位調撥、權限變更），均即時雙向同步並寫入 `localStorage`，確保資料零衝突。
- **經典秀明後台版面架構 (`LegacyShumeiView.tsx:211-505`)**:
  - 固定比例兩欄式：左側邊欄 15%（深綠 `#00664D`，`ShumeiSidebar`），右側工作區 85%。
  - 由 `activeSidebarMenu` 切換 7 大核心管理模組：
    1. `種子交流` (TablePress 35090 模式)
    2. `種子庫管理` (`ShumeiWarehouseView`)
    3. `會員專區` (`ShumeiMembersView`)
    4. `文管中心` (`ShumeiDccView`)
    5. `權限設定` (`ShumeiAccessControlView`)
    6. `流通物流報表` (`ShumeiLogisticsReportView`)
    7. `農法採種公約` (`ShumeiRulesView`)

---

### 1.3 種子編碼引擎 (NamingRule Engine 14~18 碼結構)

- **編碼結構公式 (`src/utils/namingRule.ts:1-5, 158-183`)**:
  - 官方公式：`[科屬大類]-[品種代碼]-[農法碼]-[國家地區碼]-[採種年月]-[批號流水號]`
  - 長度：14 ~ 18 碼（部分品種簡碼為 3~5 碼時可自然延伸至 18~20 碼）。
  - 標準範例：`CU-ZC-S-TW01-2606-001`、`SO-LY-S-TW01-2506-001`、`PO-RC139-S-TW04-2508-007`。
- **六段編碼規範**:
  1. **第 1 段（科屬大類，2~3 碼大寫英文）**：
     - 八大核心科屬 (`BOTANICAL_FAMILIES`):
       - `CU`: 葫蘆科 (瓜果類，Cucurbitaceae)
       - `FA`: 豆科 (固氮與土壤養護，Fabaceae)
       - `PO`: 禾本科 (糧食主食米麥，Poaceae)
       - `BR`: 十字花科 (秋冬蔬菜主力，Brassicaceae)
       - `SO`: 茄科 (夏秋果菜，Solanaceae)
       - `AS`: 菊科 (芳香耐寒蔬菜，Asteraceae)
       - `MA`: 錦葵科 (粘液特用作物，Malvaceae)
       - `LA`: 唇形科 (香草驅避植物，Lamiaceae)
     - 六大延伸科屬:
       - `AP`: 繖形科 (Apiaceae，胡蘿蔔/芹菜/茴香/芫荽)
       - `AM`: 莧科 (Amaranthaceae，莧菜/菠菜/甜菜根/紅藜)
       - `AL`: 蔥科/百合科 (Alliaceae，蔥/蒜/韭/洋蔥)
       - `CO`: 旋花科 (Convolvulaceae，空心菜/甘藷)
       - `PG`: 蓼科 (Polygonaceae，蕎麥)
       - `ZZ`: 其他科屬 (Miscellaneous，野生在來種)
  2. **第 2 段（品種簡碼，2~5 碼英數）**：
     - 如 `ZC` (Zucchini 櫛瓜)、`LY` (Lycopersicum 黑柿番茄)、`RC139` (高雄139水稻)、`SB` (青仁黑豆)、`RD` (櫻桃蘿蔔)。
  3. **第 3 段（農法代碼，1 碼大寫英文）**：
     - `S`: 秀明自然農法 (無農藥、無肥料、自家採種)
     - `N`: 廣義自然農法 (無化學農藥肥料之免耕覆蓋)
     - `O`: 有機農法 (有機驗證或有機資材)
     - `C`: 慣行農法 (常規栽培)
  4. **第 4 段（國家地區碼，4 碼英數）**：
     - 台灣分區 (TW01~TW10):
       - `TW01`: 新北北海岸 (淡水幸福農莊、金山、三芝)
       - `TW02`: 宜蘭縣 (員山阿聰自然田、三星、冬山)
       - `TW03`: 台東縣 (鹿野、池上、關山)
       - `TW04`: 花蓮縣 (光復、壽豐、富里)
       - `TW05`: 桃竹苗 (新竹芎林九芎林田、竹東)
       - `TW06`: 中彰投 (台中清水/新社、南投埔里)
       - `TW07`: 雲嘉南 (雲林西螺、台南後壁)
       - `TW08`: 高屏區 (高雄美濃、屏東新埤)
       - `TW09`: 台北市 (北投大屯山、士林)
       - `TW10`: 離島/其他 (澎湖、金門、蘭嶼)
     - 日本都道府縣 (JP01~JP47，JIS X 0401 全覆蓋):
       - 包含 `JP24`: 滋賀縣 (神慈秀明會總本山 / 甲賀市信樂町 MIHO 示範農場)
       - `JP35`: 德島縣 (阿南市橫田農場，原站首筆綠皮櫛瓜產地)
       - `JP25`: 京都府 (京野菜保護區)、`JP01`: 北海道等全 47 都道府縣。
     - 國際代表採種國度:
       - `PE01`: 秘魯安地斯山區 (高海拔耐寒紫馬鈴薯)
       - `ES01`: 西班牙安達魯西亞 (地中海耐旱耐熱)
       - `US01`: 美國美東 (百年傳家寶 Heirloom)
  5. **第 5 段（採種年月，4 碼數字 YYMM）**：
     - 如 `2606` (2026年06月)、`2512` (2025年12月)。
  6. **第 6 段（批號流水號，3~4 碼英數）**：
     - 預設三碼補零，如 `001`, `002`, `0646`。
- **編碼驗證正規表達式 (`namingRule.ts:228`)**:
  ```typescript
  const pattern = /^[A-Z]{2,3}-[A-Z0-9]{2,5}-[SNOC]-[A-Z]{2}[0-9]{2}-[0-9]{4}-[0-9A-Z]{3,4}$/;
  ```
- **分裝包數與公克雙向換算 (`namingRule.ts:141-152`)**:
  - 預設每包克重：`DEFAULT_GRAMS_PER_PACKAGE = 5` (5g/包)。
  - `packagesToGrams(packages, gramsPerPackage = 5) = packages * gramsPerPackage`
  - `gramsToPackages(grams, gramsPerPackage = 5) = Math.floor(grams / gramsPerPackage)`

---

### 1.4 實體倉儲與溫濕度調控管理 (Physical Warehouse & Inventory)

- **倉儲空間資料模型 (`src/types.ts:50-59`)**:
  ```typescript
  export interface StorageSpace {
    id: string;
    name: string;
    type: 'refrigerator' | 'clay_pot' | 'cellar' | 'ambient';
    temperature: number; // °C
    humidity: number;    // % RH
    capacityGrams: number;
    occupiedGrams: number;
    notes: string;
  }
  ```
- **四大實體儲存設施類型 (`src/data.ts:209-240`)**:
  1. `refrigerator` (電網低溫玻璃冷藏櫃): 4°C, 32% RH, 10,000g 容量。具備 5 小時備用 UPS，存放珍貴蔬菜微粒種子。
  2. `clay_pot` (雙層天然蒸發陶罐庫 Pot-in-pot cooler): 14~15°C, 55% RH, 8,000g 容量。利用內外雙層陶罐夾層濕砂水分蒸發吸熱，完全不耗電力。
  3. `cellar` (深山竹炭微通風地窖): 12°C, 45% RH, 50,000g 容量。半地下構造，砌保溫岩與乾竹炭，年溫差 5°C 內，供大宗米麥豆耐災首選。
  4. `ambient` (常溫暫存倉): 交流會暫存庫（代碼如 `TWNTPEZZA07SD1`）。
- **種子與倉儲之映射關係**:
  - `Seed.storageLocationId` 直連 `StorageSpace.id`。
  - `Seed.status`: `'available' | 'low_stock' | 'quarantined' | 'frozen'`。
  - 萌發率與氣候歷程記錄：`germinationRate` (%), `germinationCondition`, `climateAttributes`, `weatherContext`。
- **跨儲位種子調撥流程 (`ShumeiWarehouseView.tsx:59-65` & `App.tsx:302-323`)**:
  - 觸發 `handleTransferSeedStorage(seedId, targetStorageId)`。
  - 自動生成不可篡改之 `SeedMovement` 調撥記錄（記錄調撥單號 `MOV-...`、品名、原儲位、目標儲位、重量、操作人員、時間戳記、調撥事由）。

---

### 1.5 流通清單與 TablePress 雙層網格 (Circulation & TablePress)

- **TablePress #35090 核心表格 (`src/components/legacy_shumei/TablePress35090.tsx:1-200`)**:
  - **15 欄位 2 層分組表頭 (Grouped 2-Tier Header)**:
    - 上層分組：
      - 🌱 作物分類與植物學生態特徵 (`colSpan={4}`)
      - 📦 採種風土與倉儲調度 (`colSpan={4}`)
      - ⚙️ 狀態與標籤條碼追溯 (`colSpan={3}`)
    - 下層欄位：
      - 官方條碼/編號、作物名稱、植物學名 (Latin)、世代 (Gen)、提供農友、**分裝包數 ✎ (Column 4)**、換算克重 (g)、採種年份、採種產地、農法規範、操作 (✏️ 編輯 / 🏷️ 標籤)
  - **Column 4 雙擊修改功能 (`TablePress35090.tsx:118-132`)**:
    - 在「分裝包數」單元格左鍵雙擊 (`onDoubleClick`)，立即彈出 `Modal36122PackageEdit`。
    - 快速即時修改包數，自動重新折算公克重，即時更新全域狀態與 localStorage。
  - **完整編輯功能 (`TablePress35090.tsx:160-167`)**:
    - 點擊「✏️ 編輯」按鈕呼叫 `ModalSeedEdit`，支援修改作物中英文名、學名、科屬、品種、代數、產地、農友、儲位、發芽率及條碼。
- **索取清單與流通管線 (`src/components/legacy_shumei/ClaimRequestsTable.tsx:1-125`)**:
  - 資料模型：`LegacyClaimRequest` (`id`, `claimSeq`, `seedId`, `seedCode`, `cropName`, `requestedPackages`, `applicantName`, `applicantPhone`, `applicantAddress`, `status`, `trackingNumber`)。
  - 狀態轉移機制：`'待審核' → '已核准' → '已出貨' → '已送達' → '已結案'`。
  - 扣庫聯動：農友提交 `Modal66278Claim` 時，系統立即自在庫種子扣減對應包數與公克重。
  - 物流單號產生：幹部點擊「出貨」後，自動配發郵局掛號單號 `POST-TW-xxxxxx`。
- **流通報表與 CSV 導出 (`ShumeiLogisticsReportView.tsx:47-64`)**:
  - 具備庫內調撥日誌與農友換種物流雙分頁。
  - 支援一鍵導出帶有 UTF-8 BOM 之 CSV 檔案（`SHUMEI_LOGISTICS_MOVEMENTS_*.csv` 與 `SHUMEI_LOGISTICS_EXCHANGES_*.csv`）。

---

### 1.6 100x60mm 熱感應標籤與向量 SVG QR Code

- **熱感標籤列印彈窗 (`src/components/legacy_shumei/modals/Modal23852PrintLabel.tsx:1-151`)**:
  - 彈窗標題：`Modal #23852`。
  - 物理尺寸：標準 100mm × 60mm 熱感應貼紙規格（螢幕寬度 420px，列印時適配 380px）。
  - CSS 列印適配：利用 Tailwind `print:` 前綴：
    - 列印時自動隱藏彈窗標題列與關閉按鈕 (`print:hidden`)。
    - 移除陰影與背景遮罩 (`print:p-0 print:bg-white print:fixed print:inset-0 print:shadow-none print:border-none`)。
    - 標籤卡片本體保留實體黑框線與緊湊排版。
  - 標籤內容結構：
    - 頂部：🌱 秀明自然農法協會 ． 自家採種 (Shumei Natural Farming Seed Exchange)，右上角標示 `F{seed.generation} 代`。
    - 左側：作物名稱、拉丁學名、留種世代、採收年份、提供農友、產地區域、每包淨重與在庫包數。
    - 右側：光學溯源 QR Code（尺寸 92x92，容錯等級 M，內嵌官方 NamingRule 長條碼）。
    - 底部：`[{shumeiCode}]` 長編碼字串與「無農藥．無肥料」標語。
- **純向量 SVG QR Code 生成器 (`src/utils/qrCodeSvg.ts:1-68`)**:
  - `generateQrCodeSvgString(text, size = 120)`: 完全零外部相依之仿生 21×21 矩陣生成器。
  - 具備 3 個標準定位角 (Finder Patterns) 與字串字元確定性雜湊演算法。
  - 輸出為乾淨的 `<svg><rect .../></svg>` 字串，保證在完全斷網、無任何 npm 套件之純靜態 HTML 環境下依然能正確繪製與高解析度列印。

---

### 1.7 文管中心 (DCC) 與 4 級會員權限矩陣

- **4 級會員權限控制矩陣 (RBAC Matrix, `src/components/legacy_shumei/views/ShumeiAccessControlView.tsx:17-27, 88-149`)**:

  | 權限階層 (Level) | 代表角色 | 稱謂/職銜 | 允許操作權限 | 系統保護閥值 |
  |---|---|---|---|---|
  | **Level 1** | `consumer` | 支持者 (Supporter / 一般會員) | `view_seeds` (瀏覽公開清單), `claim_seeds` (發起索取申請), `write_forum` (論壇發言) | 最低門檻 |
  | **Level 2** | `grower` | 自然生產者 (Resilient Grower / 認證採種者) | 繼承 L1，增加 `provide_seeds` (登記提供入庫並自動配發 NamingRule 條碼), `scan_qr_check` (掃描核銷) | 需經農法實踐認證 |
  | **Level 3** | `saver` | 認證保種人 (Senior Saver / 分會幹部) | 繼承 L2，增加 `edit_packages` (雙擊修改包數), `approve_claims` (審核索取並發貨), `print_labels` (列印 100x60mm 標籤), `manage_storage` (儲位調撥), `approve_transfer` (核決跨區調撥) | 分會核心幹部 |
  | **Level 4** | `admin` | 首席核心守護主事 (Chief Steward / 總會管理員) | 繼承 L3，增加 `edit_dcc` (文管規章發布/修訂), `export_offgrid` (產製全庫離線單檔方舟), `manage_personnel` (人員升降職級) | 最高系統權威 |

- **文管中心 (Document Control Center, `src/components/legacy_shumei/views/ShumeiDccView.tsx:14-150`)**:
  - 受控文檔清冊：
    1. `SHUMEI-SOP-NR-01` (v2.0): 《秀明自然農法 種子科屬種分類與採種地區編碼手冊》（規範 14~18 碼公式、8大核心+6大延伸科屬、TW01~TW10 與 JP01~JP47 字典）。
    2. `SHUMEI-SOP-SEED-02` (v2.3): 《自家採種與後熟儲藏標準作業規範》（母株選拔、果菜後熟洗籽、含水率降至 8~10%）。
    3. `SHUMEI-CONV-03` (v1.2): 《種子交流會 守護者公約承諾書》（純淨承諾、代數誠實申報、次年 20% 自家採種回饋義務）。
    4. `SHUMEI-DR-EMERGENCY-04` (v1.0): 《極端災難與電網癱瘓情境 離線種子方舟操作手冊》（單檔 HTML 生存包操作與無電冷卻陶罐運作指南）。
  - 支援線上全文閱讀與純文字 (.txt) 下載。
- **農法採種公約與防雜交隔離指南 (`ShumeiRulesView.tsx:7-13, 28-61`)**:
  - 岡田茂吉四大哲學支柱：無農藥無化肥、無外來未熟有機肥、堅持「自家採種」F1~F10+、同儕互助與回饋。
  - 五大科別防雜交安全隔離距離規範：
    - 十字花科 (蟲媒異花): 800 ~ 1000 公尺 (極易雜交，需套袋或錯開花期)
    - 葫蘆科 (蟲媒異花): 500 公尺以上 (清晨未開花前套袋，人工純系授粉)
    - 禾本科 (風媒/自花): 水稻 10 公尺 / 玉米 300 公尺
    - 豆科 (閉花自花): 10 ~ 20 公尺 (花苞內已授粉，初學者首選)
    - 茄科 (自花為主): 30 ~ 50 公尺 (黑柿番茄自花授粉率達 95% 以上)

---

### 1.8 狀態管理與離線生存包相容性 (State & Offline Defense)

- **本機快取與容災機制 (`src/App.tsx:48-145`)**:
  - 所有核心模組均實裝 `localStorage` 快取寫入與讀取：
    - `OFFGRID_SEEDS_DB`: 種子主資料庫
    - `OFFGRID_STORAGE_DB`: 倉儲與儲位資料庫
    - `OFFGRID_MOVEMENTS_DB`: 內部調撥軌跡
    - `OFFGRID_EXCHANGES_DB`: 跨區交流紀錄
    - `OFFGRID_POSTS_DB`: 農耕討論與心得
    - `OFFGRID_PRODUCTS_DB`: CSA 物資目錄
    - `OFFGRID_PERSONNEL_DB`: 會員權限通訊錄
- **獨立單檔離線生存包 (`src/utils.ts:9-296` & `DisasterReadiness.tsx:16-29`)**:
  - 函數：`generateSurvivalBundle(seeds: Seed[], storage: StorageSpace[]): string`
  - 運作機制：
    - 將全種子庫與儲位資料以 JSON 序列化注入於單一純 HTML 頁面中。
    - 嵌入獨立的 CSS 樣式、深色高對比主題、離線極速全文搜尋引擎 (`filterSeeds()`) 與 DOM 渲染邏輯。
    - **完全零外部網路呼叫、零伺服器依賴、零第三方 CDN**。
    - 可直接下載為 `OFFGRID_SEED_TERMINAL_YYYY-MM-DD.html`，存放於 USB 隨身碟、離線平板或電子書閱讀器中，斷電時雙擊即開即用。
- **全庫 JSON 備份與還原 (`src/utils.ts:374-382` & `App.tsx:266-287`)**:
  - `downloadJsonBackup`: 匯出 `SEED_VAULT_BACKUP_YYYY-MM-DD.json`。
  - `handleRestoreBackupUpload`: 透過 `FileReader` 讀取 JSON 並校驗還原至 state 與 localStorage。
- **物理紙本印表 CSV (`src/utils.ts:387-406`)**:
  - `convertSeedsToCsv`: 產生包含 UTF-8 BOM 的通用 CSV 表格，供印表機輸出放置於防汛防災包內。

---

## 2. Logic Chain (推論邏輯鏈與跨系統對齊分析)

本段落依據上述實證觀察，建立跨專案整合的推論邏輯鏈：

### 2.1 角色光譜與生態定位推論
- **Step 1 (觀察依據 1.1, 1.2)**: Shumei 專案採用 Vanilla JS / Bootstrap 5 / Firebase Firestore，核心功能為公眾活動預約、食育食譜、志工奉仕、綠色 Karma 積分；而 Seed-Bank 採用 React 19 / TypeScript / Vite，核心功能為 NamingRule 14~18 碼編碼、物理儲位溫濕度調控、TablePress 流通清單、100x60mm 熱感標籤與 DCC 文管中心。
- **Step 2 (推論)**: 兩者在自然農法生態系中存在天然的分工光譜：
  - **Shumei** 定位為「公眾參與、食農教育與社群動員前台 (Public Engagement & Community Front-End)」。
  - **Seed-Bank** 定位為「專業種源保全、實體庫存物流與嚴謹採種規範中後台 (Seed Pedigree & Vault Back-End)」。

### 2.2 種子活動兌換與實體出庫扣減推論
- **Step 1 (觀察依據 1.3, 1.4, 1.5)**: Seed-Bank 的種子以 `packages`（包數）與 `quantityGrams`（公克重）雙重追蹤，每包預設 5g，並明確指向 `storageLocationId`（如 `ST-01` 電網冷藏櫃、`ST-02` 蒸發陶罐）。索取表單 (`Modal66278Claim`) 提交時會即時自特定儲位扣庫。
- **Step 2 (推論)**: 當 Shumei 會員在前端以 Karma 綠色積分兌換「種子分享包」時，Shumei 需呼叫 Seed-Bank 的出庫端點，傳入種子 ID 與包數，Seed-Bank 即可執行：
  1. 校驗儲位在庫包數 (`packages >= requestedQty`)。
  2. 扣減對應庫存並生成 `SeedMovement` 或 `ExchangeLog`。
  3. 產出帶有 14~18 碼官方編號的 100x60mm 熱感標籤以供實體分裝貼附。

### 2.3 會員與志工認證對等互通推論
- **Step 1 (觀察依據 1.7)**: Seed-Bank 具備嚴格的 4 級 RBAC 矩陣（Level 1 支持者、Level 2 耕作者、Level 3 認證保種人、Level 4 首席主事），等級決定了登記提供、審核出庫與標籤印製權限。
- **Step 2 (推論)**: Shumei 的志工人才庫具有奉仕服務時數、活動簽到與培訓證書。若將 Shumei 志工之累積奉仕時數（例如累計自然農園出勤 50 小時、通過自家採種實習），可對等對齊為 Seed-Bank 的 Level 2（認證耕作者）；擔任分會站點管理員則可晉升至 Level 3（認證保種人），達成跨系統資格對等認證。

### 2.4 QR Code 雙向導流與溯源推論
- **Step 1 (觀察依據 1.3, 1.6)**: Seed-Bank 100x60mm 實體標籤上的 SVG QR Code 目前編碼內容為官方 14~18 碼字串（如 `SO-LY-S-TW01-2506-001`）。
- **Step 2 (推論)**: 可將 QR Code URL 規格化為雙向導流協定（例如 `https://shumei.org.tw/seed/SO-LY-S-TW01-2506-001` 或 URI scheme）。使用者以手機掃描實體種子包時：
  - 前台直接跳轉至 Shumei 平台的該批次產地縮時攝影、農友耕作日誌與食育食譜。
  - 同時 Shumei 頁面透過 API 查詢 Seed-Bank 後台，即時拉取該品種的世代系譜 (F-Gen)、歷經極端氣候特徵（耐旱/耐澇）與發芽率。

### 2.5 資料權威與分散式同步推論
- **Step 1 (觀察依據 1.8)**: Seed-Bank 設計考量了極端電網癱瘓與完全斷網情境，採用本地 `localStorage` 與 `generateSurvivalBundle`（單檔 HTML 離線方舟）。
- **Step 2 (推論)**: 雙系統對接時，資料權威 (SSOT) 劃分必須清晰：
  - **種子遺傳系譜、實體儲位與官方編碼**：以 Seed-Bank 為權威。
  - **公眾會員帳號、Karma 積分、活動報名記錄**：以 Shumei (Firestore) 為權威。
  - **離線狀態下**：Seed-Bank 離線操作（如緊急調撥）待聯網後，透過版本向量或時間戳記將增量異動批次同步回 Shumei，避免資料覆蓋。

---

## 3. Caveats (調查限制與邊界說明)

1. **網路依賴與外部 API**:
   - Seed-Bank 目前主要作為本機/單機運行的 SPA（搭配 localStorage 與單檔 HTML 匯出），並未內建獨立的遠端 REST/GraphQL 後端伺服器（原程式碼中的 `express` 僅作為靜態託管選項）。與 Shumei 的整合需規劃輕量 API Gateway 或 Cloud Functions 轉接層。
2. **建構環境權限**:
   - 本次探訪期間執行 `npm --prefix /Users/tsaisungen/Sites/Seed-Bank run lint` (`tsc --noEmit`) 通過（0 錯誤）。在執行 `vite build` 時因沙盒目錄寫入限制 (`node_modules/.vite-temp/`) 遇到權限提示，但代碼本體無 TypeScript 語法錯誤。
3. **編碼長度彈性**:
   - NamingRule 標題為 14~18 碼，但在特定品種簡碼較長（如 `RC139` 5碼）或自訂批號時，長度可能達到 19~20 碼，正規表達式 `/^[A-Z]{2,3}-[A-Z0-9]{2,5}-[SNOC]-[A-Z]{2}[0-9]{2}-[0-9]{4}-[0-9A-Z]{3,4}$/` 已充分支援此彈性。

---

## 4. Conclusion (探索結論與整合架構指引)

1. **系統完整度極高**:
   - Seed-Bank 已完整實作了經典秀明後台 (Legacy Shumei View) 與現代方舟 (Modern Ark View) 的雙視圖切換架構。
   - 具備嚴謹的 NamingRule 14~18 碼種子編碼引擎（涵蓋 14 大科屬、TW01~TW10、JP01~JP47 JIS X 0401 都道府縣字典）。
   - 實體倉儲（電網冷藏櫃、雙層蒸發陶罐、竹炭地窖、常溫暫存）與 TablePress #35090 雙層表頭資料表格、第 4 欄雙擊包數修改、100x60mm 純向量 SVG QR Code 列印等功能皆已 100% 程式碼就緒。
2. **與 Shumei 專案具備強烈互補性**:
   - Shumei 專案欠缺實體種子倉位追蹤、植物學長編碼與熱感標籤列印；而 Seed-Bank 欠缺公眾端的社群動員、線上支付/Karma 積分兌換與食農教育內容。
   - 兩者結合可建構出從「公眾食育/活動體驗」到「實體種源保存/專業自家採種」的閉環生態系統。
3. **產出建議**:
   - 可立即將本報告之具體代碼結構、欄位模型與業務流程，提供給母代理人以合成編纂頂層技術規格文件 `docs/SHUMEI_SEED_BANK_COLLABORATION.md`。

---

## 5. Verification Method (獨立驗證方式)

欲獨立驗證本探索報告之正確性，可執行以下檢查：

1. **型別檢查與語法驗證**:
   ```bash
   npm --prefix /Users/tsaisungen/Sites/Seed-Bank run lint
   ```
   *預期結果*: `tsc --noEmit` 執行成功且無任何型別報錯。
2. **檢視 NamingRule 編碼引擎**:
   檢查 `/Users/tsaisungen/Sites/Seed-Bank/src/utils/namingRule.ts` 第 44 行、第 73 行、第 158 行與第 228 行，驗證 14 大科別、TW/JP 區域字典、`generateSeedCode` 與 `validateSeedCode` 正規表達式。
3. **檢視 TablePress #35090 雙層表頭與第 4 欄雙擊**:
   檢查 `/Users/tsaisungen/Sites/Seed-Bank/src/components/legacy_shumei/TablePress35090.tsx` 第 30-58 行（2-tier Header）與第 118-125 行（`column-4` `onDoubleClick` 呼叫 `Modal36122PackageEdit`）。
4. **檢視 100x60mm 熱感標籤列印版面**:
   檢查 `/Users/tsaisungen/Sites/Seed-Bank/src/components/legacy_shumei/modals/Modal23852PrintLabel.tsx` 第 63-127 行，確認 `printable-seed-label` 採用 100mm × 60mm 規格，並透過 Tailwind `print:` 類別處理實體出印。
5. **檢視 4 級 RBAC 權限設定矩陣**:
   檢查 `/Users/tsaisungen/Sites/Seed-Bank/src/components/legacy_shumei/views/ShumeiAccessControlView.tsx` 第 17-27 行之 `SYSTEM_PERMISSIONS` 矩陣與第 90-145 行之表格渲染。
6. **檢視離線單檔生存包生成器**:
   檢查 `/Users/tsaisungen/Sites/Seed-Bank/src/utils.ts` 第 9-296 行之 `generateSurvivalBundle` 函數。
