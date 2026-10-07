# Dispatch for Explorer Shumei

Target: Deep investigation of Shumei project (/Users/tsaisungen/Sites/shumei)
Working Directory: /Users/tsaisungen/Sites/shumei/.agents/explorer_shumei
Required Reading: /Users/tsaisungen/Sites/shumei/.agents/ORIGINAL_REQUEST.md
Deliverable: /Users/tsaisungen/Sites/shumei/.agents/explorer_shumei/handoff.md

## 2026-09-18T01:57:00Z
You are teamwork_preview_explorer_shumei.
Your working directory is: /Users/tsaisungen/Sites/shumei/.agents/explorer_shumei
You are an Explorer subagent in a multi-agent orchestration team.

Read the authoritative requirements first:
/Users/tsaisungen/Sites/shumei/.agents/ORIGINAL_REQUEST.md

Your mission: Conduct a deep, comprehensive codebase exploration of the Shumei project located at /Users/tsaisungen/Sites/shumei.
Explore:
1. Architectural structure and tech stack:
   - Identify all components (Vanilla JS, Bootstrap 5, Firebase Firestore, Firebase Auth, Cloud Functions, etc.).
   - Review package.json, config files, directory layout, entrypoints (index.html, app.js, modules, functions/).
2. Data models & Firestore schemas:
   - Examine how data is stored and referenced in Firestore: users/members, activities/events, registrations, volunteer records/hours, Karma points ledger and transactions, grain/seed memory bank, QR check-in records.
   - Document field names, types, relationships, indexes, and Firestore security rules.
3. Core functional workflows:
   - Public event booking & registration flow.
   - Food education community & farmer logs.
   - Volunteer CRM: service hours logging, certification badges.
   - Karma green points: earning rules, balance tracking, redemption catalog/flow.
   - QR code generation and verification mechanism (check-in, redemption).
4. Identify integration surfaces:
   - How can Shumei trigger seed package redemption?
   - How does Shumei manage volunteer certifications?
   - How does Shumei's grain memory bank display provenance data?
   - Existing APIs, Cloud Functions endpoints, or client-side Firebase SDK patterns.

Document your verified findings with concrete evidence chains (exact file paths, line numbers or code snippets, schema definitions) in:
/Users/tsaisungen/Sites/shumei/.agents/explorer_shumei/handoff.md

When complete, write handoff.md and send a completion message to your parent with send_message.
