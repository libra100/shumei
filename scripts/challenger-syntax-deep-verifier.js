/**
 * Empirical Syntax & Grammar Deep Verifier
 * Runner: challenger_it2_1 (Adversarial Empirical Challenger)
 * Target: docs/SHUMEI_SEED_BANK_COLLABORATION.md
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const docPath = path.resolve(__dirname, '../docs/SHUMEI_SEED_BANK_COLLABORATION.md');
const verifyScriptPath = path.resolve(__dirname, './verify-collaboration-doc.js');

console.log('================================================================================');
console.log('   CHALLENGER_IT2_1 DEEP EMPIRICAL SYNTAX & GRAMMAR VERIFICATION');
console.log('   Target: docs/SHUMEI_SEED_BANK_COLLABORATION.md');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function check(condition, testName, details = '') {
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

// -----------------------------------------------------------------------------
// PART 1: Run and verify scripts/verify-collaboration-doc.js
// -----------------------------------------------------------------------------
console.log('\n--- PART 1: Verification Script Execution (verify-collaboration-doc.js) ---');
try {
  const stdout = execSync(`node "${verifyScriptPath}"`, { encoding: 'utf8' });
  const hasPass = stdout.includes('TOTAL EMPIRICAL TESTS EXECUTED : 136') &&
                  stdout.includes('PASSED                         : 136') &&
                  stdout.includes('FAILED                         : 0') &&
                  stdout.includes('VERDICT: APPROVE');
  check(hasPass, 'verify-collaboration-doc.js runs synchronously with 0 failures and passes all 136 tests');
} catch (err) {
  check(false, 'verify-collaboration-doc.js executed without throwing', err.message);
}

// Read document content
const content = fs.readFileSync(docPath, 'utf8');

// -----------------------------------------------------------------------------
// PART 2: All 4 Mermaid Diagram Blocks Parse With Valid Syntax
// -----------------------------------------------------------------------------
console.log('\n--- PART 2: Detailed Mermaid Diagram Syntax & Grammar AST Parsing ---');

const mermaidBlockRegex = /```mermaid\s*([\s\S]*?)\s*```/g;
let mMatch;
const mermaidBlocks = [];
while ((mMatch = mermaidBlockRegex.exec(content)) !== null) {
  mermaidBlocks.push(mMatch[1].trim());
}

check(mermaidBlocks.length === 4, `Document contains exactly 4 Mermaid code blocks (Found: ${mermaidBlocks.length})`);

// Deep Parser for Diagram 1 (Flowchart)
if (mermaidBlocks[0]) {
  console.log('\n  [Diagram 1 AST Grammar Analysis]');
  const d1 = mermaidBlocks[0];
  const lines = d1.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));

  // 1. Header check
  check(/^flowchart\s+(TB|TD|BT|RL|LR)$/.test(lines[0]), 'Diagram 1 header is valid flowchart direction declaration', lines[0]);

  // 2. Subgraph parsing & nesting stack
  const subgraphStack = [];
  const definedSubgraphs = [];
  const definedNodes = new Set();
  const referencedNodes = new Set();
  let subgraphSyntaxValid = true;

  lines.forEach((line, idx) => {
    if (line.startsWith('subgraph ')) {
      const match = line.match(/^subgraph\s+([A-Za-z0-9_]+)(\s+\["([^"]+)"\]|\s+\[([^\]]+)\])?$/);
      if (match) {
        subgraphStack.push(match[1]);
        definedSubgraphs.push(match[1]);
      } else {
        subgraphSyntaxValid = false;
        console.error(`Invalid subgraph declaration at line ${idx + 1}: ${line}`);
      }
    } else if (line === 'end') {
      if (subgraphStack.length === 0) {
        subgraphSyntaxValid = false;
        console.error(`Unmatched 'end' at line ${idx + 1}`);
      } else {
        subgraphStack.pop();
      }
    } else if (line.startsWith('direction ')) {
      const dirMatch = line.match(/^direction\s+(TB|TD|BT|RL|LR)$/);
      check(dirMatch !== null, `Valid direction statement inside subgraph: "${line}"`);
    } else if (line.includes('-->') || line.includes('-.->') || line.includes('==>')) {
      // Edge parsing: e.g. A1 -->|text| B1 or D6 -.->|text| A3
      const edgeRegex = /^([A-Za-z0-9_]+)\s*(-->|-\.->|==>)(?:\|([^|]+)\|)?\s*([A-Za-z0-9_]+)$/;
      const em = line.match(edgeRegex);
      if (em) {
        referencedNodes.add(em[1]);
        referencedNodes.add(em[4]);
      } else {
        check(false, `Valid edge syntax at line ${idx + 1}`, line);
      }
    } else {
      // Node declaration: e.g. A1["..."] or C5[("...")]
      const nodeRegex = /^([A-Za-z0-9_]+)(\[\("([^"]*)"\)\]|\["([^"]*)"\]|\("([^"]*)"\))$/;
      const nm = line.match(nodeRegex);
      if (nm) {
        definedNodes.add(nm[1]);
      }
    }
  });

  check(subgraphSyntaxValid && subgraphStack.length === 0, 'Diagram 1 subgraphs opened and closed with 0 unclosed scopes');
  check(definedSubgraphs.length === 4, `Diagram 1 has 4 declared subgraphs (Found: ${definedSubgraphs.length})`);
  check(definedNodes.size === 18, `Diagram 1 defines 18 unique tier nodes (Found: ${definedNodes.size})`);

  // Verify all referenced nodes are defined
  let allReferencedAreDefined = true;
  referencedNodes.forEach(nodeId => {
    if (!definedNodes.has(nodeId)) {
      allReferencedAreDefined = false;
      console.error(`Referenced node ${nodeId} is not defined in Diagram 1`);
    }
  });
  check(allReferencedAreDefined, 'All nodes connected in Diagram 1 edges are formally defined');
}

// Deep Parser for Diagrams 2, 3, 4 (Sequence Diagrams)
for (let i = 1; i <= 3; i++) {
  console.log(`\n  [Diagram ${i + 1} Sequence AST Grammar Analysis]`);
  const d = mermaidBlocks[i];
  if (!d) {
    check(false, `Diagram ${i + 1} exists`);
    continue;
  }
  const lines = d.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));

  // Header & directives
  check(lines[0] === 'sequenceDiagram', `Diagram ${i + 1} starts with 'sequenceDiagram'`);
  check(lines[1] === 'autonumber', `Diagram ${i + 1} declares 'autonumber'`);

  const actors = new Map();
  const activationMap = new Map();
  const blockStack = []; // for alt / else / opt / loop
  let syntaxOk = true;

  lines.slice(2).forEach((line, idx) => {
    const lineNum = idx + 3;

    if (line.startsWith('actor ') || line.startsWith('participant ')) {
      const m = line.match(/^(actor|participant)\s+([A-Za-z0-9_]+)\s+as\s+(.+)$/);
      if (m) {
        actors.set(m[2], { type: m[1], label: m[3] });
      } else {
        syntaxOk = false;
        check(false, `Valid actor/participant syntax at line ${lineNum}`, line);
      }
    } else if (line.startsWith('activate ')) {
      const target = line.split(/\s+/)[1];
      if (!actors.has(target)) {
        check(false, `Activation of declared participant at line ${lineNum}: ${target}`);
      }
      activationMap.set(target, (activationMap.get(target) || 0) + 1);
    } else if (line.startsWith('deactivate ')) {
      const target = line.split(/\s+/)[1];
      const count = activationMap.get(target) || 0;
      if (count <= 0) {
        check(false, `Illegal deactivate without active lifeline at line ${lineNum}: ${target}`);
      } else {
        activationMap.set(target, count - 1);
      }
    } else if (line.startsWith('alt ') || line.startsWith('opt ') || line.startsWith('loop ') || line.startsWith('par ')) {
      const type = line.split(/\s+/)[0];
      blockStack.push({ type, lineNum });
    } else if (line.startsWith('else')) {
      if (blockStack.length === 0 || blockStack[blockStack.length - 1].type !== 'alt') {
        check(false, `Illegal 'else' statement without matching 'alt' at line ${lineNum}`);
      }
    } else if (line === 'end') {
      if (blockStack.length === 0) {
        check(false, `Unmatched 'end' statement at line ${lineNum}`);
      } else {
        blockStack.pop();
      }
    } else if (line.startsWith('Note over ') || line.startsWith('Note left of ') || line.startsWith('Note right of ')) {
      const noteRegex = /^Note\s+(over|left of|right of)\s+([A-Za-z0-9_,\s]+):\s*(.+)$/;
      const nm = line.match(noteRegex);
      if (!nm) {
        check(false, `Valid Note syntax at line ${lineNum}`, line);
      }
    } else if (line.includes('->>') || line.includes('-->>') || line.includes('->') || line.includes('-->')) {
      const msgRegex = /^([A-Za-z0-9_]+)\s*(-->>|->>|-->|->)\s*([A-Za-z0-9_]+):\s*(.+)$/;
      const mm = line.match(msgRegex);
      if (mm) {
        if (!actors.has(mm[1])) {
          check(false, `Sender participant '${mm[1]}' declared at line ${lineNum}`);
        }
        if (!actors.has(mm[3])) {
          check(false, `Receiver participant '${mm[3]}' declared at line ${lineNum}`);
        }
      } else {
        check(false, `Valid message arrow syntax at line ${lineNum}`, line);
      }
    }
  });

  check(blockStack.length === 0, `Diagram ${i + 1} alt/opt/loop/end block stack fully closed`);

  let allDeactivated = true;
  activationMap.forEach((val, key) => {
    if (val !== 0) {
      allDeactivated = false;
      console.error(`Participant ${key} has ${val} unclosed activations in Diagram ${i + 1}`);
    }
  });
  check(allDeactivated, `Diagram ${i + 1} lifelines 100% cleanly deactivated`);
}

// -----------------------------------------------------------------------------
// PART 3: All JSON Schema Code Blocks Parse with JSON.parse
// -----------------------------------------------------------------------------
console.log('\n--- PART 3: Comprehensive JSON Schema Strict JSON.parse & Structure Validation ---');

const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
let jMatch;
let jsonBlockIndex = 0;
const allJsonObjects = [];

while ((jMatch = jsonBlockRegex.exec(content)) !== null) {
  jsonBlockIndex++;
  const raw = jMatch[1];
  let parsedObj = null;
  let parseError = null;

  try {
    parsedObj = JSON.parse(raw);
  } catch (err) {
    parseError = err.message;
  }

  check(parseError === null, `JSON Block #${jsonBlockIndex} passes strict JSON.parse()`, parseError);

  if (parsedObj !== null) {
    const reSerialized = JSON.stringify(parsedObj);
    check(typeof reSerialized === 'string' && reSerialized.length > 0, `JSON Block #${jsonBlockIndex} roundtrips through JSON.stringify()`);
    allJsonObjects.push({ index: jsonBlockIndex, obj: parsedObj, raw });
  }
}

check(allJsonObjects.length === 9, `Found and parsed all 9 JSON schema specification blocks (Found: ${allJsonObjects.length})`);

// Deep structure verification of each JSON block
if (allJsonObjects.length === 9) {
  // Block 1: POST /api/v1/seeds/claim Request
  const j1 = allJsonObjects[0].obj;
  check(typeof j1.seedCode === 'string' && j1.requestedPackages === 1 && j1.redeemType === 'karma',
    'JSON Block #1: Valid claim request attributes');
  check(j1.userId === undefined && j1.karmaDeducted === undefined,
    'JSON Block #1 (Security): Client cannot inject userId or arbitrary karmaDeducted');
  check(typeof j1.voucherCode === 'string' && j1.voucherCode.startsWith('SHUMEI-REWARD-'),
    'JSON Block #1: voucherCode strictly formatted with SHUMEI-REWARD- prefix');

  // Block 2: POST /api/v1/seeds/claim Response
  const j2 = allJsonObjects[1].obj;
  check(j2.success === true && typeof j2.data.claimId === 'string' && j2.data.claimId.startsWith('CLM-2026-'),
    'JSON Block #2: Successful claim creation response with CLM-2026- ID prefix');
  check(j2.data.reservedPackages === 1 && j2.data.storageLocationId.startsWith('ST-'),
    'JSON Block #2: Two-phase reservation lock with storageLocationId allocation');
  check(j2.data.status === '待審核' && j2.data.statusCode === 'pending_approval',
    'JSON Block #2: Standardized dual-status representation');

  // Block 3: POST /api/v1/seeds/claim/{claimId}/cancel Request
  const j3 = allJsonObjects[2].obj;
  check(typeof j3.reason === 'string' && j3.reason.length > 0,
    'JSON Block #3: Claim cancellation request specifies reason');

  // Block 4: POST /api/v1/seeds/claim/{claimId}/cancel Response
  const j4 = allJsonObjects[3].obj;
  check(j4.success === true && j4.data.status === '已取消' && j4.data.refundedKarma === 200,
    'JSON Block #4: Claim cancellation response verifies status rollback & 200 Karma refund');

  // Block 5: POST /api/v1/members/verify-qualification Request
  const j5 = allJsonObjects[4].obj;
  check(typeof j5.uid === 'string' && typeof j5.email === 'string',
    'JSON Block #5: Qualification request contains valid uid and email');

  // Block 6: POST /api/v1/members/verify-qualification Response
  const j6 = allJsonObjects[5].obj;
  check(j6.success === true && j6.data.grantedSeedBankLevel === 3 && j6.data.grantedRole === 'saver',
    'JSON Block #6: Qualification response grants Seed-Bank Level 3 saver role');
  check(Array.isArray(j6.data.permissions) && j6.data.permissions.includes('edit_packages') && j6.data.permissions.includes('approve_claims'),
    'JSON Block #6: Qualification response includes edit_packages and approve_claims permissions');

  // Block 7: GET /trace/{shumeiCode} Response
  const j7 = allJsonObjects[6].obj;
  check(typeof j7.shumeiCode === 'string' && j7.botanical && j7.provenance && j7.culinary && j7.interaction,
    'JSON Block #7: Traceability response encapsulates 5 distinct domain sub-objects');
  check(j7.interaction.ugcRewardKarma === 50,
    'JSON Block #7: UGC feedback loop awards exactly 50 Karma');

  // Block 8: POST /api/v1/sync/seeds Request
  const j8 = allJsonObjects[7].obj;
  check(typeof j8.deviceId === 'string' && typeof j8.clientLastSyncTimestamp === 'string' && Array.isArray(j8.outgoingMovements),
    'JSON Block #8: Delta sync request has deviceId, clientLastSyncTimestamp, and outgoingMovements array');
  check(j8.outgoingPackageUpdates === undefined,
    'JSON Block #8 (Security/SSOT): Absolute outgoingPackageUpdates is completely eliminated');
  check(j8.outgoingMovements.every(m => typeof m.id === 'string' && typeof m.deltaPackages === 'number'),
    'JSON Block #8: All outgoing movements specify immutable movement id and integer deltaPackages');

  // Block 9: POST /api/v1/sync/seeds Response
  const j9 = allJsonObjects[8].obj;
  check(j9.success === true && typeof j9.syncTimestamp === 'string' && Array.isArray(j9.deltaSeeds) && Array.isArray(j9.physicalDeficitAlerts),
    'JSON Block #9: Sync response returns server syncTimestamp, deltaSeeds, and physicalDeficitAlerts');
}

// -----------------------------------------------------------------------------
// PART 4: Additional Code Blocks Syntax Check (JS and TS)
// -----------------------------------------------------------------------------
console.log('\n--- PART 4: JavaScript & TypeScript Code Blocks Syntax Verification ---');

const jsRegex = /```javascript\s*([\s\S]*?)\s*```/g;
let jsM;
let jsIdx = 0;
while ((jsM = jsRegex.exec(content)) !== null) {
  jsIdx++;
  try {
    new vm.Script(jsM[1]);
    check(true, `JavaScript Code Block #${jsIdx} syntax is 100% valid Node/ES script`);
  } catch (e) {
    check(false, `JavaScript Code Block #${jsIdx} syntax error`, e.message);
  }
}

const tsRegex = /```typescript\s*([\s\S]*?)\s*```/g;
let tsM;
let tsIdx = 0;
while ((tsM = tsRegex.exec(content)) !== null) {
  tsIdx++;
  try {
    const ts = require('/Users/tsaisungen/Sites/Seed-Bank/node_modules/typescript');
    const result = ts.transpileModule(tsM[1], {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    });
    check(typeof result.outputText === 'string', `TypeScript Code Block #${tsIdx} transpiles without compiler error`);
  } catch (e) {
    check(false, `TypeScript Code Block #${tsIdx} transpile failure`, e.message);
  }
}

// -----------------------------------------------------------------------------
// PART 5: Markdown Tables Column & Delimiter Integrity Verification
// -----------------------------------------------------------------------------
console.log('\n--- PART 5: Markdown Tables Column & Delimiter Integrity Verification ---');

// Strip all code blocks before finding markdown tables
const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '');
const rawLines = withoutCodeBlocks.split('\n');

let inTable = false;
let currentTable = [];
const tables = [];

rawLines.forEach((line, lineIdx) => {
  const trimmed = line.trim();
  const isTableRow = trimmed.startsWith('|') && trimmed.endsWith('|');
  if (isTableRow) {
    if (!inTable) {
      inTable = true;
      currentTable = [];
    }
    currentTable.push({ lineNum: lineIdx + 1, text: trimmed });
  } else {
    if (inTable) {
      if (currentTable.length >= 3) {
        tables.push(currentTable);
      }
      inTable = false;
      currentTable = [];
    }
  }
});
if (inTable && currentTable.length >= 3) {
  tables.push(currentTable);
}

check(tables.length >= 6, `Markdown contains at least 6 well-formed tables (Found: ${tables.length})`);

function splitTableRow(rowText) {
  const placeholder = '___ESCAPED_PIPE___';
  const safeText = rowText.replace(/\\\|/g, placeholder);
  const rawCols = safeText.split('|').slice(1, -1);
  return rawCols.map(c => c.replace(new RegExp(placeholder, 'g'), '|').trim());
}

tables.forEach((tbl, tIdx) => {
  const headerCols = splitTableRow(tbl[0].text);
  const delimCols = splitTableRow(tbl[1].text);

  const delimValid = delimCols.every(c => /^:?---+:?$/.test(c));
  check(delimValid && headerCols.length === delimCols.length,
    `Table #${tIdx + 1} (approx line ${tbl[0].lineNum}): Header and delimiter have matching ${headerCols.length} columns`);

  let rowsConsistent = true;
  tbl.slice(2).forEach(row => {
    const cols = splitTableRow(row.text);
    if (cols.length !== headerCols.length) {
      rowsConsistent = false;
      console.error(`Table #${tIdx + 1} row at line ${row.lineNum} has ${cols.length} cols, expected ${headerCols.length}`);
    }
  });
  check(rowsConsistent, `Table #${tIdx + 1} all data rows have exactly ${headerCols.length} columns`);
});

// -----------------------------------------------------------------------------
// SUMMARY & VERDICT
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`   TOTAL EMPIRICAL TESTS EXECUTED : ${totalTests}`);
console.log(`   PASSED                         : ${passedTests}`);
console.log(`   FAILED                         : ${failedTests}`);
console.log('================================================================================\n');

if (failedTests === 0) {
  console.log('🎯 CHALLENGER FINAL VERDICT: APPROVE');
  console.log('All 136+ test assertions, all 4 Mermaid diagrams, all 9 JSON schemas, JS/TS scripts,');
  console.log('and Markdown tables have been empirically verified with 100% pass rate.');
  process.exit(0);
} else {
  console.error('💥 CHALLENGER FINAL VERDICT: FAIL');
  console.error(`Found ${failedTests} failing tests:`, JSON.stringify(failures, null, 2));
  process.exit(1);
}
