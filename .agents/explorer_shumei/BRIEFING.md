# BRIEFING — 2026-09-18T02:10:00Z

## Mission
Conduct a deep, comprehensive codebase exploration of the Shumei project (/Users/tsaisungen/Sites/shumei), producing structured evidence chains and a 5-component handoff report.

## 🔒 My Identity
- Archetype: explorer
- Roles: codebase explorer, technical investigator
- Working directory: /Users/tsaisungen/Sites/shumei/.agents/explorer_shumei
- Original parent: d3fb908c-af3a-4fac-ac09-4c016032507e
- Milestone: M1_EXPLORATION

## 🔒 Key Constraints
- Read-only investigation — do NOT modify application source code
- Files for content delivery, Messages for coordination
- Evidence chain completeness: exact file paths, line numbers, schema definitions
- Output deliverable: /Users/tsaisungen/Sites/shumei/.agents/explorer_shumei/handoff.md

## Current Parent
- Conversation ID: d3fb908c-af3a-4fac-ac09-4c016032507e
- Updated: 2026-09-18T02:10:00Z

## Investigation State
- **Explored paths**:
  - `package.json`, `firebase.json`, `.firebaserc`
  - `functions/index.js`, `functions/package.json`
  - `data_dumps/latest_data.json`, `scripts/verify-lineage.js`
  - `public/js/` (`admin.js`, `auth.js`, `change.js`, `events.js`, `front.js`, `group.js`, `index.js`, `jyorei.js`, `lineage.js`, `list.js`, `natural-farm.js`, `natural-farm-admin.js`, `pwa.js`, `seminar.js`, `training.js`)
  - `public/farm/`, `public/seed/`, `public/activities/`, `public/youth/`, `public/scheduling/`
  - `packages/scheduling/` (TypeScript / React scheduling engine & shift slots)
- **Key findings**:
  - Identified 9 primary Firestore collections (`member`, `info`, `allowed_users`, `exchange_participants`, `natural_events`, `natural_bookings`, `activities_events`, `seminars`, `jyorei_logs`) and cross-db `ganttcraft_projects/shumei`.
  - Discovered end-to-end QR code generation (`qrcodejs`) and camera scanning (`html5-qrcode`) in seed exchange (`BAG-...`), natural farm bookings (`SHUMEI-NF-...`), and youth events (`SHM-...`).
  - Mapped Karma points earning (+20/+40 for events, +50 for UGC reviews, +20 for quiz, +100 for rice adoption) and voucher minting (`SHUMEI-REWARD-...`).
  - Documented volunteer 4-stage Kanban CRM and certificate issuance (`SHUMEI-VOL-2026-...`), perfectly mapping to Seed-Bank's 4-tier membership authorization matrix.
  - Formulated 4 concrete cross-system integration surfaces with Seed-Bank.
- **Unexplored areas**: None for Shumei codebase; investigation goals 100% completed.

## Key Decisions Made
- Executed local script verification (`verify-lineage.js` and Node syntax check on `functions/index.js`).
- Structured 5-component handoff report in `/Users/tsaisungen/Sites/shumei/.agents/explorer_shumei/handoff.md`.

## Artifact Index
- /Users/tsaisungen/Sites/shumei/.agents/explorer_shumei/handoff.md — Final investigation handoff report
