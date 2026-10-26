const { onRequest } = require("firebase-functions/v2/https");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { messagingApi } = require("@line/bot-sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PubSub } = require("@google-cloud/pubsub");
const {
  getTaipeiDate,
  getNextMonthInfo,
  sendMonthlyPlanningReminder,
  sendUpcomingActivityReminders,
  getAllEventsFromDatabase,
  parseEventDateTime,
  extractResponsiblePersons,
  matchEditorLineUser,
  getDaysUntilEvent
} = require("./activityReminders");

admin.initializeApp();
const db = admin.firestore();
const pubsub = new PubSub();

// Define secrets that will need to be configured in Firebase Secret Manager
const lineChannelSecret = defineSecret("LINE_CHANNEL_SECRET");
const lineChannelAccessToken = defineSecret("LINE_CHANNEL_ACCESS_TOKEN");
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// 1. Function to handle LINE Webhook (Fast Response)
exports.lineWebhook = onRequest(
  { secrets: [lineChannelSecret, lineChannelAccessToken, geminiApiKey], region: "asia-east1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    try {
      const events = req.body.events;
      if (!events || events.length === 0) {
        res.status(200).send("OK");
        return;
      }

      // Publish each event to Pub/Sub for background processing
      await Promise.all(
        events.map(async (event) => {
          // 支援文字訊息與圖片訊息 (圖片用於入信願書 OCR)
          if (event.type !== "message" || (event.message.type !== "text" && event.message.type !== "image")) {
            return Promise.resolve(null);
          }
          
          const topic = pubsub.topic("process-line-event");
          return topic.publishMessage({
            json: { event }
          });
        })
      );

      // Return 200 OK immediately so LINE doesn't timeout
      res.status(200).send("OK");
    } catch (error) {
      logger.error("Error handling webhook", error);
      res.status(500).end();
    }
  }
);

// Helper: 智慧 Gemini 呼叫器 (含多模型自動備援 Fallback 與重試)
async function callGeminiSafe(genAI, promptOrParts, logger) {
  const modelsToTry = [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-2.5-flash"
  ];
  let lastError = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const modelName = modelsToTry[i];
    try {
      logger.info(`[Gemini] Attempting call with model: ${modelName}`);
      const m = genAI.getGenerativeModel({ model: modelName });
      const startTime = Date.now();
      const res = await m.generateContent(promptOrParts);
      logger.info(`[Gemini] Model ${modelName} succeeded in ${Date.now() - startTime}ms`);
      return res;
    } catch (err) {
      lastError = err;
      const status = err.status || (err.message && err.message.match(/\[(\d{3})\]/)?.[1]);
      logger.warn(`[Gemini] Model ${modelName} failed (status: ${status || 'unknown'}): ${err.message}`);
      if (i < modelsToTry.length - 1) {
        await new Promise(r => setTimeout(r, 800));
      }
    }
  }
  throw lastError;
}

// Helper: 依據錯誤原因產生差異化、人性化的回覆說明
function getFriendlyErrorMessage(err, context = "general") {
  const errMsg = (err && err.message) ? err.message : String(err);
  const status = err.status || (errMsg.match(/\[(\d{3})\]/)?.[1]);

  if (status == 503 || errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("Service Unavailable")) {
    return "🤖 AI 雲端模型目前瞬間用量較大（503 暫時忙碌），小助理已自動排隊但暫時逾時，請稍候 5 ~ 10 秒後再傳送一次喔！";
  }
  if (status == 429 || errMsg.includes("429") || errMsg.includes("Quota") || errMsg.includes("ResourceExhausted")) {
    return "⏳ AI 呼叫頻率已達雲端上限（429 流量管制），請稍等約 10 秒後再試～";
  }
  if (errMsg.includes("timeout") || errMsg.includes("ETIMEDOUT") || errMsg.includes("DEADLINE_EXCEEDED")) {
    return "⏱️ 伺服器處理連線逾時（可能因網路延遲或傳送內容較大），請確認網路連線後再試一次！";
  }
  if (errMsg.includes("JSON") || errMsg.includes("AI 解析失敗")) {
    if (context === "jyorei") {
      return "🙏 淨靈打卡格式未能完全辨識～\n💡 建議直接輸入例如：「今天施光2次信徒」或「今天跟小明淨靈3次」。";
    }
    if (context === "ocr") {
      return "📷 願書辨識未完全成功，照片可能反光或傾斜，請盡量由上往下平拍再傳送一次！";
    }
    if (context === "lineage") {
      return "🌿 靈線查詢未能辨識出人名～\n💡 建議輸入：「王小明的介紹人是誰？」或「誰是陳小華的世話人？」。";
    }
    if (context === "seminar") {
      return "🍑 座談會登記提醒：請提供會談對象的姓名與日期（例如：「今天與王小明座談...」）。";
    }
    return "🤔 小助理未能完全辨識這段文字的意思，請換個更簡潔直白的描述再試一次！";
  }
  return `抱歉，系統處理時發生異常（${errMsg.slice(0, 35)}...），請稍後再試一次。`;
}

