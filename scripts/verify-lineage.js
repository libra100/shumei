/**
 * verify-lineage.js
 * 合併自 test.js + test2.js
 * 用途：驗證 data.json (Firestore export) 中的 lineage 節點與連結是否完整正確
 *
 * 使用方式：
 *   cd data_dumps
 *   node ../scripts/verify-lineage.js [data_file.json]
 */

const fs = require('fs');
const path = require('path');

const dataFile = process.argv[2] || 'latest_data.json';
const dataPath = path.resolve(process.cwd(), dataFile);

if (!fs.existsSync(dataPath)) {
  console.error(`❌ 找不到資料檔案：${dataPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataPath));

// --- 解析成員資料 ---
const members = data.documents.map(d => {
  const m = { id: d.name.split('/').pop() };
  for (const [k, v] of Object.entries(d.fields)) {
    m[k] = v.stringValue !== undefined ? v.stringValue :
           (v.booleanValue !== undefined ? v.booleanValue :
           (v.arrayValue && v.arrayValue.values ? v.arrayValue.values.map(x => x.stringValue) : null));
  }
  return m;
});

// --- 建立 nodes ---
const nodes = [];
const links = [];
const nodeLookup = new Set();

members.forEach(m => {
  const name = m.name || m.id;
  if (!nodeLookup.has(name)) {
    nodeLookup.add(name);
    nodes.push({ id: name, name });
  }
});

// --- 建立 links ---
members.forEach(m => {
  const targetId = m.name || m.id;
  let guideName = null;
  if (m.guide && Array.isArray(m.guide) && m.guide.length > 0) {
    if (typeof m.guide[0] === 'string') {
      guideName = m.guide[0].trim();
    }
  }

  if (guideName && guideName !== '') {
    if (!nodeLookup.has(guideName)) {
      nodeLookup.add(guideName);
      nodes.push({ id: guideName, name: guideName });
    }
    links.push({ source: guideName, target: targetId });
  }
});

console.log(`\n📊 Lineage 資料摘要`);
console.log(`   資料來源：${dataFile}`);
console.log(`   總成員數：${members.length}`);
console.log(`   總節點數：${nodes.length}`);
console.log(`   總連結數：${links.length}`);

// --- 驗證 links 的 source/target 是否存在於 nodes ---
let invalidCount = 0;
const nodeIds = new Set(nodes.map(n => n.id));

links.forEach(l => {
  if (!nodeIds.has(l.source)) {
    console.warn(`   ⚠️  Invalid source: ${l.source}`);
    invalidCount++;
  }
  if (!nodeIds.has(l.target)) {
    console.warn(`   ⚠️  Invalid target: ${l.target}`);
    invalidCount++;
  }
});

if (invalidCount === 0) {
  console.log(`\n✅ 所有連結驗證通過，無孤立節點。`);
} else {
  console.log(`\n❌ 發現 ${invalidCount} 個無效連結端點，請檢查上方警告。`);
}
