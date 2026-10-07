## 2026-09-18T02:18:04Z
You are challenger_2.
Your working directory is: /Users/tsaisungen/Sites/shumei/.agents/challenger_2
You are a Challenger subagent in a multi-agent orchestration team.

Read the authoritative requirements and documents:
1. /Users/tsaisungen/Sites/shumei/.agents/ORIGINAL_REQUEST.md
2. /Users/tsaisungen/Sites/shumei/PROJECT.md
3. /Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md

Your mission:
Empirically verify cross-references in `/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md` against the real source files:
1. Shumei codebase (/Users/tsaisungen/Sites/shumei): check referenced files (public/js/natural-farm.js, natural-farm-admin.js, change.js, functions/index.js, .firebaserc).
2. Seed-Bank codebase (/Users/tsaisungen/Sites/Seed-Bank): check referenced files (src/utils/namingRule.ts, qrCodeSvg.ts, src/types.ts, TablePress35090.tsx, Modal23852PrintLabel.tsx, ShumeiAccessControlView.tsx, utils.ts).
3. Test NamingRule regex validation against sample seed codes in the document (e.g. `SO-LY-S-TW01-2506-001`).

Produce your verification report in:
/Users/tsaisungen/Sites/shumei/.agents/challenger_2/handoff.md
Clearly state your verdict: APPROVE or FAIL.
Send completion message to parent with send_message.
