# BRIEFING — 2026-09-18T02:07:00Z

## Mission
Deep, comprehensive codebase exploration of the Seed-Bank project located at /Users/tsaisungen/Sites/Seed-Bank across 8 core dimensions.

## 🔒 My Identity
- Archetype: explorer
- Roles: [explorer, synthesis]
- Working directory: /Users/tsaisungen/Sites/shumei/.agents/explorer_seedbank
- Original parent: d3fb908c-af3a-4fac-ac09-4c016032507e
- Milestone: Seed-Bank Codebase Exploration

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Explore Seed-Bank at /Users/tsaisungen/Sites/Seed-Bank
- Produce concrete evidence chains (exact file paths, line numbers, schemas)
- Output structured handoff report in /Users/tsaisungen/Sites/shumei/.agents/explorer_seedbank/handoff.md

## Current Parent
- Conversation ID: d3fb908c-af3a-4fac-ac09-4c016032507e
- Updated: 2026-09-18T01:57:00Z

## Investigation State
- **Explored paths**:
  - `/Users/tsaisungen/Sites/Seed-Bank/package.json`, `tsconfig.json`, `vite.config.ts`, `PROJECT.md`
  - `src/types.ts`, `src/data.ts`, `src/utils.ts`, `src/App.tsx`, `src/index.css`
  - `src/utils/namingRule.ts`, `src/utils/qrCodeSvg.ts`
  - `src/components/legacy_shumei/`: `LegacyShumeiView.tsx`, `ShumeiSidebar.tsx`, `ShumeiActionBar.tsx`, `ShumeiFilterCard.tsx`, `TablePress35090.tsx`, `ClaimRequestsTable.tsx`
  - `src/components/legacy_shumei/modals/`: `Modal36122PackageEdit.tsx`, `Modal66281Provide.tsx`, `Modal66278Claim.tsx`, `Modal23852PrintLabel.tsx`, `ModalSeedEdit.tsx`
  - `src/components/legacy_shumei/views/`: `ShumeiWarehouseView.tsx`, `ShumeiMembersView.tsx`, `ShumeiDccView.tsx`, `ShumeiAccessControlView.tsx`, `ShumeiLogisticsReportView.tsx`, `ShumeiRulesView.tsx`
  - `src/components/`: `DisasterReadiness.tsx`, `FacilityLogistics.tsx`, `SeedStewardship.tsx`, `SeedSwapTracker.tsx`, `CsaMarketplace.tsx`, `EventExperience.tsx`
- **Key findings**:
  - React 19 + TS 5.8 + Tailwind v4 + Vite 6 dual-view architecture (Legacy Shumei ↔ Modern Ark) with shared single source of truth in state and localStorage.
  - 14~18 digit NamingRule engine `[科屬]-[品種]-[農法]-[地區]-[YYMM]-[批號]`, regex validation, TW01~TW10 and JP01~JP47 JIS X 0401 dictionaries.
  - 4 cooling facility types (refrigerator, clay_pot pot-in-pot, bamboo cellar, ambient) with temperature/humidity monitoring and transfer audit logging.
  - TablePress #35090 with 15 cols, 2-tier grouped header, Column 4 double-click package count edit, and claim management.
  - 100x60mm thermal sticker label printing via Modal #23852 with vector SVG QR code.
  - 4-tier RBAC permission matrix (Level 1: 支持者, Level 2: 耕作者, Level 3: 認證保種人, Level 4: 首席主事), DCC versioned SOPs and isolation distances.
  - Single-file offline HTML survival bundle (`generateSurvivalBundle`) embedding zero-dependency database and search engine.
- **Unexplored areas**: None. All 8 dimensions fully explored with verified evidence chains.

## Key Decisions Made
- Compiled comprehensive handoff report at `/Users/tsaisungen/Sites/shumei/.agents/explorer_seedbank/handoff.md`.

## Artifact Index
- /Users/tsaisungen/Sites/shumei/.agents/explorer_seedbank/DISPATCH.md — Dispatch instructions
- /Users/tsaisungen/Sites/shumei/.agents/explorer_seedbank/progress.md — Progress & heartbeat
- /Users/tsaisungen/Sites/shumei/.agents/explorer_seedbank/handoff.md — Final handoff report
