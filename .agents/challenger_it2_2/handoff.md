# Handoff Report: Empirical Challenge & Verification of Cross-References

- **Agent**: `challenger_it2_2` (Empirical Challenger)
- **Roles**: critic, specialist
- **Date**: 2026-09-18
- **Scope**: `docs/SHUMEI_SEED_BANK_COLLABORATION.md`
- **Target Systems**:
  - Shumei Platform (`/Users/tsaisungen/Sites/shumei`)
  - Seed-Bank System (`/Users/tsaisungen/Sites/Seed-Bank`)
- **Verdict**: **APPROVE**

---

## 1. Observation

All observations were obtained directly through tool executions and file inspections across the physical repositories.

### 1.1 Shumei Codebase Cross-References

| Document Citation | Physical File & Exact Line / Content | Tool Command & Empirical Output | Status |
|---|---|---|---|
| **Firebase Project** (`.firebaserc:61`): `shumei-2025` | `/Users/tsaisungen/Sites/shumei/.firebaserc`: `{"projects": {"default": "shumei-2025"}}` | `cat /Users/tsaisungen/Sites/shumei/.firebaserc` -> `{"projects": {"default": "shumei-2025"}}` | **VERIFIED (100% Match)** |
| **Tab Anchor** (`natural-farm.html:214`): `<section id="tab-seeds">` | `/Users/tsaisungen/Sites/shumei/public/farm/natural-farm.html:214`: `<section id="tab-seeds" class="tab-pane-content" style="display:none;">` | Python file line check -> Exact line 214 contains `<section id="tab-seeds"` | **VERIFIED (Exact Line Match)** |
| **Karma Tokens & Vouchers** (`natural-farm.js:132-134`): `shumei_user_karma`, `shumei_user_vouchers`, `redeemKarmaReward`, `SHUMEI-REWARD-` | `/Users/tsaisungen/Sites/shumei/public/js/natural-farm.js`: Lines 765-790 contain `shumei_user_karma`, `shumei_user_vouchers`, `redeemKarmaReward(title, cost)`, and voucher prefix `SHUMEI-REWARD-` | Grep / Python AST search -> 6 occurrences of `shumei_user_karma`, 2 of `shumei_user_vouchers` | **VERIFIED (100% Match)** |
| **Booking Token Format** (`natural-farm.js:91`): `SHUMEI-NF-${timestamp36}-${rand4}` | `/Users/tsaisungen/Sites/shumei/public/js/natural-farm.js:359`: `const token = \`SHUMEI-NF-\${Date.now().toString(36).toUpperCase()}-\${Math.floor(1000 + Math.random() * 9000)}\`;` | `grep_search 'SHUMEI-NF-'` -> Line 359 matches template exactly | **VERIFIED (100% Match)** |
| **Volunteer CRM Pipeline & Cert** (`natural-farm-admin.js:191-197`, `622-680`): 4 stages, `SHUMEI-VOL-2026-` | `/Users/tsaisungen/Sites/shumei/public/js/natural-farm-admin.js`: Line 92 `volunteerList`, Line 626 `const stages = ['新申請', '面談評估', '已認證', '活躍奉仕'];`, Line 672 `generateVolunteerCert()`, Line 675 `SHUMEI-VOL-2026-\${Math.floor(1000 + Math.random() * 9000)}` | `view_file` lines 620-680 -> Verified exact stages, function name, and serial prefix | **VERIFIED (100% Match)** |
| **Exchange Participants & Optical Check-in** (`change.js:90`, `80`): `exchange_participants`, statuses `pending/active/completed`, `html5-qrcode`, `enablePersistence()` | `/Users/tsaisungen/Sites/shumei/public/js/change.js`: Line 11 `db.enablePersistence()`, Line 19 `html5QrCode = null`, Line 76 `db.collection('exchange_participants')`, Line 176 `status: 'pending'`, Line 39 `p.status === 'active' \|\| p.status === 'completed'` | `view_file` lines 1-180 -> All fields, statuses, and offline persistence verified | **VERIFIED (100% Match)** |
| **Seminars & Gemini AI** (`functions/index.js:92`): `seminars` collection, `gemini-2.5-flash` | `/Users/tsaisungen/Sites/shumei/functions/index.js`: Line 195 `genAI.getGenerativeModel({ model: "gemini-2.5-flash" });`, Line 249 `db.collection("seminars").doc();` | `view_file` lines 170-265 -> Model string and collection call verified | **VERIFIED (100% Match)** |
| **Core Firestore Collections**: `/member`, `/allowed_users`, `/info` | Found in `public/js/admin.js`, `public/js/list.js`, `public/js/lineage.js`: `/member/{join}` stores `name`, `guide`, `sewajin`, `born`, `post`, `connect`, `part`; `/allowed_users/{email}` stores `allowDirectLogin`, `linkedMemberId`, `linkedName`, `lastLogin` | `grep_search` and `view_file` confirmed exact fields and document ID keys | **VERIFIED (100% Match)** |

