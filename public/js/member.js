/**
 * member.js - 秀明青年成員專屬頁面核心邏輯
 * 包含：身份綁定/選取、個人排班查詢、各項工作招募報名與意願提交
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

const GANTTCRAFT_URL = "https://firestore.googleapis.com/v1/projects/gantt-craft-2026/databases/(default)/documents/ganttcraft_projects/shumei";

// Standard Recruitment Jobs Definition
const RECRUITMENT_JOBS = [
  { id: 'tag_worship', label: '參拜護持', icon: '🙏', desc: '參拜日前置準備、引導與現場奉事協助' },
  { id: 'tag_study', label: '上秀勉', icon: '📖', desc: '秀勉學習共修、教誨研讀與心得分享' },
  { id: 'tag_bag', label: '換神光袋', icon: '✨', desc: '定期更換神光袋、儀式配合與協助' },
  { id: 'tag_johrei', label: '淨靈實踐推廣', icon: '☀️', desc: '道場或定點結伴淨靈、施光實踐行動' },
  { id: 'tag_nonbeliever', label: '未信徒引導接待', icon: '🤝', desc: '新朋友初次到訪引導、體驗與交流分享' },
  { id: 'tag_counter', label: '青年櫃檯接待值班', icon: '🛎️', desc: '週末青年輪值櫃檯、簽到引導與茶水接待' },
  { id: 'tag_farm', label: '自然農法農事協力', icon: '🌾', desc: '秀明自然農法田間除草、播種與採收護持' }
];

let currentMember = null; // { id, name, part, leader }
let allMembersCache = [];
let allVolunteers = [];
let myAssignments = [];
let currentYearMonth = '';
let identityModalInstance = null;
let volunteerModalInstance = null;

auth.onAuthStateChanged((user) => {
  if (user) {
    initMemberPage(user);
  } else {
    window.location.href = '/index.html';
  }
});

function signOut() {
  auth.signOut().then(() => {
    localStorage.removeItem('SHUMEI_MEMBER_IDENTITY');
    window.location.href = '/index.html';
  });
}

function initMemberPage(user) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  currentYearMonth = `${year}-${month}`;

  const monthBadge = document.getElementById('current-month-badge');
  if (monthBadge) monthBadge.innerText = `${year}年 ${month}月排程與招募`;

  const modalEl = document.getElementById('identityModal');
  if (modalEl) identityModalInstance = new bootstrap.Modal(modalEl);

  const volModalEl = document.getElementById('volunteerModal');
  if (volModalEl) volunteerModalInstance = new bootstrap.Modal(volModalEl);

  // 1. 讀取現有選定身份
  const savedIdentity = localStorage.getItem('SHUMEI_MEMBER_IDENTITY');
  if (savedIdentity) {
    try {
      currentMember = JSON.parse(savedIdentity);
    } catch (e) {
      currentMember = null;
    }
  }

  // 2. 載入名冊快取
  loadMemberList().then(() => {
    if (!currentMember) {
      openIdentitySelector();
    } else {
      updateMemberUI();
      loadGanttCraftMemberData();
    }
  });
}

async function loadMemberList() {
  try {
    const snap = await db.collection('member').get();
    allMembersCache = [];
    snap.forEach(doc => {
      allMembersCache.push({ id: doc.id, ...doc.data() });
    });

    const select = document.getElementById('select-member-name');
    if (select) {
      select.innerHTML = '<option value="" disabled selected>請選擇您的姓名</option>';
      allMembersCache
        .filter(m => m.name)
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
        .forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.innerText = `${m.name} (${m.leader || '未分組'} - 入信 ${m.id.split('A')[0]})`;
          select.appendChild(opt);
        });
    }
  } catch (err) {
    console.warn("Could not load member list:", err);
  }
}

function openIdentitySelector() {
  if (identityModalInstance) {
    identityModalInstance.show();
  }
}

function confirmIdentity() {
  const select = document.getElementById('select-member-name');
  const selectedId = select.value;
  if (!selectedId) {
    alert("請先選取您的姓名！");
    return;
  }

  const found = allMembersCache.find(m => m.id === selectedId);
  if (found) {
    currentMember = {
      id: found.id,
      name: found.name,
      leader: found.leader || '',
      part: found.part || ''
    };
    localStorage.setItem('SHUMEI_MEMBER_IDENTITY', JSON.stringify(currentMember));
    if (identityModalInstance) identityModalInstance.hide();
    updateMemberUI();
    loadGanttCraftMemberData();
  }
}

function updateMemberUI() {
  if (!currentMember) return;

  const btn = document.getElementById('btn-identity');
  if (btn) btn.innerText = `👤 ${currentMember.name}`;

  const welcome = document.getElementById('welcome-name');
  if (welcome) welcome.innerText = `你好，${currentMember.name} 👋`;

  const subtext = document.getElementById('member-subtext');
  if (subtext) subtext.innerText = `青年部 • ${currentMember.leader || '未分組'} | 入信編號：${currentMember.id.split('A')[0]}`;
}

/**
 * 載入 GanttCraft 資料（我的排班 + 意願登記狀況）
 */