// 2. Background Function to process the event using Gemini API
exports.processLineEvent = onMessagePublished(
  {
    topic: "process-line-event",
    secrets: [lineChannelSecret, lineChannelAccessToken, geminiApiKey],
    region: "asia-east1"
  },
  async (pubsubEvent) => {
    const event = pubsubEvent.data.message.json.event;
    if (!event) return;
    
    const isImage = event.message.type === "image";
    const userMessage = event.message.text || "";
    const replyToken = event.replyToken;
    const userId = event.source ? event.source.userId : null;
    const sourceType = event.source ? event.source.type : "user";
    const isPrivateChat = sourceType === "user";

    const client = new messagingApi.MessagingApiClient({
      channelAccessToken: lineChannelAccessToken.value()
    });

    // 判斷是否需要處理
    const isStats = userMessage.includes("統計");
    const lowerMessage = userMessage.toLowerCase();
    const isTagged = lowerMessage.includes("@shumei helper");

    // 關鍵字判斷
    const isEditorAuthCmd = /^(?:幹部認證|綁定幹部|編輯認證)\s+(\S+)\s+(.+)$/.test(userMessage.trim());
    const isEditorListCmd = /^(?:編輯人員名單|幹部名單|查看編輯人員)$/.test(userMessage.trim());
    const isJyoreiKeyword = /淨靈|施光|御光|jyorei/i.test(userMessage);
    const isLineageKeyword = /介紹人|世話人|組長|下線|靈線|電話|住址|地址/.test(userMessage);
    const isSeminarKeyword = /登記|紀錄|座談|回報/.test(userMessage);
    const isActivityCmd = /^(?:活動|活動查詢|查詢活動|近期活動|活動日程|本月活動|下月活動|活動清單|活動負責人)$/.test(userMessage.trim()) || userMessage.includes("近期活動") || userMessage.includes("活動日程") || userMessage.includes("活動負責人") || (isPrivateChat && userMessage.trim() === "活動");

    // 個人對話 (1對1) 或圖片一律處理；群組或聊天室則需標記機器人或命中關鍵字
    const isForBot = isPrivateChat || isTagged || isStats || isEditorAuthCmd || isEditorListCmd || isJyoreiKeyword || isLineageKeyword || isSeminarKeyword || isActivityCmd || isImage;

    if (!isForBot) {
      return; // 忽略群組中的一般閒聊，不回覆且不呼叫 AI
    }

    // 取得發話者在 LINE 的顯示名稱
    let userName = "發言者";
    try {
      if (userId) {
        const profile = await client.getProfile(userId);
        userName = profile.displayName || "發言者";
      }
    } catch (e) {
      logger.error("Failed to get user profile", e);
    }

    logger.info(`[LineEvent] From ${userName} (${userId || "unknown"}), type=${sourceType}, isImage=${isImage}, text="${userMessage.slice(0, 80)}"`);

    const genAI = new GoogleGenerativeAI(geminiApiKey.value());
    const nowStr = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });

    // 輔助函式：檢查發話者是否為已認證的幹部/編輯人員 (對應 Firestore info/editors)
    async function checkEditorPermission(lineUid) {
      if (!lineUid) return { isEditor: false, editorName: null };
      try {
        const editorsDoc = await db.collection("info").doc("editors").get();
        if (!editorsDoc.exists) return { isEditor: false, editorName: null };
        const data = editorsDoc.data() || {};
        const lineMap = data.lineUserIdToName || {};
        const matchedName = lineMap[lineUid];
        if (matchedName) {
          const editorDetail = (data.editors && data.editors[matchedName]) || {};
          if (editorDetail.active !== false) {
            return { isEditor: true, editorName: matchedName };
          }
        }
        return { isEditor: false, editorName: null };
      } catch (e) {
        logger.error("Error checking editor permission", e);
        return { isEditor: false, editorName: null };
      }
    }

    // ==========================================
    // 功能零：LINE 幹部認證與編輯人員名單管理 (對應 info/editors)
    // ==========================================
    if (isEditorAuthCmd) {
      if (!isPrivateChat) {
        await client.replyMessage({
          replyToken,
          messages: [{ type: "text", text: "🔒 為避免密碼外洩，請在與我的「1 對 1 私聊」中輸入幹部認證指令喔！" }]
        });
        return;
      }

      try {
        const match = userMessage.trim().match(/^(?:幹部認證|綁定幹部|編輯認證)\s+(\S+)\s+(.+)$/);
        const inputPass = match[1].trim();
        const inputName = match[2].trim();

        const [setDoc, youthDoc, editorsDoc] = await Promise.all([
          db.collection("info").doc("set").get(),
          db.collection("info").doc("youth").get(),
          db.collection("info").doc("editors").get()
        ]);

        const validPass = (setDoc.exists && setDoc.data().pass) ? String(setDoc.data().pass) : "shumei567sty";
        if (inputPass !== validPass) {
          await client.replyMessage({
            replyToken,
            messages: [{ type: "text", text: "❌ 認證密碼錯誤，請確認幹部查詢密碼後重試。" }]
          });
          return;
        }

        const youthLeaders = (youthDoc.exists && Array.isArray(youthDoc.data().leader)) ? youthDoc.data().leader : [];
        const existingEditorsData = editorsDoc.exists ? editorsDoc.data() : {};
        let currentEditorList = Array.isArray(existingEditorsData.editorList)
          ? [...existingEditorsData.editorList]
          : [...youthLeaders];
        const updatedEditorsMap = existingEditorsData.editors || {};
        const updatedLineMap = existingEditorsData.lineUserIdToName || {};

        // 智慧比對既有幹部 (支援全名與簡稱/別名雙向匹配，例如「蔡松恩」vs「松恩」、「官泰佑」vs「泰佑」)
        let matchedTargetKey = null;
        for (const key of Object.keys(updatedEditorsMap)) {
          const item = updatedEditorsMap[key] || {};
          const alias = (item.alias || '').trim();
          const itemName = (item.name || key).trim();

          if (key === inputName || itemName === inputName || (alias && alias === inputName)) {
            matchedTargetKey = key;
            break;
          }
          if (inputName.length >= 2 && (key.includes(inputName) || inputName.includes(key))) {
            matchedTargetKey = key;
            break;
          }
        }

        if (!matchedTargetKey) {
          for (const item of currentEditorList) {
            if (item === inputName || (inputName.length >= 2 && (item.includes(inputName) || inputName.includes(item)))) {
              matchedTargetKey = item;
              break;
            }
          }
        }

        let finalNameKey = inputName;
        let inheritedData = {};

        if (matchedTargetKey) {
          inheritedData = updatedEditorsMap[matchedTargetKey] || {};
          // 若原先為短簡稱 (如「松恩」) 而輸入為長全名 (如「蔡松恩」)，升級為全名並記錄簡稱別名
          if (inputName.length > matchedTargetKey.length) {
            finalNameKey = inputName;
            inheritedData.alias = matchedTargetKey;
            delete updatedEditorsMap[matchedTargetKey];
            currentEditorList = currentEditorList.map(n => n === matchedTargetKey ? finalNameKey : n);
          } else {
            finalNameKey = matchedTargetKey;
            if (inputName !== finalNameKey && !inheritedData.alias) {
              inheritedData.alias = inputName;
            }
          }
        } else {
          currentEditorList.push(finalNameKey);
        }

        currentEditorList = Array.from(new Set(currentEditorList));

        // 整合職稱與組別資訊
        const roleTitle = inheritedData.roleTitle || "小組長";
        const group = inheritedData.group || (finalNameKey.includes("組") ? finalNameKey : `${inheritedData.alias || finalNameKey}組`);
        const compositeRole = inheritedData.role || `${roleTitle} • ${group}`;

        updatedEditorsMap[finalNameKey] = {
          ...inheritedData,
          name: finalNameKey,
          lineDisplayName: userName,
          lineUserId: userId,
          role: compositeRole,
          roleTitle: roleTitle,
          group: group,
          active: true,
          verifiedAt: nowStr,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        updatedLineMap[userId] = finalNameKey;

        await db.collection("info").doc("editors").set({
          editorList: currentEditorList,
          editors: updatedEditorsMap,
          lineUserIdToName: updatedLineMap,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        const aliasHint = inheritedData.alias ? ` (簡稱/別名：${inheritedData.alias})` : "";
        await client.replyMessage({
          replyToken,
          messages: [{
            type: "text",
            text: `🎉 幹部身分認證成功！\n\n👤 編輯人員姓名：${finalNameKey}${aliasHint}\n📱 LINE 暱稱：${userName}\n🏢 所屬組別：${group}\n🔑 權限狀態：已啟用\n\n您已正式登錄至資料庫 [info/editors] 幹部名冊中，現在可以直接拍照上傳入信願書或私聊查詢成員聯絡資訊！`
          }]
        });
        return;
      } catch (err) {
        logger.error("Error in editor authentication", err);
        await client.replyMessage({
          replyToken,
          messages: [{ type: "text", text: "認證過程發生錯誤，請稍後再試。" }]
        });
        return;
      }
    }

    if (isEditorListCmd && isPrivateChat) {
      const authStatus = await checkEditorPermission(userId);
      if (!authStatus.isEditor) {
        await client.replyMessage({
          replyToken,
          messages: [{ type: "text", text: "🔒 您尚未綁定幹部身分。\n請輸入：「幹部認證 [密碼] [您的姓名]」完成認證。" }]
        });
        return;
      }
      const editorsDoc = await db.collection("info").doc("editors").get();
      const data = editorsDoc.exists ? editorsDoc.data() : {};
      const list = data.editorList || [];
      const editorsMap = data.editors || {};
      const lines = list.map((name, idx) => {
        const info = editorsMap[name];
        const status = (info && info.lineUserId && info.active !== false) ? `✅ 已綁定 LINE (${info.lineDisplayName})` : "⏳ 尚未綁定 LINE";
        return `${idx + 1}. ${name} — ${status}`;
      });
      await client.replyMessage({
        replyToken,
        messages: [{
          type: "text",
          text: `📋【資料庫授權編輯人員名單】\n(對應位置：info/editors)\n\n${lines.join("\n") || "尚無名單"}`
        }]
      });
      return;
    }

    // ==========================================
    // 功能一：紙本「入信願書」拍照 OCR 自動建檔
    // ==========================================
    if (isImage) {
      try {
        const authStatus = await checkEditorPermission(userId);
        // 若在 1 對 1 私聊傳圖片，驗證是否為已認證編輯人員
        if (isPrivateChat && !authStatus.isEditor) {
          await client.replyMessage({
            replyToken,
            messages: [{
              type: "text",
              text: "🔒 權限不足：拍照上傳「入信願書」新增成員僅限授權編輯人員操作。\n\n若您是幹部，請先輸入指令完成認證：\n幹部認證 [密碼] [您的姓名]\n（例如：幹部認證 shumei567sty 松恩）"
            }]
          });
          return;
        }
        const editorLabel = authStatus.editorName ? `${authStatus.editorName} (LINE)` : `${userName} (LINE)`;
        const blobClient = new messagingApi.MessagingApiBlobClient({ channelAccessToken: lineChannelAccessToken.value() });
        const stream = await blobClient.getMessageContent(event.message.id);
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const imageBase64 = Buffer.concat(chunks).toString("base64");

        const ocrPrompt = `
這是一張「入信願書」（Admission Form）的照片。請將照片中的文字進行 OCR 辨識，並擷取以下資訊，最後以 JSON 格式回傳。
請務必將民國年份 (例如：民國 112 年 或 85年) 自動轉換為西元年份 (例如：2023 或 1996)，格式必須為 YYYY-MM-DD。
如果未提供某個欄位，請回傳 null 或空字串。

請以 JSON 格式回傳，必須包含以下欄位：
- isAdmissionForm (布林值：照片內容是否為入信願書，若否則設為 false)
- name (字串：入信者姓名)
- joinDate (字串：入信日期，格式為 YYYY-MM-DD，請自動將民國轉為西元)
- born (字串：出生年月日，格式為 YYYY-MM-DD，請自動將民國轉為西元)
- guide (陣列：介紹人姓名字串陣列，通常有1~2位)
- sewajin (字串：世話人)
- adress (字串：通訊地址)
- phone (字串：行動電話)
- tel (字串：市話/家用電話)
- note (字串：備註或其他文字，如助教師)
- reply (字串：若非入信願書，請簡短友善告知)

請直接回傳純 JSON 字串，不要包含任何 Markdown 標記（例如 \`\`\`json 等）。
`;
        const aiResponse = await callGeminiSafe(genAI, [
          ocrPrompt,
          {
            inlineData: {
              data: imageBase64,
              mimeType: "image/jpeg"
            }
          }
        ], logger);

        let parsedData;
        try {
          const rawText = aiResponse.response.text();
          const cleanText = rawText.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();
          parsedData = JSON.parse(cleanText);
        } catch (e) {
          logger.error("Failed to parse admission OCR JSON", e);
          if (isPrivateChat || isTagged) {
            await client.replyMessage({
              replyToken,
              messages: [{ type: "text", text: "📷 願書文字辨識解析異常，可能照片稍有晃動或反光，請嘗試由上往下平拍再傳送一次。" }]
            });
          }
          return;
        }

        if (parsedData.isAdmissionForm && parsedData.name && parsedData.joinDate) {
          // 檢查 ID 碰撞並遞增補綴 'A'
          let joinDateId = parsedData.joinDate;
          let exists = true;
          while (exists) {
            const docSnap = await db.collection("member").doc(joinDateId).get();
            if (docSnap.exists) {
              joinDateId += "A";
            } else {
              exists = false;
            }
          }

          const guideList = Array.isArray(parsedData.guide) ? parsedData.guide.filter(Boolean) : (parsedData.guide ? [parsedData.guide] : []);

          await db.collection("member").doc(joinDateId).set({
            name: parsedData.name.trim(),
            guide: guideList,
            sewajin: parsedData.sewajin || "",
            adress: parsedData.adress || "",
            tel: parsedData.tel || "",
            phone: parsedData.phone || "",
            born: parsedData.born || "",
            leader: "",
            note: parsedData.note || "",
            post: (parsedData.note && parsedData.note.includes("助教師")) ? "助教師" : ((parsedData.note && parsedData.note.includes("世話人")) ? "世話人" : ""),
            connect: true,
            part: "青年部",
            source: "line_ocr",
            createdBy: editorLabel,
            lastEditor: editorLabel,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          const webUrl = "https://shumei-2025.web.app/youth/list.html?q=" + encodeURIComponent(parsedData.name);
          const replyText = `🎉 收到入信願書！已成功為「${parsedData.name}」建立成員資料。\n\n📅 入信日期：${parsedData.joinDate} (編號: ${joinDateId})\n🎂 出生日期：${parsedData.born || "未註明"}\n🤝 介紹人：${guideList.join("、") || "無"}\n🌾 世話人：${parsedData.sewajin || "無"}\n📞 電話：${parsedData.phone || parsedData.tel || "未註明"}\n🏠 地址：${parsedData.adress || "未註明"}\n✍️ 建檔人員：${editorLabel}\n\n🔗 點此查看青年部名冊：\n${webUrl}`;

          await client.replyMessage({
            replyToken,
            messages: [{ type: "text", text: replyText }]
          });
          return;
        } else {
          // 非願書照片
          if (isPrivateChat || isTagged) {
            const replyMsg = parsedData.reply || "這張照片看起來不是「入信願書」喔！請傳送平整清晰的紙本願書照片。";
            await client.replyMessage({
              replyToken,
              messages: [{ type: "text", text: replyMsg }]
            });
          }
          return;
        }
      } catch (err) {
        logger.error("Error processing admission image OCR", err);
        if (isPrivateChat || isTagged) {
          await client.replyMessage({
            replyToken,
            messages: [{ type: "text", text: getFriendlyErrorMessage(err, "ocr") }]
          }).catch(e => logger.error("Error sending error reply", e));
        }
        return;
      }
    }

    // ==========================================
    // 功能二：淨靈 / 施光 口語打卡與統計查詢 (不記錄施光時間)
    // ==========================================
    if (isJyoreiKeyword) {
      const isJyoreiStats = isStats || /幾次|總計|累積/.test(userMessage);

      // 2A. 查詢淨靈統計
      if (isJyoreiStats) {
        try {
          const snapshot = await db.collection("jyorei_logs").get();
          let grandTotal = 0;
          let totalBelievers = 0;
          let totalNonBelievers = 0;
          let myGrandTotal = 0;
          let myBelievers = 0;
          let myNonBelievers = 0;

          snapshot.forEach(doc => {
            const d = doc.data();
            const b = parseInt(d.totalBeliever ?? d.selfBeliever ?? 0) || 0;
            const nb = parseInt(d.totalNonBeliever ?? d.selfNonBeliever ?? 0) || 0;
            const g = parseInt(d.grandTotal ?? (b + nb)) || (b + nb);

            grandTotal += g;
            totalBelievers += b;
            totalNonBelievers += nb;

            if (d.reporter === userName || d.lineUserId === userId) {
              myGrandTotal += g;
              myBelievers += b;
              myNonBelievers += nb;
            }
          });

          let replyText = `✨【秀明淨靈實踐統計】✨\n\n`;
          replyText += `🌍 全會累積打卡：${snapshot.size} 筆\n`;
          replyText += `🙏 全會總人次：${grandTotal.toLocaleString()} 人次\n`;
          replyText += `   • 信徒：${totalBelievers.toLocaleString()} 人次\n`;
          replyText += `   • 未信徒：${totalNonBelievers.toLocaleString()} 人次\n\n`;
          replyText += `👤 您 (${userName}) 的實踐累積：\n`;
          replyText += `   • 總人次：${myGrandTotal.toLocaleString()} 人次\n`;
          replyText += `   • 信徒：${myBelievers.toLocaleString()} 人次\n`;
          replyText += `   • 未信徒：${myNonBelievers.toLocaleString()} 人次\n\n`;
          replyText += `🔗 查看全會即時打卡動態：\nhttps://shumei-2025.web.app/activities/jyorei.html`;

          await client.replyMessage({
            replyToken,
            messages: [{ type: "text", text: replyText }]
          });
          return;
        } catch (err) {
          logger.error("Error fetching jyorei stats", err);
        }
      }

      // 2B. 自然語言登記淨靈打卡
      try {
        const jyoreiPrompt = `
現在的台北時間是：${nowStr}
目前發話者的名稱是：「${userName}」

請分析使用者的訊息，判斷是否為「淨靈/施光打卡紀錄」。
注意：本系統「不需要」且「不記錄」施光時間/分鐘數，只記錄人數與次數（人次）。
使用者可能說：「今天施光2次信徒、1次未信徒」、「給小明淨靈」、「今天在家淨靈2次」。
如果使用者未特別指明信徒或未信徒，預設全數計為信徒人次 (believerCount)。

請以 JSON 格式回傳：
- isJyoreiLog (布林值：是否為淨靈/施光打卡紀錄，若否則設為 false)
- believerCount (整數：信徒人次，預設0)
- nonBelieverCount (整數：未信徒人次，預設0)
- totalCount (整數：總人次，必須大於0)
- targetNames (字串陣列：施光對象名字，若無則為空陣列)
- date (字串：日期 YYYY-MM-DD，若有相對時間如今天/昨天請推算)
- reply (字串：若非打卡時的親切回應，否則 null)

使用者訊息：
"${userMessage}"
`;
        const aiResponse = await callGeminiSafe(genAI, jyoreiPrompt, logger);
        const rawText = aiResponse.response.text();
        const cleanText = rawText.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();
        const parsedData = JSON.parse(cleanText);

        if (parsedData.isJyoreiLog && parsedData.totalCount > 0) {
          const logDate = parsedData.date || new Date().toISOString().split("T")[0];
          const bCount = parsedData.believerCount || 0;
          const nbCount = parsedData.nonBelieverCount || 0;
          const tCount = parsedData.totalCount || (bCount + nbCount);

          await db.collection("jyorei_logs").add({
            date: logDate,
            reporter: userName,
            lineUserId: userId,
            selfBeliever: bCount,
            selfNonBeliever: nbCount,
            selfTotal: tCount,
            totalBeliever: bCount,
            totalNonBeliever: nbCount,
            grandTotal: tCount,
            targetNames: parsedData.targetNames || [],
            source: "line",
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });

          const targetsStr = (parsedData.targetNames && parsedData.targetNames.length > 0) ? parsedData.targetNames.join("、") : "未特別註明";
          const replyText = `🙏 感謝您的誠心實踐！已成功記錄淨靈打卡！\n\n👤 實踐者：${userName}\n📅 日期：${logDate}\n✨ 本次施光：共 ${tCount} 人次\n   • 信徒：${bCount} 人次\n   • 未信徒：${nbCount} 人次\n🎯 施光對象：${targetsStr}\n\n🔗 查看全會即時打卡動態：\nhttps://shumei-2025.web.app/activities/jyorei.html`;

          await client.replyMessage({
            replyToken,
            messages: [{ type: "text", text: replyText }]
          });
          return;
        } else if (parsedData.reply && (isPrivateChat || isTagged)) {
          await client.replyMessage({
            replyToken,
            messages: [{ type: "text", text: parsedData.reply }]
          });
          return;
        }
      } catch (err) {
        logger.error("Error processing jyorei log", err);
        if (replyToken && (isPrivateChat || isTagged)) {
          await client.replyMessage({
            replyToken,
            messages: [{ type: "text", text: getFriendlyErrorMessage(err, "jyorei") }]
          }).catch(e => logger.error("Error sending error reply", e));
        }
        return;
      }
    }

    // ==========================================
    // 功能三：幹部專屬成員與靈線快查助理
    // ==========================================
    if (isLineageKeyword) {
      try {
        const queryPrompt = `
請分析以下使用者的詢問，判斷意圖為以下哪一種：
1. "contact_query": 詢問成員的電話、市話、手機或通訊地址 (例如："查 官泰佑 電話"、"查 豔良 住址"、"小明電話")
2. "downline_query": 詢問某成員的下線、他介紹了誰入信 (例如："小明的下線有誰"、"美美介紹了誰"、"誰是泰佑介紹的")
3. "lineage_query": 詢問成員的介紹人、世話人、組長、組別或基本靈線脈絡 (例如："小明的介紹人是誰"、"誰是陳小華的世話人"、"美美所屬組別")
4. "other": 非以上查詢

請以 JSON 格式回傳：
- intent (字串："contact_query" | "downline_query" | "lineage_query" | "other")
- targetMemberName (字串：欲查詢的成員姓名，若未提及則為 null)

使用者訊息：
"${userMessage}"
`;
        const aiResponse = await callGeminiSafe(genAI, queryPrompt, logger);
        const rawText = aiResponse.response.text();
        const cleanText = rawText.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();
        const parsedQuery = JSON.parse(cleanText);

        if (parsedQuery.intent !== "other" && parsedQuery.targetMemberName) {
          const targetName = parsedQuery.targetMemberName.trim();

          // 隱私與幹部權限防護規則：
          // 1. 群組中禁止公開回覆電話與地址
          // 2. 1對1私聊必須通過「幹部認證」在 [info/editors] 名單內才可查詢
          if (parsedQuery.intent === "contact_query") {
            if (!isPrivateChat) {
              await client.replyMessage({
                replyToken,
                messages: [{ type: "text", text: `🔒 為保護個人隱私，查詢「${targetName}」的電話與通訊地址，請在 1 對 1 私聊向我查詢喔！` }]
              });
              return;
            }
            const authStatus = await checkEditorPermission(userId);
            if (!authStatus.isEditor) {
              await client.replyMessage({
                replyToken,
                messages: [{
                  type: "text",
                  text: "🔒 權限不足：成員電話與地址僅限「已認證幹部/編輯人員」查詢。\n\n若您是幹部，請先輸入指令完成認證：\n幹部認證 [密碼] [您的姓名]\n（例如：幹部認證 shumei567sty 松恩）"
                }]
              });
              return;
            }
          }

          // 查詢 Firestore member
          const memberSnapshot = await db.collection("member").get();
          let matchedMember = null;
          let downlines = [];

          memberSnapshot.forEach(doc => {
            const data = doc.data();
            const name = (data.name || "").trim();
            if (name === targetName || name.includes(targetName) || targetName.includes(name)) {
              if (!matchedMember) matchedMember = { id: doc.id, ...data };
            }

            // 檢查下線 (guide 陣列中是否包含 targetName)
            if (data.guide && Array.isArray(data.guide)) {
              if (data.guide.some(g => g && (g.includes(targetName) || targetName.includes(g)))) {
                downlines.push(name || doc.id);
              }
            }
          });

          // 3A. 聯絡資訊查詢 (僅在 1 對 1 私聊)
          if (parsedQuery.intent === "contact_query") {
            if (!matchedMember) {
              await client.replyMessage({
                replyToken,
                messages: [{ type: "text", text: `查無成員「${targetName}」的聯絡資訊。\n可至青年部名冊查詢：https://shumei-2025.web.app/youth/list.html` }]
              });
              return;
            }

            const phone = matchedMember.phone || "未提供";
            const tel = matchedMember.tel || "未提供";
            const adress = matchedMember.adress || "未提供";
            const replyText = `👤【${matchedMember.name}】聯絡資訊：\n\n📱 行動電話：${phone}\n☎️ 市內電話：${tel}\n🏠 通訊地址：${adress}\n\n🔗 查看名冊：\nhttps://shumei-2025.web.app/youth/list.html?q=${encodeURIComponent(matchedMember.name)}`;

            await client.replyMessage({
              replyToken,
              messages: [{ type: "text", text: replyText }]
            });
            return;
          }

          // 3B. 查詢下線名單
          if (parsedQuery.intent === "downline_query") {
            let replyText = `🌱【${targetName}】介紹入信的下線名單：\n\n`;
            if (downlines.length === 0) {
              replyText += `目前系統中尚無由 ${targetName} 擔任介紹人的成員紀錄。`;
            } else {
              replyText += downlines.map((m, i) => `${i + 1}. ${m}`).join("\n");
              replyText += `\n\n共計 ${downlines.length} 位成員。`;
            }
            replyText += `\n\n🔗 查看完整靈線圖：\nhttps://shumei-2025.web.app/youth/lineage.html`;

            await client.replyMessage({
              replyToken,
              messages: [{ type: "text", text: replyText }]
            });
            return;
          }

          // 3C. 查詢介紹人 / 世話人 / 靈線脈絡
          if (parsedQuery.intent === "lineage_query") {
            if (!matchedMember) {
              await client.replyMessage({
                replyToken,
                messages: [{ type: "text", text: `查無成員「${targetName}」的靈線資料。\n可至青年部名冊查詢：https://shumei-2025.web.app/youth/list.html` }]
              });
              return;
            }

            const guideStr = (matchedMember.guide && matchedMember.guide.length > 0) ? matchedMember.guide.filter(Boolean).join("、") : "無";
            const sewajinStr = matchedMember.sewajin || "無";
            const leaderStr = matchedMember.leader || "未分組";
            const partStr = matchedMember.part || "青年部";

            const replyText = `🌿【${matchedMember.name}】靈線與成員資訊：\n\n🤝 介紹人：${guideStr}\n🌾 世話人：${sewajinStr}\n🚩 所屬組長：${leaderStr}\n🏛️ 所屬部門：${partStr}\n📅 入信編號：${matchedMember.id.split('A')[0]}\n\n🔗 查看 3D 靈線關係網絡：\nhttps://shumei-2025.web.app/youth/lineage.html`;

            await client.replyMessage({
              replyToken,
              messages: [{ type: "text", text: replyText }]
            });
            return;
          }
        }
      } catch (err) {
        logger.error("Error processing lineage query", err);
        if (replyToken && (isPrivateChat || isTagged)) {
          await client.replyMessage({
            replyToken,
            messages: [{ type: "text", text: getFriendlyErrorMessage(err, "lineage") }]
          }).catch(e => logger.error("Error sending error reply", e));
        }
        return;
      }
    }

    // ==========================================
    // 功能四：座談會統計查詢 (原既有功能)
    // ==========================================
    if (isStats) {
      try {
        const snapshot = await db.collection("seminars").get();
        const seminars = [];
        
        // 取得台北時間的當月
        const now = new Date();
        const tzOffset = 8 * 60; // 台北時區 +8
        const localNow = new Date(now.getTime() + tzOffset * 60 * 1000);
        let targetYear = localNow.getUTCFullYear();
        let targetMonth = localNow.getUTCMonth() + 1;

        if (userMessage.includes("上個月") || userMessage.includes("上月")) {
          targetMonth -= 1;
          if (targetMonth === 0) {
            targetMonth = 12;
            targetYear -= 1;
          }
        } else {
          const monthMatch = userMessage.match(/(\d{1,2})月/);
          if (monthMatch) {
            let m = parseInt(monthMatch[1]);
            if (m >= 1 && m <= 12) {
              targetMonth = m;
              if (targetMonth > localNow.getUTCMonth() + 1) {
                targetYear -= 1;
              }
            }
          }
        }

        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.date) {
            let y, m, d;
            let match = data.date.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
            if (match) {
              y = parseInt(match[1]);
              m = parseInt(match[2]);
              d = parseInt(match[3]);
            } else {
              const pd = new Date(data.date);
              if (!isNaN(pd.getTime())) {
                y = pd.getFullYear();
                m = pd.getMonth() + 1;
                d = pd.getDate();
              }
            }
            if (y === targetYear && m === targetMonth) {
              seminars.push({ ...data, m, d });
            }
          }
        });

        if (seminars.length === 0) {
          await client.replyMessage({
            replyToken: replyToken,
            messages: [{ type: "text", text: targetMonth + "月目前沒有座談會紀錄喔！" }],
          });
          return;
        }

        // 排序日期
        seminars.sort((a, b) => a.d - b.d);

        const grouped = {};
        seminars.forEach(sem => {
          const dateKey = sem.m + "/" + sem.d;
          if (!grouped[dateKey]) grouped[dateKey] = [];
          grouped[dateKey].push(sem);
        });

        let replyText = "🍑桃子座談會" + targetMonth + "月\n";
        let count = 1;
        
        for (const dateKey of Object.keys(grouped)) {
          replyText += "🔺" + dateKey + "\n";
          grouped[dateKey].forEach(sem => {
            let attendeesStr = "";
            if (sem.attendees && sem.attendees !== "無" && sem.attendees.trim() !== "") {
              let cleanedAttendees = sem.attendees.replace(/[,，\s]+/g, "、").replace(/^、|、$/g, "");
              attendeesStr = "（" + cleanedAttendees + "）";
            }
            replyText += count + "." + sem.memberName + attendeesStr + "\n";
            count++;
          });
        }

        await client.replyMessage({
          replyToken: replyToken,
          messages: [{ type: "text", text: replyText.trim() }],
        });
        return;
      } catch (err) {
        logger.error("Error fetching seminar stats", err);
      }
    }

    // ==========================================
    // 功能四點五：近期活動與活動負責人快查
    // ==========================================
    if (isActivityCmd) {
      try {
        const [eventsList, editorsDoc] = await Promise.all([
          getAllEventsFromDatabase(db, logger),
          db.collection("info").doc("editors").get().catch(() => null)
        ]);

        const editorsData = editorsDoc && editorsDoc.exists ? editorsDoc.data() : {};
        const editorsMap = editorsData.editors || {};
        const todayTaipei = getTaipeiDate();

        // 篩選從今天開始未來的活動 (包含今天)
        const upcoming = [];
        for (const item of eventsList) {
          const evt = item.data;
          const parsed = parseEventDateTime(evt);
          if (!parsed) continue;
          const diffDays = getDaysUntilEvent(parsed, todayTaipei);
          if (diffDays >= 0) {
            const leaders = extractResponsiblePersons(evt);
            const leaderStatuses = leaders.map(name => {
              const match = matchEditorLineUser(name, editorsMap, editorsData.lineUserIdToName);
              return match.isBound ? `✅ ${name} (已綁定 LINE)` : `⏳ ${name} (尚未綁定 LINE)`;
            });

            upcoming.push({
              title: evt.title || "未命名活動",
              category: evt.category || "活動",
              location: evt.location || "神慈秀明會",
              displayDate: parsed.displayStr,
              diffDays,
              registeredCount: evt.registeredCount || 0,
              leadersStr: leaderStatuses.length > 0 ? leaderStatuses.join("、") : "⚠️ 尚未指定負責人"
            });
          }
        }

        // 依日期先後排序
        upcoming.sort((a, b) => a.diffDays - b.diffDays);

        if (upcoming.length === 0) {
          await client.replyMessage({
            replyToken,
            messages: [{
              type: "text",
              text: `📅【秀明近期活動日程】\n\n目前系統中尚無近期公開活動排程。\n可至活動系統發布新活動並指定負責人：\nhttps://shumei-2025.web.app/activities/events.html`
            }]
          });
          return;
        }

        let replyLines = `📅【秀明近期活動與負責人日程表】\n\n`;
        upcoming.slice(0, 8).forEach((act, idx) => {
          let timingTag = act.diffDays === 0 ? "🔥【今天】" : (act.diffDays === 1 ? "⚡【明天】" : (act.diffDays === 2 ? "⏳【後天】" : `(${act.diffDays}天後)`));
          replyLines += `${idx + 1}. ${act.title} ${timingTag}\n`;
          replyLines += `   📅 時間：${act.displayDate}\n`;
          replyLines += `   📍 地點：${act.location}\n`;
          replyLines += `   👤 負責人：${act.leadersStr}\n`;
          replyLines += `   👥 報名：${act.registeredCount} 人\n\n`;
        });

        replyLines += `🔗 查看完整活動清單或發布新活動：\nhttps://shumei-2025.web.app/activities/events.html`;

        await client.replyMessage({
          replyToken,
          messages: [{
            type: "text",
            text: replyLines.trim()
          }]
        });
        return;
      } catch (err) {
        logger.error("Error handling activity query command:", err);
      }
    }

    // ==========================================
    // 功能五：座談會登記與一般問答 (原既有功能)
    // ==========================================
    try {
      const prompt = `
現在的台北時間是：${nowStr}
目前發話者的 LINE 名稱是：「${userName}」

請分析以下使用者的訊息，判斷是否為「單筆座談會報名/登記」，或是一般的疑問/閒聊。
只要使用者提到「進行座談」、「跟...座談」、「開會」、「見面」且包含人名與時間地點，就請視為座談會登記 (isRegistration: true)。

⚠️ 重要排除規則：
1. 如果訊息內容屬於「統計列表」、「總覽簡報」、「名單整理」、「座談會行程總結」（例如含有多個日期如 🔺8/21、8/22、或多位成員的整理列表），請務必將 \`isRegistration\` 設為 \`false\`！
2. 如果無法確定或無法擷取出明確的「成員姓名 (memberName)」或「日期 (date)」，請務必將 \`isRegistration\` 設為 \`false\`！
3. 如果使用者是在「詢問問題」（例如：「誰有超過100件」、「請問...」等非登記內容），請將 \`isRegistration\` 設為 \`false\`，並在 \`reply\` 欄位給出親切簡短的回答。

如果訊息中有提到相對時間（例如：今天、明天、後天、下週一等），請務必根據上方提供的「現在的台北時間」自動推算，並將 \`date\` 轉換成絕對的日期格式（例如：YYYY/MM/DD 或 YYYY-MM-DD）。
如果訊息內容有提到「我」，請將「我」自動對應並替換成發話者的名字（${userName}），並在擷取成員名單或對象者時，直接填寫此名字。

請以 JSON 格式回傳，必須包含以下欄位：
- isRegistration (布林值：是否為單筆座談會報名/登記，若否則設為 false)
- date (字串：日期，若無則為 null)
- time (字串：時間，若無則為 null)
- location (字串：地點，若無則為 null)
- memberName (字串：對象者/主要會談的青年成員姓名，若無則為 null)
- feelings (字串：當下的感受或內容，若無則為 null)
- goals (字串：信仰提升的目標或討論重點，若無則為 null)
- attendees (字串：其他參加者名單，若無則為 null)
- reply (字串：若非登記且使用者在提問時的回應內容；若是群組一般閒聊則為 null)

若完全無關座談或為列表統計，isRegistration 請設為 false。
請直接回傳 JSON 字串，不要包含任何 Markdown 標記（例如 \`\`\`json 等）。

使用者訊息：
"${userMessage}"
`;
      
      const aiResponse = await callGeminiSafe(genAI, prompt, logger);

      let parsedData;
      try {
        const text = aiResponse.response.text();
        const cleanText = text.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();
        parsedData = JSON.parse(cleanText);
      } catch (e) {
        logger.error("Failed to parse Gemini response as JSON", e);
        if (!isPrivateChat && !isTagged) return;
        throw new Error("AI 解析失敗");
      }

      let replyText = "";

      const hasMember = parsedData.memberName && parsedData.memberName !== "未提供" && parsedData.memberName !== "null";
      const hasDate = parsedData.date && parsedData.date !== "未提供" && parsedData.date !== "null";
      const isValidRegistration = parsedData.isRegistration && hasMember && hasDate;

      if (isValidRegistration) {
        const registrationRef = db.collection("seminars").doc();
        await registrationRef.set({
          userId: userId,
          source: "line",
          memberName: parsedData.memberName,
          date: parsedData.date,
          time: parsedData.time || "未提供",
          location: parsedData.location || "未提供",
          feelings: parsedData.feelings || "未提供",
          goals: parsedData.goals || "未提供",
          attendees: parsedData.attendees || "無",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const targetMember = parsedData.memberName;
        const webUrl = "https://shumei-2025.web.app/seminar.html?q=" + encodeURIComponent(targetMember);

        replyText = "收到您的登記資訊！\n\n成員：" + parsedData.memberName + "\n日期：" + parsedData.date + " " + (parsedData.time || "") + "\n地點：" + (parsedData.location || "未提供") + "\n感受：" + (parsedData.feelings || "未提供") + "\n目標：" + (parsedData.goals || "未提供") + "\n參加者：" + (parsedData.attendees || "無") + "\n\n已為您成功同步至網站紀錄！\n🔗 點此查看網站紀錄：\n" + webUrl;
      } else {
        if (parsedData.reply && (isPrivateChat || isTagged)) {
          replyText = parsedData.reply;
        } else if (isPrivateChat || isTagged) {
          replyText = "您好！我是秀明青年小助理～\n您可以透過我完成以下功能：\n1. 📅 查詢「近期活動」與「活動負責人」\n2. 📷 拍照上傳「入信願書」自動建檔\n3. 🙏 傳送「今天施光2次信徒」登記淨靈人次或「淨靈統計」\n4. 🌿 詢問成員靈線、介紹人或私訊查詢電話地址\n5. 🍑 紀錄座談會或查詢當月座談統計！";
        }
      }

      if (replyText !== "") {
        await client.replyMessage({
          replyToken: replyToken,
          messages: [{ type: "text", text: replyText }],
        });
      }

    } catch (error) {
      logger.error("Error processing event", error);
      if (replyToken && (isPrivateChat || isTagged)) {
        await client.replyMessage({
          replyToken: replyToken,
          messages: [{ type: "text", text: getFriendlyErrorMessage(error, "seminar") }],
        }).catch(e => logger.error("Error sending error reply", e));
      }
    }
  }
);

// ==========================================
// 6. 排程功能：每個月 26 日活動規劃與設定負責人提醒 (Monthly Planning Reminder)
// ==========================================
exports.monthlyActivityPlanningReminder = onSchedule(
  {
    schedule: "0 9 26 * *",
    timeZone: "Asia/Taipei",
    region: "asia-east1",
    secrets: [lineChannelSecret, lineChannelAccessToken]
  },
  async (event) => {
    logger.info("Executing monthlyActivityPlanningReminder on the 26th at 09:00 Taipei time...");
    let client = null;
    try {
      client = new messagingApi.MessagingApiClient({
        channelAccessToken: lineChannelAccessToken.value()
      });
    } catch (e) {
      logger.error("Failed to initialize LINE client with secret for monthly reminder:", e);
      return;
    }

    try {
      const summary = await sendMonthlyPlanningReminder({
        db,
        client,
        dryRun: false,
        logger
      });
      logger.info("monthlyActivityPlanningReminder completed successfully:", summary);
    } catch (err) {
      logger.error("Error executing monthlyActivityPlanningReminder:", err);
    }
  }
);

// ==========================================
// 7. 排程功能：每日活動到期自動跳出通知提醒負責人 (Upcoming Activity Notification)
// ==========================================
exports.dailyActivityReminder = onSchedule(
  {
    schedule: "30 8 * * *",
    timeZone: "Asia/Taipei",
    region: "asia-east1",
    secrets: [lineChannelSecret, lineChannelAccessToken]
  },
  async (event) => {
    logger.info("Executing dailyActivityReminder daily at 08:30 Taipei time...");
    let client = null;
    try {
      client = new messagingApi.MessagingApiClient({
        channelAccessToken: lineChannelAccessToken.value()
      });
    } catch (e) {
      logger.error("Failed to initialize LINE client with secret for daily reminder:", e);
      return;
    }

    try {
      const summary = await sendUpcomingActivityReminders({
        db,
        client,
        dryRun: false,
        logger
      });
      logger.info("dailyActivityReminder completed successfully:", summary);
    } catch (err) {
      logger.error("Error executing dailyActivityReminder:", err);
    }
  }
);

// ==========================================
// 8. 測試與手動觸發端點：活動通知測試與驗證 (HTTP Test Trigger)
// ==========================================
exports.testActivityNotifications = onRequest(
  {
    region: "asia-east1",
    secrets: [lineChannelSecret, lineChannelAccessToken]
  },
  async (req, res) => {
    // 支援 GET 與 POST 參數
    const params = req.method === "POST" ? req.body : req.query;
    const type = params.type || "all";
    const forceDate = params.forceDate || null;
    // 安全防護：預設為 dryRun=true，除非明確認證 dryRun=false
    const isDryRun = params.dryRun === "false" || params.dryRun === false ? false : true;

    logger.info(`testActivityNotifications invoked. type=${type}, dryRun=${isDryRun}, forceDate=${forceDate}`);

    let client = null;
    try {
      client = new messagingApi.MessagingApiClient({
        channelAccessToken: lineChannelAccessToken.value()
      });
    } catch (e) {
      logger.warn("Could not retrieve lineChannelAccessToken from secret manager:", e.message || e);
      client = new messagingApi.MessagingApiClient({
        channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "dummy-token-for-dry-run"
      });
    }

    const executionResults = {};
    try {
      if (type === "monthly" || type === "monthly_planning") {
        executionResults.monthly = await sendMonthlyPlanningReminder({
          db,
          client,
          dryRun: isDryRun,
          forceDate,
          logger
        });
      } else if (type === "daily" || type === "upcoming_activities") {
        executionResults.upcoming = await sendUpcomingActivityReminders({
          db,
          client,
          dryRun: isDryRun,
          forceDate,
          logger
        });
      } else {
        // 預設執行兩者
        executionResults.monthly = await sendMonthlyPlanningReminder({
          db,
          client,
          dryRun: isDryRun,
          forceDate,
          logger
        });
        executionResults.upcoming = await sendUpcomingActivityReminders({
          db,
          client,
          dryRun: isDryRun,
          forceDate,
          logger
        });
      }

      res.status(200).json({
        success: true,
        dryRun: isDryRun,
        message: isDryRun ? "Simulation completed successfully (dryRun=true, no actual LINE push sent)" : "Notifications sent successfully via LINE",
        results: executionResults
      });
    } catch (err) {
      logger.error("Error in testActivityNotifications:", err);
      res.status(500).json({
        success: false,
        error: err.message || String(err)
      });
    }
  }
);

