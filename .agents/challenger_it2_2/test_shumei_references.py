import os
import json
import re

SHUMEI_DIR = "/Users/tsaisungen/Sites/shumei"

print("=== VERIFYING SHUMEI FILES & REFERENCES ===")

# 1. Check .firebaserc
firebaserc_path = os.path.join(SHUMEI_DIR, ".firebaserc")
print(f"Checking {firebaserc_path}...")
assert os.path.exists(firebaserc_path), f"Missing {firebaserc_path}"
with open(firebaserc_path) as f:
    firebaserc = json.load(f)
print("  .firebaserc content:", firebaserc)

# 2. Check public/farm/natural-farm.html
html_path = os.path.join(SHUMEI_DIR, "public/farm/natural-farm.html")
print(f"Checking {html_path}...")
assert os.path.exists(html_path), f"Missing {html_path}"
with open(html_path) as f:
    html_lines = f.readlines()

tab_seeds_lines = [(i+1, line.strip()) for i, line in enumerate(html_lines) if 'id="tab-seeds"' in line]
print(f"  Found id=\"tab-seeds\" at lines: {tab_seeds_lines}")

# 3. Check public/js/natural-farm.js
js_path = os.path.join(SHUMEI_DIR, "public/js/natural-farm.js")
print(f"Checking {js_path}...")
assert os.path.exists(js_path), f"Missing {js_path}"
with open(js_path) as f:
    js_content = f.read()

print("  Searching keywords in natural-farm.js:")
for kw in ["shumei_user_karma", "shumei_user_vouchers", "redeemKarmaReward", "SHUMEI-REWARD", "switchMainTab", "DNA", "seed"]:
    matches = len(re.findall(re.escape(kw), js_content, re.IGNORECASE))
    print(f"    Keyword '{kw}': {matches} occurrences")

# 4. Check public/js/natural-farm-admin.js
admin_js_path = os.path.join(SHUMEI_DIR, "public/js/natural-farm-admin.js")
print(f"Checking {admin_js_path}...")
assert os.path.exists(admin_js_path), f"Missing {admin_js_path}"
with open(admin_js_path) as f:
    admin_lines = f.readlines()

print(f"  Total lines in natural-farm-admin.js: {len(admin_lines)}")
cert_lines = [(i+1, line.strip()) for i, line in enumerate(admin_lines) if "SHUMEI-VOL" in line or "generateVolunteerCert" in line or "volunteerList" in line or "活躍奉仕" in line]
print("  Volunteer CRM matches:")
for lnum, line in cert_lines[:15]:
    print(f"    Line {lnum}: {line[:100]}")

# 5. Check change.html and change.js
change_html = os.path.join(SHUMEI_DIR, "public/farm/change.html")
change_js = os.path.join(SHUMEI_DIR, "public/js/change.js")
print(f"Checking change.html exists: {os.path.exists(change_html)}")
print(f"Checking change.js exists: {os.path.exists(change_js)}")

# 6. Check functions/
functions_dir = os.path.join(SHUMEI_DIR, "functions")
print(f"Checking functions directory: {os.path.exists(functions_dir)}")
if os.path.exists(functions_dir):
    print("  Functions files:", os.listdir(functions_dir))

# 7. Check Firestore collections referenced in codebase
collections = [
    "member",
    "allowed_users",
    "exchange_participants",
    "natural_events",
    "natural_bookings",
    "seminars",
    "volunteers",
    "karma",
    "users",
    "info"
]

print("\n=== SCANNING SHUMEI CODEBASE FOR COLLECTION REFERENCES ===")
for root, dirs, files in os.walk(SHUMEI_DIR):
    if any(p in root for p in [".git", "node_modules", ".agents"]):
        continue
    for file in files:
        if file.endswith((".js", ".html", ".ts", ".json")):
            fpath = os.path.join(root, file)
            with open(fpath, "r", errors="ignore") as f:
                content = f.read()
            for coll in collections:
                # search for collection("name") or collection('name') or db.collection or /name/
                pats = [f'collection("{coll}")', f"collection('{coll}')", f'collection(`{coll}`)', f'/{coll}/']
                for pat in pats:
                    if pat in content:
                        rel = os.path.relpath(fpath, SHUMEI_DIR)
                        print(f"  Found '{pat}' in {rel}")
