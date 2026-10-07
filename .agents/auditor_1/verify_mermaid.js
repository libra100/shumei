const fs = require('fs');
const content = fs.readFileSync('/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md', 'utf8');
const mermaidRegex = /```mermaid\n([\s\S]*?)\n```/g;
let match;
let index = 1;
while ((match = mermaidRegex.exec(content)) !== null) {
  const code = match[1];
  console.log('=== Mermaid Diagram #' + index + ' ===');
  console.log('First line:', code.trim().split('\n')[0]);
  console.log('Total lines:', code.trim().split('\n').length);
  index++;
}
