import { 
  validateSeedCode, 
  parseSeedCode, 
  generateSeedCode,
  BOTANICAL_FAMILIES,
  FARMING_METHODS,
  REGION_CODES 
} from '/Users/tsaisungen/Sites/Seed-Bank/src/utils/namingRule';

console.log("=== EMPIRICAL TEST SUITE: NamingRule Validation & Parsing ===");

let passed = 0;
let failed = 0;

function assertTest(name: string, condition: boolean, details?: any) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${name}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${name}`, details ? JSON.stringify(details) : '');
  }
}

// 1. Test Seed-Bank Seed Dataset codes
const datasetCodes = [
  "SO-LY-S-TW01-2506-001",
  "PO-RC-S-JP24-2406-002",
  "SO-PT-S-TW03-2506-003",
  "FA-SB-S-TW02-2506-004",
  "CU-ZC-S-TW01-2606-005",
  "BR-RD-S-TW06-2512-006",
  "PO-RC139-S-TW04-2508-007"
];

console.log("\n--- Suite 1: Dataset Seed Codes in data.ts ---");
datasetCodes.forEach(code => {
  const res = validateSeedCode(code);
  assertTest(`Validate dataset code: ${code}`, res.isValid, res);
  const parsed = parseSeedCode(code);
  assertTest(`Parse dataset code: ${code}`, parsed !== null && parsed.familyCode.length > 0, parsed);
});

// 2. Test codes referenced in SHUMEI_SEED_BANK_COLLABORATION.md
console.log("\n--- Suite 2: Collaboration Blueprint Referenced Codes ---");
const docCodes = [
  "SO-LY-S-TW01-2506-001",
  "PO-RC139-S-TW04-2508-007"
];
docCodes.forEach(code => {
  const res = validateSeedCode(code);
  assertTest(`Doc reference code: ${code}`, res.isValid, res);
});

// 3. Test all Botanical Families, Farming Methods, and Regions
console.log("\n--- Suite 3: Combinatorial Validity across Taxonomies ---");
BOTANICAL_FAMILIES.forEach(fam => {
  const code = `${fam.code}-VAR-S-TW01-2606-001`;
  const res = validateSeedCode(code);
  assertTest(`Family ${fam.code} (${fam.name}) code valid`, res.isValid, res);
});

FARMING_METHODS.forEach(meth => {
  const code = `SO-LY-${meth.code}-TW01-2606-001`;
  const res = validateSeedCode(code);
  assertTest(`Method ${meth.code} (${meth.name}) code valid`, res.isValid, res);
});

const sampleRegions = ["TW01", "TW10", "JP01", "JP24", "JP47", "PE01", "ES01", "US01"];
sampleRegions.forEach(reg => {
  const code = `CU-ZC-S-${reg}-2606-001`;
  const res = validateSeedCode(code);
  assertTest(`Region ${reg} code valid`, res.isValid, res);
});

// 4. Test Round-Trip Generation & Parsing
console.log("\n--- Suite 4: Round-Trip Generation and Parsing ---");
const genCode = generateSeedCode({
  familyCode: 'PO',
  varietyCode: 'RC139',
  methodCode: 'S',
  regionCode: 'TW04',
  harvestYear: 2025,
  harvestMonth: 8,
  batchNumber: 7
});
assertTest(`Generated code matches expected: ${genCode}`, genCode === "PO-RC139-S-TW04-2508-007", { genCode });
const parsedGen = parseSeedCode(genCode);
assertTest(`Parsed generated code matches variety`, parsedGen?.varietyCode === 'RC139', parsedGen);
assertTest(`Parsed harvestYear is 2025`, parsedGen?.harvestYear === 2025, parsedGen);
assertTest(`Parsed harvestMonth is 8`, parsedGen?.harvestMonth === 8, parsedGen);

// 5. Test Case-Insensitivity & Whitespace Trimming
console.log("\n--- Suite 5: Resiliency & Normalization ---");
const lowerCode = "so-ly-s-tw01-2506-001";
const lowerRes = validateSeedCode(lowerCode);
assertTest(`Lowercase code accepted after toUpperCase()`, lowerRes.isValid, lowerRes);

const spacedCode = "  SO-LY-S-TW01-2506-001   ";
const spacedRes = validateSeedCode(spacedCode);
assertTest(`Whitespace trimmed code accepted`, spacedRes.isValid, spacedRes);

// 6. Adversarial & Malformed Inputs (Must FAIL validation)
console.log("\n--- Suite 6: Adversarial & Malformed Inputs (Should FAIL) ---");
const invalidCases = [
  { name: "Empty string", code: "" },
  { name: "Missing dashes", code: "SOLYSTW012506001" },
  { name: "Invalid family 1 char", code: "S-LY-S-TW01-2506-001" },
  { name: "Invalid family 4 chars", code: "SOLA-LY-S-TW01-2506-001" },
  { name: "Invalid method 'X'", code: "SO-LY-X-TW01-2506-001" },
  { name: "Invalid region length 'TW1'", code: "SO-LY-S-TW1-2506-001" },
  { name: "Invalid region alpha only 'TWXX'", code: "SO-LY-S-TWXX-2506-001" },
  { name: "Invalid year 2 digits '25'", code: "SO-LY-S-TW01-25-001" },
  { name: "Invalid batch 1 digit '1'", code: "SO-LY-S-TW01-2506-1" },
  { name: "Invalid batch 5 digits '00001'", code: "SO-LY-S-TW01-2506-00001" },
  { name: "SQL Injection payload", code: "SO-LY-S-TW01-2506-001'; DROP TABLE seeds;--" },
  { name: "XSS payload", code: "<script>alert('XSS')</script>" },
  { name: "Random gibberish", code: "INVALID-CODE-XYZ" },
  { name: "Only 5 parts", code: "SO-LY-S-TW01-2506" },
  { name: "7 parts", code: "SO-LY-S-TW01-2506-001-EXTRA" }
];

invalidCases.forEach(c => {
  const res = validateSeedCode(c.code);
  assertTest(`Reject ${c.name}: '${c.code.slice(0, 30)}'`, !res.isValid, res);
});

console.log("\n==========================================");
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("==========================================");

if (failed > 0) {
  process.exit(1);
}
