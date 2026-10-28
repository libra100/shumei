# 秀明小助理系統運作規則與更動紀錄 (System Rules & Changelog)

**記錄日期**：2026 年 10 月 28 日  
**主要維護者**：松恩 & AI 協同團隊  
**適用範圍**：LINE Bot 官方帳號、Cloud Functions 後端、Firestore 資料庫架構  

---

## 📋 一、今日確立之核心運作規則 (System Rules)

### 1. 使用者反饋與功能升級建議收集機制
- **觸發條件**：
  - 前綴關鍵字：`建議`、`反饋`、`許願`、`功能建議`、`升級建議`、`回報問題`、`系統建議`（支援空格、中文冒號與英文冒號）。
  - 自然語句開頭：`我希望...`、`希望能...`、`能不能...`、`可不可以...`、`可以請小助理...`、`希望小助理...`（長度 $\ge$ 4 字）。
- **資料庫存檔規格**：
  - 集合路徑：`system_feedbacks`
  - 欄位結構：
    - `content` (string): 建議內容主體（自動去除前綴詞）
    - `userName` (string): 發送者 LINE 暱稱（若無則標示「成員」）
    - `userId` (string): 發送者 LINE User ID
    - `status` (string): 初始狀態為 `"pending"`（待評估）
    - `source` (string): `"line_private"` 或 `"line_group"`
    - `createdAt` (Timestamp): 伺服器時間戳記
- **即時回覆標準**：
  - 即時回傳溫馨確認訊息，給予信徒/同工即時肯定，並告知排程評估日期：
    > 📝 *感謝您的寶貴反饋！小助理已為您記錄此項功能調整需求：「[建議內容]」，已列入「下次系統升級確認清單」中，管理員將於每月 26 日排程統一進行評估與規劃更新！感謝您一同讓小助理更完善～🙏*

---

### 2. 每月 26 日排程統籌推播規則
- **執行時間**：每月 26 日早上 09:00（台北時區 Asia/Taipei）。
- **觸發函數**：`monthlyActivityPlanningReminder`。
- **推播內容組合**：
  1. 下個月份活動規劃與負責人設定提醒（含活動管理系統連結）。
  2. **【本月使用者功能升級建議彙整】**：
     - 自動撈取 `system_feedbacks` 中所有 `status == 'pending'` 的建議清單。
     - 條列呈現建議者與內容（最多展示 5 筆，超出時顯示總筆數）。
     - 提醒管理員於月度幹部會議中一併討論評估。
- **推播對象**：所有在 `info/editors` 中 `active == true` 且已綁定 `lineUserId` 之幹部與管理員。

---

### 3. 幹部隨時查閱建議指令
- **觸發關鍵字**：`查看建議`、`升級建議`、`建議清單`、`待確認建議`、`查看反饋`、`反饋清單`。
- **安全防護規則**：
  - **環境限制**：僅限在與小助理的 **1 對 1 私聊** 中查詢；若在群組中觸發，小助理會提示「🔒 為保護隱私與管理秩序，請在與我的 1 對 1 私聊中查看建議清單喔！」。
  - **權限驗證**：發送者必須為已在 `info/editors` 認證的有效幹部。

---

### 4. 資安防護：密碼全面遮蔽與防洩規則
- **嚴格禁止行為**：
  - 不得在任何公開或私聊提示訊息、錯誤訊息或操作範例中明碼暴露真實密碼。
- **認證指導標準格式**：
  - 一律改用預留位置格式：`幹部認證 [專屬密碼] [您的姓名]`。
  - 徹底移除過往容易造成誤解或洩漏的具體範例文字（如「例如：幹部認證 xxx 松恩」）。

---

### 5. 座談會與統計查詢寬鬆比對規則
- **比對優化**：
  - 修正過去必須包含「統計」二字才會回應的嚴苛限制。
  - 現在輸入 `本月座談會`、`座談會`、`10月座談會`、`座談會回報` 或 `座談會統計`，皆能正確命中座談會報名與統計處理流程。

---

### 6. Gemini AI 運算模型優先權與透明標記規則
- **優先順序**：
  1. 首選：`gemini-3.8-flash`（最新高智商、高速推理模型）
  2. 備援一：`gemini-3.5-flash-lite`（極速輕量模型）
  3. 備援二：`gemini-2.5-flash`（高穩定備援）
