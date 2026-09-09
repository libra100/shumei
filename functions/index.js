const { onRequest } = require("firebase-functions/v2/https");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { messagingApi } = require("@line/bot-sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PubSub } = require("@google-cloud/pubsub");

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
          if (event.type !== "message" || event.message.type !== "text") {
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

// 2. Background Function to process the event using Gemini API
exports.processLineEvent = onMessagePublished(
  { topic: "process-line-event", secrets: [lineChannelSecret, lineChannelAccessToken, geminiApiKey], region: "asia-east1" },
  async (pubsubEvent) => {
    const event = pubsubEvent.data.message.json.event;
    if (!event) return;
    
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
    
    // 檢查是否有明確標記機器人 (忽略大小寫)
    const lowerMessage = userMessage.toLowerCase();
    const isTagged = lowerMessage.includes("@shumei helper");

    // 個人對話 (1對1) 一律處理；群組或聊天室則需要標記機器人、要求統計、或包含登記關鍵字
    const isForBot = isPrivateChat || isTagged || isStats || /登記|紀錄|座談|回報/.test(userMessage);

    if (!isForBot) {
      return; // 忽略群組中的一般閒聊，不回覆且不呼叫 AI
    }

    // 處理統計指令
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

        let replyText = "桃子座談會\n";
        let count = 1;
        
        for (const dateKey of Object.keys(grouped)) {
          replyText += "🔺" + dateKey + "\n";
          grouped[dateKey].forEach(sem => {
            let attendeesStr = (sem.attendees && sem.attendees !== "無" && sem.attendees.trim() !== "") ? "（" + sem.attendees + "）" : "";
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
        logger.error("Error fetching stats", err);
      }
    }

    let userName = "發言者";
    try {
      if (userId) {
        const profile = await client.getProfile(userId);
        userName = profile.displayName || "發言者";
      }
    } catch (e) {
      logger.error("Failed to get user profile", e);
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey.value());
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    try {
      const nowStr = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
      const prompt = `
現在的台北時間是：${nowStr}
目前發話者的 LINE 名稱是：「${userName}」

請分析以下使用者的訊息，判斷是否為「單筆座談會報名/登記」。
只要使用者提到「進行座談」、「跟...座談」、「開會」、「見面」且包含人名與時間地點，就請視為座談會登記 (isRegistration: true)。

⚠️ 重要排除規則：
1. 如果訊息內容屬於「統計列表」、「總覽簡報」、「名單整理」、「座談會行程總結」（例如含有多個日期如 🔺8/21、8/22、或多位成員的整理列表），請務必將 \`isRegistration\` 設為 \`false\`！
2. 如果無法確定或無法擷取出明確的「成員姓名 (memberName)」或「日期 (date)」，請務必將 \`isRegistration\` 設為 \`false\`！

如果訊息中有提到相對時間（例如：今天、明天、後天、下週一等），請務必根據上方提供的「現在的台北時間」自動推算，並將 \`date\` 轉換成絕對的日期格式（例如：YYYY/MM/DD 或 YYYY-MM-DD）。
如果訊息內容有提到「我」，請將「我」自動對應並替換成發話者的名字（${userName}），並在擷取成員名單或對象者時，直接填寫此名字。

請從中擷取相關資訊，並以 JSON 格式回傳，必須包含以下欄位：
- isRegistration (布林值：是否為單筆座談會報名/登記，若否或為統計/列表則設為 false)
- date (字串：日期，若無則為 null)
- time (字串：時間，若無則為 null)
- location (字串：地點，若無則為 null)
- memberName (字串：對象者/主要會談的青年成員姓名，若無則為 null)
- feelings (字串：當下的感受或內容，若無則為 null)
- goals (字串：信仰提升的目標或討論重點，若無則為 null)
- attendees (字串：其他參加者名單，若無則為 null)

若完全無關座談或為列表統計，isRegistration 請設為 false。
請直接回傳 JSON 字串，不要包含任何 Markdown 標記（例如 \`\`\`json 等）。

使用者訊息：
"${userMessage}"
`;
      
      const aiResponse = await model.generateContent(prompt);

      let parsedData;
      try {
        const text = aiResponse.response.text();
        const cleanText = text.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();
        parsedData = JSON.parse(cleanText);
      } catch (e) {
        logger.error("Failed to parse Gemini response as JSON", e);
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
        // 如果不是有效登記：只有 1對1 個人對話，或是群組中有明確 tag 機器人，才回覆提示教學訊息
        if (isPrivateChat || isTagged) {
          replyText = "您好！如果您想紀錄座談會，請輸入包含：時間、地點、主要成員、感受、目標以及其他參加者的資訊喔！可以直接用口語的方式告訴我～";
        }
      }

      if (replyText !== "") {
        // Reply via LINE API
        await client.replyMessage({
          replyToken: replyToken,
          messages: [{ type: "text", text: replyText }],
        });
      }

    } catch (error) {
      logger.error("Error processing event", error);
      if (replyToken) {
        await client.replyMessage({
          replyToken: replyToken,
          messages: [{ type: "text", text: "抱歉，系統目前有些忙碌，請稍後再試一次。" }],
        }).catch(e => logger.error("Error sending error reply", e));
      }
    }
  }
);
