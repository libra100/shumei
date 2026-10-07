/**
 * dashboard.js - 青年部幹部總覽儀表板核心邏輯
 * 整合：GanttCraft 排程、成員意願、座談會、成員關懷密度與淨靈願景
 */

if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: 'AIzaSyA8KmjgG2SWv2XVTlqMcxxa2PbljlX7ueU',
    authDomain: 'shumei-2025.firebaseapp.com',
    databaseURL: 'https://shumei-2025.firebaseio.com',
    projectId: 'shumei-2025',
  });
}
const db = firebase.firestore();
const auth = firebase.auth();

// Global states
let allMembers = [];
let ganttAssignments = [];
let ganttVolunteers = [];
let currentYearMonth = '';

const GANTTCRAFT_URL = "https://firestore.googleapis.com/v1/projects/gantt-craft-2026/databases/(default)/documents/ganttcraft_projects/shumei";

// Authentication Listener
auth.onAuthStateChanged((user) => {
  if (user) {
    if (user.isAnonymous) {
      // 匿名登入者為一般成員，導向成員專區
      window.location.href = '/member/index.html';
      return;
    }
    const nameEl = document.getElementById('user-display-name');
    if (nameEl && user.displayName) {
      nameEl.innerText = `幹部：${user.displayName}`;
    }
    initDashboard();
  } else {
    window.location.href = '/index.html';
  }
});

function signOut() {
  auth.signOut().then(() => {
    window.location.href = '/index.html';
  });
}

function initDashboard() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  currentYearMonth = `${year}-${month}`;

  const dateStr = `${year} 年 ${month} 月 ${now.getDate()} 日 (星期${['日','一','二','三','四','五','六'][now.getDay()]})`;
  const dateEl = document.getElementById('dash-date-str');
  if (dateEl) dateEl.innerText = `${dateStr} • 本月工作月份：${currentYearMonth}`;

  const monthBadge = document.getElementById('badge-current-month');
  if (monthBadge) monthBadge.innerText = `${year}年 ${month}月份`;

  // Fetch all parallel sections
  loadMembersData();
  loadGanttCraftData();
  loadSeminarsData();
  loadJyoreiData();
}

function refreshDashboard() {
  initDashboard();
}

/**
 * 1. 成員資料與關懷連結密度
 */
async function loadMembersData() {
  try {
    const snap = await db.collection('member').get();
    allMembers = [];
    snap.forEach((doc) => {
      allMembers.push({ id: doc.id, ...doc.data() });
    });

    // 總成員數
    const totalEl = document.getElementById('kpi-total-members');
    if (totalEl) totalEl.innerText = allMembers.length;

    // 關懷密度統計：未接觸 (connect == false)
    const unconnected = allMembers.filter(m => !m.connect);
    const unconnCountEl = document.getElementById('kpi-unconnected-count');
    if (unconnCountEl) unconnCountEl.innerText = unconnected.length;

    const densityBadge = document.getElementById('density-badge');
    if (densityBadge) densityBadge.innerText = `${unconnected.length} 人需關懷`;

    // 渲染未接觸清單
    const unconnContainer = document.getElementById('unconnected-list');
    if (unconnContainer) {
      if (unconnected.length === 0) {
        unconnContainer.innerHTML = '<div class="text-muted small py-2">太棒了！目前全員皆為可接觸狀態。</div>';
      } else {
        unconnContainer.innerHTML = unconnected.map(m => `
          <div class="density-alert-item unconnected">
            <div>
              <strong class="text-white">${m.name || '未命名'}</strong>
              <span class="badge bg-secondary ms-1 py-0 px-2" style="font-size: 10px;">${m.leader || '未分組'}</span>
              <div class="small text-muted mt-1">
                入信: ${m.id.split('A')[0]} | 世話人: ${m.sewajin || '無'}
              </div>
            </div>
            <div class="text-end">
              ${m.phone ? `<a href="tel:${m.phone}" class="btn btn-sm btn-outline-success py-0 px-2" style="font-size: 11px;">通話</a>` : ''}
              ${m.adress ? `<button type="button" onclick="window.open('https://www.google.com/maps/dir//${encodeURIComponent(m.adress)}')" class="btn btn-sm btn-outline-info py-0 px-2 ms-1" style="font-size: 11px;">導航</button>` : ''}
            </div>
          </div>
        `).join('');
      }
    }

    // 渲染特殊焦點與備註成員
    const attentionMembers = allMembers.filter(m => m.note && m.note.trim().length > 0);
    const attentionContainer = document.getElementById('attention-list');
    if (attentionContainer) {
      if (attentionMembers.length === 0) {
        attentionContainer.innerHTML = '<div class="text-muted small py-2">目前無特殊備註名單。</div>';
      } else {
        attentionContainer.innerHTML = attentionMembers.slice(0, 10).map(m => `
          <div class="density-alert-item attention">
            <div>
              <strong class="text-white">${m.name || '未命名'}</strong>
              <span class="badge bg-secondary ms-1 py-0 px-2" style="font-size: 10px;">${m.leader || '未分組'}</span>
              <div class="small text-warning mt-1">
                💬 ${m.note}
              </div>
            </div>
          </div>
        `).join('');
      }
    }

  } catch (err) {
    console.error("Error loading members:", err);
  }
}

