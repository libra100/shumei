import re

html_path = '/Users/tsaisungen/Sites/shumei/public/change.html'
js_path = '/Users/tsaisungen/Sites/shumei/public/js/change.js'

with open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

# Extract script content
script_pattern = re.compile(r'<script>(.*?)</script>\s*</body>', re.DOTALL)
match = script_pattern.search(html_content)

if not match:
    print("Script not found!")
    exit(1)

js_content = match.group(1).strip()

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(js_content)

# Replace script in html
new_html_content = script_pattern.sub(r'<script src="./js/change.js"></script>\n</body>', html_content)
with open(html_path, 'w', encoding='utf-8') as f:
    f.write(new_html_content)

print("Extraction complete.")
