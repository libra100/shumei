# Shumei Codebase Exploration Report

**Target**: Shumei Natural Farming Promotion & Activity Community Platform (`/Users/tsaisungen/Sites/shumei`)  
**Investigator**: teamwork_preview_explorer_shumei  
**Date**: 2026-09-18  
**Status**: Completed (Hard Handoff)

---

## 1. Observation

### 1.1 Architectural Structure & Tech Stack Overview
The Shumei platform is a multi-tier hybrid web application combining a lightweight front-facing PWA, client-side Firebase Compat SDK single/multi-page modules, an external React/TypeScript monorepo package for duty scheduling, and a Firebase Cloud Functions v2 serverless backend integrated with Google Gemini GenAI and LINE Messaging API.

#### Core Components & Versions
- **Front-End Foundation**:
  - Vanilla JavaScript (ES6+), HTML5, CSS3 with Glassmorphism styles (`public/css/app.css`, `public/css/natural-farm.css`).
  - Bootstrap 5.1.1 (`https://cdn.jsdelivr.net/npm/bootstrap@5.1.1/dist/css/bootstrap.min.css`) and FontAwesome 6.4.0.
  - Progressive Web App (PWA): `public/manifest.json`, `public/sw.js`, `public/js/pwa.js` (Theme color: `#ffa100`).
  - Excel Generation & Parsing: ExcelJS v4.4.0 (`package.json:13`, `public/js/admin.js:150-239`).
  - QR Code Generation: `qrcodejs` v1.0.0 (`https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js`).
  - Optical Camera Barcode/QR Scanning: `html5-qrcode` v2.3.8 (`https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js`).
  - 3D Graph Visualization: `3d-force-graph` and `Three.js` (`public/youth/lineage.html:27`, `public/js/lineage.js:15-18`).
  - Data Visualizations: `Chart.js` (`public/js/natural-farm-admin.js:204-261`).

- **Firebase SDK & Multi-Database Architecture**:
  - Client Firebase Compat SDK 10.6.0 (`firebase-app-compat.js`, `firebase-auth-compat.js`, `firebase-firestore-compat.js`).
  - Offline Persistence: Explicitly enabled via `db.enablePersistence()` across modules (`public/js/index.js:11-17`, `public/js/change.js:11-13`, `public/js/seminar.js:16-18`).
  - Dual-Database Cross-Querying:
    - Primary Database: `shumei-2025` (Auth, Member Directory, Farm Bookings, Seed Exchanges, Seminars, Jyorei Logs).
    - Companion Database: `gantt-craft-2026` (`packages/scheduling/src/services/firebase.ts:17-39`, `public/js/front.js:17-51`, `public/js/admin.js:256-289`) storing project assignments (`ganttcraft_projects/shumei`).

- **Serverless Backend (`functions/`)**:
  - Runtime: Node.js 20 (`functions/package.json:12`).
  - Dependencies (`functions/package.json:15-22`):
    - `firebase-admin` v12.1.0
    - `firebase-functions` v5.0.1 (Firebase Functions v2 HTTPS & Pub/Sub)
    - `@google/generative-ai` v0.21.0 (Gemini 2.5 Flash API integration)
    - `@line/bot-sdk` v9.5.1 (LINE Messaging API)
    - `@google-cloud/pubsub` v5.3.1 (Asynchronous event dispatching)
    - `nodemailer` v9.0.5

- **Monorepo Package (`packages/scheduling/`)**:
  - TypeScript package `@shumei/scheduling` (`packages/scheduling/package.json:2`).
  - Components: `ShumeiApp.tsx`, `ShumeiFront.tsx`, `ShumeiScheduler.tsx`, `ShumeiStatusBoard.tsx`, `TodayShiftBoard.tsx`, `QuickShiftModal.tsx`, `ExcludedDatesModal.tsx`, `ShiftAlertToast.tsx`.
  - Shift Slots (`packages/scheduling/src/constants/shiftSlots.ts:8-41`):
    - `slot_09_12` (早班 09:00 ~ 12:00, 3 hrs)
    - `slot_12_15` (午班 12:00 ~ 15:00, 3 hrs)
    - `slot_15_18` (傍晚班 15:00 ~ 18:00, 3 hrs)
    - `slot_18_21` (晚班 18:00 ~ 21:00, 3 hrs)

