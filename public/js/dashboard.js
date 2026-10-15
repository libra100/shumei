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
let editingJobsList = [];
let manageJobsModalInstance = null;

const DEFAULT_RECRUITMENT_JOBS = [
  { id: 'tag_worship', label: '參拜護持', icon: '🙏', desc: '參拜日前置準備、引導與現場奉事協助', active: true },
  { id: 'tag_study', label: '上秀勉', icon: '📖', desc: '秀勉學習共修、教誨研讀與心得分享', active: true },
  { id: 'tag_bag', label: '換神光袋', icon: '✨', desc: '定期更換神光袋、儀式配合與協助', active: true },
  { id: 'tag_johrei', label: '淨靈實踐推廣', icon: '☀️', desc: '道場或定點結伴淨靈、施光實踐行動', active: true },
  { id: 'tag_nonbeliever', label: '未信徒引導接待', icon: '🤝', desc: '新朋友初次到訪引導、體驗與交流分享', active: true },
  { id: 'tag_counter', label: '青年櫃檯接待值班', icon: '🛎️', desc: '週末青年輪值櫃檯、簽到引導與茶水接待', active: true },
  { id: 'tag_farm', label: '自然農法農事協力', icon: '🌾', desc: '秀明自然農法田間除草、播種與採收護持', active: true }
];

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
      const tagLabels = await getDynamicTagLabels();

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

/**
 * 5. 工作招募項目管理與動態標籤
 */
async function getDynamicTagLabels() {
  const map = {
    'tag_worship': '參拜護持',
    'tag_study': '上秀勉',
    'tag_bag': '換神光袋',
    'tag_johrei': '淨靈實踐',
    'tag_nonbeliever': '未信徒引導',
    'tag_counter': '青年櫃檯接待',
    'tag_farm': '自然農法協力'
  };
  try {
    const doc = await db.collection('info').doc('recruitment_jobs').get();
    if (doc.exists && Array.isArray(doc.data().jobs)) {
      doc.data().jobs.forEach(j => {
        if (j.id && j.label) {
          map[j.id] = j.label;
        }
      });
    }
  } catch (e) {
    console.warn("Could not fetch recruitment_jobs for tag labels:", e);
  }
  return map;
}

async function openManageJobsModal() {
  const modalEl = document.getElementById('manageJobsModal');
  if (!modalEl) return;
  if (!manageJobsModalInstance) {
    manageJobsModalInstance = new bootstrap.Modal(modalEl);
  }

  const listEl = document.getElementById('manage-jobs-list');
  const statusEl = document.getElementById('manage-jobs-status');
  if (statusEl) statusEl.innerText = '讀取中...';
  if (listEl) {
    listEl.innerHTML = '<div class="text-center py-4 text-muted small"><div class="spinner-border spinner-border-sm text-warning me-1"></div>正在載入目前招募項目...</div>';
  }

  manageJobsModalInstance.show();

  try {
    const doc = await db.collection('info').doc('recruitment_jobs').get();
    if (doc.exists && Array.isArray(doc.data().jobs) && doc.data().jobs.length > 0) {
      editingJobsList = JSON.parse(JSON.stringify(doc.data().jobs));
    } else {
      editingJobsList = JSON.parse(JSON.stringify(DEFAULT_RECRUITMENT_JOBS));
    }
    if (statusEl) statusEl.innerText = `目前共 ${editingJobsList.length} 項`;
    renderJobsEditList();
  } catch (err) {
    console.error("Error loading recruitment jobs:", err);
    editingJobsList = JSON.parse(JSON.stringify(DEFAULT_RECRUITMENT_JOBS));
    if (statusEl) statusEl.innerText = '使用預設設定';
    renderJobsEditList();
  }
}

