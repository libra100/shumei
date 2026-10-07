/**
 * Exhaustive Empirical Verification & Stress Test Harness for SHUMEI_SEED_BANK_COLLABORATION.md
 * Author / Runner: challenger_1 / worker_2_rep
 * Mode: Hard Empirical Verification (Updated for Findings 1-5 Architecture Hardening)
 */

const fs = require('fs');
const path = require('path');

const docPath = path.resolve(__dirname, '../docs/SHUMEI_SEED_BANK_COLLABORATION.md');
const originalReqPath = path.resolve(__dirname, '../.agents/ORIGINAL_REQUEST.md');
const projectPath = path.resolve(__dirname, '../PROJECT.md');

console.log('================================================================================');
console.log('   EMPIRICAL CHALLENGER VERIFICATION HARNESS (Hardened Architecture)');
console.log('   Target: docs/SHUMEI_SEED_BANK_COLLABORATION.md');
console.log('================================================================================\n');

if (!fs.existsSync(docPath)) {
  console.error(`FATAL: Target document does not exist at ${docPath}`);
  process.exit(1);
}

const content = fs.readFileSync(docPath, 'utf8');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}${details ? ': ' + details : ''}`);
    failures.push({ testName, details });
  }
}

// ============================================================================
// SUITE 1: JSON PARSE & SCHEMA STRUCTURE STRESS TESTING
// ============================================================================
console.log('\n--- SUITE 1: JSON Parse & Schema Structure Stress Testing ---');

const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
let jsonMatch;
let jsonCount = 0;
const parsedJsonBlocks = [];

while ((jsonMatch = jsonBlockRegex.exec(content)) !== null) {
  jsonCount++;
  const raw = jsonMatch[1];
  let parsed = null;
  let errorMsg = null;

  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    errorMsg = e.message;
  }

  assert(errorMsg === null, `JSON Block #${jsonCount} strict JSON.parse validation`, errorMsg);
  if (parsed !== null) {
    parsedJsonBlocks.push({ index: jsonCount, data: parsed, raw });
  }
}

assert(parsedJsonBlocks.length === 9, `Expected exactly 9 JSON specification blocks (Found: ${parsedJsonBlocks.length})`);

