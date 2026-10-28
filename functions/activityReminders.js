/**
 * activityReminders.js
 * 
 * 秀明活動通知與排程管理核心邏輯
 * 1. 每月 26 日活動規劃與設定負責人提醒 (Monthly Planning Reminder)
 * 2. 活動到期自動跳出通知提醒負責人 (Upcoming Activity Notification for In-Charge Cadres)
 * 3. 負責人尚未綁定 LINE 時之管理員/幹部備援通報 (Graceful Fallback Mechanism)
 */

const defaultLogger = console;

/**
 * 取得指定時間在台北時區 (Asia/Taipei, UTC+8) 的年月日與時間物件
 * @param {Date|string|number} [baseDate=new Date()]
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, second: number, rawDate: Date }}
 */
function getTaipeiDate(baseDate = new Date()) {
  const d = new Date(baseDate);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  }).formatToParts(d);

  const get = (type) => parts.find(p => p.type === type)?.value;
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    hour: parseInt(get('hour'), 10),
    minute: parseInt(get('minute'), 10),
    second: parseInt(get('second'), 10),
    rawDate: d
  };
}

/**
 * 依據台北時間推算下一個月份與年份 (例: 10月 -> 11月; 12月 -> 次年1月)
 * @param {{ year: number, month: number }} taipeiDate
 * @returns {{ nextYear: number, nextMonth: number }}
 */
function getNextMonthInfo(taipeiDate) {
  let nextYear = taipeiDate.year;
  let nextMonth = taipeiDate.month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  return { nextYear, nextMonth };
}

/**
 * 解析活動時間為標準台北時間格式
 * 支援 startTime, startDate, date, time, sessions 等多元欄位與 Firestore Timestamp
 * 包含斜線 (2026/10/28)、中文日期 (2026年10月28日)、單位數月份/日期/小時 (9:30)、plain timestamp 物件等多元容錯
 * @param {Object} evt
 * @returns {Object|null}
 */
function parseEventDateTime(evt) {
  if (!evt) return null;
  let rawDate = evt.startTime || evt.startDate || evt.date;
  let rawTime = evt.time || evt.startTimeStr;

  // 支援 natural_events 中的 sessions 結構
  if (!rawDate && Array.isArray(evt.sessions) && evt.sessions.length > 0) {
    rawDate = evt.sessions[0].date;
    rawTime = rawTime || evt.sessions[0].time;
  }

  if (!rawDate) return null;

  let d = null;
  if (typeof rawDate.toDate === 'function') {
    d = rawDate.toDate();
  } else if (rawDate instanceof Date) {
    d = rawDate;
  } else if (rawDate && typeof rawDate === 'object' && (rawDate.seconds !== undefined || rawDate._seconds !== undefined)) {
    const s = rawDate.seconds !== undefined ? rawDate.seconds : rawDate._seconds;
    d = new Date(s * 1000);
  } else if (typeof rawDate === 'string') {
    let clean = rawDate.trim();
    // 支援斜線 2026/10/28 與中文年月日 2026年10月28日
    clean = clean.replace(/[\/.]/g, '-');
    clean = clean.replace(/(\d{4})年(\d{1,2})月(\d{1,2})日?/, '$1-$2-$3');

    // 正規化 YYYY-M-D 為 YYYY-MM-DD
    const ymdMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(.*)$/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = ymdMatch[2].padStart(2, '0');
      const day = ymdMatch[3].padStart(2, '0');
      const rest = ymdMatch[4] || '';
      clean = `${year}-${month}-${day}${rest}`.trim();
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      if (rawTime && typeof rawTime === 'string') {
        const timeMatch = rawTime.trim().match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          const hh = timeMatch[1].padStart(2, '0');
          const mm = timeMatch[2];
          clean += `T${hh}:${mm}:00`;
        } else {
          clean += 'T00:00:00';
        }
      } else {
        clean += 'T00:00:00';
      }
    } else if (/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})/.test(clean)) {
      clean = clean.replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})/, (m, dp, hh, mm) => {
        return `${dp}T${hh.padStart(2, '0')}:${mm}`;
      });
    } else if (/^(\d{4}-\d{2}-\d{2})T(\d{1,2}):(\d{2})/.test(clean)) {
      clean = clean.replace(/^(\d{4}-\d{2}-\d{2})T(\d{1,2}):(\d{2})/, (m, dp, hh, mm) => {
        return `${dp}T${hh.padStart(2, '0')}:${mm}`;
      });
    }

    // 若無時區標記，自動預設為台北時區 (+08:00)
    if (!clean.includes('+') && !clean.endsWith('Z')) {
      clean += '+08:00';
    }
    d = new Date(clean);
  }

  if (!d || isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(d);
  const get = (type) => parts.find(p => p.type === type)?.value;
  const y = get('year');
  const m = get('month');
  const day = get('day');
  const h = get('hour');
  const min = get('minute');

  const dateStr = `${y}-${m}-${day}`;
  const timeStr = (h === '00' && min === '00' && !rawTime && !(typeof rawDate === 'string' && rawDate.includes(':'))) ? '' : `${h}:${min}`;
  const displayStr = timeStr ? `${dateStr} ${timeStr}` : dateStr;

  return {
    date: d,
    dateStr,
    timeStr,
    displayStr,
    y: parseInt(y, 10),
    m: parseInt(m, 10),
    d: parseInt(day, 10)
  };
}