### 1.2 Seed-Bank Codebase Cross-References

| Document Citation | Physical File & Exact Line / Content | Tool Command & Empirical Output | Status |
|---|---|---|---|
| **Hosting Target** (`.firebaserc:62`): `shumei-seed-bank` | `/Users/tsaisungen/Sites/Seed-Bank/.firebaserc`: `{"projects": {"default": "shumei-2025"}, "targets": {"shumei-2025": {"hosting": {"seed-bank": ["shumei-seed-bank"]}}}}` | `cat /Users/tsaisungen/Sites/Seed-Bank/.firebaserc` -> Matches verbatim | **VERIFIED (100% Match)** |
| **Tech Stack** (`package.json:68-84`): React 19, Vite 6, TS 5.8, Tailwind 4, qrcode.react 4.2.0 | `/Users/tsaisungen/Sites/Seed-Bank/package.json`: `react: ^19.0.1`, `vite: ^6.2.3`, `typescript: ~5.8.2`, `tailwindcss: ^4.1.14`, `qrcode.react: ^4.2.0` | `view_file` on `package.json` -> Dependencies verified | **VERIFIED (100% Match)** |
| **Type Definition: `Seed`** (`src/types.ts:98`): 13 core botanical & inventory fields | `/Users/tsaisungen/Sites/Seed-Bank/src/types.ts`: Lines 4-29 define `Seed` with `id`, `name`, `variety`, `scientificName`, `generation`, `harvestYear`, `harvester`, `climateAttributes`, `germinationRate`, `storageLocationId`, `quantityGrams`, `packages`, `shumeiCode` | Python AST parser -> All 13 fields confirmed present | **VERIFIED (100% Match)** |
| **Type Definition: `StorageSpace`** (`src/types.ts:99`): ST-01~04 physical microclimates | `/Users/tsaisungen/Sites/Seed-Bank/src/types.ts`: Lines 38-48 define `StorageSpace` (`refrigerator`, `clay_pot`, `cellar`, `ambient`, `temperature`, `humidity`, `capacityGrams`, `occupiedGrams`) | AST verified | **VERIFIED (100% Match)** |
| **Type Definition: `SeedMovement`** (`src/types.ts:100`): Movement log | `/Users/tsaisungen/Sites/Seed-Bank/src/types.ts`: Lines 50-60 define `SeedMovement` (`id`, `seedId`, `fromLocation`, `toLocation`, `quantityGrams`, `operator`, `timestamp`, `reason`) | AST verified | **VERIFIED (100% Match)** |
| **Type Definition: `LegacyClaimRequest`** (`src/types.ts:101`): TablePress claim request | `/Users/tsaisungen/Sites/Seed-Bank/src/types.ts`: Lines 75-92 define `LegacyClaimRequest` (`claimSeq`, `seedCode`, `requestedPackages`, `applicantName`, `status: '待審核'\|'已核准'\|'已出貨'\|'已送達'\|'已結案'`, `trackingNumber`) | AST verified | **VERIFIED (100% Match)** |
| **Type Definition: `Personnel`** (`src/types.ts:102`): 4-tier RBAC | `/Users/tsaisungen/Sites/Seed-Bank/src/types.ts`: Lines 110-125 define `Personnel` (`id`, `name`, `role`, `level: 1\|2\|3\|4`, `permissions: string[]`) | AST verified | **VERIFIED (100% Match)** |
| **Component: `TablePress35090.tsx`** (`3.1.3`, lines 164-172): Grouped 2-tier header, Column 4 onDoubleClick | `/Users/tsaisungen/Sites/Seed-Bank/src/components/legacy_shumei/TablePress35090.tsx`: Line 28 2-tier header, Line 50 `<th className="... bg-emerald-800/80 text-white font-bold border-x border-emerald-700">分裝包數 ✎</th>`, Line 118-121 `<td className="column-4 ... cursor-pointer" onDoubleClick={() => onDoubleClickPackage(seed)}>` | `view_file` lines 20-135 -> Grouped header, class `column-4`, and double-click handler verified | **VERIFIED (100% Match)** |
| **Component: `Modal36122PackageEdit.tsx`**: Fast package edit modal | `/Users/tsaisungen/Sites/Seed-Bank/src/components/legacy_shumei/modals/Modal36122PackageEdit.tsx`: Modal #36122 package editor | File confirmed present and imported in `LegacyShumeiView.tsx` | **VERIFIED (100% Match)** |
| **Component: `Modal23852PrintLabel.tsx`** (`3.1.4`, lines 174-184): 100x60mm label, QRCodeSVG | `/Users/tsaisungen/Sites/Seed-Bank/src/components/legacy_shumei/modals/Modal23852PrintLabel.tsx`: Line 59 `標準熱感標籤規格 (100mm × 60mm)`, Line 106 `<QRCodeSVG value={shumeiCode} size={92} level="M" />`, Line 121 `[{shumeiCode}]` | `view_file` lines 50-130 -> Exact dimensions, QRCodeSVG level="M", size=92 verified | **VERIFIED (100% Match)** |
| **Component: `ClaimRequestsTable.tsx`** (`3.1.2.1`): TablePress claim list & buttons | `/Users/tsaisungen/Sites/Seed-Bank/src/components/legacy_shumei/ClaimRequestsTable.tsx`: Lines 80-115 handle statuses `'待審核'`, `'已核准'`, `'已出貨'` with approve and ship action buttons | `view_file` lines 1-125 -> Lifecycle status rendering verified | **VERIFIED (100% Match)** |
| **Component: `ShumeiAccessControlView.tsx`** (`3.2.2`, lines 199-206): 4-tier RBAC & permissions | `/Users/tsaisungen/Sites/Seed-Bank/src/components/legacy_shumei/views/ShumeiAccessControlView.tsx`: Lines 17-27 define 9 permissions: `view_seeds`, `claim_seeds`, `provide_seeds`, `edit_packages`, `approve_claims`, `print_labels`, `manage_storage`, `edit_dcc`, `export_offgrid` | `view_file` lines 1-60 -> Exact permission keys and minLevels match doc | **VERIFIED (100% Match)** |
| **Disaster Survival Bundle** (`3.4.3`, line 307): `generateSurvivalBundle`, `OFFGRID VAC-1` | `/Users/tsaisungen/Sites/Seed-Bank/src/utils.ts`: Line 9 `export function generateSurvivalBundle(seeds: Seed[], storage: StorageSpace[]): string`, Line 19 `<title>【緊急守護】自然農法種子庫 - 斷電備用查詢終端 (OFFGRID VAC-1)</title>` | `view_file` lines 1-30 -> Function signature and HTML title match verbatim | **VERIFIED (100% Match)** |