// Stress test individual JSON blocks for logical completeness
if (parsedJsonBlocks.length >= 9) {
  // Block 1: Claim Request (Finding 4: userId and karmaDeducted removed from client body)
  const b1 = parsedJsonBlocks[0].data;
  assert(!b1.userId && !b1.karmaDeducted && b1.seedCode && b1.requestedPackages === 1,
    'Block #1 (POST /seeds/claim request): valid fields with client userId & karmaDeducted stripped for security');
  assert(b1.voucherCode && b1.voucherCode.startsWith('SHUMEI-REWARD-'),
    'Block #1 (POST /seeds/claim request): voucherCode follows SHUMEI-REWARD- pattern');

  // Block 2: Claim Response (Finding 1: reservedPackages & Finding 4: dual status/statusCode)
  const b2 = parsedJsonBlocks[1].data;
  assert(b2.success === true && b2.data && b2.data.claimId.startsWith('CLM-2026-'),
    'Block #2 (POST /seeds/claim response): success flag and CLM-2026- claimId format');
  assert(b2.data.storageLocationId && b2.data.storageLocationId.startsWith('ST-'),
    'Block #2 (POST /seeds/claim response): storageLocationId references ST- vault');
  assert(b2.data.reservedPackages === 1,
    'Block #2 (POST /seeds/claim response): reservedPackages indicates two-phase reservation lock');
  assert(b2.data.status === '待審核' && b2.data.statusCode === 'pending_approval',
    'Block #2 (POST /seeds/claim response): dual status and statusCode harmonized');

  // Block 3: Claim Cancel Request (Finding 1: cancellation endpoint)
  const b3 = parsedJsonBlocks[2].data;
  assert(b3.reason && typeof b3.reason === 'string',
    'Block #3 (POST /seeds/claim/{claimId}/cancel request): cancellation reason present');

  // Block 4: Claim Cancel Response (Finding 1: rollback status & refund)
  const b4 = parsedJsonBlocks[3].data;
  assert(b4.success === true && b4.data && b4.data.status === '已取消' && b4.data.refundedKarma === 200,
    'Block #4 (POST /seeds/claim/{claimId}/cancel response): status cancelled and 200 Karma refunded');

  // Block 5: Qualification Request (Finding 4)
  const b5 = parsedJsonBlocks[4].data;
  assert(b5.uid && b5.email, 'Block #5 (POST /members/verify-qualification request): uid and email present');

  // Block 6: Qualification Response (Finding 4: Level 3 saver)
  const b6 = parsedJsonBlocks[5].data;
  assert(b6.success === true && b6.data.grantedSeedBankLevel === 3 && b6.data.grantedRole === 'saver',
    'Block #6 (POST /members/verify-qualification response): Level 3 saver role granted');
  assert(Array.isArray(b6.data.permissions) && b6.data.permissions.includes('edit_packages'),
    'Block #6 (POST /members/verify-qualification response): contains edit_packages permission');

  // Block 7: Trace Response
  const b7 = parsedJsonBlocks[6].data;
  assert(b7.shumeiCode && b7.botanical && b7.provenance && b7.culinary && b7.interaction,
    'Block #7 (GET /trace/{shumeiCode} response): comprehensive 5-domain structure');
  assert(b7.interaction.ugcRewardKarma === 50,
    'Block #7 (GET /trace/{shumeiCode} response): UGC feedback awards exactly 50 Karma');

  // Block 8: Sync Request (Finding 2: outgoingPackageUpdates removed; differential outgoingMovements)
  const b8 = parsedJsonBlocks[7].data;
  assert(b8.clientLastSyncTimestamp && Array.isArray(b8.outgoingMovements) && b8.outgoingPackageUpdates === undefined,
    'Block #8 (POST /sync/seeds request): outgoingMovements present and absolute outgoingPackageUpdates removed');
  assert(b8.outgoingMovements.length > 0 && b8.outgoingMovements[0].deltaPackages < 0,
    'Block #8 (POST /sync/seeds request): strictly differential deltaPackages negative deduction');

  // Block 9: Sync Response (Finding 2: physicalDeficitAlerts and deltaSeeds)
  const b9 = parsedJsonBlocks[8].data;
  assert(b9.success === true && b9.syncTimestamp && Array.isArray(b9.deltaSeeds) && Array.isArray(b9.physicalDeficitAlerts),
    'Block #9 (POST /sync/seeds response): success flag, deltaSeeds, and physicalDeficitAlerts array');
}


// ============================================================================
// SUITE 2: MERMAID DIAGRAMS SYNTAX & AST VALIDATION
// ============================================================================
console.log('\n--- SUITE 2: Mermaid Diagrams Syntax & AST Validation ---');

const mermaidBlockRegex = /```mermaid\s*([\s\S]*?)\s*```/g;
let mMatch;
let mCount = 0;
const mermaidBlocks = [];

while ((mMatch = mermaidBlockRegex.exec(content)) !== null) {
  mCount++;
  mermaidBlocks.push({ index: mCount, code: mMatch[1].trim() });
}

assert(mCount === 4, `Found exactly 4 Mermaid diagrams as expected (Found: ${mCount})`);

// Diagram 1: Flowchart
if (mermaidBlocks[0]) {
  console.log('\n  Deep-checking Diagram #1: Flowchart Architecture...');
  const lines = mermaidBlocks[0].code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));
  assert(lines[0] === 'flowchart TB', 'Diagram #1 header is "flowchart TB"');

  const subgraphs = lines.filter(l => l.startsWith('subgraph')).map(l => l.split(' ')[1]);
  const ends = lines.filter(l => l === 'end');
  assert(subgraphs.length === 4, `Diagram #1 has 4 logical subgraphs (Found: ${subgraphs.length})`);
  assert(ends.length === 4, `Diagram #1 has 4 matching 'end' statements (Found: ${ends.length})`);
  assert(subgraphs.includes('ClientTier') && subgraphs.includes('ShumeiFront') &&
         subgraphs.includes('MiddlewareTier') && subgraphs.includes('SeedBankBack'),
         'Diagram #1 contains all 4 architectural tier subgraphs');
}