#### Directory Layout & Entrypoints
```
/Users/tsaisungen/Sites/shumei/
├── .firebaserc                     # Default project: "shumei-2025"
├── firebase.json                   # Hosting config with 17 legacy route 301 redirects to /youth/, /farm/, /seed/, /activities/, /scheduling/
├── package.json                    # Root package (exceljs, uuid)
├── functions/                      # Cloud Functions v2
│   ├── index.js                    # lineWebhook (HTTP) & processLineEvent (Pub/Sub + Gemini)
│   └── package.json                # Node 20, @google/generative-ai, @line/bot-sdk, @google-cloud/pubsub
├── data_dumps/
│   └── latest_data.json            # 254 member documents export
├── scripts/
│   ├── verify-lineage.js           # Lineage graph verification (254 members, 399 nodes, 253 links)
│   ├── extract_js.py               # Script extraction helper
│   └── refactor_change.py          # Refactoring utility
├── packages/scheduling/            # Reusable TypeScript/React scheduling module
│   ├── package.json
│   └── src/
│       ├── constants/shiftSlots.ts
│       ├── services/firebase.ts
│       ├── types/shumei.ts
│       └── components/ & pages/
└── public/                         # Public web root
    ├── 404.html, index.html        # Entry landing & authentication gate
    ├── css/                        # app.css, natural-farm.css
    ├── js/                         # Vanilla JS business modules
    │   ├── admin.js                # Youth directory admin & excel export
    │   ├── auth.js                 # Authentication helpers
    │   ├── change.js               # Seed exchange & optical cart checkout
    │   ├── events.js               # Activities & offline QR ticketing
    │   ├── front.js                # Kiosk tablet self-service front desk
    │   ├── group.js                # Group view & volunteer roster
    │   ├── index.js                # Main router & auth dispatch
    │   ├── jyorei.js               # Jyorei service counter & lineage sync
    │   ├── lineage.js              # 3D Three.js lineage graph
    │   ├── list.js                 # Read-only member list & identity claim
    │   ├── natural-farm.js         # Public farm events, UGC reviews, Karma wallet
    │   ├── natural-farm-admin.js   # Farm operations, volunteer Kanban, QR check-in
    │   ├── pwa.js                  # Service Worker registration
    │   ├── seminar.js              # Seminar records & auto-query
    │   └── training.js             # Training camp scheduling & home visits
    ├── farm/                       # natural-farm.html, natural-farm-admin.html
    ├── seed/                       # change.html (Seed exchange system)
    ├── activities/                 # events.html, jyorei.html, training.html
    ├── youth/                      # admin.html, list.html, group.html, lineage.html, seminar.html
    └── scheduling/                 # index.html (redirect), front.html (kiosk UI)
```

---

### 1.2 Data Models & Firestore Schemas

Direct observation of code queries (`.collection(...)`, `.doc(...)`, `.set(...)`, `.update(...)`, and `data_dumps/latest_data.json`) verifies the following Firestore schemas:

#### Collection: `member`
- **Path**: `/member/{joinDateKey}`
- **Key Strategy**: Join date string (`YYYY-MM-DD`). In case of date collisions, an alphabetical suffix is appended (e.g., `2024-05-12A`, `2024-05-12B`) via `check_num` recursion (`public/js/admin.js:556-566`).
- **Fields**:
  | Field Name | Type | Description |
  |---|---|---|
  | `name` | `string` | Full Chinese name of the member |
  | `guide` | `string[]` | Array of introducers/guides (靈線介紹人, usually 1~2 names) |
  | `sewajin` | `string` | Responsible caretaker/facilitator (世話人) |
  | `adress` | `string` | Residential address (*note schema typo*: `adress`) |
  | `tel` | `string` | Home telephone number |
  | `phone` | `string` | Mobile phone number |
  | `born` | `string` | Birth date (`YYYY-MM-DD` or `YYYY/MM/DD`) |
  | `join` | `string` | Faith initiation date |
  | `leader` | `string` | Assigned squad leader name |
  | `post` | `string` | Official appointment title (e.g. `'助教師'`, `'世話人'`) |
  | `connect` | `boolean` | Active contact status (true = in touch, false = disconnected) |
  | `part` | `string` | Affiliation department (`'青年部'`, `'大學生'`, `'男子部'`, etc.) |
  | `note` | `string` | Administrative notes |