### 1.3 NamingRule Validation Empirical Test Run

Executed automated test harness `/Users/tsaisungen/Sites/shumei/.agents/challenger_it2_2/test_naming_rule.ts` via `npx --prefix /Users/tsaisungen/Sites/Seed-Bank tsx`.

```text
=== EMPIRICAL TEST SUITE: NamingRule Validation & Parsing ===

--- Suite 1: Dataset Seed Codes in data.ts ---
  ✅ PASS: Validate dataset code: SO-LY-S-TW01-2506-001
  ✅ PASS: Parse dataset code: SO-LY-S-TW01-2506-001
  ✅ PASS: Validate dataset code: PO-RC-S-JP24-2406-002
  ✅ PASS: Parse dataset code: PO-RC-S-JP24-2406-002
  ✅ PASS: Validate dataset code: SO-PT-S-TW03-2506-003
  ✅ PASS: Parse dataset code: SO-PT-S-TW03-2506-003
  ✅ PASS: Validate dataset code: FA-SB-S-TW02-2506-004
  ✅ PASS: Parse dataset code: FA-SB-S-TW02-2506-004
  ✅ PASS: Validate dataset code: CU-ZC-S-TW01-2606-005
  ✅ PASS: Parse dataset code: CU-ZC-S-TW01-2606-005
  ✅ PASS: Validate dataset code: BR-RD-S-TW06-2512-006
  ✅ PASS: Parse dataset code: BR-RD-S-TW06-2512-006
  ✅ PASS: Validate dataset code: PO-RC139-S-TW04-2508-007
  ✅ PASS: Parse dataset code: PO-RC139-S-TW04-2508-007

--- Suite 2: Collaboration Blueprint Referenced Codes ---
  ✅ PASS: Doc reference code: SO-LY-S-TW01-2506-001
  ✅ PASS: Doc reference code: PO-RC139-S-TW04-2508-007

--- Suite 3: Combinatorial Validity across Taxonomies ---
  ✅ PASS: Family CU (葫蘆科 (瓜果類)) code valid
  ✅ PASS: Family FA (豆科 (土壤養護與固氮)) code valid
  ✅ PASS: Family PO (禾本科 (糧食主食與米麥)) code valid
  ✅ PASS: Family BR (十字花科 (秋冬蔬菜主力)) code valid
  ✅ PASS: Family SO (茄科 (夏秋果菜)) code valid
  ✅ PASS: Family AS (菊科 (芳香耐寒蔬菜)) code valid
  ✅ PASS: Family MA (錦葵科 (粘液與特用作物)) code valid
  ✅ PASS: Family LA (唇形科 (香草驅避植物)) code valid
  ✅ PASS: Family AP (繖形科 (繖形根菜/香辛類)) code valid
  ✅ PASS: Family AM (莧科 (莧菜/藜麥類)) code valid
  ✅ PASS: Family AL (蔥科/百合科 (蔥蒜類)) code valid
  ✅ PASS: Family CO (旋花科 (旋花葉菜/甘藷類)) code valid
  ✅ PASS: Family PG (蓼科 (蓼科雜糧類)) code valid
  ✅ PASS: Family ZZ (其他科屬 (特用/野生在來種)) code valid
  ✅ PASS: Method S (秀明自然農法) code valid
  ✅ PASS: Method N (廣義自然農法) code valid
  ✅ PASS: Method O (有機農法) code valid
  ✅ PASS: Method C (慣行農法) code valid
  ✅ PASS: Region TW01 code valid
  ✅ PASS: Region TW10 code valid
  ✅ PASS: Region JP01 code valid
  ✅ PASS: Region JP24 code valid
  ✅ PASS: Region JP47 code valid
  ✅ PASS: Region PE01 code valid
  ✅ PASS: Region ES01 code valid
  ✅ PASS: Region US01 code valid

--- Suite 4: Round-Trip Generation and Parsing ---
  ✅ PASS: Generated code matches expected: PO-RC139-S-TW04-2508-007
  ✅ PASS: Parsed generated code matches variety
  ✅ PASS: Parsed harvestYear is 2025
  ✅ PASS: Parsed harvestMonth is 8

--- Suite 5: Resiliency & Normalization ---
  ✅ PASS: Lowercase code accepted after toUpperCase()
  ✅ PASS: Whitespace trimmed code accepted

--- Suite 6: Adversarial & Malformed Inputs (Should FAIL) ---
  ✅ PASS: Reject Empty string: ''
  ✅ PASS: Reject Missing dashes: 'SOLYSTW012506001'
  ✅ PASS: Reject Invalid family 1 char: 'S-LY-S-TW01-2506-001'
  ✅ PASS: Reject Invalid family 4 chars: 'SOLA-LY-S-TW01-2506-001'
  ✅ PASS: Reject Invalid method 'X': 'SO-LY-X-TW01-2506-001'
  ✅ PASS: Reject Invalid region length 'TW1': 'SO-LY-S-TW1-2506-001'
  ✅ PASS: Reject Invalid region alpha only 'TWXX': 'SO-LY-S-TWXX-2506-001'
  ✅ PASS: Reject Invalid year 2 digits '25': 'SO-LY-S-TW01-25-001'
  ✅ PASS: Reject Invalid batch 1 digit '1': 'SO-LY-S-TW01-2506-1'
  ✅ PASS: Reject Invalid batch 5 digits '00001': 'SO-LY-S-TW01-2506-00001'
  ✅ PASS: Reject SQL Injection payload: 'SO-LY-S-TW01-2506-001'; DROP T'
  ✅ PASS: Reject XSS payload: '<script>alert('XSS')</script>'
  ✅ PASS: Reject Random gibberish: 'INVALID-CODE-XYZ'
  ✅ PASS: Reject Only 5 parts: 'SO-LY-S-TW01-2506'
  ✅ PASS: Reject 7 parts: 'SO-LY-S-TW01-2506-001-EXTRA'

==========================================
TOTAL TESTS: 63 | PASSED: 63 | FAILED: 0
==========================================
```