async function loadGanttCraftMemberData() {
  if (!currentMember) return;

  const loadingEl = document.getElementById('my-schedule-loading');
  const listEl = document.getElementById('my-schedule-list');

  try {
    const res = await fetch(GANTTCRAFT_URL);
    if (!res.ok) throw new Error("GanttCraft response was not ok");
    const json = await res.json();

    const rawAssignments = json.fields?.shumeiAssignments?.arrayValue?.values || [];
    const rawVolunteers = json.fields?.shumeiVolunteers?.arrayValue?.values || [];

    // 1. 個人排定班表
    myAssignments = [];
    rawAssignments.forEach(item => {
      const f = item.mapValue?.fields;
      if (!f) return;
      const staffId = f.staffId?.stringValue || '';
      const date = f.date?.stringValue || '';
      const tagId = f.tagId?.stringValue || '';

      const matchId = currentMember.id;
      const matchShortId = currentMember.id.split('A')[0];
      const matchName = currentMember.name;

      if (date.startsWith(currentYearMonth)) {
        if (staffId === matchId || staffId === matchShortId || staffId === matchName) {
          myAssignments.push({ date, tagId });
        }
      }
    });

    const countEl = document.getElementById('my-schedule-count');
    if (countEl) countEl.innerText = `${myAssignments.length} 項安排`;

    if (loadingEl) loadingEl.classList.add('d-none');
    if (listEl) {
      listEl.classList.remove('d-none');
      if (myAssignments.length === 0) {
        listEl.innerHTML = `
          <div class="text-center py-3 text-muted small">
            <div>🕊️ 本月目前尚未安排您的排班工作。</div>
            <div class="mt-1" style="font-size: 11px;">歡迎在下方表達您可以協助的工作項目，幹部將會協助排入！</div>
          </div>
        `;
      } else {
        const tagMap = {
          'tag_worship': '參拜護持',
          'tag_study': '上秀勉',
          'tag_bag': '換神光袋',
          'tag_johrei': '淨靈實踐',
          'tag_nonbeliever': '未信徒引導'
        };

        listEl.innerHTML = myAssignments.map(a => `
          <div class="d-flex align-items-center justify-content-between p-2 mb-2 rounded" style="background: rgba(0, 243, 255, 0.06); border: 1px solid rgba(0, 243, 255, 0.2);">
            <div>
              <strong class="text-info">${tagMap[a.tagId] || a.tagId}</strong>
              <div class="small text-muted">排定日期：${a.date}</div>
            </div>
            <span class="badge bg-success py-1 px-2" style="font-size: 11px;">✓ 已排定</span>
          </div>
        `).join('');
      }
    }

    // 2. 意願登記表
    allVolunteers = [];
    rawVolunteers.forEach(item => {
      const f = item.mapValue?.fields;
      if (!f) return;
      allVolunteers.push({
        memberName: f.memberName?.stringValue || '',
        memberId: f.memberId?.stringValue || '',
        tagId: f.tagId?.stringValue || '',
        tagLabel: f.tagLabel?.stringValue || '',
        date: f.date?.stringValue || '',
        note: f.note?.stringValue || '',
        month: f.month?.stringValue || ''
      });
    });

    renderAvailableJobs();

  } catch (err) {
    console.warn("Could not sync member schedule:", err);
    if (loadingEl) loadingEl.innerText = "暫時無法讀取排程資料";
  }
}

/**
 * 渲染招募工作卡片清單
 */