/**
 * 計算活動日期與今天 (台北時區) 的日數差距
 * @param {{ y: number, m: number, d: number }} parsedEvent
 * @param {{ year: number, month: number, day: number }} todayTaipei
 * @returns {number}
 */
function getDaysUntilEvent(parsedEvent, todayTaipei) {
  const d1 = new Date(Date.UTC(todayTaipei.year, todayTaipei.month - 1, todayTaipei.day));
  const d2 = new Date(Date.UTC(parsedEvent.y, parsedEvent.m - 1, parsedEvent.d));
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 從活動物件中萃取「負責人」姓名清單
 * 支援 responsiblePerson, responsiblePersons, leader, leaders, inCharge, 負責人, organizer 等別名
 * @param {Object} evt
 * @returns {string[]}
 */
function extractResponsiblePersons(evt) {
  if (!evt) return [];
  const candidates = [
    evt.responsiblePerson,
    evt.responsiblePersons,
    evt.leader,
    evt.leaders,
    evt.inCharge,
    evt['負責人'],
    evt.organizer,
    evt.manager,
    evt.host,
    evt.contact,
    evt.contactPerson,
    evt.instructor,
    evt.speaker
  ];

  const names = new Set();
  const stopwords = new Set(['無', '未指定', '待定', '暫無', '無負責人', '尚未指定', '待確認', 'null', 'undefined', 'none', '']);

  for (const c of candidates) {
    if (!c) continue;
    if (Array.isArray(c)) {
      for (const item of c) {
        if (typeof item === 'string') {
          const split = item.split(/[,，、\/\s]+/);
          for (const s of split) {
            const trimmed = s.trim();
            if (trimmed && !stopwords.has(trimmed.toLowerCase())) {
              names.add(trimmed);
            }
          }
        } else if (item && typeof item.name === 'string') {
          const trimmed = item.name.trim();
          if (trimmed && !stopwords.has(trimmed.toLowerCase())) {
            names.add(trimmed);
          }
        }
      }
    } else if (typeof c === 'string') {
      const split = c.split(/[,，、\/\s]+/);
      for (const s of split) {
        const trimmed = s.trim();
        if (trimmed && !stopwords.has(trimmed.toLowerCase())) {
          names.add(trimmed);
        }
      }
    } else if (typeof c === 'object' && c.name) {
      const trimmed = c.name.trim();
      if (trimmed && !stopwords.has(trimmed.toLowerCase())) {
        names.add(trimmed);
      }
    }
  }

  return Array.from(names);
}

/**
 * 比對幹部/編輯人員名單，查詢指定姓名是否已綁定 LINE
 * 支援 key、v.name 完全比對、大小寫忽略比對、子字串模糊比對以及 lineUserIdToName 反向查詢
 * @param {string} personName
 * @param {Object} editorsMap (來自 info/editors.editors)
 * @param {Object} [lineUserIdToName] (來自 info/editors.lineUserIdToName)
 * @returns {{ name: string, lineUserId: string|null, lineDisplayName: string, isBound: boolean, role: string }}
 */
function matchEditorLineUser(personName, editorsMap = {}, lineUserIdToName = {}) {
  const cleanName = (personName || '').trim();
  if (!cleanName) {
    return { name: cleanName, lineUserId: null, lineDisplayName: '', isBound: false, role: '' };
  }

  // 1. 完全相符 (先查 key，再查 value.name)
  let matched = editorsMap[cleanName];

  if (!matched) {
    for (const [k, v] of Object.entries(editorsMap)) {
      if (k.trim() === cleanName || (v && typeof v.name === 'string' && v.name.trim() === cleanName)) {
        matched = v;
        break;
      }
    }
  }

  // 2. 忽略大小寫與前後空白搜尋
  if (!matched) {
    const lower = cleanName.toLowerCase();
    for (const [k, v] of Object.entries(editorsMap)) {
      if (k.trim().toLowerCase() === lower || (v && typeof v.name === 'string' && v.name.trim().toLowerCase() === lower)) {
        matched = v;
        break;
      }
    }
  }

  // 3. 子字串比對 (例如「蔡松恩」vs「松恩」)
  if (!matched && cleanName.length >= 2) {
    for (const [k, v] of Object.entries(editorsMap)) {
      const tk = k.trim();
      const vName = (v && typeof v.name === 'string') ? v.name.trim() : '';
      if (tk.length >= 2 && (tk.includes(cleanName) || cleanName.includes(tk))) {
        matched = v;
        break;
      }
      if (vName.length >= 2 && (vName.includes(cleanName) || cleanName.includes(vName))) {
        matched = v;
        break;
      }
    }
  }

  // 4. 反向從 lineUserIdToName 比對
  if (!matched && lineUserIdToName && typeof lineUserIdToName === 'object') {
    for (const [uid, name] of Object.entries(lineUserIdToName)) {
      if (typeof name === 'string') {
        const trimName = name.trim();
        if (trimName === cleanName || (cleanName.length >= 2 && trimName.length >= 2 && (trimName.includes(cleanName) || cleanName.includes(trimName)))) {
          matched = {
            name: trimName,
            lineUserId: uid,
            lineDisplayName: trimName,
            active: true,
            role: '幹部'
          };
          break;
        }
      }
    }
  }

  if (matched && matched.active !== false && matched.lineUserId && typeof matched.lineUserId === 'string' && matched.lineUserId.trim()) {
    return {
      name: matched.name || cleanName,
      lineUserId: matched.lineUserId.trim(),
      lineDisplayName: matched.lineDisplayName || '',
      isBound: true,
      role: matched.role || '幹部'
    };
  }

  return {
    name: (matched && matched.name) || cleanName,
    lineUserId: null,
    lineDisplayName: (matched && matched.lineDisplayName) || '',
    isBound: false,
    role: (matched && matched.role) || ''
  };
}

/**
 * 取得所有已綁定 LINE 且啟用的幹部與管理員清單
 * 整合 info/editors 與 info/admins (支援 email 白名單與名稱檢驗)
 * @param {Object} editorsData (info/editors)
 * @param {Object} [adminsData] (info/admins)
 * @returns {{ boundCadres: Array, boundAdmins: Array }}
 */
function getActiveBoundCadresAndAdmins(editorsData = {}, adminsData = {}) {
  const editors = editorsData?.editors || {};
  const lineMap = editorsData?.lineUserIdToName || {};
  const adminEmails = (adminsData && Array.isArray(adminsData.emails))
    ? adminsData.emails.map(e => String(e).toLowerCase().trim())
    : [];
  const adminNames = (adminsData && Array.isArray(adminsData.names))
    ? adminsData.names.map(n => String(n).trim())
    : [];

  const boundCadres = [];
  const boundAdmins = [];
  const seenUserIds = new Set();

  for (const [key, info] of Object.entries(editors)) {
    if (!info) continue;
    if (info.active === false) continue;
    const uid = info.lineUserId && typeof info.lineUserId === 'string' ? info.lineUserId.trim() : '';
    if (!uid) continue;

    const personName = info.name || key;
    const role = (info.role || '').toLowerCase();
    const email = (info.email || '').toLowerCase().trim();

    const isAdmin = info.isAdmin === true ||
      role.includes('admin') ||
      role.includes('管理') ||
      role.includes('主事') ||
      role.includes('會長') ||
      role.includes('部長') ||
      (email && adminEmails.includes(email)) ||
      (adminNames.includes(personName));

    const cadreObj = {
      name: personName,
      lineDisplayName: info.lineDisplayName || '',
      lineUserId: uid,
      role: info.role || '幹部',
      isAdmin
    };

    if (!seenUserIds.has(uid)) {
      seenUserIds.add(uid);
      boundCadres.push(cadreObj);
    }
    if (isAdmin && !boundAdmins.some(a => a.lineUserId === uid)) {
      boundAdmins.push(cadreObj);
    }
  }

  // 補充 lineUserIdToName 中尚未涵蓋的已綁定使用者
  for (const [uid, name] of Object.entries(lineMap)) {
    if (!uid || typeof uid !== 'string') continue;
    const cleanUid = uid.trim();
    if (!seenUserIds.has(cleanUid)) {
      seenUserIds.add(cleanUid);
      const personName = typeof name === 'string' ? name.trim() : '幹部';
      const cadreObj = {
        name: personName,
        lineDisplayName: personName,
        lineUserId: cleanUid,
        role: '幹部',
        isAdmin: adminNames.includes(personName)
      };
      boundCadres.push(cadreObj);
      if (cadreObj.isAdmin) {
        boundAdmins.push(cadreObj);
      }
    }
  }

  // 若無人明確被標記為管理員，則由所有已綁定幹部共同擔任備援通報對象
  const fallbackAdmins = boundAdmins.length > 0 ? boundAdmins : boundCadres;

  return { boundCadres, boundAdmins: fallbackAdmins };
}

/**
 * 組合「每月 26 日活動規劃與設定負責人提醒」LINE 訊息
 * @param {number} nextYear
 * @param {number} nextMonth
 * @param {Object} [taipeiDate=null]
 * @param {Array} [pendingFeedbacks=[]] 待確認之使用者升級建議清單
 * @returns {string}
 */
function buildMonthlyPlanningMessage(nextYear, nextMonth, taipeiDate = null, pendingFeedbacks = []) {
  const dayStr = (taipeiDate && taipeiDate.day === 26) ? '今天是本月 26 日' : (taipeiDate ? `今天是 ${taipeiDate.month} 月 ${taipeiDate.day} 日` : '今天是本月 26 日');
  let msg = `📅【秀明活動籌備提醒 — ${nextYear} 年 ${nextMonth} 月活動規劃】\n\n各位幹部與活動負責人好：\n${dayStr}，提醒您該開始規劃【${nextYear} 年 ${nextMonth} 月】的各項活動日程囉！\n\n🎯 籌備重點事項：\n1. 規劃確認下個月份之集會、青年座談、研修與農法活動日期\n2. 進入活動系統發布新活動，並確實設定每場活動之「負責人」\n3. 設定完成後，系統將在活動即將舉行前，自動透過 LINE 推播提醒負責人進行事前預備！\n\n🔗 活動發布與管理頁面：\nhttps://shumei-2025.web.app/activities/events.html`;

  if (Array.isArray(pendingFeedbacks) && pendingFeedbacks.length > 0) {
    msg += `\n\n💡【本月使用者功能升級建議彙整】\n小助理在此期間共收集到 ${pendingFeedbacks.length} 則待確認建議：\n`;
    pendingFeedbacks.slice(0, 5).forEach((fb, idx) => {
      const user = fb.userName || '成員';
      const content = fb.content || '';
      msg += `${idx + 1}. ${user}：「${content}」\n`;
    });
    if (pendingFeedbacks.length > 5) {
      msg += `...以及其他 ${pendingFeedbacks.length - 5} 則建議。\n`;
    }
    msg += `管理員可於本次月度籌備會議中一併討論評估！`;
  }

  msg += `\n\n願大家在各項聖業與奉事中充滿神慈光芒與喜悅！🙏✨`;
  return msg;
}

/**
 * 組合「活動即將舉行提醒 (給負責人)」LINE 訊息
 * @param {Object} evt
 * @param {Object} parsedEvent
 * @param {string} personName
 * @param {string} timingDesc (例如「將於今日舉行」、「即將於明日舉行」)
 * @returns {string}
 */
function buildUpcomingActivityMessage(evt, parsedEvent, personName, timingDesc) {
  const loc = evt.location || '神慈秀明會';
  const category = evt.category || '青年活動';
  const count = evt.registeredCount || 0;
  const desc = evt.desc || evt.description || '無特別說明';

  return `🔔【秀明活動即將舉行提醒】
親愛的 ${personName} 負責人您好：

由您擔任負責人的活動${timingDesc}（${parsedEvent.displayStr}），請提前確認各項事宜與準備工作！

📌 活動名稱：${evt.title || '秀明活動'}
📅 活動時間：${parsedEvent.displayStr}
📍 集合地點：${loc}
🏷️ 活動類別：${category}
👥 目前報名：${count} 人
📝 活動內容：${desc}

🔗 查看活動詳情與現場 QR 簽到：
https://shumei-2025.web.app/activities/events.html

感謝您的誠心承擔與付出！願奉事圓滿順利！🙏✨`;
}

/**
 * 組合「負責人尚未綁定 LINE 備援提醒 (給管理員/幹部)」LINE 訊息
 * @param {Object} evt
 * @param {Object} parsedEvent
 * @param {string} personName
 * @param {string} timingDesc
 * @returns {string}
 */
function buildUnboundFallbackMessage(evt, parsedEvent, personName, timingDesc) {
  return `⚠️【活動負責人尚未綁定 LINE 通知】
活動「${evt.title || '秀明活動'}」${timingDesc}（${parsedEvent.displayStr}）。

📌 活動名稱：${evt.title || '秀明活動'}
📅 活動時間：${parsedEvent.displayStr}
👤 指定負責人：${personName}（尚未綁定 LINE）

由於負責人「${personName}」尚未於 LINE 完成幹部身分綁定，無法直接接收個人推播。
請幹部提醒其在與機器人的 1 對 1 私聊中輸入：
「幹部認證 [密碼] ${personName}」
完成身分認證與綁定，或請幹部協助轉達活動籌備通知！

🔗 活動頁面：
https://shumei-2025.web.app/activities/events.html`;
}

/**
 * 組合「活動未指派負責人警告 (給管理員/幹部)」LINE 訊息
 * @param {Object} evt
 * @param {Object} parsedEvent
 * @param {string} timingDesc
 * @returns {string}
 */
function buildUnassignedLeaderFallbackMessage(evt, parsedEvent, timingDesc) {
  return `⚠️【活動未設定負責人提醒】
活動「${evt.title || '秀明活動'}」${timingDesc}（${parsedEvent.displayStr}），但目前系統中尚未指派負責人！

📌 活動名稱：${evt.title || '秀明活動'}
📅 活動時間：${parsedEvent.displayStr}
📍 集合地點：${evt.location || '神慈秀明會'}

為確保活動籌備順暢，請幹部盡速至系統指定活動負責人：
https://shumei-2025.web.app/activities/events.html`;
}

/**
 * 彙整各資料庫集合中的所有活動
 * 支援 activities_events, events, natural_events, farm_events
 * 自動跨集合依 doc.id 與 (title + date) 進行去重，並排除取消/刪除之活動
 * @param {Object} db Firestore 資料庫實例
 * @param {Object} logger
 * @returns {Promise<Array>}
 */
async function getAllEventsFromDatabase(db, logger = defaultLogger) {
  const eventDocs = [];
  const seenIds = new Set();
  const seenKeys = new Set();
  const targetCollections = ['activities_events', 'events', 'natural_events', 'farm_events'];

  for (const collName of targetCollections) {
    try {
      const snap = await db.collection(collName).get();
      snap.forEach(doc => {
        const data = doc.data() || {};

        // 排除已取消、刪除或草稿狀態之活動
        const status = (data.status || '').toLowerCase();
        if (status === 'cancelled' || status === '已取消' || data.cancelled === true || data.deleted === true) {
          return;
        }

        // 檢查是否跨 collection 重複 (同一 doc.id 或同活動名稱+日期時間)
        if (seenIds.has(doc.id)) {
          // 若同一 doc.id 已存在，將此 doc.ref 追加記錄到已存在項目的 extraRefs，方便同步更新 remindersSent
          const existing = eventDocs.find(e => e.id === doc.id);
          if (existing) {
            existing.extraRefs = existing.extraRefs || [];
            existing.extraRefs.push(doc.ref);
          }
          return;
        }

        const titleKey = (data.title || '').trim();
        const dateKey = (data.startTime || data.startDate || data.date || '').toString().trim();
        const combinedKey = (titleKey && dateKey) ? `${titleKey}_${dateKey}` : null;
        if (combinedKey && seenKeys.has(combinedKey)) {
          const existing = eventDocs.find(e => {
            const eTitle = (e.data.title || '').trim();
            const eDate = (e.data.startTime || e.data.startDate || e.data.date || '').toString().trim();
            return `${eTitle}_${eDate}` === combinedKey;
          });
          if (existing) {
            existing.extraRefs = existing.extraRefs || [];
            existing.extraRefs.push(doc.ref);
          }
          return;
        }

        seenIds.add(doc.id);
        if (combinedKey) seenKeys.add(combinedKey);

        eventDocs.push({
          id: doc.id,
          collectionName: collName,
          docRef: doc.ref,
          extraRefs: [],
          data
        });
      });
    } catch (e) {
      logger.warn(`Could not read collection ${collName}:`, e.message || e);
    }
  }

  return eventDocs;
}

/**
 * 發布 LINE 訊息給單一接收者 (含錯誤隔離與保護)
 * @param {Object} client LINE MessagingApiClient
 * @param {string} lineUserId
 * @param {string} messageText
 * @param {Object} logger
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
async function safePushMessage(client, lineUserId, messageText, logger = defaultLogger) {
  if (!client || !lineUserId) {
    return { success: false, error: 'Missing client or lineUserId' };
  }
  try {
    await client.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text: messageText }]
    });
    return { success: true, error: null };
  } catch (err) {
    logger.error(`Error pushing LINE message to ${lineUserId}:`, err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * 執行「每月 26 日活動規劃與設定負責人提醒」
 * @param {Object} params
 * @param {Object} params.db Firestore 實例
 * @param {Object} params.client LINE MessagingApiClient 實例
 * @param {boolean} [params.dryRun=false] 若為 true 則不實際發出 LINE 訊息
 * @param {Date|string} [params.forceDate] 用於測試指定日期
 * @param {Object} [params.logger]
 */
async function sendMonthlyPlanningReminder({ db, client, dryRun = false, forceDate = null, logger = defaultLogger }) {
  const taipeiDate = getTaipeiDate(forceDate || new Date());
  const { nextYear, nextMonth } = getNextMonthInfo(taipeiDate);

  logger.info(`[MonthlyReminder] Triggered at Taipei date: ${taipeiDate.year}-${taipeiDate.month}-${taipeiDate.day}, Next month: ${nextYear}-${nextMonth}`);

  // 1. 讀取 info/editors、info/admins 與待處理之 system_feedbacks
  const feedbackCol = db.collection('system_feedbacks');
  const feedbackPromise = (feedbackCol && typeof feedbackCol.where === 'function')
    ? feedbackCol.where('status', '==', 'pending').get().catch(() => null)
    : Promise.resolve(null);

  const [editorsSnap, adminsSnap, feedbackSnap] = await Promise.all([
    db.collection('info').doc('editors').get().catch(() => null),
    db.collection('info').doc('admins').get().catch(() => null),
    feedbackPromise
  ]);

  const editorsData = editorsSnap && editorsSnap.exists ? editorsSnap.data() : {};
  const adminsData = adminsSnap && adminsSnap.exists ? adminsSnap.data() : {};
  const pendingFeedbacks = [];
  if (feedbackSnap && !feedbackSnap.empty) {
    feedbackSnap.forEach(doc => {
      pendingFeedbacks.push({ id: doc.id, ...doc.data() });
    });
  }

  const { boundCadres, boundAdmins } = getActiveBoundCadresAndAdmins(editorsData, adminsData);

  // 通知對象：所有已綁定 LINE 且啟用的幹部 (涵蓋管理員與幹部)
  const recipients = boundCadres;
  const messageText = buildMonthlyPlanningMessage(nextYear, nextMonth, taipeiDate, pendingFeedbacks);

  const results = [];
  let successCount = 0;
  let failCount = 0;

  if (recipients.length === 0) {
    logger.warn('[MonthlyReminder] No bound cadres found in info/editors.');
  }

  for (const r of recipients) {
    if (dryRun) {
      results.push({ name: r.name, lineUserId: r.lineUserId, status: 'dry_run' });
      successCount++;
    } else {
      const res = await safePushMessage(client, r.lineUserId, messageText, logger);
      if (res.success) {
        successCount++;
        results.push({ name: r.name, lineUserId: r.lineUserId, status: 'sent' });
      } else {
        failCount++;
        results.push({ name: r.name, lineUserId: r.lineUserId, status: 'failed', error: res.error });
      }
    }
  }

  // 記錄通知紀錄至 notification_logs 集合
  if (!dryRun) {
    try {
      await db.collection('notification_logs').add({
        type: 'monthly_planning_reminder',
        taipeiDate: `${taipeiDate.year}-${taipeiDate.month}-${taipeiDate.day}`,
        targetNextMonth: `${nextYear}-${nextMonth}`,
        recipientCount: recipients.length,
        successCount,
        failCount,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      logger.warn('Failed to record notification log:', e);
    }
  }

  return {
    type: 'monthly_planning_reminder',
    taipeiDate: `${taipeiDate.year}-${taipeiDate.month}-${taipeiDate.day}`,
    targetNextMonth: `${nextYear}-${nextMonth}`,
    recipientsCount: recipients.length,
    successCount,
    failCount,
    dryRun,
    messagePreview: messageText,
    results
  };
}

/**
 * 執行「活動到期自動跳出通知提醒負責人」
 * @param {Object} params
 * @param {Object} params.db Firestore 實例
 * @param {Object} params.client LINE MessagingApiClient 實例
 * @param {boolean} [params.dryRun=false] 若為 true 則不實際發出 LINE 訊息
 * @param {Date|string} [params.forceDate] 用於測試指定日期
 * @param {Object} [params.logger]
 */
async function sendUpcomingActivityReminders({ db, client, dryRun = false, forceDate = null, logger = defaultLogger }) {
  const todayTaipei = getTaipeiDate(forceDate || new Date());
  logger.info(`[ActivityReminder] Checking upcoming activities for Taipei date: ${todayTaipei.year}-${todayTaipei.month}-${todayTaipei.day}`);

  // 1. 讀取所有活動資料與幹部清單
  const [eventsList, editorsSnap, adminsSnap] = await Promise.all([
    getAllEventsFromDatabase(db, logger),
    db.collection('info').doc('editors').get().catch(() => null),
    db.collection('info').doc('admins').get().catch(() => null)
  ]);

  const editorsData = editorsSnap && editorsSnap.exists ? editorsSnap.data() : {};
  const adminsData = adminsSnap && adminsSnap.exists ? adminsSnap.data() : {};
  const editorsMap = editorsData.editors || {};
  const lineUserIdToName = editorsData.lineUserIdToName || {};
  const { boundCadres, boundAdmins } = getActiveBoundCadresAndAdmins(editorsData, adminsData);

  const activitiesNotified = [];
  let totalMessagesSent = 0;
  let totalFailures = 0;

  for (const item of eventsList) {
    const evt = item.data;
    const parsed = parseEventDateTime(evt);
    if (!parsed) continue;

    // 計算活動與今日差距
    const diffDays = getDaysUntilEvent(parsed, todayTaipei);

    // 僅提醒：今日 (diffDays === 0)、明日 (diffDays === 1)、後天 (diffDays === 2)
    if (diffDays < 0 || diffDays > 2) {
      continue;
    }

    let timingKey = '';
    let timingDesc = '';
    if (diffDays === 0) {
      timingKey = 'today';
      timingDesc = '將於今日舉行';
    } else if (diffDays === 1) {
      timingKey = 'tomorrow';
      timingDesc = '即將於明日舉行';
    } else if (diffDays === 2) {
      timingKey = 'advance_2d';
      timingDesc = '預計於 2 天後舉行';
    }

    const reminderId = `${timingKey}_${parsed.dateStr}`;
    const sentList = Array.isArray(evt.remindersSent) ? evt.remindersSent : [];
    if (sentList.includes(reminderId)) {
      // 本活動在此階段已發送過提醒，略過重複通報
      continue;
    }

    const leaders = extractResponsiblePersons(evt);
    const notificationsForThisEvent = [];

    // 情境 A：尚未指定負責人 -> 向管理員/幹部發出預警
    if (leaders.length === 0) {
      const unassignedMsg = buildUnassignedLeaderFallbackMessage(evt, parsed, timingDesc);
      for (const adminCadre of boundAdmins) {
        if (dryRun) {
          notificationsForThisEvent.push({
            recipient: adminCadre.name,
            type: 'unassigned_leader_fallback',
            lineUserId: adminCadre.lineUserId,
            status: 'dry_run'
          });
          totalMessagesSent++;
        } else {
          const res = await safePushMessage(client, adminCadre.lineUserId, unassignedMsg, logger);
          if (res.success) {
            totalMessagesSent++;
            notificationsForThisEvent.push({ recipient: adminCadre.name, type: 'unassigned_leader_fallback', status: 'sent' });
          } else {
            totalFailures++;
            notificationsForThisEvent.push({ recipient: adminCadre.name, type: 'unassigned_leader_fallback', status: 'failed', error: res.error });
          }
        }
      }
    } else {
      // 情境 B：已指定負責人
      for (const leaderName of leaders) {
        const match = matchEditorLineUser(leaderName, editorsMap, lineUserIdToName);

        if (match.isBound && match.lineUserId) {
          // B1: 負責人已綁定 LINE -> 直接推播給負責人
          const msg = buildUpcomingActivityMessage(evt, parsed, match.name, timingDesc);
          if (dryRun) {
            notificationsForThisEvent.push({
              recipient: match.name,
              type: 'direct_leader_reminder',
              lineUserId: match.lineUserId,
              status: 'dry_run'
            });
            totalMessagesSent++;
          } else {
            const res = await safePushMessage(client, match.lineUserId, msg, logger);
            if (res.success) {
              totalMessagesSent++;
              notificationsForThisEvent.push({ recipient: match.name, type: 'direct_leader_reminder', status: 'sent' });
            } else {
              totalFailures++;
              notificationsForThisEvent.push({ recipient: match.name, type: 'direct_leader_reminder', status: 'failed', error: res.error });
            }
          }
        } else {
          // B2: 負責人尚未綁定 LINE -> 備援發送給幹部/管理員
          const fallbackMsg = buildUnboundFallbackMessage(evt, parsed, leaderName, timingDesc);
          for (const adminCadre of boundAdmins) {
            if (dryRun) {
              notificationsForThisEvent.push({
                recipient: adminCadre.name,
                type: 'unbound_leader_fallback',
                targetLeader: leaderName,
                lineUserId: adminCadre.lineUserId,
                status: 'dry_run'
              });
              totalMessagesSent++;
            } else {
              const res = await safePushMessage(client, adminCadre.lineUserId, fallbackMsg, logger);
              if (res.success) {
                totalMessagesSent++;
                notificationsForThisEvent.push({ recipient: adminCadre.name, type: 'unbound_leader_fallback', targetLeader: leaderName, status: 'sent' });
              } else {
                totalFailures++;
                notificationsForThisEvent.push({ recipient: adminCadre.name, type: 'unbound_leader_fallback', targetLeader: leaderName, status: 'failed', error: res.error });
              }
            }
          }
        }
      }
    }

    // 更新活動文件上的 remindersSent 清單，確保不重複提醒
    // 只有在至少一封提醒發送成功時，或是 dryRun 模擬時才標記
    const anySentSuccessfully = notificationsForThisEvent.some(n => n.status === 'sent' || n.status === 'dry_run');
    if (!dryRun && anySentSuccessfully) {
      try {
        const newSentList = [...sentList, reminderId];
        const updatePayload = {
          remindersSent: newSentList,
          lastReminderAt: new Date().toISOString()
        };
        await item.docRef.set(updatePayload, { merge: true });
        if (Array.isArray(item.extraRefs)) {
          for (const extraRef of item.extraRefs) {
            await extraRef.set(updatePayload, { merge: true }).catch(err => {
              logger.warn(`Failed to update extraRef for event ${item.id}:`, err);
            });
          }
        }
      } catch (err) {
        logger.warn(`Failed to update remindersSent for event ${item.id}:`, err);
      }
    }

    activitiesNotified.push({
      eventId: item.id,
      collection: item.collectionName,
      title: evt.title,
      eventDate: parsed.displayStr,
      timingKey,
      leaders,
      notifications: notificationsForThisEvent
    });
  }

  // 記錄至 notification_logs
  if (!dryRun && activitiesNotified.length > 0) {
    try {
      await db.collection('notification_logs').add({
        type: 'upcoming_activity_reminders',
        taipeiDate: `${todayTaipei.year}-${todayTaipei.month}-${todayTaipei.day}`,
        activitiesCount: activitiesNotified.length,
        totalMessagesSent,
        totalFailures,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      logger.warn('Failed to record activity reminder log:', e);
    }
  }

  return {
    type: 'upcoming_activity_reminders',
    taipeiDate: `${todayTaipei.year}-${todayTaipei.month}-${todayTaipei.day}`,
    activitiesNotifiedCount: activitiesNotified.length,
    totalMessagesSent,
    totalFailures,
    dryRun,
    activities: activitiesNotified
  };
}

module.exports = {
  getTaipeiDate,
  getNextMonthInfo,
  parseEventDateTime,
  getDaysUntilEvent,
  extractResponsiblePersons,
  matchEditorLineUser,
  getActiveBoundCadresAndAdmins,
  buildMonthlyPlanningMessage,
  buildUpcomingActivityMessage,
  buildUnboundFallbackMessage,
  buildUnassignedLeaderFallbackMessage,
  getAllEventsFromDatabase,
  safePushMessage,
  sendMonthlyPlanningReminder,
  sendUpcomingActivityReminders
};