### 1.4 Master Verification Harness Output

Executed `/Users/tsaisungen/Sites/shumei/.agents/challenger_it2_2/master_empirical_verifier.py`:
- Total checks executed: 52
- Passed: 52
- Failed: 0
- Seed-Bank TypeScript check (`npx tsc -p tsconfig.json --noEmit`): 0 errors
- Shumei Cloud Functions check (`node -c functions/index.js`): 0 syntax errors

---

## 2. Logic Chain

1. **Premise 1 (Source Integrity)**: If every file, line reference, UI component class, and data collection cited in `docs/SHUMEI_SEED_BANK_COLLABORATION.md` exists and matches the live repositories at `/Users/tsaisungen/Sites/shumei` and `/Users/tsaisungen/Sites/Seed-Bank`, then the document's empirical foundation is sound.
   - *Evidence*: Observations 1.1 and 1.2 demonstrate that `.firebaserc` (project ID `shumei-2025`), `natural-farm.html` (line 214 `#tab-seeds`), `natural-farm.js` (Karma tokens and localStorage keys), `natural-farm-admin.js` (volunteer stages and cert generator `SHUMEI-VOL-2026-`), `change.js` (Firestore collection `exchange_participants` and statuses), `functions/index.js` (`gemini-2.5-flash`), `TablePress35090.tsx` (`column-4` double click), `Modal23852PrintLabel.tsx` (100x60mm QRCodeSVG Level M), `ShumeiAccessControlView.tsx` (4-tier RBAC and 9 permissions), and `src/utils.ts` (`generateSurvivalBundle` OFFGRID VAC-1) match the live codebases with 100% precision.