function renderAvailableJobs() {
  const container = document.getElementById('available-jobs-container');
  if (!container || !currentMember) return;

  const myVolunteeredTags = new Set(
    allVolunteers
      .filter(v => (!v.month || v.month === currentYearMonth) && (v.memberId === currentMember.id || v.memberName === currentMember.name))
      .map(v => v.tagId)
  );

  const badgeEl = document.getElementById('my-volunteer-badge');
  if (badgeEl) badgeEl.innerText = `已登記 ${myVolunteeredTags.size} 項`;

  container.innerHTML = RECRUITMENT_JOBS.map(job => {
    const isVolunteered = myVolunteeredTags.has(job.id);
    return `
      <div class="work-card ${isVolunteered ? 'volunteer-active' : ''}">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div>
            <div class="h6 mb-1 fw-bold ${isVolunteered ? 'text-success' : 'text-white'}">
              ${job.icon} ${job.label}
            </div>
            <p class="text-muted small mb-0">${job.desc}</p>
          </div>
          <div class="flex-shrink-0">
            ${isVolunteered ? `
              <button class="btn btn-sm btn-outline-danger interactive" onclick="cancelVolunteerInterest('${job.id}')" style="font-size: 12px; border-radius: 8px;">
                取消意願
              </button>
            ` : `
              <button class="btn btn-sm btn-outline-warning interactive" onclick="openVolunteerModal('${job.id}', '${job.label}')" style="font-size: 12px; border-radius: 8px;">
                ✋ 我可以參與
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openVolunteerModal(tagId, tagLabel) {
  document.getElementById('vol-tag-id').value = tagId;
  document.getElementById('vol-tag-label').value = tagLabel;
  document.getElementById('vol-modal-job-name').innerText = tagLabel;
  document.getElementById('vol-date-note').value = '';
  document.getElementById('vol-comment').value = '';

  if (volunteerModalInstance) {
    volunteerModalInstance.show();
  }
}

/**
 * 提交意願至 GanttCraft REST API
 */
async function submitVolunteerInterest() {
  if (!currentMember) {
    alert("請先選擇您的姓名！");
    return;
  }

  const tagId = document.getElementById('vol-tag-id').value;
  const tagLabel = document.getElementById('vol-tag-label').value;
  const dateNote = document.getElementById('vol-date-note').value.trim();
  const comment = document.getElementById('vol-comment').value.trim();

  const submitBtn = document.getElementById('btn-submit-volunteer');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "提交中...";
  }

  try {
    // 讀取最新 volunteers
    const res = await fetch(GANTTCRAFT_URL);
    const json = await res.json();
    const existingRaw = json.fields?.shumeiVolunteers?.arrayValue?.values || [];

    const newVolunteerItem = {
      mapValue: {
        fields: {
          memberId: { stringValue: currentMember.id },
          memberName: { stringValue: currentMember.name },
          tagId: { stringValue: tagId },
          tagLabel: { stringValue: tagLabel },
          date: { stringValue: dateNote },
          note: { stringValue: comment },
          expressedAt: { stringValue: new Date().toISOString() },
          month: { stringValue: currentYearMonth }
        }
      }
    };

    const updatedArray = [...existingRaw, newVolunteerItem];

    // PATCH 回 GanttCraft
    const patchUrl = `${GANTTCRAFT_URL}?updateMask.fieldPaths=shumeiVolunteers`;
    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          shumeiVolunteers: {
            arrayValue: { values: updatedArray }
          }
        }
      })
    });

    if (!patchRes.ok) throw new Error("GanttCraft patch failed");

    if (volunteerModalInstance) volunteerModalInstance.hide();
    alert(`✅ 已成功登記參與「${tagLabel}」之工作意願！\n幹部排班時將會收到通知。`);
    loadGanttCraftMemberData();
  } catch (err) {
    console.error("Submit volunteer error:", err);
    alert("提交意願失敗，請確認網路連線。");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = "確認表達意願";
    }
  }
}

/**
 * 取消工作意願
 */
async function cancelVolunteerInterest(tagId) {
  if (!confirm("確定要取消此項工作意願嗎？")) return;

  try {
    const res = await fetch(GANTTCRAFT_URL);
    const json = await res.json();
    const existingRaw = json.fields?.shumeiVolunteers?.arrayValue?.values || [];

    const updatedArray = existingRaw.filter(item => {
      const f = item.mapValue?.fields;
      if (!f) return false;
      const mId = f.memberId?.stringValue || '';
      const mName = f.memberName?.stringValue || '';
      const tId = f.tagId?.stringValue || '';
      const isMe = (mId === currentMember.id || mName === currentMember.name);
      return !(isMe && tId === tagId);
    });

    const patchUrl = `${GANTTCRAFT_URL}?updateMask.fieldPaths=shumeiVolunteers`;
    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          shumeiVolunteers: {
            arrayValue: { values: updatedArray }
          }
        }
      })
    });

    if (!patchRes.ok) throw new Error("GanttCraft cancel failed");

    alert("已取消該項工作意願。");
    loadGanttCraftMemberData();
  } catch (err) {
    console.error("Cancel volunteer error:", err);
    alert("取消失敗，請稍候再試。");
  }
}
