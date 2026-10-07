const fs = require('fs');
const path = require('path');

const docPath = '/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md';
const content = fs.readFileSync(docPath, 'utf8');

const results = [];
function check(condition, desc) {
  results.push({ desc, pass: !!condition });
  if (condition) {
    console.log(`[PASS] ${desc}`);
  } else {
    console.error(`[FAIL] ${desc}`);
  }
}

console.log('=== VICTORY AUDITOR INDEPENDENT EMPIRICAL AUDIT ===\n');

// 1. Placeholder & Stub Check
const forbidden = /\b(TODO|TBD|FIXME|placeholder|dummy|stub)\b/i;
const lines = content.split('\n');
let foundForbidden = 0;
lines.forEach((l, i) => {
  if (forbidden.test(l)) {
    foundForbidden++;
    console.error(`Forbidden word at line ${i+1}: ${l}`);
  }
});
check(foundForbidden === 0, 'Zero prohibited placeholders (TODO, TBD, FIXME, placeholder, dummy, stub)');

// 2. Acceptance Criteria Verification
check(content.includes('## 第貳章 雙專案技術架構與功能矩陣全景對比 (R1)'), 'R1 section present');
check(content.includes('## 第參章 四大核心業務面向之互補機制深度剖析 (R2)'), 'R2 section present');
check(content.includes('## 第肆章 具體落地整合方案與技術介面規格 (R3)'), 'R3 section present');

// Four Dimensions
check(content.includes('3.1 面向一：種子庫存出庫扣減與活動兌換串接'), 'Dimension 1: Seed inventory deduction & Karma redemption');
check(content.includes('3.2 面向二：會員體系與志工認證雙向互通'), 'Dimension 2: Member & volunteer certification reciprocity');
check(content.includes('3.3 面向三：溯源條碼與食農教育雙向導流'), 'Dimension 3: Traceability & food education bi-directional traffic');
check(content.includes('3.4 面向四：全功能雙向同步架構與離線生存相容性'), 'Dimension 4: Bi-directional sync & offline disaster readiness');

// Data Mapping Tables
check(content.includes('4.1.1 種子實體與系譜模型映射表'), 'Data mapping: Seed & genealogy');
check(content.includes('4.1.2 會員身分與志工資歷模型映射表'), 'Data mapping: Member & volunteer');
check(content.includes('4.1.3 索取兌換與流通交易模型映射表'), 'Data mapping: Claim & circulation');

// API Endpoints
check(content.includes('POST /api/v1/seeds/claim'), 'API: POST /seeds/claim');
check(content.includes('POST /api/v1/seeds/claim/{claimId}/cancel'), 'API: POST /seeds/claim/{claimId}/cancel');
check(content.includes('POST /api/v1/members/verify-qualification'), 'API: POST /members/verify-qualification');
check(content.includes('GET /trace/{shumeiCode}'), 'API: GET /trace/{shumeiCode}');
check(content.includes('POST /api/v1/sync/seeds'), 'API: POST /sync/seeds');

// JSON parsing
const jsonBlocks = [...content.matchAll(/```json\s*([\s\S]*?)\s*```/g)];
check(jsonBlocks.length === 9, `9 JSON schema blocks found (Found: ${jsonBlocks.length})`);
let jsonErrors = 0;
jsonBlocks.forEach((m, idx) => {
  try {
    JSON.parse(m[1]);
  } catch (e) {
    jsonErrors++;
    console.error(`JSON parse error in block #${idx+1}:`, e.message);
  }
});
check(jsonErrors === 0, 'All JSON schema blocks strictly valid JSON');

// Mermaid diagrams
const mermaidBlocks = [...content.matchAll(/```mermaid\s*([\s\S]*?)\s*```/g)];
check(mermaidBlocks.length >= 2, `At least 2 Mermaid diagrams found (Found: ${mermaidBlocks.length})`);

// Roadmap & Risk Mitigation
check(content.includes('4.4.1 四階段推進時程規劃'), 'Roadmap: 4-phase rollout schedule');
check(content.includes('4.4.3 四大核心技術風險評估與緩解矩陣'), 'Risk mitigation matrix');

// Groundedness in Shumei codebase
check(fs.existsSync('/Users/tsaisungen/Sites/shumei/public/farm/natural-farm.html'), 'Shumei natural-farm.html exists');
check(fs.existsSync('/Users/tsaisungen/Sites/shumei/public/js/natural-farm.js'), 'Shumei natural-farm.js exists');
check(fs.existsSync('/Users/tsaisungen/Sites/shumei/public/js/natural-farm-admin.js'), 'Shumei natural-farm-admin.js exists');

const farmHtml = fs.readFileSync('/Users/tsaisungen/Sites/shumei/public/farm/natural-farm.html', 'utf8');
check(farmHtml.includes('id="tab-seeds"'), 'Shumei natural-farm.html contains section id="tab-seeds"');

const adminJs = fs.readFileSync('/Users/tsaisungen/Sites/shumei/public/js/natural-farm-admin.js', 'utf8');
check(adminJs.includes('SHUMEI-VOL-2026-'), 'Shumei natural-farm-admin.js contains certificate format SHUMEI-VOL-2026-');

// Groundedness in Seed-Bank codebase
check(fs.existsSync('/Users/tsaisungen/Sites/Seed-Bank/src/types.ts'), 'Seed-Bank src/types.ts exists');
check(fs.existsSync('/Users/tsaisungen/Sites/Seed-Bank/src/utils/namingRule.ts'), 'Seed-Bank namingRule.ts exists');
check(fs.existsSync('/Users/tsaisungen/Sites/Seed-Bank/src/components/legacy_shumei/TablePress35090.tsx'), 'Seed-Bank TablePress35090.tsx exists');
check(fs.existsSync('/Users/tsaisungen/Sites/Seed-Bank/src/components/legacy_shumei/modals/Modal23852PrintLabel.tsx'), 'Seed-Bank Modal23852PrintLabel.tsx exists');

const seedTypes = fs.readFileSync('/Users/tsaisungen/Sites/Seed-Bank/src/types.ts', 'utf8');
check(seedTypes.includes('shumeiCode?: string;'), 'Seed-Bank types.ts defines shumeiCode');
check(seedTypes.includes('packages?: number;'), 'Seed-Bank types.ts defines packages?: number;');
check(seedTypes.includes('quantityGrams: number;'), 'Seed-Bank types.ts defines quantityGrams');
check(seedTypes.includes('storageLocationId: string;'), 'Seed-Bank types.ts defines storageLocationId');

const allPassed = results.every(r => r.pass);
console.log(`\nIndependent checks: ${results.filter(r => r.pass).length}/${results.length} PASSED`);
if (allPassed) {
  console.log('\n🎯 FINAL VERDICT: 100% CLEAN - VICTORY CONFIRMED');
} else {
  console.log('\n💥 FINAL VERDICT: ISSUES FOUND - VICTORY REJECTED');
}