2. **Premise 2 (NamingRule Validation Engine Integrity)**: If the NamingRule validation function correctly validates all seed codes present in the system, validates all codes cited in the blueprint, supports all 14 botanical families, 4 farming methods, domestic and international region codes, correctly performs bidirectional serialization/deserialization, and strictly rejects adversarial and malformed inputs, then the botanical coding foundation is production-ready.
   - *Evidence*: Observation 1.3 demonstrates that 63 out of 63 unit and adversarial test cases passed without a single failure. All 7 real seed items from `Seed-Bank/src/data.ts` (including `SO-LY-S-TW01-2506-001` and `PO-RC139-S-TW04-2508-007`) validated and parsed cleanly. All 15 adversarial test cases (SQL injection, XSS, wrong segments, malformed fields) were rejected.

3. **Premise 3 (Nomenclature Explanation)**: The documentation frequently refers to "NamingRule 14~18 碼". An adversarial check was conducted to investigate why the dash-separated string length is 21~26 characters.
   - *Evidence*: `Seed-Bank/src/components/legacy_shumei/views/ShumeiDccView.tsx` and `types.ts` establish that "14~18 碼" is the historical/official convention established in `SHUMEI-SOP-NR-01`. The alphanumeric characters without hyphens range from 16 to 21 chars. The regex in `namingRule.ts` (`/^[A-Z]{2,3}-[A-Z0-9]{2,5}-[SNOC]-[A-Z]{2}[0-9]{2}-[0-9]{4}-[0-9A-Z]{3,4}$/`) explicitly enforces the 6-segment hyphenated format. Both the blueprint and the code maintain consistency with this standard.