function renderJobsEditList() {
  const listEl = document.getElementById('manage-jobs-list');
  if (!listEl) return;

  if (editingJobsList.length === 0) {
    listEl.innerHTML = `
      <div class="text-center py-4 text-muted small">
        目前無任何招募項目，點擊下方「＋ 新增招募項目」或「恢復預設 7 項」以建立項目。
      </div>
    `;
    return;
  }

  listEl.innerHTML = editingJobsList.map((job, idx) => `
    <div class="p-3 rounded job-edit-card" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); transition: border-color 0.2s;" data-idx="${idx}">
      <div class="row g-2 align-items-center">
        <div class="col-3 col-sm-2 col-md-1 text-center">
          <label class="form-label text-muted small d-block mb-1">圖示</label>
          <input type="text" class="form-control text-center px-1 job-icon-input" value="${escapeHtml(job.icon || '📌')}" maxlength="4" style="background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(255,255,255,0.2); font-size: 18px;" onchange="syncCurrentJobRow(${idx}, 'icon', this.value)">
        </div>
        <div class="col-9 col-sm-10 col-md-4">
          <label class="form-label text-muted small mb-1">項目名稱 (標題)</label>
          <input type="text" class="form-control job-label-input" value="${escapeHtml(job.label || '')}" placeholder="例：參拜護持" style="background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(255,255,255,0.2);" onchange="syncCurrentJobRow(${idx}, 'label', this.value)">
        </div>
        <div class="col-12 col-md-5">
          <label class="form-label text-muted small mb-1">工作說明與注意事項</label>
          <input type="text" class="form-control job-desc-input" value="${escapeHtml(job.desc || '')}" placeholder="例：參拜日前置準備、引導與現場奉事協助" style="background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(255,255,255,0.2);" onchange="syncCurrentJobRow(${idx}, 'desc', this.value)">
        </div>
        <div class="col-12 col-md-2 d-flex align-items-center justify-content-end gap-3 pt-2 pt-md-4">
          <div class="form-check form-switch mb-0" title="是否開放信徒報名">
            <input class="form-check-input job-active-switch" type="checkbox" id="switch-job-${idx}" ${job.active !== false ? 'checked' : ''} onchange="syncCurrentJobRow(${idx}, 'active', this.checked)">
            <label class="form-check-label small text-muted" for="switch-job-${idx}">${job.active !== false ? '開啟' : '隱藏'}</label>
          </div>
          <button type="button" class="btn btn-sm btn-outline-danger p-1" onclick="deleteJobRow(${idx})" title="刪除此項目">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function syncCurrentJobRow(idx, field, value) {
  if (editingJobsList[idx]) {
    editingJobsList[idx][field] = value;
    if (field === 'active') {
      const labelEl = document.querySelector(`label[for="switch-job-${idx}"]`);
      if (labelEl) labelEl.innerText = value ? '開啟' : '隱藏';
    }
  }
}

function syncAllRowsFromDOM() {
  const cards = document.querySelectorAll('.job-edit-card');
  cards.forEach(card => {
    const idx = parseInt(card.getAttribute('data-idx'), 10);
    if (editingJobsList[idx]) {
      const icon = card.querySelector('.job-icon-input')?.value?.trim() || '📌';
      const label = card.querySelector('.job-label-input')?.value?.trim() || '';
      const desc = card.querySelector('.job-desc-input')?.value?.trim() || '';
      const active = card.querySelector('.job-active-switch')?.checked ?? true;
      editingJobsList[idx].icon = icon;
      editingJobsList[idx].label = label;
      editingJobsList[idx].desc = desc;
      editingJobsList[idx].active = active;
    }
  });
}

function addNewJobRow() {
  syncAllRowsFromDOM();
  editingJobsList.push({
    id: 'tag_custom_' + Date.now().toString(36),
    label: '',
    icon: '📌',
    desc: '',
    active: true
  });
  renderJobsEditList();
  const statusEl = document.getElementById('manage-jobs-status');
  if (statusEl) statusEl.innerText = `目前共 ${editingJobsList.length} 項`;

  setTimeout(() => {
    const inputs = document.querySelectorAll('.job-label-input');
    if (inputs.length > 0) {
      inputs[inputs.length - 1].focus();
    }
  }, 100);
}

function deleteJobRow(idx) {
  syncAllRowsFromDOM();
  if (editingJobsList[idx]) {
    const name = editingJobsList[idx].label || '此項目';
    if (!confirm(`確定要刪除「${name}」嗎？`)) return;
    editingJobsList.splice(idx, 1);
    renderJobsEditList();
    const statusEl = document.getElementById('manage-jobs-status');
    if (statusEl) statusEl.innerText = `目前共 ${editingJobsList.length} 項`;
  }
}

function resetToDefaultJobs() {
  if (!confirm("確定要將項目重設為預設的 7 項活動招募嗎？\n（未儲存前不會影響線上設定）")) return;
  editingJobsList = JSON.parse(JSON.stringify(DEFAULT_RECRUITMENT_JOBS));
  renderJobsEditList();
  const statusEl = document.getElementById('manage-jobs-status');
  if (statusEl) statusEl.innerText = `目前共 ${editingJobsList.length} 項 (預設)`;
}

async function saveRecruitmentJobs() {
  syncAllRowsFromDOM();

  for (let i = 0; i < editingJobsList.length; i++) {
    const item = editingJobsList[i];
    if (!item.label || item.label.trim() === '') {
      alert(`第 ${i + 1} 個項目的名稱不可為空！`);
      return;
    }
    if (!item.id) {
      item.id = 'tag_custom_' + Date.now().toString(36) + '_' + i;
    }
    item.label = item.label.trim();
    item.desc = (item.desc || '').trim();
    item.icon = (item.icon || '📌').trim();
  }

  const saveBtn = document.getElementById('btn-save-jobs');
  const statusEl = document.getElementById('manage-jobs-status');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerText = '儲存發布中...';
  }
  if (statusEl) statusEl.innerText = '正在寫入雲端資料庫...';

  try {
    const user = auth.currentUser;
    await db.collection('info').doc('recruitment_jobs').set({
      jobs: editingJobsList,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: user?.displayName || user?.email || '小組長'
    });

    if (statusEl) statusEl.innerText = '✅ 儲存成功！';
    alert("✅ 招募工作項目已成功發布！\n一般信徒頁面 (member/index.html) 已即時同步最新內容。");
    if (manageJobsModalInstance) {
      manageJobsModalInstance.hide();
    }
    loadGanttCraftData();
  } catch (err) {
    console.error("Error saving recruitment jobs:", err);
    alert("❌ 儲存失敗：" + (err.message || '請檢查網路連線或權限'));
    if (statusEl) statusEl.innerText = '儲存失敗';
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = '💾 儲存並發布';
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
