#!/usr/bin/env node

/**
 * scripts/resolve_feedback.js
 * 
 * 全自動使用者功能建議結案與 LINE 上線通知工具
 * 
 * 使用方式：
 *   1. 列出待處理建議：
 *      node scripts/resolve_feedback.js list
 * 
 *   2. 結案建議並自動發送 LINE 通知給原提議者：
 *      node scripts/resolve_feedback.js complete <文件ID或關鍵字> [自訂上線說明]
 * 
 *   3. 僅查看某筆建議詳情（不發送通知）：
 *      node scripts/resolve_feedback.js get <文件ID或關鍵字>
 */

const { execSync } = require('child_process');
const path = require('path');

// 引用 functions 內的相依套件
const admin = require(path.join(__dirname, '../functions/node_modules/firebase-admin'));
const { messagingApi } = require(path.join(__dirname, '../functions/node_modules/@line/bot-sdk'));
const { MessagingApiClient } = messagingApi;

// 初始化 Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'shumei-2025' });
}
const db = admin.firestore();

// 取得 LINE Channel Access Token
function getLineToken() {
  if (process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    return process.env.LINE_CHANNEL_ACCESS_TOKEN.trim();
  }
  try {
    const stdout = execSync(
      'gcloud secrets versions access latest --secret=LINE_CHANNEL_ACCESS_TOKEN --project=shumei-2025 2>/dev/null'
    ).toString();
    return stdout.trim();
  } catch (err) {
    console.error('⚠️ 無法自動獲取 LINE_CHANNEL_ACCESS_TOKEN，請確認 gcloud 權限或設定環境變數。');
    return null;
  }
}

async function listPendingFeedbacks() {
  console.log('🔍 正在查詢待處理的使用者功能升級建議 (status == "pending")...\n');
  const snap = await db.collection('system_feedbacks')
    .where('status', '==', 'pending')
    .get();

  if (snap.empty) {
    console.log('✨ 目前系統中無待處理的建議！');
    return;
  }

  const sortedDocs = snap.docs.sort((a, b) => {
    const tA = a.data().createdAt?.toMillis?.() || (a.data().createdAt?.seconds ? a.data().createdAt.seconds * 1000 : 0);
    const tB = b.data().createdAt?.toMillis?.() || (b.data().createdAt?.seconds ? b.data().createdAt.seconds * 1000 : 0);
    return tB - tA;
  });

  console.log(`📋 共有 ${sortedDocs.length} 筆待確認建議：\n`);
  sortedDocs.forEach((doc, idx) => {
    const d = doc.data();
    const timeStr = d.createdAt ? (d.createdAt.toDate ? d.createdAt.toDate().toISOString() : JSON.stringify(d.createdAt)) : '未知時間';
    const cat = d.category ? `【${d.category}】` : '【未分類】';
    console.log(`[${idx + 1}] ID: ${doc.id}`);
    console.log(`    類別: ${cat}`);
    console.log(`    提議者: ${d.userName || '未知'} (userId: ${d.userId || '無'})`);
    console.log(`    內容: 「${d.content || ''}」`);
    console.log(`    時間: ${timeStr}`);
    console.log('----------------------------------------------------');
  });
}

async function findFeedback(idOrQuery) {
  if (!idOrQuery) return null;
  // 先嘗試以 ID 直接讀取
  const directSnap = await db.collection('system_feedbacks').doc(idOrQuery).get();
  if (directSnap.exists) {
    return { id: directSnap.id, ...directSnap.data(), ref: directSnap.ref };
  }

  // 嘗試模糊搜尋 content 或 userName
  const allPending = await db.collection('system_feedbacks')
    .where('status', '==', 'pending')
    .get();

  const matches = [];
  allPending.forEach(doc => {
    const d = doc.data();
    const str = `${doc.id} ${d.userName} ${d.content} ${d.category}`;
    if (str.includes(idOrQuery)) {
      matches.push({ id: doc.id, ...d, ref: doc.ref });
    }
  });

  if (matches.length === 1) {
    return matches[0];
  } else if (matches.length > 1) {
    console.log(`⚠️ 搜尋到 ${matches.length} 筆相符建議，請指定更精確的 ID：`);
    matches.forEach(m => console.log(`   - ID: ${m.id} | ${m.userName}: ${m.content}`));
    return null;
  }
  return null;
}

