# ⛩️ @shumei/scheduling

> **秀明值班排程與現場自助報到系統模組**  
> 專為秀明會青年名單、小組長排程、淨靈活動與現場櫃檯登記所設計的模組化排程方案。

---

## 📦 模組內容

- **`ShumeiApp`**：完整秀明值班甘特圖與排班主介面（支援小組切換、甘特排程、看板與即時 Firebase Firestore 雙向同步）。
- **`ShumeiFront`**：現場平板自助報到櫃檯（第一步選組 ➔ 第二步選名字 ➔ 第三步登記參拜/淨靈/上秀勉標籤）。
- **`ShumeiScheduler`**：排班時間軸與人員配置組件。
- **`ShumeiStatusBoard`**：值班狀態統計看板。

---

## 🚀 使用方式

```tsx
import { ShumeiApp, ShumeiFront } from "@shumei/scheduling";

// 1. 嵌入排程主頁
<Route path="/shumei" element={<ShumeiApp />} />

// 2. 嵌入現場櫃檯報到
<Route path="/shumei-front" element={<ShumeiFront />} />
```
