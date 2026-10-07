import os
import json
import re

SEED_BANK_DIR = "/Users/tsaisungen/Sites/Seed-Bank"

print("=== VERIFYING SEED-BANK FILES & REFERENCES ===")

# 1. Check .firebaserc
firebaserc_path = os.path.join(SEED_BANK_DIR, ".firebaserc")
print(f"Checking {firebaserc_path}...")
assert os.path.exists(firebaserc_path), f"Missing {firebaserc_path}"
with open(firebaserc_path) as f:
    print("  .firebaserc content:", f.read().strip())

# 2. Check package.json
pkg_path = os.path.join(SEED_BANK_DIR, "package.json")
print(f"Checking {pkg_path}...")
assert os.path.exists(pkg_path), f"Missing {pkg_path}"
with open(pkg_path) as f:
    pkg = json.load(f)
print("  Dependencies & DevDependencies:")
deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
for k in ["react", "react-dom", "vite", "typescript", "tailwindcss", "@tailwindcss/vite", "qrcode.react"]:
    print(f"    {k}: {deps.get(k)}")

# 3. Check src/types.ts
types_path = os.path.join(SEED_BANK_DIR, "src/types.ts")
print(f"Checking {types_path}...")
assert os.path.exists(types_path), f"Missing {types_path}"
with open(types_path) as f:
    types_content = f.read()

types_to_check = ["Seed", "StorageSpace", "SeedMovement", "LegacyClaimRequest", "Personnel"]
for t in types_to_check:
    print(f"\n--- Checking Type/Interface: {t} ---")
    match = re.search(rf'(?:interface|type)\s+{t}\b.*?\{{(.*?)\}}', types_content, re.DOTALL)
    if match:
        body = match.group(1)
        fields = [line.strip() for line in body.split("\n") if line.strip() and not line.strip().startswith("//")]
        print(f"  Found {t} with fields:")
        for field in fields[:25]:
            print(f"    {field}")
    else:
        # Check if type alias
        alias_match = re.search(rf'(?:interface|type)\s+{t}\b.*?;', types_content)
        if alias_match:
            print(f"  Found {t}: {alias_match.group(0)}")
        else:
            print(f"  NOT FOUND: {t}")

# 4. Check utils & components
files_to_check = [
    "src/utils/namingRule.ts",
    "src/utils/qrCodeSvg.ts",
    "src/components/legacy_shumei/TablePress35090.tsx",
    "src/components/legacy_shumei/Modal23852PrintLabel.tsx",
    "src/components/legacy_shumei/ClaimRequestsTable.tsx",
    "src/components/legacy_shumei/ShumeiAccessControlView.tsx",
    "src/components/legacy_shumei/Modal36122PackageEdit.tsx"
]

print("\n--- Checking Specific Files in Seed-Bank ---")
for f in files_to_check:
    full_p = os.path.join(SEED_BANK_DIR, f)
    print(f"  {f}: {'EXISTS' if os.path.exists(full_p) else 'MISSING'}")

# 5. Search for generateSurvivalBundle / OFFGRID VAC-1
print("\n--- Searching for generateSurvivalBundle / OFFGRID VAC-1 ---")
for root, dirs, files in os.walk(SEED_BANK_DIR):
    if any(p in root for p in [".git", "node_modules", "dist"]):
        continue
    for file in files:
        if file.endswith((".ts", ".tsx", ".js", ".jsx")):
            fpath = os.path.join(root, file)
            with open(fpath, "r", errors="ignore") as f_in:
                c = f_in.read()
            if "generateSurvivalBundle" in c or "OFFGRID" in c:
                rel = os.path.relpath(fpath, SEED_BANK_DIR)
                print(f"  Found in {rel}")