/**
 * 2. GanttCraft 排程與成員工作意願
 */
async function loadGanttCraftData() {
  const loadingEl = document.getElementById('gantt-schedule-loading');
  const summaryEl = document.getElementById('gantt-tags-summary');
  const volLoadingEl = document.getElementById('volunteers-loading');
  const volContainer = document.getElementById('volunteers-container');

  try {
    const res = await fetch(GANTTCRAFT_URL);
    if (!res.ok) throw new Error("GanttCraft project not reachable");
    const json = await res.json();

    const rawAssignments = json.fields?.shumeiAssignments?.arrayValue?.values || [];
    const rawVolunteers = json.fields?.shumeiVolunteers?.arrayValue?.values || [];

    // 1. 本月排程統計
    const tagCounts = {};
    let monthlyScheduledTotal = 0;

    rawAssignments.forEach(item => {
      const f = item.mapValue?.fields;
      if (!f) return;
      const date = f.date?.stringValue || '';
      const tagId = f.tagId?.stringValue || '其他';
      const staffId = f.staffId?.stringValue || '';

      if (date.startsWith(currentYearMonth)) {
        monthlyScheduledTotal++;
        tagCounts[tagId] = (tagCounts[tagId] || 0) + 1;
      }
    });

    const schedCountEl = document.getElementById('kpi-scheduled-count');
    if (schedCountEl) schedCountEl.innerText = monthlyScheduledTotal;

    // 渲染排程標籤摘要卡片
    if (loadingEl) loadingEl.classList.add('d-none');
    if (summaryEl) {
      summaryEl.classList.remove('d-none');
      const tagLabels = {
        'tag_worship': '參拜',
        'tag_study': '上秀勉',
        'tag_bag': '換神光袋',
        'tag_johrei': '淨靈實踐',
        'tag_nonbeliever': '未信徒引導'
      };

      const keys = Object.keys(tagCounts);
      if (keys.length === 0) {
        summaryEl.innerHTML = '<div class="col-12 text-center py-3 text-muted small">本月在 GanttCraft 尚未排入任何班表。</div>';
      } else {
        summaryEl.innerHTML = keys.map(k => {
          const label = tagLabels[k] || k;
          return `
            <div class="col-6 col-md-3">
              <div class="p-3 rounded" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
                <div class="small text-muted mb-1">${label}</div>
                <div class="h4 mb-0 fw-bold text-info">${tagCounts[k]} <span class="small font-weight-normal text-muted" style="font-size: 13px;">人次</span></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 2. 成員工作報名意願
    ganttVolunteers = [];
    rawVolunteers.forEach(item => {
      const f = item.mapValue?.fields;
      if (!f) return;
      const v = {
        memberName: f.memberName?.stringValue || '',
        memberId: f.memberId?.stringValue || '',
        tagId: f.tagId?.stringValue || '',
        tagLabel: f.tagLabel?.stringValue || '未分類工作',
        date: f.date?.stringValue || '',
        note: f.note?.stringValue || '',
        expressedAt: f.expressedAt?.stringValue || '',
        month: f.month?.stringValue || ''
      };
      if (!v.month || v.month === currentYearMonth) {
        ganttVolunteers.push(v);
      }
    });

    const volBadge = document.getElementById('volunteer-total-badge');
    if (volBadge) volBadge.innerText = `${ganttVolunteers.length} 人登記`;
    const volKpi = document.getElementById('kpi-volunteer-count');
    if (volKpi) volKpi.innerText = ganttVolunteers.length;

    if (volLoadingEl) volLoadingEl.classList.add('d-none');
    if (volContainer) {
      volContainer.classList.remove('d-none');
      if (ganttVolunteers.length === 0) {
        volContainer.innerHTML = `
          <div class="col-12 text-center py-4 text-muted small">
            <div>🕊️ 本月目前尚無成員表達工作報名意願。</div>
            <div class="mt-1" style="font-size: 11px;">成員可於個人專屬頁面 (member/index.html) 提交本月可參與之工作。</div>
          </div>
        `;
      } else {
        // Group by tagLabel / work type
        const grouped = {};
        ganttVolunteers.forEach(v => {
          const key = v.tagLabel || '其他工作';
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(v);
        });

        volContainer.innerHTML = Object.keys(grouped).map(jobTitle => {
          const volunteers = grouped[jobTitle];
          return `
            <div class="col-12 col-md-6 col-lg-4">
              <div class="volunteer-job-card">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <strong class="text-warning">${jobTitle}</strong>
                  <span class="badge bg-secondary py-1 px-2" style="font-size: 11px;">${volunteers.length} 人意願</span>
                </div>
                <div class="d-flex flex-wrap gap-1 mt-2">
                  ${volunteers.map(v => `
                    <span class="volunteer-badge" title="登記日期: ${v.expressedAt.slice(0, 10) || '無'} ${v.note ? `\n備註: ${v.note}` : ''}">
                      👤 ${v.memberName || '成員'}
                    </span>
                  `).join('')}
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

  } catch (err) {
    console.warn("Could not sync GanttCraft data:", err);
    if (loadingEl) loadingEl.innerText = "暫時無法連線至 GanttCraft 排程系統";
    if (volLoadingEl) volLoadingEl.innerText = "暫時無法讀取工作意願清單";
  }
}

/**
 * 清空本月成員工作意願 (每月清空機制)
 */
async function clearMonthlyVolunteers() {
  if (!confirm(`確定要清空本月 (${currentYearMonth}) 的所有成員報名意願嗎？\n清空後成員可重新提交意願。`)) {
    return;
  }

  try {
    const patchUrl = `${GANTTCRAFT_URL}?updateMask.fieldPaths=shumeiVolunteers`;
    const res = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          shumeiVolunteers: {
            arrayValue: { values: [] }
          }
        }
      })
    });

    if (!res.ok) throw new Error("Failed to clear volunteers on GanttCraft");
    alert("✅ 本月意願已成功清空！");
    loadGanttCraftData();
  } catch (err) {
    console.error("Error clearing volunteers:", err);
    alert("清空失敗，請確認網路連線或權限。");
  }
}