#### Collection: `info`
Configuration and administrative master tables stored as specific documents:
- `/info/admins`:
  - `emails`: `string[]` (Authorized administrator Google email addresses; verified in `admin.js:21-27`, `index.js:64-72`, `seminar.js:28-34`).
- `/info/set`:
  - `pass`: `string` (Administrative query gate password; e.g. `'1223'` or custom).
  - `login`: `boolean` (Global login switch).
  - `write`: `boolean` (Write permission toggle for input fields).
- `/info/youth`:
  - `leader`: `string[]` (Master list of active group leader names).
- `/info/org`:
  - `part`: `string[]` (Master list of organizational subdivisions).

#### Collection: `allowed_users`
- **Path**: `/allowed_users/{userEmail}`
- **Fields**:
  - `email`: `string`
  - `name`: `string` (Google Profile Display Name)
  - `allowDirectLogin`: `boolean` (If true, bypasses password gate)
  - `lastLogin`: `Timestamp` (serverTimestamp)
  - `linkedMemberId`: `string` (Claimed member document ID from `/member`)
  - `linkedName`: `string` (Claimed member name)
- **Identity Claim Mechanism** (`public/js/list.js:558-620`): Users input their Name, Birth Date (`born`), and Join Date (`join`). If inputs strictly match the database record, the user's Google account is permanently linked to the member record.

#### Collection: `exchange_participants` (Seed Exchange System)
- **Path**: `/exchange_participants/{ticketId}`
- **Key Strategy**: User UID (`user.uid`, anonymous or authenticated Google UID; `public/js/change.js:173-179`).
- **Fields**:
  | Field Name | Type | Description |
  |---|---|---|
  | `name` | `string` | Participant's name |
  | `phone` | `string` | Contact phone |
  | `seedName` | `string` | Name of seed variety brought to exchange |
  | `variety` | `string` | Crop variety / family (e.g., `'茄科'`, `'黑柿留種番茄'`) |
  | `weight` | `number` | Total weight brought in grams |
  | `quota` | `number` | Approved package redemption allowance (核定兌換包數額度) |
  | `selectedBags` | `string[]` | Array of scanned seed bag IDs (e.g. `['BAG-K8S1-B1', 'BAG-K8S1-B2']`) |
  | `status` | `string` | Lifecycle state: `'pending'` (待審核) → `'active'` (選種中) → `'completed'` (已核准出關) |
  | `timestamp` | `Timestamp` | Registration submission timestamp |

#### Collection: `natural_events` & `natural_bookings`
- **Path**: `/natural_events/{eventId}` (`public/js/natural-farm.js:19-82`, `public/js/natural-farm-admin.js:351-367`):
  - `title`: `string`
  - `category`: `string` (`'dining'`, `'farm_exp'`, `'seed_saving'`, `'market'`)
  - `categoryName`: `string`
  - `bannerUrl`: `string`
  - `pricing`: `string`
  - `bringUtensilsBonus`: `string` (e.g., `'+20 Karma'`)
  - `sessions`: `Array<{ id, date, time, max, booked, waitlist }>`
  - `status`: `string` (`'已發布'`)
- **Path**: `/natural_bookings/{token}` (`public/js/natural-farm.js:358-390`):
  - `token`: `string` (Primary Key, format: `SHUMEI-NF-${timestamp36}-${rand4}`)
  - `eventId`: `string`
  - `eventTitle`: `string`
  - `sessionDate`: `string`
  - `sessionTime`: `string`
  - `location`: `string`
  - `userName`: `string`
  - `userPhone`: `string`
  - `userEmail`: `string`
  - `headcount`: `number`
  - `bringUtensils`: `boolean` (Eco-friendly tableware bonus flag)
  - `paymentMethod`: `string` (`'linepay'`, `'newebpay'`, `'onsite'`)
  - `paymentMethodName`: `string`
  - `paymentStatus`: `string`
  - `status`: `string` (`'已確認'` or `'候補中'`)
  - `qrCodeToken`: `string`
  - `checkedIn`: `boolean` (Field check-in flag)
  - `checkedInAt`: `Timestamp`
  - `createdAt`: `string` (ISO timestamp)