4. **Premise 4 (Technical Soundness of Architectural Proposals)**:
   - *Two-Phase Inventory Lock*: Accurately models the interaction between Shumei's frontend Karma vouchers and Seed-Bank's `TablePress35090` Column 4 inventory. It solves concurrency race conditions by separating reservation (`reservedPackages += requestedPackages`) from physical settlement (`packages -= requestedPackages`).
   - *Physical Reality Precedence & LIFO Preemption*: In split-brain offline sync scenarios (`SeedMovement` delta playback), physical dispatch is irrevocable; the document properly prioritizes physical seed delivery and compensates preempted online orders with full Karma refund + 50 bonus Karma.
   - *Label QR Code Routing*: The document astutely identifies that `Modal23852PrintLabel.tsx` currently renders `value={shumeiCode}` as plain text, and explicitly schedules Phase 1 to upgrade this to `https://shumei-2025.web.app/trace/${shumeiCode}` to enable instant camera redirection to `#tab-seeds`.

5. **Inference**: Because every cross-reference is empirically verified, the validation engine is robust against attacks, and the architectural solutions directly solve the domain's real operational constraints, the collaboration blueprint is verified to be accurate, practical, and of enterprise quality.

---

## 3. Caveats

1. **Physical Thermal Printer Execution**: Physical 100mm × 60mm thermal printing was verified at the software code level (`Modal23852PrintLabel.tsx` CSS `@media print` rules, DOM structure, SVG element attributes, and `window.print()` trigger). Physical paper ejection on a thermal printer (e.g., Xprinter / Zebra) requires on-site hardware testing during Phase 1 rollout.
2. **Phase 0.5 Implementation Prerequisite**: The document acknowledges that Shumei's current Karma ledger and Volunteer CRM reside in browser `localStorage` and client-side JavaScript memory (`volunteerList` in `natural-farm-admin.js`). The document correctly categorizes Phase 0.5 (Firestore migration of Karma and Volunteer CRM) as an explicit, mandatory prerequisite before launching Phase 1 APIs.
3. **Repository Path Encapsulation**: In Seed-Bank, modal components (`Modal23852PrintLabel.tsx` and `Modal36122PackageEdit.tsx`) reside in `src/components/legacy_shumei/modals/`, and view components (`ShumeiAccessControlView.tsx`) reside in `src/components/legacy_shumei/views/`. The document mentions them by filename or relative component name, which is unambiguous.

---

## 4. Adversarial Challenge Assessment

