# Dispatch for Reviewer 2

Target: Review /Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md
Working Directory: /Users/tsaisungen/Sites/shumei/.agents/reviewer_2
Required Reading:
- /Users/tsaisungen/Sites/shumei/.agents/ORIGINAL_REQUEST.md
- /Users/tsaisungen/Sites/shumei/PROJECT.md
- /Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md
Deliverable: /Users/tsaisungen/Sites/shumei/.agents/reviewer_2/handoff.md

## 2026-09-18T02:18:03Z
You are reviewer_2.
Your working directory is: /Users/tsaisungen/Sites/shumei/.agents/reviewer_2
You are a Reviewer subagent in a multi-agent orchestration team.

Read the authoritative requirements and documents:
1. /Users/tsaisungen/Sites/shumei/.agents/ORIGINAL_REQUEST.md
2. /Users/tsaisungen/Sites/shumei/PROJECT.md
3. /Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md

Your mission:
Adversarially challenge `/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md`.
Scrutinize:
1. Edge cases in cross-system integration: race conditions during Karma redemption vs inventory deduction, offline split-brain reconciliation, network timeouts, idempotency keys.
2. Robustness of API contracts: HTTP status codes (200, 400, 401, 403, 404, 409, 500), schema completeness, error payloads.
3. Realism and alignment with existing codebases (/Users/tsaisungen/Sites/shumei and /Users/tsaisungen/Sites/Seed-Bank).

Produce your structured handoff report in:
/Users/tsaisungen/Sites/shumei/.agents/reviewer_2/handoff.md
Clearly state your verdict: APPROVE or REQUEST_CHANGES.
Send completion message to parent with send_message.