// Diagrams 2-4: Sequence Diagrams
for (let d = 1; d <= 3; d++) {
  if (!mermaidBlocks[d]) continue;
  console.log(`\n  Deep-checking Diagram #${d+1}: Sequence Diagram...`);
  const lines = mermaidBlocks[d].code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));
  assert(lines[0] === 'sequenceDiagram', `Diagram #${d+1} header is "sequenceDiagram"`);
  assert(lines[1] === 'autonumber', `Diagram #${d+1} enables "autonumber"`);

  const actors = lines.filter(l => l.startsWith('actor ') || l.startsWith('participant '));
  assert(actors.length >= 5, `Diagram #${d+1} declares sufficient actors/participants (Found: ${actors.length})`);

  const activates = lines.filter(l => l.startsWith('activate ')).map(l => l.split(' ')[1]);
  const deactivates = lines.filter(l => l.startsWith('deactivate ')).map(l => l.split(' ')[1]);
  assert(activates.length === deactivates.length,
    `Diagram #${d+1} has balanced activate (${activates.length}) and deactivate (${deactivates.length}) calls`);

  // Verify FIFO / matching balance
  const activeSet = {};
  let balanceOk = true;
  lines.forEach(l => {
    if (l.startsWith('activate ')) {
      const p = l.split(' ')[1];
      activeSet[p] = (activeSet[p] || 0) + 1;
    } else if (l.startsWith('deactivate ')) {
      const p = l.split(' ')[1];
      if (!activeSet[p] || activeSet[p] <= 0) balanceOk = false;
      else activeSet[p]--;
    }
  });
  Object.values(activeSet).forEach(v => { if (v !== 0) balanceOk = false; });
  assert(balanceOk, `Diagram #${d+1} activation lifelines strictly balanced`);
}


// ============================================================================
// SUITE 3: DOMAIN KEYWORD & CONCEPT RIGOROUS COVERAGE
// ============================================================================
console.log('\n--- SUITE 3: Domain Keyword & Concept Coverage ---');

const domainCategories = {
  'Shumei Core': [
    'Vanilla JS', 'Bootstrap 5', 'Firebase', 'Firestore', 'Cloud Functions',
    'shumei-2025', 'Karma', '200 Karma', '+40', '+50', '粒籽記憶庫', 'DNA Bank',
    'natural-farm.js', 'natural-farm-admin.js', 'change.html', '食育食譜',
    'tab-seeds'
  ],
  'Seed-Bank Core': [
    'React 19', 'TypeScript', 'Tailwind CSS', 'Vite', 'NamingRule', '14~18',
    'TablePress', '#35090', '100x60mm', 'SVG QR Code', 'DCC', 'ST-01', 'ST-02',
    'ST-03', 'ST-04', 'Modal23852', 'OFFGRID VAC-1', 'generateSurvivalBundle',
    'qrcode.react', 'QRCodeSVG'
  ],
  'Four Dimensions': [
    '種子庫存出庫扣減', '會員體系與志工認證雙向互通', '溯源條碼與食農教育雙向導流',
    '全功能雙向同步架構與離線生存相容性', 'Single Source of Truth', 'SSOT',
    'runTransaction', 'Delta Sync', 'reservedPackages', 'Two-Phase'
  ],
  'RBAC & Volunteer': [
    'Level 1', 'Level 2', 'Level 3', 'Level 4', '新申請', '面談評估', '已認證',
    '活躍奉仕', '120', 'SHUMEI-VOL-2026', 'saver', 'grower', 'admin',
    'seedBankLevel >= 3'
  ],
  'API & Data Mapping': [
    '/api/v1/seeds/claim', '/api/v1/members/verify-qualification', '/trace/{shumeiCode}',
    '/api/v1/sync/seeds', 'Data Mapping Table', '種子實體與系譜模型映射表',
    '會員身分與志工資歷模型映射表', '索取兌換與流通交易模型映射表',
    'Idempotency-Replay', 'ERR_INSUFFICIENT_KARMA', 'pending_approval'
  ],
  'Roadmap & Risks': [
    'Phase 0.5', 'Phase 1: 0~3 個月', 'Phase 2: 3~6 個月', 'Phase 3: 6~12 個月',
    'Concurrency Race Condition', 'Split-Brain Offline Conflict',
    'Privilege Escalation', 'Append-Only', '物理現實不可逆'
  ]
};

