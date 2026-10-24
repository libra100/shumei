# 神慈秀明會 (Shumei) 專案功能與程式碼關鍵字索引地圖
# Codebase Feature & Keyword Lookup Index

> **說明**：本索引專為工程師與協作 Agent 設計。當需要修改、除錯或擴充特定業務功能時，可直接搜尋下方關鍵字，迅速定位對應的前端頁面 (HTML)、JavaScript 商業邏輯 (JS)、樣式 (CSS) 與後端 Cloud Functions 及 Firestore 資料庫路徑。

---

## 快速跳轉目錄

1. [身份驗證與登入流程 (Auth & Login)](#1-身份驗證與登入流程-auth--login)
2. [幹部總覽儀表板 (Youth Dashboard & Operations)](#2-幹部總覽儀表板-youth-dashboard--operations)
3. [青年名冊與身份認領 (Youth List & Member CRM)](#3-青年名冊與身份認領-youth-list--member-crm)
4. [名冊後台管理與維護 (Admin Portal)](#4-名冊後台管理與維護-admin-portal)
5. [青年分組與活動意願指派 (Group & Activity Assignment)](#5-青年分組與活動意願指派-group--activity-assignment)
6. [座談會記錄與自訂出席 (Seminar & Attendance)](#6-座談會記錄與自訂出席-seminar--attendance)
7. [世代表與靈統關聯 (Lineage Tree)](#7-世代表與靈統關聯-lineage-tree)
8. [一般信徒專區 (Member Portal)](#8-一般信徒專區-member-portal)
9. [淨靈打卡與施光紀錄 (Jyorei Tracking)](#9-淨靈打卡與施光紀錄-jyorei-tracking)
10. [活動報名與青年研修 (Events & Training)](#10-活動報名與青年研修-events--training)
11. [秀明自然農法與綠色市集 (Natural Farm & Market)](#11-秀明自然農法與綠色市集-natural-farm--market)
12. [現場排程與櫃檯接待 (Scheduling & Front Kiosk)](#12-現場排程與櫃檯接待-scheduling--front-kiosk)
13. [自家採種與種子兌換 (Seed Bank & Karma Exchange)](#13-自家採種與種子兌換-seed-bank--karma-exchange)
14. [LINE Bot 與 Gemini OCR 後端 (Cloud Functions & AI)](#14-line-bot-與-gemini-ocr-後端-cloud-functions--ai)
15. [URL 重定向與 PWA 設定 (Routing & Service Worker)](#15-url-重定向與-pwa-設定-routing--service-worker)

---

## 1. 身份驗證與登入流程 (Auth & Login)
*   **功能描述**：登入首頁角色選擇（一般信徒 vs 小組長）、Google OAuth 登入、小組長密碼快速驗證（支援 LINE 內建瀏覽器避開 403 阻擋）、Session 與 Role 旗標管理。
*   **搜尋關鍵字**：`登入`, `小組長登入`, `密碼登入`, `Google登入`, `一般信徒登入`, `幹部密碼`, `leaderPasswordModal`, `SHUMEI_LEADER_AUTH`, `info/set.pass`
*   **前端 HTML**：`public/index.html`
*   **前端 JS**：`public/js/index.js`
*   **核心函式 / 符號**：
    *   `signInWithGoogle()`: 啟動 Google 彈窗登入
    *   `signInAsGuest(role)`: 一般信徒匿名登入（導向 `/member/index.html`）
    *   `openLeaderPasswordModal()`: 開啟幹部密碼輸入彈窗
    *   `submitLeaderPassword(event)`: 驗證 `info/set.pass` 密碼並寫入 `SHUMEI_LEADER_AUTH`
*   **Firestore 集合**：
    *   `info/set` (欄位: `pass`, `write`, `login`)
    *   `info/admins` (欄位: `emails`)

---

## 2. 幹部總覽儀表板 (Youth Dashboard & Operations)
*   **功能描述**：幹部統計 KPI、關懷密度警示（未接觸者 `connect == false`）、特殊備註成員追蹤、招募項目設定（7大預設項目/彈窗編輯/自訂新增）、甘特圖工作意願統計。
*   **搜尋關鍵字**：`總覽`, `儀表板`, `未接觸`, `關懷密度`, `招募項目`, `值班意願`, `甘特圖`, `manageJobsModal`, `tag_worship`, `kpi-total-members`
*   **前端 HTML**：`public/youth/dashboard.html`
*   **前端 JS**：`public/js/dashboard.js`
*   **核心函式 / 符號**：
    *   `initDashboard()`: 儀表板總初始化，同步載入成員、甘特圖、座談會與淨靈
    *   `loadMembersData()`: 統計成員數與渲染需關懷名單
    *   `openManageJobsModal()` / `saveRecruitmentJobs()`: 招募工作項目動態彈窗維護
    *   `DEFAULT_RECRUITMENT_JOBS`: 系統預設之 7 項護持工作清單
*   **Firestore 集合**：
    *   `member` (全體名單)
    *   `info/recruitment_jobs` (客製化工作招募項目)
    *   外部 API: `https://firestore.googleapis.com/.../ganttcraft_projects/shumei`

---

## 3. 青年名冊與身份認領 (Youth List & Member CRM)
*   **功能描述**：青年部成員名單卡片/表格瀏覽、姓名與組別搜尋、電話直撥、地址導航、入信日期比對、幹部密碼解鎖完整編輯權限、信徒身份認領綁定。
*   **搜尋關鍵字**：`青年名冊`, `青年名單`, `身份認領`, `認領身份`, `通話導航`, `直接登入`, `入信日期`, `btnClaimIdentity`, `submitClaimIdentity`, `able()`
*   **前端 HTML**：`public/youth/list.html`
*   **前端 JS**：`public/js/list.js`
*   **核心函式 / 符號**：
    *   `initData()`: 載入成員資料，自動識別 `SHUMEI_LEADER_AUTH` 免密碼彈窗
    *   `able()`: 解鎖名冊完整唯讀限制與編輯入口
    *   `submitClaimIdentity()`: 核對信徒入信日期（自動相容 Document ID 去除英文後綴）並綁定 `allowed_users`
    *   `getDate(group)`: 依照分組渲染卡片清單
*   **Firestore 集合**：
    *   `member` (文件 ID 為入信日，例如 `2022-08-07` 或 `2022-08-07A`)
    *   `allowed_users` (文件 ID 為使用者 Email，儲存 `linkedMemberId`, `allowDirectLogin`)

---

## 4. 名冊後台管理與維護 (Admin Portal)
*   **功能描述**：幹部管理介面，新增成員、編輯姓名/電話/地址/幹部備註/世話人/組別/入信日、刪除成員、密碼保護與手機優化 Modal。
*   **搜尋關鍵字**：`後台管理`, `新增名單`, `編輯成員`, `刪除成員`, `adminBody`, `editModal`, `saveMember`, `submitEdit`
*   **前端 HTML**：`public/youth/admin.html`
*   **前端 JS**：`public/js/admin.js`
*   **核心函式 / 符號**：
    *   `initData()`: 驗證管理員權限並載入完整名冊
    *   `openEditModal(id)`: 填入成員資料並開啟編輯對話框
    *   `saveMember()`: 寫入/更新 Firestore `member` 文件
    *   `deleteMember(id)`: 刪除成員文件
*   **Firestore 集合**：
    *   `member`, `info/admins`, `info/set`

---

## 5. 青年分組與活動意願指派 (Group & Activity Assignment)
*   **功能描述**：青年部各小組名單分類、小組長指派、每月大型活動/奉事指派、中文可讀活動名稱映射、動態活動清單設定。
*   **搜尋關鍵字**：`青年分組`, `組長指派`, `小組名單`, `活動意願`, `中文活動名`, `activity_items`, `groupSelect`
*   **前端 HTML**：`public/youth/group.html`
*   **前端 JS**：`public/js/group.js`
*   **核心函式 / 符號**：
    *   `initData()`: 載入成員組別與活動設定
    *   `updateGroup(memberId, newGroup)`: 變更成員隸屬組別
    *   `loadActivityItems()`: 自 `info/activity_items` 讀取動態設定
*   **Firestore 集合**：
    *   `member`, `info/activity_items`

---

## 6. 座談會記錄與自訂出席 (Seminar & Attendance)
*   **功能描述**：家庭座談會與青年座談會出席記錄、兩階段選單（先選組別再選成員）、支援非名單內「自訂姓名」直接出席簽到、歷史座談會次數統計。
*   **搜尋關鍵字**：`座談會`, `出席記錄`, `兩階段選擇`, `自訂姓名`, `輸入名字`, `sem_leader`, `sem_member`, `addCustomAttendee`
*   **前端 HTML**：`public/youth/seminar.html`
*   **前端 JS**：`public/js/seminar.js`
*   **核心函式 / 符號**：
    *   `loadMembers()`: 載入成員並填入兩段式下拉選單
    *   `loadSeminars()`: 載入歷史座談會紀錄
    *   `saveSeminarRecord()`: 儲存出席與心得分享
    *   `addCustomAttendee()`: 處理未登錄新朋友姓名填寫
*   **Firestore 集合**：
    *   `seminar` (儲存日期、出席人員陣列 `attendees`、心得)
    *   `member`

---

## 7. 世代表與靈統關聯 (Lineage Tree)
*   **功能描述**：秀明信仰靈統傳承視覺化系譜樹、以世話人（Sewajin）與導引人為節點串聯多世代傳承關係圖。
*   **搜尋關鍵字**：`世代表`, `系譜`, `靈統`, `世話人`, `導引人`, `lineageTree`, `renderTree`, `buildLineageTree`
*   **前端 HTML**：`public/youth/lineage.html`
*   **前端 JS**：`public/js/lineage.js`
*   **核心函式 / 符號**：
    *   `buildLineageTree()`: 依據成員 `sewajin` 與 `guide` 構建階層樹狀結構
    *   `renderTree()`: 繪製視覺化系譜圖
*   **Firestore 集合**：
    *   `member` (欄位: `name`, `sewajin`, `leader`, `guide`)

---

## 8. 一般信徒專區 (Member Portal)
*   **功能描述**：一般信徒/青年個人首頁、查看每月活動行程、勾選工作意願標籤、報名自然農法水花園市集與光之餐桌、個人淨靈打卡快捷入口。
*   **搜尋關鍵字**：`一般信徒`, `個人專區`, `工作意願`, `個人排程`, `招募報名`, `member-jobs-container`
*   **前端 HTML**：`public/member/index.html`
*   **前端 JS**：`public/js/member.js`
*   **核心函式 / 符號**：
    *   `loadRecruitmentJobs()`: 動態讀取最新發布之 7 項護持工作並渲染選擇開關
    *   `saveMemberWillingness()`: 儲存個人工作意願至資料庫
*   **Firestore 集合**：
    *   `member`, `info/recruitment_jobs`, `events`

---

## 9. 淨靈打卡與施光紀錄 (Jyorei Tracking)
*   **功能描述**：施光與受光即時打卡登記、道場與戶外淨靈紀錄、歷史淨靈累積次數與時數統計儀表。
*   **搜尋關鍵字**：`淨靈打卡`, `施光`, `受光`, `淨靈回數`, `jyorei-card`, `submitJyorei`
*   **前端 HTML**：`public/activities/jyorei.html`
*   **前端 JS**：`public/js/jyorei.js`
*   **核心函式 / 符號**：
    *   `submitJyoreiRecord()`: 記錄施光者、受光者、地點與時長
    *   `loadJyoreiStats()`: 聚合個人與全體淨靈總次數
*   **Firestore 集合**：
    *   `jyorei` (欄位: `giver`, `receiver`, `location`, `timestamp`, `duration`)

---

## 10. 活動報名與青年研修 (Events & Training)
*   **功能描述**：大型活動清單、青年幹部研修、參拜日前置護持、完全動態化的 Firestore 資料庫驅動活動（支援隨時增修刪改）。
*   **搜尋關鍵字**：`活動報名`, `青年研修`, `參拜護持`, `光之餐桌`, `水花園市集`, `dynamicEvents`, `events-container`
*   **前端 HTML**：
    *   `public/activities/events.html`
    *   `public/activities/training.html`
*   **前端 JS**：
    *   `public/js/events.js`
    *   `public/js/training.js`
*   **核心函式 / 符號**：
    *   `loadEvents()`: 從 `events` 集合載入活動，杜絕靜態死資料
    *   `registerEvent()`: 執行線上報名並寫入名冊
*   **Firestore 集合**：
    *   `events`, `training`

---

## 11. 秀明自然農法與綠色市集 (Natural Farm & Market)
*   **功能描述**：自然農法理念推廣、田間農事奉事、水花園市集活動、光之餐桌、作物粒籽記憶庫、土壤履歷與農友日誌、市集動態管理後台。
*   **搜尋關鍵字**：`自然農法`, `水花園市集`, `光之餐桌`, `粒籽記憶庫`, `農事奉事`, `natural-farm`, `grain-memory`
*   **前端 HTML**：
    *   `public/farm/natural-farm.html`
    *   `public/farm/natural-farm-admin.html`
*   **專屬樣式**：`public/css/natural-farm.css`
*   **前端 JS**：
    *   `public/js/natural-farm.js`
    *   `public/js/natural-farm-admin.js`
*   **核心函式 / 符號**：
    *   `loadFarmEvents()`: 載入水花園市集與農法體驗
    *   `loadGrainMemory()`: 讀取品種採種履歷
*   **Firestore 集合**：
    *   `farm_events`, `grain_dna`

---

## 12. 現場排程與櫃檯接待 (Scheduling & Front Kiosk)
*   **功能描述**：週末輪值青年現場櫃檯 Kiosk、簽到引導、大螢幕值班狀態即時看板、茶水與導覽接待。
*   **搜尋關鍵字**：`現場櫃檯`, `青年櫃檯`, `輪值排班`, `現場簽到`, `front.html`, `kiosk`
*   **前端 HTML**：
    *   `public/scheduling/front.html`
    *   `public/scheduling/index.html`
*   **前端 JS**：
    *   `public/js/front.js`
    *   `public/js/scheduling.js`
*   **Firestore 集合**：
    *   `counter_shifts`, `kiosk_records`

---

## 13. 自家採種與種子兌換 (Seed Bank & Karma Exchange)
*   **功能描述**：Shumei 綠色積分（Karma）兌換自家採種種子包、對接 Seed-Bank 種源庫位出庫扣減與熱感標籤產生。
*   **搜尋關鍵字**：`種子兌換`, `Karma`, `採種`, `Seed-Bank`, `change.html`, `claimSeed`
*   **前端 HTML**：`public/seed/change.html`
*   **前端 JS**：`public/js/change.js`
*   **核心函式 / 符號**：
    *   `loadSeedInventory()`: 載入種子可領取庫存
    *   `claimSeed()`: 發起 Karma 兌換種子請求
*   **Firestore 集合**：
    *   `seeds`, `karma_ledger`

---

## 14. LINE Bot 與 Gemini OCR 後端 (Cloud Functions & AI)
*   **功能描述**：LINE 官方帳號 Webhook、入信願書紙本拍照 OCR 自動轉文字、Gemini 視覺模型辨識、自動建檔匯入、LINE 幹部身份綁定與系譜查詢。
*   **搜尋關鍵字**：`LINE Bot`, `lineWebhook`, `processLineEvent`, `入信願書`, `OCR`, `Gemini`, `processImageOcr`
*   **後端入口**：`functions/index.js`
*   **核心函式 / 符號**：
    *   `exports.lineWebhook`: HTTP 觸發點，接收 LINE Webhook 並快速發布 Pub/Sub
    *   `exports.processLineEvent`: Pub/Sub 非同步處理函式，調用 Gemini API 處理文字問答與圖片 OCR
    *   `processImageOcr()`: 入信願書紙本圖片解析提取姓名、入信日、世話人與地址
*   **環境變數與密鑰**：
    *   `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `GEMINI_API_KEY`

---

## 15. URL 重定向與 PWA 設定 (Routing & Service Worker)
*   **功能描述**：Firebase Hosting 靜態轉址（相容舊網址如 `/list.html` 轉至 `/youth/list.html`）、PWA 清單、離線快取 Service Worker。
*   **搜尋關鍵字**：`firebase.json`, `manifest.json`, `sw.js`, `pwa.js`, `redirects`
*   **設定檔路徑**：
    *   `firebase.json`: 定義 301/302 Redirect 規則
    *   `public/manifest.json`: PWA 主題色與圖示
    *   `public/sw.js`: Service Worker 快取策略
    *   `public/js/pwa.js`: 註冊 Service Worker 與安裝提示