/**
 * 3. 座談會登記狀況
 */
async function loadSeminarsData() {
  const loadingEl = document.getElementById('seminars-loading');
  const container = document.getElementById('seminars-container');

  try {
    const snap = await db.collection('seminars').get();
    const seminars = [];
    snap.forEach(doc => {
      seminars.push({ id: doc.id, ...doc.data() });
    });

    // Sort descending by date
    seminars.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const recent = seminars.slice(0, 4);

    if (loadingEl) loadingEl.classList.add('d-none');
    if (container) {
      container.classList.remove('d-none');
      if (recent.length === 0) {
        container.innerHTML = '<div class="col-12 text-center py-3 text-muted small">尚無座談會登記資料。</div>';
      } else {
        container.innerHTML = recent.map(s => {
          const attendees = Array.isArray(s.attendees) ? s.attendees : [];
          return `
            <div class="col-12 col-md-6 col-lg-3">
              <div class="p-3 rounded h-100" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <strong class="text-success">${s.date || '未指定日期'}</strong>
                  <span class="badge bg-secondary py-0 px-2" style="font-size: 10px;">${attendees.length} 人參加</span>
                </div>
                <div class="small text-white fw-bold mb-1">成員：${s.member || '未提供'}</div>
                <div class="small text-muted" style="font-size: 11px;">
                  📍 ${s.location || '未提供地點'}
                </div>
                ${s.goals ? `<div class="small text-info mt-2" style="font-size: 11px;">🎯 目標: ${s.goals}</div>` : ''}
              </div>
            </div>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.warn("Error loading seminars:", err);
    if (loadingEl) loadingEl.innerText = "無法載入座談會記錄";
  }
}

/**
 * 4. 淨靈打卡願景狀況
 */
async function loadJyoreiData() {
  try {
    const totalEl = document.getElementById('dash-jyorei-total');
    const progEl = document.getElementById('dash-jyorei-progress');
    const logsEl = document.getElementById('recent-jyorei-logs');

    // 嘗試由 Firestore 讀取最近打卡記錄
    const snap = await db.collection('jyorei_logs').limit(5).get().catch(() => null);
    if (snap && !snap.empty) {
      const logs = [];
      snap.forEach(doc => logs.push(doc.data()));
      if (logsEl) {
        logsEl.innerHTML = logs.map(l => `
          <div class="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10">
            <span>${l.reporterName || '成員'} • ${l.targetName || '受者'}</span>
            <span class="text-info">${l.date || '今日'} (${l.type === 'believer' ? '信徒' : '未信徒'})</span>
          </div>
        `).join('');
      }
    } else {
      if (logsEl) {
        logsEl.innerHTML = '<div class="text-muted small">本月淨靈實踐持續推動中，全員朝 10,000 人次邁進！</div>';
      }
    }
  } catch (err) {
    console.warn("Error loading jyorei data:", err);
  }
}

/**
 * Desktop Sidebar Navigation Anchor Click
 */
function switchSidebar(el) {
  document.querySelectorAll('.dashboard-sidebar .nav-link-item').forEach(item => {
    item.classList.remove('active');
  });
  el.classList.add('active');
}