async function completeFeedback(idOrQuery, releaseNote = '') {
  const fb = await findFeedback(idOrQuery);
  if (!fb) {
    console.error(`❌ 找不到符合「${idOrQuery}」的待處理建議。`);
    return;
  }

  console.log(`\n🎯 選定建議：`);
  console.log(`   ID: ${fb.id}`);
  console.log(`   提議者: ${fb.userName || '成員'} (${fb.userId || '無 LINE ID'})`);
  console.log(`   內容: 「${fb.content}」`);
  if (releaseNote) {
    console.log(`   自訂說明: ${releaseNote}`);
  }

  // 1. 更新 Firestore 狀態為 completed
  await fb.ref.update({
    status: 'completed',
    releaseNote: releaseNote || '',
    resolvedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log(`✅ 已將建議 ${fb.id} 狀態更新為 completed！`);

  // 2. 若有 userId，發送 LINE 上線通知
  if (fb.userId) {
    const token = getLineToken();
    if (!token) {
      console.warn('⚠️ 缺少 LINE Token，略過推播發送。');
      return;
    }

    const client = new MessagingApiClient({ channelAccessToken: token });
    const noteSection = releaseNote ? `\n💡 升級說明：${releaseNote}\n` : '';
    const notifyText = `🌸【秀明小助理 功能升級通知】

您好！感謝您先前向小助理提出的寶貴需求：
「${fb.content}」

我們的工程團隊已完成此項功能開發並正式升級上線囉！🎉${noteSection}
誠摯感謝您與我們一同讓小助理更完善，歡迎您隨時體驗看看～🙏✨`;

    try {
      await client.pushMessage({
        to: fb.userId,
        messages: [{ type: 'text', text: notifyText }]
      });
      console.log(`🚀 已成功發送 LINE 推播通知給 ${fb.userName} (${fb.userId})！`);

      // 寫入通知日誌
      await db.collection('notification_logs').add({
        type: 'feedback_resolved',
        feedbackId: fb.id,
        recipient: fb.userName || '',
        lineUserId: fb.userId,
        content: fb.content,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (pushErr) {
      console.error(`❌ 發送 LINE 推播失敗:`, pushErr.message || pushErr);
    }
  } else {
    console.log(`ℹ️ 該筆建議無 LINE userId，僅完成後台狀態結案。`);
  }
}

// 主程式入口
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'list';

  try {
    if (command === 'list') {
      await listPendingFeedbacks();
    } else if (command === 'complete') {
      const idOrQuery = args[1];
      const note = args.slice(2).join(' ');
      if (!idOrQuery) {
        console.error('❌ 請提供建議 ID 或關鍵字：node scripts/resolve_feedback.js complete <id_or_query> [note]');
        process.exit(1);
      }
      await completeFeedback(idOrQuery, note);
    } else if (command === 'get') {
      const idOrQuery = args[1];
      const fb = await findFeedback(idOrQuery);
      if (fb) {
        console.log('📌 建議詳情：', JSON.stringify(fb, null, 2));
      } else {
        console.log('❌ 查無相符資料。');
      }
    } else {
      console.log('📖 使用說明：');
      console.log('   node scripts/resolve_feedback.js list');
      console.log('   node scripts/resolve_feedback.js complete <id_or_query> [自訂說明]');
      console.log('   node scripts/resolve_feedback.js get <id_or_query>');
    }
  } catch (err) {
    console.error('❌ 執行失敗:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  findFeedback,
  completeFeedback,
  listPendingFeedbacks
};