#### Collection: `activities_events`
- **Path**: `/activities_events/{eventId}` (`public/js/events.js:270-289`):
  - `title`, `category` (`'研修營隊'`, `'自然農法'`, `'青年活動'`), `startTime`, `capacity`, `registeredCount`, `location`, `fee`, `desc`, `status`, `createdAt`.

#### Collection: `seminars`
- **Path**: `/seminars/{seminarId}` (`public/js/seminar.js:345-365`, `functions/index.js:249-261`):
  - `userId`: `string` (LINE user ID or Google UID)
  - `source`: `string` (`'line'` or `'web'`)
  - `memberName`: `string` (Target youth member name)
  - `date`: `string` (`YYYY-MM-DD` or `YYYY/MM/DD`)
  - `time`: `string`
  - `location`: `string`
  - `feelings`: `string` (Personal reflection / conversation takeaway)
  - `goals`: `string` (Spiritual / faith uplift goal)
  - `attendees`: `string` (Other attendees)
  - `createdAt`: `Timestamp`

#### Collection: `jyorei_logs`
- **Path**: `/jyorei_logs/{autoId}` (`public/js/jyorei.js:252-273`):
  - `date`: `string` (`YYYY-MM-DD`)
  - `reporter`: `string` (Practitioner name)
  - `selfBeliever`: `number` (Jyorei given to believers)
  - `selfNonBeliever`: `number` (Jyorei given to non-believers)
  - `selfTotal`: `number`
  - `lineageMembersCount`: `number`
  - `totalBeliever`: `number`
  - `totalNonBeliever`: `number`
  - `grandTotal`: `number`
  - `lineageDetails`: `Array<{ name, believer, nonBeliever }>`
  - `timestamp`: `Timestamp`

#### Cross-Database Entity: `ganttcraft_projects/shumei`
- **Location**: `gantt-craft-2026` Firestore database (`packages/scheduling/src/services/firebase.ts:17-39`, `public/js/front.js:144-156`):
  - `shumeiStaff`: `Array<{ id, name, role, color, leader }>`
  - `shumeiTags`: `Array<{ id, name, color }>` (`tag_worship`, `tag_study`, `tag_bag`, `tag_johrei`, `tag_nonbeliever`)
  - `shumeiAssignments`: `Array<{ id, staffId, tagId, date, slotId, role: 'main'|'assist', startTime, endTime, durationHours, value }>`
  - `excludedDates`: `string[]` (Holiday / exempt dates)

---

### 1.3 Core Functional Workflows

#### Workflow 1: Public Event Booking & Self-Check-in Flow
1. **Discovery & Session Selection**: Public views interactive cards (`public/js/natural-farm.js:218-290`). Quota progress bar calculates `(booked / max) * 100`. If full, switches to waitlist mode (`開放候補`).
2. **Form Submission & Utensil Incentive**: User selects session, inputs name, phone, email, headcount, and checks `自備環保餐具` (`bringUtensils`).
3. **Token & QR Generation**:
   - Token format: `SHUMEI-NF-${timestamp36}-${rand4}` (`natural-farm.js:359`).
   - QR code rendered using `new QRCode(...)` encoding JSON `{ token, event, name, count, pay }` (`natural-farm.js:410-423`).
   - `.ics` calendar file exported for Apple/Google Calendar (`natural-farm.js:436-459`).
4. **Karma Reward Crediting**: Awards +20 Karma for booking, or +40 Karma if `bringUtensils` is checked (`natural-farm.js:393`).
5. **Physical Check-in Scanner**: Staff opens camera scanner via `Html5QrcodeScanner` (`natural-farm-admin.js:428-460`).
   - Scans token or parses JSON.
   - Updates Firestore `natural_bookings/{token}` with `{ checkedIn: true, checkedInAt: serverTimestamp() }`.
   - Plays audio feedback chime using Web Audio API (`AudioContext`, 880Hz sine wave; `natural-farm-admin.js:518-527`).
   - Generates CSV roster download (`exportRosterCSV`, `natural-farm-admin.js:532-549`).