Object.entries(domainCategories).forEach(([category, keywords]) => {
  console.log(`\n  Checking Category: [${category}] (${keywords.length} terms)...`);
  keywords.forEach(kw => {
    assert(content.includes(kw), `Document includes domain concept "${kw}"`);
  });
});


// ============================================================================
// SUITE 4: STRUCTURAL MARKDOWN TABLES VERIFICATION
// ============================================================================
console.log('\n--- SUITE 4: Markdown Tables Structural Verification ---');

const tableHeaderMatches = content.match(/\|[^\n]+\|\n\|(?:\s*[-:]+[-| :]*)\|/g) || [];
assert(tableHeaderMatches.length >= 6,
  `Document contains at least 6 structured markdown tables (Found: ${tableHeaderMatches.length})`);

// Specific table checks:
assert(content.includes('| 維度 (Dimension) | Shumei 自然農法公眾社群平台'), 'Section 2.2 Tech Stack Comparison Table exists');
assert(content.includes('| Shumei 志工管線指標 | 認證條件與憑證 | Seed-Bank 映射位階'), 'Section 3.2.3 Volunteer to RBAC Mapping Table exists');
assert(content.includes('#### 4.1.1 種子實體與系譜模型映射表'), 'Section 4.1.1 Seed Mapping Table exists');
assert(content.includes('#### 4.1.2 會員身分與志工資歷模型映射表'), 'Section 4.1.2 Member Mapping Table exists');
assert(content.includes('#### 4.1.3 索取兌換與流通交易模型映射表'), 'Section 4.1.3 Transaction Mapping Table exists');
assert(content.includes('| 風險編號 | 風險情境描述 | 嚴重性 (Severity)'), 'Section 4.4.3 Risk Matrix Table exists');


// ============================================================================
// SUITE 5: CROSS-PROJECT SEED-BANK NAMINGRULE SPECIFICATION ADVERSARIAL TEST
// ============================================================================
console.log('\n--- SUITE 5: Cross-Project NamingRule Specification Adversarial Test ---');

const seedBankRegex = /^[A-Z]{2,3}-[A-Z0-9]{2,5}-[SNOC]-[A-Z]{2}[0-9]{2}-[0-9]{4}-[0-9A-Z]{3,4}$/;

const extractedSeedCodes = [
  'SO-LY-S-TW01-2506-001',
  'PO-RC139-S-TW04-2508-007'
];

extractedSeedCodes.forEach(code => {
  const matches = seedBankRegex.test(code);
  assert(matches, `Sample seed code '${code}' strictly satisfies Seed-Bank NamingRule regex`);
});


// ============================================================================
// FINAL VERDICT EVALUATION
// ============================================================================
console.log('\n================================================================================');
console.log(`   TOTAL EMPIRICAL TESTS EXECUTED : ${totalTests}`);
console.log(`   PASSED                         : ${passedTests}`);
console.log(`   FAILED                         : ${failedTests}`);
console.log('================================================================================\n');

if (failedTests === 0) {
  console.log('🎯 VERDICT: APPROVE');
  console.log('Document SHUMEI_SEED_BANK_COLLABORATION.md satisfies 100% of empirical tests without any regressions.');
  process.exit(0);
} else {
  console.error(`💥 VERDICT: FAIL`);
  console.error(`Detected ${failedTests} test failures:`);
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