- **透明度規範**：
  - 所有由 AI 模型運算生成的對話回覆，末尾必須附加：`⚡ 運算模型：<使用的模型名稱>`。

---

## 🛠️ 二、今日程式碼更動清單 (Changelog)

| 檔案路徑 | 變更類型 | 核心內容說明 |
| :--- | :---: | :--- |
| [`functions/index.js`](file:///Users/tsaisungen/Sites/shumei/functions/index.js) | 核心邏輯 | 1. 增加 `isFeedbackCmd` 與 `isFeedbackQueryCmd` 識別與處理器。<br>2. 整合 Gemini AI 智能分類標籤（`座談會`、`入信願書`、`活動日程`、`淨靈統計`、`成員資料`、`系統功能` 等）。<br>3. 增加未命中意圖時之「主動引導建議」提示機制。<br>4. 移除 Firestore 複合索引相依改採記憶體排序防止查詢崩潰。<br>5. 擴充 `isSeminarQuery` 支援 `本月座談會`。<br>6. 遮蔽認證指令中的真實密碼與移除冗餘範例。 |
| [`functions/activityReminders.js`](file:///Users/tsaisungen/Sites/shumei/functions/activityReminders.js) | 排程提醒 | 1. `buildMonthlyPlanningMessage` 增加 `pendingFeedbacks` 參數並依分類標籤與圖示結構化呈現。<br>2. `sendMonthlyPlanningReminder` 異步載入 `system_feedbacks` 並附加容錯保護機制。 |
| [`functions/test/test_reminders.js`](file:///Users/tsaisungen/Sites/shumei/functions/test/test_reminders.js) | 單元測試 | 1. 擴充 mockDb 支援 `system_feedbacks.where`。<br>2. 增加月度排程包含建議彙整與分類標籤的斷言驗證。<br>3. 全數 33 項單元測試順利通過。 |
| [`scripts/resolve_feedback.js`](file:///Users/tsaisungen/Sites/shumei/scripts/resolve_feedback.js) | 自動化工具 | 建立 AI 協同專用之全自動結案與 LINE 上線通知工具（支援 `list` 與 `complete` 自動發送推播給原提議者）。 |
| [`functions/package.json`](file:///Users/tsaisungen/Sites/shumei/functions/package.json) | 環境升級 | 升級 `engines.node` 至 `"22"`，符合 Cloud Functions 最新長期支援規範。 |
| **GCP 雲端架構** | 營運維護 | 重新綁定 Cloud Billing 帳戶 `01A30B-E7F427-41EBBE` 至專案 `shumei-2025`，排除 Cloud Run 部署凍結異常。 |

---

## 💡 三、未來功能擴充建議 (Feature Recommendations)

針對「使用者反饋與升級建議」功能，建議後續可評估以下延伸設計：

1. **建議處理進度標記（Lifecycle Tracking）**
   - 幹部在 LINE 私聊中可直接輸入指令變更狀態：
     - `採納建議 #1`（標記為 `accepted`，列入排程開發）
     - `完成建議 #1`（標記為 `completed`，已升級上線）
     - `暫緩建議 #1 [原因]`（標記為 `deferred`）

2. **升級上線自動通知機制（Close-the-Loop Notification）**
   - 當某個功能升級完成並標記為 `completed` 時，系統自動發送 LINE 推播給當初提議的使用者：
     > 🎉 *感謝您先前的寶貴提議！您於 10/28 建議的「...」功能已經正式上線囉，快來體驗看看吧！*  
   - 此舉能大幅強化使用者與同工的參與感與向心力。

3. **AI 智能分類與負責幹部指派**
   - 收集到建議時，由 Gemini 模型自動辨識建議所屬範疇並加上標籤：
     - `[活動排程]`、`[座談會登記]`、`[入信願書OCR]`、`[淨靈統計]`、`[介面體驗]`。
   - 26 日彙整報告時依類別分組，方便活動組、總務組或教務幹部認領。

4. **Web 管理後台「系統建議與反饋」專屬分頁**
   - 在現有 Web 管理介面增加反饋管理頁面，提供表格檢視、搜尋、批次更改狀態、新增處理備註與匯出 Excel。

5. **+1 附議與熱門度排行（Upvote）**
   - 若其他同工也想要相同功能，可在群組中點選或回覆「+1」，系統自動為該筆建議累加計數，26 日提醒時優先展示得票數最高的前三名熱門需求。