#### Workflow 2: Food Education Community, Farmer Logs & UGC
1. **Solar Term Farmer Diaries**: 24-solar terms logs (`立夏`, `小滿`, etc.) display soil fragrance, root health, and biodiversity notes (`natural-farm.js:575-612`). Users can like (`likeFeedPost`), share (`shareFeed`), or inquire (`openAskFarmerModal`).
2. **3-Dimensional UGC Sensory Reviews**: Users submit reviews rated along three dimensions:
   - 純淨度 (`purityRating`, 1~5 stars)
   - 土地連結 (`connectionRating`, 1~5 stars)
   - 體驗評價 (`expRating`, 1~5 stars)
   - Review submission awards +50 Karma points (`natural-farm.js:684`).
   - Admin moderation dashboard allows pinning (`isPinned`) and approving (`isApproved`) reviews (`natural-farm-admin.js:572-620`).
3. **Interactive Food Education Tools**:
   - Additive & Sugar Impact Calculator (`calculateAdditiveImpact`, lines 696-719).
   - Food Education Quiz (`submitFoodQuiz`, lines 727-745; awards +20 Karma).
   - Water Rice Field Adoption (`submitAdoptRice`, lines 748-769; allocates personalized wooden sign to field, awards +100 Karma).

#### Workflow 3: Volunteer CRM & Certification Pipeline
1. **4-Stage Kanban CRM Pipeline** (`public/js/natural-farm-admin.js:622-670`):
   - Stage 1: `新申請` (New Application, 0 hrs)
   - Stage 2: `面談評估` (Interview & Assessment, ~12 hrs)
   - Stage 3: `已認證` (Certified Volunteer, >= 30 hrs)
   - Stage 4: `活躍奉仕` (Active Service Core Leader, >= 120 hrs)
2. **Service Hours Logging**: Volunteers log hours through event attendance, clean-up shifts, and kiosk service (`+40 Karma / hours`).
3. **Certificate Generation**: When hours >= 30, admin triggers `generateVolunteerCert(name, hours)` (`natural-farm-admin.js:672-680`), minting certificate modal with unique serial code `SHUMEI-VOL-2026-${rand4}` and formal issue date.

#### Workflow 4: Karma Green Points Ledger & Redemption
1. **Balance Storage**: Stored in `localStorage.getItem('shumei_user_karma')` (default 380 pts; `natural-farm.js:137`).
2. **Earning Rules**:
   - Booking with tableware: +40 pts (without tableware: +20 pts).
   - UGC Review submission: +50 pts.
   - Food education quiz pass: +20 pts.
   - Rice adoption: +100 pts.
   - Volunteer check-in: +40 pts.
3. **Reward Voucher Minting**: User calls `redeemKarmaReward(rewardName, cost)` (`natural-farm.js:531-552`). Deducts points, generates voucher `{ id: 'VOUCHER-...', title: rewardName, date: YYYY-MM-DD, code: 'SHUMEI-REWARD-${rand6}' }`, and adds to `userVouchers` wallet.

#### Workflow 5: Seed Exchange & Barcode Optical Verification (`public/js/change.js`)
1. **Public Self-Registration**: Public registers brought seeds (name, phone, seedName, variety, weight). Saves to `exchange_participants/{uid}` with `status: 'pending'`, `quota: 0`.
2. **Staff Approval & Quota Assignment**: Staff inspects physical seed quality, inputs approved pack quota (`quota`), updates `status: 'active'`.
3. **Packaging & QR Label Generation**:
   - System calculates `packCount`.
   - Generates unique bag IDs: `BAG-${uid.substring(4)}-B${i}`.
   - Uses `QRCode.js` to print thermal label format with bag ID and crop variety.
4. **Self-Service Optical Bag Scanning**:
   - Participant activates device camera via `Html5Qrcode`.
   - Scans seed bag QR (`BAG-...`). Verifies uniqueness in cart.
   - Updates `exchange_participants/{uid}.selectedBags`.
5. **Exit Verification Gate**:
   - Exit staff selects participant. Compares `selectedBags.length` against `quota`.
   - If `count > quota`: triggers `⚠️ 超額警報` (`exit-status-badge`).
   - If valid: staff approves exit, updating `status: 'completed'`.

---

### 1.4 Cloud Functions & External Integrations

