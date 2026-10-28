/**
 * test_reminders.js
 * 
 * 全面性單元測試與邊界測試：
 * 1. 台北時區換算與推算次月
 * 2. 活動日期多元格式解析
 * 3. 負責人萃取與正則正規化
 * 4. 幹部 LINE ID 比對與模糊匹配
 * 5. 管理員與幹部備援群組識別
 * 6. 每月 26 日排程提醒模擬 (含跨年跨月)
 * 7. 即將舉行活動排程提醒模擬 (負責人已綁定、未綁定備援、未指派預警、防重複通知)
 */

const assert = require('assert');
const {
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
  sendMonthlyPlanningReminder,
  sendUpcomingActivityReminders
} = require('../activityReminders');

console.log('🧪 開始執行活動排程與負責人提醒單元測試...\n');

let passedTests = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

async function runAllTests() {
  // -------------------------------------------------------------
  // 1. 台北時間與次月推算測試
  // -------------------------------------------------------------
  await test('getTaipeiDate: 台北時區標準換算', () => {
    const d = getTaipeiDate('2026-10-26T01:00:00Z'); // UTC 01:00 = 台北 09:00
    assert.strictEqual(d.year, 2026);
    assert.strictEqual(d.month, 10);
    assert.strictEqual(d.day, 26);
    assert.strictEqual(d.hour, 9);
  });

  await test('getNextMonthInfo: 一般月份遞增 (10月 -> 11月)', () => {
    const next = getNextMonthInfo({ year: 2026, month: 10 });
    assert.strictEqual(next.nextYear, 2026);
    assert.strictEqual(next.nextMonth, 11);
  });

  await test('getNextMonthInfo: 跨年度 12 月推算次年 1 月 (12月 -> 次年1月)', () => {
    const next = getNextMonthInfo({ year: 2026, month: 12 });
    assert.strictEqual(next.nextYear, 2027);
    assert.strictEqual(next.nextMonth, 1);
  });

  // -------------------------------------------------------------
  // 2. 活動日期格式解析測試
  // -------------------------------------------------------------
  await test('parseEventDateTime: 標準 ISO 日期時間解析', () => {
    const parsed = parseEventDateTime({ startTime: '2026-10-28T14:30' });
    assert.ok(parsed);
    assert.strictEqual(parsed.dateStr, '2026-10-28');
    assert.strictEqual(parsed.timeStr, '14:30');
    assert.strictEqual(parsed.displayStr, '2026-10-28 14:30');
  });

  await test('parseEventDateTime: 分離之 date 與 time 欄位解析', () => {
    const parsed = parseEventDateTime({ date: '2026-11-05', time: '09:00 - 12:00' });
    assert.ok(parsed);
    assert.strictEqual(parsed.dateStr, '2026-11-05');
    assert.strictEqual(parsed.timeStr, '09:00');
  });

  await test('parseEventDateTime: 秀明自然農法 sessions 結構解析', () => {
    const parsed = parseEventDateTime({
      sessions: [{ date: '2026-11-15', time: '10:00 - 13:00' }]
    });
    assert.ok(parsed);
    assert.strictEqual(parsed.dateStr, '2026-11-15');
    assert.strictEqual(parsed.timeStr, '10:00');
  });

  await test('parseEventDateTime: Firestore Timestamp 物件解析', () => {
    const mockTimestamp = {
      toDate: () => new Date('2026-12-01T08:00:00+08:00')
    };
    const parsed = parseEventDateTime({ startTime: mockTimestamp });
    assert.ok(parsed);
    assert.strictEqual(parsed.dateStr, '2026-12-01');
    assert.strictEqual(parsed.timeStr, '08:00');
  });

  await test('parseEventDateTime: 序列化 Plain Seconds Timestamp 物件解析', () => {
    // 支援從 REST 或序列化資料載入的 Timestamp 物件 ({ seconds })
    const parsed = parseEventDateTime({ startTime: { seconds: 1761619200 } });
    assert.ok(parsed);
    assert.strictEqual(parsed.y, 2025);
  });

  await test('parseEventDateTime: 斜線日期格式 (2026/10/28) 與單位數小時 (9:30) 正確解析', () => {
    const p1 = parseEventDateTime({ startTime: '2026/10/28' });
    assert.ok(p1, '應能成功解析斜線日期');
    assert.strictEqual(p1.dateStr, '2026-10-28');

    const p2 = parseEventDateTime({ date: '2026/10/28', time: '9:30' });
    assert.ok(p2, '應能解析斜線日期與單位數小時');
    assert.strictEqual(p2.timeStr, '09:30');
    assert.strictEqual(p2.displayStr, '2026-10-28 09:30');

    const p3 = parseEventDateTime({ date: '2026-1-5', time: '9:00 - 12:00' });
    assert.ok(p3, '應能解析單位數月份與日期 (2026-1-5)');
    assert.strictEqual(p3.dateStr, '2026-01-05');
    assert.strictEqual(p3.timeStr, '09:00');
  });

  await test('parseEventDateTime: 中文年月日格式 (2026年10月28日 09:30) 正確解析', () => {
    const p = parseEventDateTime({ startTime: '2026年10月28日 09:30' });
    assert.ok(p);
    assert.strictEqual(p.dateStr, '2026-10-28');
    assert.strictEqual(p.timeStr, '09:30');
  });

  await test('parseEventDateTime: 空值與無效日期防護', () => {
    assert.strictEqual(parseEventDateTime(null), null);
    assert.strictEqual(parseEventDateTime({}), null);
    assert.strictEqual(parseEventDateTime({ startTime: 'not-a-date' }), null);
  });

  // -------------------------------------------------------------
  // 3. 活動距今天數計算測試
  // -------------------------------------------------------------
  await test('getDaysUntilEvent: 正確計算過去、今日、明日與未來天數', () => {
    const today = { year: 2026, month: 10, day: 25 };
    assert.strictEqual(getDaysUntilEvent({ y: 2026, m: 10, d: 24 }, today), -1); // 昨天
    assert.strictEqual(getDaysUntilEvent({ y: 2026, m: 10, d: 25 }, today), 0);  // 今天
    assert.strictEqual(getDaysUntilEvent({ y: 2026, m: 10, d: 26 }, today), 1);  // 明天
    assert.strictEqual(getDaysUntilEvent({ y: 2026, m: 10, d: 27 }, today), 2);  // 後天
    assert.strictEqual(getDaysUntilEvent({ y: 2026, m: 10, d: 31 }, today), 6);  // 6天後
    assert.strictEqual(getDaysUntilEvent({ y: 2026, m: 11, d: 1 }, today), 7);   // 跨月7天後
  });

  // -------------------------------------------------------------
  // 4. 負責人姓名萃取與清洗測試
  // -------------------------------------------------------------
  await test('extractResponsiblePersons: 單一人名、逗號分隔、頓號分隔多元解析', () => {
    assert.deepStrictEqual(extractResponsiblePersons({ responsiblePerson: '松恩' }), ['松恩']);
    assert.deepStrictEqual(extractResponsiblePersons({ 負責人: '松恩、豔良' }), ['松恩', '豔良']);
    assert.deepStrictEqual(extractResponsiblePersons({ leader: ['松恩', '小華'] }), ['松恩', '小華']);
    assert.deepStrictEqual(extractResponsiblePersons({ inCharge: '豔良, 官泰佑' }), ['豔良', '官泰佑']);
  });

  await test('extractResponsiblePersons: 排除無效停用詞與空值', () => {
    assert.deepStrictEqual(extractResponsiblePersons({ responsiblePerson: '未指定' }), []);
    assert.deepStrictEqual(extractResponsiblePersons({ 負責人: '無' }), []);
    assert.deepStrictEqual(extractResponsiblePersons({ leader: '待定' }), []);
    assert.deepStrictEqual(extractResponsiblePersons({}), []);
  });

  // -------------------------------------------------------------
  // 5. 幹部 LINE ID 比對測試
  // -------------------------------------------------------------
  const mockEditorsMap = {
    '蔡松恩': { name: '蔡松恩', lineUserId: 'U_SONGEN', lineDisplayName: '松恩', role: '管理員', active: true },
    '豔良': { name: '豔良', lineUserId: 'U_YANLIANG', lineDisplayName: '豔良', role: '青年幹部', active: true },
    '官泰佑': { name: '官泰佑', lineUserId: '', lineDisplayName: '泰佑', role: '小組長', active: true },
    '已離職幹部': { name: '已離職幹部', lineUserId: 'U_INACTIVE', lineDisplayName: '', role: '幹部', active: false }
  };

  await test('matchEditorLineUser: 完全比對成功', () => {
    const match = matchEditorLineUser('豔良', mockEditorsMap);
    assert.strictEqual(match.isBound, true);
    assert.strictEqual(match.lineUserId, 'U_YANLIANG');
  });

  await test('matchEditorLineUser: 模糊/子字串比對 (松恩 -> 蔡松恩)', () => {
    const match = matchEditorLineUser('松恩', mockEditorsMap);
    assert.strictEqual(match.isBound, true);
    assert.strictEqual(match.lineUserId, 'U_SONGEN');
  });

  await test('matchEditorLineUser: 尚未綁定 LINE ID (空字串) 返回 isBound=false', () => {
    const match = matchEditorLineUser('官泰佑', mockEditorsMap);
    assert.strictEqual(match.isBound, false);
    assert.strictEqual(match.lineUserId, null);
  });

  await test('matchEditorLineUser: 停用幹部 (active=false) 返回 isBound=false', () => {
    const match = matchEditorLineUser('已離職幹部', mockEditorsMap);
    assert.strictEqual(match.isBound, false);
    assert.strictEqual(match.lineUserId, null);
  });

  await test('matchEditorLineUser: 不在名單上的陌生人 返回 isBound=false', () => {
    const match = matchEditorLineUser('神秘路人', mockEditorsMap);
    assert.strictEqual(match.isBound, false);
  });

  await test('matchEditorLineUser: 支援以 ID 為 key 之 editorsMap (比對 v.name)', () => {
    const idKeyedMap = {
      'user_999': { name: '蔡松恩', lineUserId: 'U_SONGEN', role: '管理員', active: true }
    };
    const match = matchEditorLineUser('蔡松恩', idKeyedMap);
    assert.strictEqual(match.isBound, true);
    assert.strictEqual(match.lineUserId, 'U_SONGEN');
  });

  await test('matchEditorLineUser: 支援從 lineUserIdToName 反向查詢', () => {
    const lineMap = { 'U_REVERSE': '小美' };
    const match = matchEditorLineUser('小美', {}, lineMap);
    assert.strictEqual(match.isBound, true);
    assert.strictEqual(match.lineUserId, 'U_REVERSE');
  });

  // -------------------------------------------------------------
  // 6. 管理員與幹部備援群組篩選測試
  // -------------------------------------------------------------
  await test('getActiveBoundCadresAndAdmins: 正確篩選已綁定幹部與管理員', () => {
    const { boundCadres, boundAdmins } = getActiveBoundCadresAndAdmins({ editors: mockEditorsMap });
    // 只有 蔡松恩 與 豔良 啟用且已綁定
    assert.strictEqual(boundCadres.length, 2);
    // 管理員只有 蔡松恩
    assert.strictEqual(boundAdmins.length, 1);
    assert.strictEqual(boundAdmins[0].name, '蔡松恩');
  });

  await test('getActiveBoundCadresAndAdmins: 支援 info/admins 的 emails 白名單判定管理員', () => {
    const editors = {
      '幹部A': { name: '幹部A', email: 'admin@shumei.org', lineUserId: 'U_A', role: '幹部', active: true },
      '幹部B': { name: '幹部B', email: 'user@shumei.org', lineUserId: 'U_B', role: '幹部', active: true }
    };
    const admins = { emails: ['admin@shumei.org'] };
    const { boundCadres, boundAdmins } = getActiveBoundCadresAndAdmins({ editors }, admins);
    assert.strictEqual(boundCadres.length, 2);
    assert.strictEqual(boundAdmins.length, 1);
    assert.strictEqual(boundAdmins[0].name, '幹部A');
  });

  await test('getActiveBoundCadresAndAdmins: 若無明確管理員，以所有已綁定幹部為備援對象', () => {
    const onlyCadres = {
      '幹部A': { name: '幹部A', lineUserId: 'U_A', role: '幹部', active: true },
      '幹部B': { name: '幹部B', lineUserId: 'U_B', role: '小組長', active: true }
    };
    const { boundCadres, boundAdmins } = getActiveBoundCadresAndAdmins({ editors: onlyCadres });
    assert.strictEqual(boundCadres.length, 2);
    assert.strictEqual(boundAdmins.length, 2);
  });

  // -------------------------------------------------------------
  // 7. 訊息內容組合驗證
  // -------------------------------------------------------------
  await test('buildMonthlyPlanningMessage: 包含正確次月提醒與活動管理連結', () => {
    const msg = buildMonthlyPlanningMessage(2026, 11);
    assert.ok(msg.includes('2026 年 11 月'));
    assert.ok(msg.includes('負責人'));
    assert.ok(msg.includes('https://shumei-2025.web.app/activities/events.html'));
  });

  await test('buildMonthlyPlanningMessage: 包含待確認使用者功能升級建議彙整與分類標籤', () => {
    const feedbacks = [
      { userName: '蔡松恩', content: '希望願書能多辨識右下角的助教師印章', category: '入信願書' },
      { userName: '小明', content: '希望座談會可匯出Excel', category: '座談會' }
    ];
    const msg = buildMonthlyPlanningMessage(2026, 11, null, feedbacks);
    assert.ok(msg.includes('本月使用者功能升級建議彙整'));
    assert.ok(msg.includes('📑 【入信願書】'));
    assert.ok(msg.includes('🍑 【座談會】'));
    assert.ok(msg.includes('蔡松恩'));
    assert.ok(msg.includes('小明'));
  });

  await test('buildUpcomingActivityMessage: 包含負責人姓名、時間與活動名稱', () => {
    const msg = buildUpcomingActivityMessage(
      { title: '青年春季研修', location: '台中會館', category: '研修營隊', registeredCount: 25 },
      { displayStr: '2026-10-28 09:00' },
      '松恩',
      '於明日即將舉行'
    );
    assert.ok(msg.includes('松恩'));
    assert.ok(msg.includes('青年春季研修'));
    assert.ok(msg.includes('台中會館'));
    assert.ok(msg.includes('25 人'));
  });

  await test('buildUnboundFallbackMessage: 包含尚未綁定提醒與指導指令', () => {
    const msg = buildUnboundFallbackMessage(
      { title: '自然農法工作坊' },
      { displayStr: '2026-10-27 10:00' },
      '泰佑',
      '於明日即將舉行'
    );
    assert.ok(msg.includes('泰佑'));
    assert.ok(msg.includes('尚未綁定 LINE'));
    assert.ok(msg.includes('幹部認證'));
  });

  // -------------------------------------------------------------
  // 8. 模擬執行每月 26 日提醒排程
  // -------------------------------------------------------------
  await test('sendMonthlyPlanningReminder: 模擬執行發送推播', async () => {
    const pushedMessages = [];
    const mockClient = {
      pushMessage: async ({ to, messages }) => {
        pushedMessages.push({ to, text: messages[0].text });
        return {};
      }
    };

    const mockDb = {
      collection: (name) => {
        if (name === 'info') {
          return {
            doc: (docId) => ({
              get: async () => {
                if (docId === 'editors') {
                  return {
                    exists: true,
                    data: () => ({ editors: mockEditorsMap })
                  };
                }
                return { exists: false, data: () => ({}) };
              }
            })
          };
        }
        if (name === 'system_feedbacks') {
          return {
            where: (field, op, val) => ({
              get: async () => ({
                empty: false,
                forEach: (cb) => {
                  cb({
                    id: 'fb_1',
                    data: () => ({
                      content: '希望可以增加活動提醒自訂時間',
                      userName: '小明'
                    })
                  });
                }
              })
            })
          };
        }
        if (name === 'notification_logs') {
          return {
            add: async (data) => ({ id: 'log_123' })
          };
        }
        return {
          doc: () => ({ get: async () => ({ exists: false }) }),
          where: () => ({ get: async () => ({ empty: true, forEach: () => {} }) })
        };
      }
    };

    const result = await sendMonthlyPlanningReminder({
      db: mockDb,
      client: mockClient,
      dryRun: false,
      forceDate: '2026-10-26T09:00:00+08:00'
    });

    assert.strictEqual(result.recipientsCount, 2);
    assert.strictEqual(result.successCount, 2);
    assert.strictEqual(pushedMessages.length, 2);
    assert.ok(pushedMessages[0].text.includes('11 月活動規劃'));
    assert.ok(pushedMessages[0].text.includes('本月使用者功能升級建議彙整'));
    assert.ok(pushedMessages[0].text.includes('希望可以增加活動提醒自訂時間'));
  });

  // -------------------------------------------------------------
  // 9. 模擬執行活動即將舉行提醒 (含直推、備援、防重覆)
  // -------------------------------------------------------------
  await test('sendUpcomingActivityReminders: 模擬多情境活動提醒發送', async () => {
    const pushedMessages = [];
    const mockClient = {
      pushMessage: async ({ to, messages }) => {
        pushedMessages.push({ to, text: messages[0].text });
        return {};
      }
    };

    const mockEvents = [
      // 活動 1：今日活動，負責人為「松恩」(已綁定 U_SONGEN)
      {
        id: 'evt_1',
        title: '今日座談',
        startTime: '2026-10-25T14:00',
        responsiblePerson: '松恩',
        remindersSent: []
      },
      // 活動 2：明日活動，負責人為「官泰佑」(尚未綁定，應備援推給管理員 蔡松恩)
      {
        id: 'evt_2',
        title: '明日農事',
        startTime: '2026-10-26T09:00',
        responsiblePerson: '官泰佑',
        remindersSent: []
      },
      // 活動 3：後天活動，尚未指派負責人 (應發出預警給管理員 蔡松恩)
      {
        id: 'evt_3',
        title: '後天大型研修',
        startTime: '2026-10-27T08:30',
        responsiblePerson: '',
        remindersSent: []
      },
      // 活動 4：下週活動 (5 天後，不應觸發通知)
      {
        id: 'evt_4',
        title: '下週春季大祭',
        startTime: '2026-10-30T09:00',
        responsiblePerson: '豔良',
        remindersSent: []
      },
      // 活動 5：今日活動，但已發送過提醒 (防重複，不應再次發送)
      {
        id: 'evt_5',
        title: '已通知過的活動',
        startTime: '2026-10-25T10:00',
        responsiblePerson: '豔良',
        remindersSent: ['today_2026-10-25']
      }
    ];

    const updatedDocs = {};
    const mockDb = {
      collection: (name) => {
        if (name === 'activities_events') {
          return {
            get: async () => ({
              forEach: (cb) => {
                mockEvents.forEach(evt => {
                  cb({
                    id: evt.id,
                    ref: {
                      set: async (data, opts) => {
                        updatedDocs[evt.id] = data;
                      }
                    },
                    data: () => evt
                  });
                });
              }
            })
          };
        }
        if (name === 'events' || name === 'natural_events') {
          return {
            get: async () => ({
              forEach: () => {}
            })
          };
        }
        if (name === 'info') {
          return {
            doc: (docId) => ({
              get: async () => {
                if (docId === 'editors') {
                  return {
                    exists: true,
                    data: () => ({ editors: mockEditorsMap })
                  };
                }
                return { exists: false, data: () => ({}) };
              }
            })
          };
        }
        if (name === 'notification_logs') {
          return {
            add: async (data) => ({ id: 'log_act_123' })
          };
        }
        return { doc: () => ({ get: async () => ({ exists: false }) }) };
      }
    };

    const result = await sendUpcomingActivityReminders({
      db: mockDb,
      client: mockClient,
      dryRun: false,
      forceDate: '2026-10-25T08:30:00+08:00' // 今日為 10-25
    });

    // 應處理 evt_1, evt_2, evt_3
    assert.strictEqual(result.activitiesNotifiedCount, 3);
    assert.strictEqual(pushedMessages.length, 3);

    // 1. 直推給松恩 (evt_1)
    const msg1 = pushedMessages.find(m => m.to === 'U_SONGEN' && m.text.includes('今日座談'));
    assert.ok(msg1, '應直接推播給已綁定之負責人 松恩');
    assert.ok(msg1.text.includes('於今日舉行'));

    // 2. 備援給管理員 (蔡松恩 U_SONGEN)，因 官泰佑 尚未綁定 LINE (evt_2)
    const msg2 = pushedMessages.find(m => m.to === 'U_SONGEN' && m.text.includes('官泰佑'));
    assert.ok(msg2, '應發出負責人尚未綁定備援通報給管理員');
    assert.ok(msg2.text.includes('明日農事'));

    // 3. 預警給管理員 (蔡松恩 U_SONGEN)，因未指定負責人 (evt_3)
    const msg3 = pushedMessages.find(m => m.to === 'U_SONGEN' && (m.text.includes('未設定負責人') || m.text.includes('尚未指派負責人')));
    assert.ok(msg3, '應發出活動未設定負責人預警給管理員');
    assert.ok(msg3.text.includes('後天大型研修'));

    // 4. 驗證資料庫更新 remindersSent
    assert.ok(updatedDocs['evt_1'].remindersSent.includes('today_2026-10-25'));
    assert.ok(updatedDocs['evt_2'].remindersSent.includes('tomorrow_2026-10-26'));
    assert.ok(updatedDocs['evt_3'].remindersSent.includes('advance_2d_2026-10-27'));
  });

  // -------------------------------------------------------------
  // 10. 跨集合去重與取消活動過濾測試 (getAllEventsFromDatabase)
  // -------------------------------------------------------------
  await test('getAllEventsFromDatabase: 跨 activities_events 與 events 自動去重並過濾取消活動', async () => {
    const mockDb = {
      collection: (name) => ({
        get: async () => ({
          forEach: (cb) => {
            if (name === 'activities_events') {
              cb({ id: 'evt_dup_1', ref: { id: 'ref_act' }, data: () => ({ id: 'evt_dup_1', title: '雙重寫入活動', startTime: '2026-10-25T14:00' }) });
              cb({ id: 'evt_cancelled', ref: { id: 'ref_c' }, data: () => ({ id: 'evt_cancelled', title: '已取消活動', status: 'cancelled', startTime: '2026-10-25T15:00' }) });
            }
            if (name === 'events') {
              cb({ id: 'evt_dup_1', ref: { id: 'ref_events' }, data: () => ({ id: 'evt_dup_1', title: '雙重寫入活動', startTime: '2026-10-25T14:00' }) });
            }
          }
        })
      })
    };

    const events = await getAllEventsFromDatabase(mockDb);
    // 應過濾已取消活動，且同 ID 活動僅回傳 1 筆
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].id, 'evt_dup_1');
    assert.strictEqual(events[0].extraRefs.length, 1);
  });

  // -------------------------------------------------------------
  // 11. 跨集合多文件推播防重複與雙向更新測試
  // -------------------------------------------------------------
  await test('sendUpcomingActivityReminders: 跨集合雙重存在活動僅發送 1 封通知且雙向同步更新', async () => {
    const pushedMessages = [];
    const mockClient = {
      pushMessage: async ({ to, messages }) => {
        pushedMessages.push({ to, text: messages[0].text });
        return {};
      }
    };

    const updatedRefs = [];
    const mockEvtData = {
      id: 'dup_evt_100',
      title: '跨集合測試座談',
      startTime: '2026-10-25T14:00',
      responsiblePerson: '松恩',
      remindersSent: []
    };

    const mockDb = {
      collection: (name) => {
        if (name === 'activities_events' || name === 'events') {
          return {
            get: async () => ({
              forEach: (cb) => {
                cb({
                  id: mockEvtData.id,
                  ref: {
                    id: `${name}_ref`,
                    set: async (payload) => {
                      updatedRefs.push({ name, payload });
                    }
                  },
                  data: () => mockEvtData
                });
              }
            })
          };
        }
        if (name === 'info') {
          return {
            doc: () => ({
              get: async () => ({
                exists: true,
                data: () => ({ editors: mockEditorsMap })
              })
            })
          };
        }
        return { doc: () => ({ get: async () => ({ exists: false }) }), add: async () => {} };
      }
    };

    const result = await sendUpcomingActivityReminders({
      db: mockDb,
      client: mockClient,
      dryRun: false,
      forceDate: '2026-10-25T08:30:00+08:00'
    });

    // 嚴格檢驗：僅發送 1 封推播，絕不重複
    assert.strictEqual(result.activitiesNotifiedCount, 1);
    assert.strictEqual(pushedMessages.length, 1);
    assert.strictEqual(pushedMessages[0].to, 'U_SONGEN');

    // 檢驗 activities_events 與 events 之 document ref 均有被同步寫入 remindersSent
    assert.strictEqual(updatedRefs.length, 2);
    assert.ok(updatedRefs.some(r => r.name === 'activities_events'));
    assert.ok(updatedRefs.some(r => r.name === 'events'));
  });

  // -------------------------------------------------------------
  // 12. 推播失敗時不標記 remindersSent 容錯重試測試
  // -------------------------------------------------------------
  await test('sendUpcomingActivityReminders: 推播失敗時不寫入 remindersSent 以利下次重試', async () => {
    const failingClient = {
      pushMessage: async () => {
        throw new Error('LINE API 500 Network Timeout');
      }
    };

    let setCalled = false;
    const mockDb = {
      collection: (name) => {
        if (name === 'activities_events') {
          return {
            get: async () => ({
              forEach: (cb) => {
                cb({
                  id: 'fail_evt',
                  ref: { set: async () => { setCalled = true; } },
                  data: () => ({
                    id: 'fail_evt',
                    title: '重試測試活動',
                    startTime: '2026-10-25T14:00',
                    responsiblePerson: '松恩',
                    remindersSent: []
                  })
                });
              }
            })
          };
        }
        if (name === 'info') {
          return {
            doc: () => ({
              get: async () => ({
                exists: true,
                data: () => ({ editors: mockEditorsMap })
              })
            })
          };
        }
        return { doc: () => ({ get: async () => ({ exists: false }) }), add: async () => {} };
      }
    };

    const result = await sendUpcomingActivityReminders({
      db: mockDb,
      client: failingClient,
      dryRun: false,
      forceDate: '2026-10-25T08:30:00+08:00'
    });

    assert.strictEqual(result.totalFailures, 1);
    assert.strictEqual(result.totalMessagesSent, 0);
    // 關鍵驗證：因為推送失敗，不應更新 remindersSent
    assert.strictEqual(setCalled, false);
  });

  console.log(`\n🎉 全部 ${passedTests} 項單元測試順利通過！`);
}

runAllTests().catch(err => {
  console.error('\n❌ 測試執行失敗:', err);
  process.exit(1);
});

