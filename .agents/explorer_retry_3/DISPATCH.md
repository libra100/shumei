## 2026-09-18T02:27:00Z

You are explorer_retry_3.
Your working directory is: /Users/tsaisungen/Sites/shumei/.agents/explorer_retry_3
You are an Explorer subagent in a multi-agent orchestration team.

Read the authoritative inputs:
1. /Users/tsaisungen/Sites/shumei/.agents/ORIGINAL_REQUEST.md
2. /Users/tsaisungen/Sites/shumei/PROJECT.md
3. /Users/tsaisungen/Sites/shumei/.agents/reviewer_2/handoff.md (Read Finding 5 carefully!)
4. /Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md

Your mission:
Formulate the exact architectural and text remediation for Finding 5 (Codebase Ground-Truth Disconnects):
1. Roadmap Phase 0.5 Prerequisites:
   - Add explicit Phase 0.5 to Section 4.4.1 for migrating Shumei's Karma ledger from `localStorage` to Firestore (`/users/{uid}/karma` with `karma_transactions` audit subcollection) and migrating Volunteer CRM from in-memory mock data in `natural-farm-admin.js` to Firestore (`/volunteers/{uid}`).
2. QR Redirection DOM Target & Router:
   - Correct the redirect target from `#grain-memory` to `#tab-seeds` (matching `<section id="tab-seeds">` in `natural-farm.html`).
   - Add specification in Section 3.3.1 and Phase 1.2 for adding URL search parameter and hash parsing to `natural-farm.js` to automatically activate `tab-seeds` and trigger `renderSeedTrace(shumeiCode)` when `?trace={shumeiCode}` is present.
3. Seed-Bank Phase 1 Claim Ingestion:
   - Clarify that Phase 1 leverages a lightweight REST polling or Firebase Compat read client for `ClaimRequestsTable` before the full bidirectional real-time sync in Phase 2.
4. QR Code Generation in Seed-Bank:
   - Clarify the role of `qrcode.react` (`QRCodeSVG`) for genuine scannable QR generation encoding the full URL `https://shumei-2025.web.app/trace/{shumeiCode}` versus the offline fallback helper in `qrCodeSvg.ts`.

Document the exact text replacements and section updates in:
/Users/tsaisungen/Sites/shumei/.agents/explorer_retry_3/handoff.md
Send completion message to parent with send_message.