#### Cloud Function 1: `lineWebhook` (`functions/index.js:20-56`)
- Endpoint: `POST https://asia-east1-shumei-2025.cloudfunctions.net/lineWebhook`
- Handles LINE Messaging Webhook events. Publishes text events asynchronously to Google Cloud Pub/Sub topic `process-line-event` within 200ms to prevent LINE webhook timeouts.

#### Cloud Function 2: `processLineEvent` (`functions/index.js:59-292`)
- Trigger: Pub/Sub topic `process-line-event`.
- Secret Manager: `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `GEMINI_API_KEY`.
- Logic:
  - If user queries statistics (`統計`, `上個月`, `X月`): reads Firestore collection `seminars`, aggregates records by date, formats a structured text message, and replies via LINE Messaging API.
  - If user mentions seminar registration (`進行座談`, `跟...座談`, etc.): invokes Google Generative AI `gemini-2.5-flash` with Taipei time context.
  - Extracts structured JSON: `memberName`, `date`, `time`, `location`, `feelings`, `goals`, `attendees`.
  - Writes to Firestore collection `seminars`.
  - Replies on LINE with confirmation summary and a deep-link URL: `https://shumei-2025.web.app/seminar.html?q=${encodeURIComponent(memberName)}`.

---

## 2. Logic Chain

```
[Observation: change.js & natural-farm.js generate vouchers and exchange bag IDs]
                               │
                               ▼
[Observation: change.js generates BAG-${uid}-B${i} and checks selectedBags vs quota]
[Observation: natural-farm.js mints voucher code SHUMEI-REWARD-${rand6} for seed redemption]
                               │
                               ▼
[Inference 1: Seed Redemption Interface]
Shumei already has an end-to-end tokenized quota & voucher mechanism. 
When a member spends Karma points on "自家採種種子包", Shumei issues a voucher code 
or grants exchange quota. This is the exact integration surface for Seed-Bank!
                               │
                               ▼
[Observation: natural-farm-admin.js implements 4-stage Volunteer Kanban (新申請->面談->已認證->活躍奉仕)]
[Observation: volunteer hours logged (0h -> 12h -> 30h -> 120h) & SHUMEI-VOL-2026-xxxx certificates]
                               │
                               ▼
[Inference 2: Volunteer CRM & Certification Interface]
Shumei's 4 stages map 1:1 to Seed-Bank's 4-tier membership authorization matrix:
  - Shumei 新申請 (0h)          <---> Seed-Bank 一般會員 (Tier 1)
  - Shumei 已認證 (30h+ 證書)    <---> Seed-Bank 認證採種者 (Tier 2)
  - Shumei 活躍奉仕 (120h+ 核心)  <---> Seed-Bank 分會幹部 (Tier 3)
  - Shumei 總管理員 (info/admins) <---> Seed-Bank 總會管理員 (Tier 4)
                               │
                               ▼
[Observation: natural-farm.js tracks crop generations (第12代越光米, 第9代黑豆) & field diaries]
[Observation: lineage.js tracks spiritual parentage via 3D force graph]
                               │
                               ▼
[Inference 3: Provenance & Educational Storytelling Interface]
Shumei possesses rich storytelling data (field photos, farmer diaries, sensory reviews, generation tags),
but lacks physical lot inventory, germination rate tests, and cold storage sensor telemetry.
Seed-Bank possesses physical warehouse records and 14~18 character accession lot codes, but lacks 
consumer-facing storytelling and recipe engagement. Linking Seed-Bank's QR code to Shumei's URL 
creates a bidirectional bridge.
                               │
                               ▼
[Observation: Cloud Functions v2, Pub/Sub, Gemini 2.5 Flash, Firestore REST API in code]
                               │
                               ▼
[Inference 4: Cross-System Synchronization Architecture]
Shumei already demonstrates cross-project Firestore querying (connecting to gantt-craft-2026 
via Firestore REST API and multi-instance Firebase SDK). A unified synchronization layer can 
use Firebase Cloud Functions HTTPS/PubSub endpoints to exchange JSON payloads with Seed-Bank.
```

---

## 3. Caveats

