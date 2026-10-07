# Project: Shumei ↔ Seed-Bank Cross-Project Collaboration & Architectural Integration

## Architecture
This project establishes a comprehensive architectural and functional integration between two complementary open-source platforms within the Shumei Natural Farming (秀明自然農法) ecosystem:
1. **Shumei Platform** (`/Users/tsaisungen/Sites/shumei`): Public Engagement, Community Education, Volunteer Management, and Gamified Karma Ecosystem (Vanilla JS / Bootstrap 5 / Firebase Firestore / Cloud Functions v2).
2. **Seed-Bank System** (`/Users/tsaisungen/Sites/Seed-Bank`): Professional Germplasm Conservation, Seed Naming Engine (NamingRule 14~18 char), Physical Microclimate Vault Management, 100x60mm Thermal Printing, and 4-Tier Governance (React 19 / TypeScript / Tailwind CSS / Vite).

Both platforms share the same Google Cloud / Firebase project infrastructure (`shumei-2025`), providing a native foundation for unified Firestore data persistence, shared Firebase Authentication, and Cloud Functions API routing.

```
+-----------------------------------------------------------------------------------+
|                            SHUMEI ECOSYSTEM LANDSCAPE                             |
+-----------------------------------------------------------------------------------+
|  [Shumei Frontend] (shumei-2025.web.app)                                          |
|  - Public Event Booking & Kiosk Registration                                      |
|  - Food Education & 24 Solar Terms Farmer UGC Diaries                             |
|  - Volunteer CRM Kanban & Service Hours Certification                             |
|  - Green Karma Points Ledger & Activity Redemption Wallet                         |
|  - Grain DNA Memory Bank & 3D Force Lineage Tree                                  |
+-----------------------------------------+-----------------------------------------+
                                          | Shared Cloud / Unified APIs
                                          v
+-----------------------------------------------------------------------------------+
|  [Integration & Middleware Layer] (Cloud Functions v2 / Firestore SSOT)           |
|  - /api/v1/seeds/claim (Karma to Seed inventory allocation)                       |
|  - /api/v1/members/verify-qualification (Volunteer CRM to 4-tier RBAC)            |
|  - /trace/{shumeiCode} (Dynamic QR redirect to Origin & Recipe Storytelling)      |
|  - /api/v1/sync/seeds (Bi-directional Delta Replication & Offline Recovery)      |
+-----------------------------------------+-----------------------------------------+
                                          | Shared Cloud / Unified APIs
                                          v
+-----------------------------------------------------------------------------------+
|  [Seed-Bank Vault] (shumei-seed-bank)                                             |
|  - NamingRule 14~18 Char Botanical Code Engine                                    |
|  - Physical Warehouse (Refrigerated, Pot-in-Pot, Charcoal Cellar, Ambient)       |
|  - TablePress #35090 Double-Tier Grid & Column 4 Fast Package Editor              |
|  - 100x60mm Thermal Sticker Label Printing Engine (Vector SVG QR)                 |
|  - DCC (Document Control Center) & 4-Tier RBAC Stewardship Matrix                 |
|  - Standalone Single-File HTML Disaster Survival Bundle (OFFGRID VAC-1)           |
+-----------------------------------------------------------------------------------+
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Tech Stack & Architecture Comparison Matrix | Structured comparison across Framework, Language, UI, State, Storage, and Deployment | M1 | Survey (Explorer 1 & 2) |
| 2 | Ecological Role Spectrum | Analysis of "Public Engagement & Food Edu Frontend" vs "Professional Seed Vault Back-office" | M1 | Survey (Explorer 3) |
| 3 | Dimension 1: Karma Redemption to Physical Seed Deduction | Workflow connecting Shumei 200pt Karma voucher to Seed-Bank physical inventory deduction and 100x60mm label printing | M1 | Survey (Explorer 1, 2, 3) |
| 4 | Dimension 2: Member & Volunteer Certification Reciprocity | 1:1 mapping of Shumei volunteer service hours (0-120h+) & certificates to Seed-Bank 4-Tier RBAC | M1 | Survey (Explorer 1, 2, 3) |
| 5 | Dimension 3: Bi-directional Provenance & Food Education Traffic | Thermal label QR code routing to Shumei grower diaries/recipes; Shumei querying Seed-Bank pedigree & germination | M1 | Survey (Explorer 1, 2, 3) |
| 6 | Dimension 4: Bi-directional Sync & Offline Disaster Readiness | SSOT definition, Firestore delta replication, and offline survival bundle (`generateSurvivalBundle`) integration | M1 | Survey (Explorer 1, 2, 3) |
| 7 | Cross-System Data Mapping Table | Exact field mapping for Seeds, Members/Volunteers, and Claim/Circulation transactions | M1 | Survey (Explorer 3) |
| 8 | Formal API Endpoint Specifications | Detailed OpenAPI-style contracts for Claim, Qualification, and Seed Sync with error schemas | M1 | Survey (Explorer 3) |
| 9 | End-to-End Sequence Diagrams (Mermaid) | Valid Mermaid sequence diagrams for Redemption & Provenance Flows | M1 | Survey (Explorer 3) |
| 10 | Phased Implementation Roadmap & Risk Matrix | 3-phase rollout (0-3m, 3-6m, 6-12m) with mitigation for out-of-sync, network loss, and data leakage | M1 | Survey (Explorer 3) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Collaboration Blueprint Document | Author `/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md` covering all 10 inventoried features and meeting all Acceptance Criteria | Phase 0 (Survey Complete) | READY |

## Interface Contracts
### Shumei (Karma/Claim) ↔ Seed-Bank (Inventory/Fulfillment)
- Endpoint: `POST /api/v1/seeds/claim`
- Request Payload:
  ```json
  {
    "claimId": "CLM-YYYY-XXXX",
    "userId": "string",
    "userName": "string",
    "seedId": "string",
    "seedCode": "string (NamingRule)",
    "requestedPackages": "number",
    "redeemType": "karma | free | exchange",
    "karmaDeducted": "number",
    "fulfillmentMethod": "pickup | post",
    "shippingAddress": "string?"
  }
  ```
- Response Payload:
  ```json
  {
    "success": true,
    "claimSeq": "number",
    "storageLocationId": "string",
    "allocatedBatch": "string",
    "labelReady": true,
    "status": "pending_approval"
  }
  ```

### Shumei (Volunteer CRM) ↔ Seed-Bank (RBAC Access Control)
- Endpoint: `POST /api/v1/members/verify-qualification`
- Request: `{ "uid": "string", "email": "string" }`
- Response:
  ```json
  {
    "uid": "string",
    "volunteerHours": "number",
    "volunteerStage": "新申請 | 面談評估 | 已認證 | 活躍奉仕",
    "certificateId": "string?",
    "grantedSeedBankLevel": 1 | 2 | 3 | 4,
    "grantedRole": "consumer | grower | saver | admin"
  }
  ```

### Seed-Bank (Physical Label QR) ↔ Shumei (Food Education & Traceability)
- Dynamic URI Scheme: `https://shumei-2025.web.app/trace/{shumeiCode}`
- Redirect Target: `natural-farm.html?trace={shumeiCode}#dna-bank`
- Data Served: Time-lapse photos, grower name, farm coordinates, cooking tips, UGC reviews.

## Code Layout
- Deliverable Target: `/Users/tsaisungen/Sites/shumei/docs/SHUMEI_SEED_BANK_COLLABORATION.md`
- Referenced Source Files:
  - Shumei: `/Users/tsaisungen/Sites/shumei/public/js/natural-farm.js`, `natural-farm-admin.js`, `change.js`, `functions/index.js`
  - Seed-Bank: `/Users/tsaisungen/Sites/Seed-Bank/src/utils/namingRule.ts`, `qrCodeSvg.ts`, `src/types.ts`, `src/components/legacy_shumei/`