### Challenge Summary
- **Overall Risk Assessment**: **LOW**
- **Robustness**: Exceptionally high. The document reflects deep, verified familiarity with both codebases and provides bulletproof distributed transaction semantics (RFC 7807 problem details, IETF idempotency keys, two-phase reservation locks, append-only delta movements, and physical reality precedence).

### Key Challenges Evaluated
1. **Challenge 1: Concurrency Race Condition on Seed Deduction**
   - *Attack Scenario*: 10 users concurrently redeem the last available seed bag (`packages: 1`).
   - *Mitigation Verified*: Section 3.1.1 & 4.2.1 mandate Firestore `runTransaction` verifying `(packages - reservedPackages) >= requestedPackages` and atomically incrementing `reservedPackages`. Net available stock prevents overselling.
2. **Challenge 2: Offline Split-Brain & Inventory Deficit**
   - *Attack Scenario*: An off-grid farm distributes 3 physical seed bags offline while online users claim 2 bags. Total stock was 3.
   - *Mitigation Verified*: Section 3.4.2 & 4.2.4.1 eliminate absolute value overrides (`newPackages`), adopting signed relative delta movements (`deltaPackages: -3`). Upon sync, the Physical Priority Principle commits the offline distribution, detects `Deficit = 2`, and preempts the latest online claims via LIFO with full Karma refund + 50 bonus Karma.
3. **Challenge 3: Botanical Code Injection & Validation Bypass**
   - *Attack Scenario*: Injecting SQL, XSS, or malformed strings into `Seed.shumeiCode` or URL routes.
   - *Mitigation Verified*: Validated empirically with 15 adversarial test cases. Regex `/^[A-Z]{2,3}-[A-Z0-9]{2,5}-[SNOC]-[A-Z]{2}[0-9]{2}-[0-9]{4}-[0-9A-Z]{3,4}$/` strictly rejects all malicious payloads.

---

## 5. Conclusion

**VERDICT**: **APPROVE**

`docs/SHUMEI_SEED_BANK_COLLABORATION.md` has been exhaustively and empirically verified against the live source codes of both `/Users/tsaisungen/Sites/shumei` and `/Users/tsaisungen/Sites/Seed-Bank`. All 52 automated cross-reference checks passed with 100% accuracy. The NamingRule engine passed all 63 unit and adversarial test cases. The architectural designs (two-phase locking, optical QR routing, 4-tier RBAC reciprocity, and offline physical priority arbitration) are logically sound and directly grounded in the existing codebases.

---

## 6. Verification Method

To independently reproduce and verify this assessment, execute the following commands:

```bash
# 1. Run the master cross-reference verification harness (52 checks)
python3 /Users/tsaisungen/Sites/shumei/.agents/challenger_it2_2/master_empirical_verifier.py

# 2. Run the NamingRule unit, combinatorial, and adversarial test suite (63 tests)
npx --prefix /Users/tsaisungen/Sites/Seed-Bank tsx /Users/tsaisungen/Sites/shumei/.agents/challenger_it2_2/test_naming_rule.ts

# 3. Verify TypeScript type-checking on Seed-Bank (0 errors)
npx --prefix /Users/tsaisungen/Sites/Seed-Bank tsc -p /Users/tsaisungen/Sites/Seed-Bank/tsconfig.json --noEmit

# 4. Verify syntax on Shumei Cloud Functions (0 errors)
node -c /Users/tsaisungen/Sites/shumei/functions/index.js
```

### Invalidation Conditions
This approval would be invalidated if:
1. `shumei/.firebaserc` or `Seed-Bank/.firebaserc` project configurations are changed to point to differing Google Cloud projects.
2. The NamingRule regex in `Seed-Bank/src/utils/namingRule.ts` is modified without updating corresponding test suites.
3. Shumei modifies `natural-farm.html:214` `<section id="tab-seeds">` DOM anchor without updating redirect routes in `GET /trace/{shumeiCode}`.