1. **Security Rules in Cloud**: There is no local `firestore.rules` file in the Git repository. Authorization is currently enforced client-side via `info/admins`, `info/set`, and `allowed_users/{email}`. In production, matching Cloud Firestore Security Rules must be deployed to prevent direct unauthenticated REST/SDK writes.
2. **Mock Fallbacks in Client Code**: `natural-farm.js` and `natural-farm-admin.js` contain rich default mock data (`DEFAULT_EVENTS`, `DEFAULT_FEED`, `DEFAULT_REVIEWS`, `volunteerList`, `rosterData`) to ensure flawless offline demo execution when Firestore is disconnected. Real data is merged via Firestore listeners when online.
3. **Seed-Bank Codebase Separation**: Seed-Bank is a separate React 19 / TypeScript application not stored in this directory. Observations regarding Seed-Bank in this report are grounded in the project specifications in `ORIGINAL_REQUEST.md`.

---

## 4. Conclusion & Identified Integration Surfaces

Shumei is functionally rich on public engagement, community building, volunteer hours logging, and food education, featuring clean integration touchpoints:

### Concrete Integration Surfaces:
1. **Seed Package Redemption Surface**:
   - **Shumei Action**: In `natural-farm.js:531-552` (`redeemKarmaReward`), when a member redeems a seed packet using 100 Karma points, a voucher record is generated.
   - **Integration Endpoint**: A webhook or Cloud Function `redeemSeedBankVoucher` can send `{ voucherCode, userUid, cropType, quantity: 1 }` to Seed-Bank.
   - **Seed-Bank Response**: Deducts 1 physical package from warehouse inventory, logs TablePress circulation, and generates a 100x60mm thermal label with Shumei voucher tracking.

2. **Volunteer Qualification & Certificate Surface**:
   - **Shumei Action**: `natural-farm-admin.js:672` (`generateVolunteerCert`) issues a certificate with code `SHUMEI-VOL-2026-XXXX` once a volunteer logs >= 30 hours.
   - **Integration Endpoint**: Shumei can expose `/api/volunteer/verify?code=...` or export a verified volunteer list. Seed-Bank ingests this serial number to automatically elevate a user from "一般會員" to "認證採種者".

3. **Crop Provenance & Storytelling Surface**:
   - **Shumei Action**: `natural-farm.html` hosts crop generation profiles (`第 12 代越光米`, `第 9 代黑豆`), 24-solar term farmer diaries, and cooking recipes.
   - **Integration Endpoint**: Seed-Bank QR code thermal labels can embed deep links: `https://shumei-2025.web.app/farm/natural-farm.html?crop=koshihikari_gen12`. Conversely, Shumei's seed memory bank can call Seed-Bank's lot API to display the accession number, harvest year, and germination percentage.

4. **API & Event Synchronizer**:
   - Shumei's existing `functions/` codebase has Cloud Functions v2 and Pub/Sub architecture. A new HTTPS endpoint `api/cross-sync` can be hosted in `functions/index.js` to handle bidirectional syncing with Seed-Bank without altering the core architecture.

---

## 5. Verification Method

To independently verify the observations and code claims in this report:

1. **Verify Member Data & Lineage Graph**:
   ```bash
   node /Users/tsaisungen/Sites/shumei/scripts/verify-lineage.js /Users/tsaisungen/Sites/shumei/data_dumps/latest_data.json
   ```
   *Expected Output*: `總成員數：254, 總節點數：399, 總連結數：253, 所有連結驗證通過，無孤立節點。`

2. **Verify Cloud Functions Syntax & Dependencies**:
   ```bash
   node -c /Users/tsaisungen/Sites/shumei/functions/index.js
   ```
   *Expected Output*: Exits with code 0 (clean JavaScript syntax).

3. **Inspect Key File Locations**:
   - Seed Exchange & Optical Cart: `public/js/change.js` (lines 76-105, 173-183, 244-250, 290-330, 580-600)
   - Karma Ledger & UGC Reviews: `public/js/natural-farm.js` (lines 358-398, 531-552, 658-693)
   - Volunteer CRM Kanban & Certificates: `public/js/natural-farm-admin.js` (lines 92-98, 380-405, 622-680)
   - Cloud Functions Pub/Sub & Gemini: `functions/index.js` (lines 20-56, 59-292)
   - Cross-Project Scheduling & Duty Types: `packages/scheduling/src/types/shumei.ts`, `packages/scheduling/src/constants/shiftSlots.ts`

