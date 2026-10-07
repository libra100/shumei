# Original User Request

## 2026-09-18T01:52:47Z

本專案旨在對「Shumei 自然農法推廣與活動社群平台」與「Seed-Bank 秀明自家採種種子庫管理系統」兩個專案進行深度架構與功能交叉比對，剖析兩者在生態系中的角色定位、資料模型與功能互補性，並產出具備實踐可行性的技術規格與全方位跨專案合作藍圖。

Working directory: /Users/tsaisungen/Sites/shumei
Integrity mode: development

## Requirements

### R1. 雙專案技術架構與功能矩陣全景對比
- 全面盤點 Shumei（Vanilla JS / Bootstrap 5 / Firebase Firestore / Cloud Functions / 公眾活動預約、食育社群、志工 CRM、Karma 綠色積分、QR 核銷）與 Seed-Bank（React 19 / TypeScript / Tailwind CSS / Vite / 雙視圖架構 / NamingRule 14~18 碼編碼引擎、物理倉儲溫濕管理、TablePress 流通清單、向量 SVG QR Code 熱感標籤、DCC 文管中心）之核心架構與功能。
- 繪製兩者在自然農法推廣生態系中的角色光譜（「公眾參與及食農教育前台」 vs 「專業種源保存與庫存流通中後台」）。

### R2. 四大核心業務面向之互補性與整合潛力剖析
針對以下四個重點面向進行深度機制剖析：
1. **種子庫存與活動兌換串接**：Shumei 會員以 Karma 點數兌換種子包時，如何無縫對接 Seed-Bank 實體庫位出庫扣減、流通記錄登記與 100x60mm 熱感標籤印製。
2. **會員與志工認證互通**：Shumei 志工人才庫奉仕時數與證書系統，如何與 Seed-Bank 4 級採種會員權限矩陣（一般會員、認證採種者、分會幹部、總會管理員）進行對等驗證與資格晉升。
3. **溯源與食育雙向導流**：掃描 Seed-Bank 實體種子包 QR Code 如何自動導流至 Shumei 產地縮時照片、農友日誌與食育食譜；反之 Shumei 粒籽記憶庫如何直接調用 Seed-Bank 品種系譜與採種年份數據。
4. **全功能雙向同步架構**：探討資料權威（Single Source of Truth）、分散式資料同步（Firestore ↔ Seed-Bank State/API）與離線生存包相容性。

### R3. 具體落地整合方案、技術規格與分階段路線圖
- 設計跨系統資料欄位映射表（Data Mapping Table，涵蓋種子資訊、會員/志工、領取兌換記錄）。
- 定義系統間對接之 API 介面規格（包含端點、請求/回應格式與錯誤處理機制）。
- 繪製端到端整合業務流程圖（Sequence / User Journey Diagram）。
- 提出分階段實施路線圖（Roadmap：短期 0~3 月輕量連結、中期 3~6 月雙向串接、長期 6~12 月一體化生態運作），並評估實施效益與潛在技術風險。

## Acceptance Criteria

### 完整度與客觀性
- [ ] 產出完整的策略與架構分析報告文件 `docs/SHUMEI_SEED_BANK_COLLABORATION.md`。
- [ ] 涵蓋技術堆疊（Tech Stack）、資料模型（Data Schema）、業務流程（User Journey）三大維度之結構化對比矩陣。
- [ ] 完整涵蓋四大指定合作面向之詳細設計方案。
- [ ] 包含至少 2 幅具備語法正確性之 Mermaid 架構/流程圖（生態系全景定位圖、跨專案資料流 Sequence Diagram）。
- [ ] 包含完整跨系統資料欄位映射表與明確的 API 端點規格草案。
- [ ] 分階段路線圖具備具體的實施優先級、預期效益與風險因應對策。
