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

// Standard Recruitment Jobs Definition & Dynamic Storage
const DEFAULT_RECRUITMENT_JOBS = [
  { id: 'tag_worship', label: '參拜護持', icon: '🙏', desc: '參拜日前置準備、引導與現場奉事協助', active: true },
  { id: 'tag_study', label: '上秀勉', icon: '📖', desc: '秀勉學習共修、教誨研讀與心得分享', active: true },
  { id: 'tag_bag', label: '換神光袋', icon: '✨', desc: '定期更換神光袋、儀式配合與協助', active: true },
  { id: 'tag_johrei', label: '淨靈實踐推廣', icon: '☀️', desc: '道場或定點結伴淨靈、施光實踐行動', active: true },
  { id: 'tag_nonbeliever', label: '未信徒引導接待', icon: '🤝', desc: '新朋友初次到訪引導、體驗與交流分享', active: true },
  { id: 'tag_counter', label: '青年櫃檯接待值班', icon: '🛎️', desc: '週末青年輪值櫃檯、簽到引導與茶水接待', active: true },
  { id: 'tag_farm', label: '自然農法農事協力', icon: '🌾', desc: '秀明自然農法田間除草、播種與採收護持', active: true }
];

let recruitmentJobs = [...DEFAULT_RECRUITMENT_JOBS];

async function fetchRecruitmentJobs() {
  try {
    const doc = await db.collection('info').doc('recruitment_jobs').get();
    if (doc.exists && Array.isArray(doc.data().jobs) && doc.data().jobs.length > 0) {
      recruitmentJobs = doc.data().jobs;
    } else {
      recruitmentJobs = [...DEFAULT_RECRUITMENT_JOBS];
    }
  } catch (e) {
    console.warn("Could not fetch info/recruitment_jobs, fallback to defaults:", e);
    recruitmentJobs = [...DEFAULT_RECRUITMENT_JOBS];
  }
}

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

let distinctGroupsCache = [];

async function loadMemberList() {
  try {
    const snap = await db.collection('member').get();
    allMembersCache = [];
    snap.forEach(doc => {
      allMembersCache.push({ id: doc.id, ...doc.data() });
    });

    // 嘗試從 info/youth 取得官方組別推薦順序
    let orderedLeaders = [];
    try {
      const youthDoc = await db.collection('info').doc('youth').get();
      if (youthDoc.exists && Array.isArray(youthDoc.data().leader)) {
        orderedLeaders = youthDoc.data().leader;
      }
    } catch (e) {
      console.warn("Could not fetch info/youth leaders:", e);
    }

    // 統計各組人數
    const groupCountMap = {};
    allMembersCache.forEach(m => {
      if (!m.name) return;
      const g = (m.leader && m.leader.trim() !== '') ? m.leader.trim() : '未分組';
      groupCountMap[g] = (groupCountMap[g] || 0) + 1;
    });

    // 建立組別清單：先依 youth 排列，再放其他組別，最後放未分組
    const groupsSet = new Set(Object.keys(groupCountMap));
    const sortedGroups = [];

    orderedLeaders.forEach(l => {
      if (groupsSet.has(l)) {
        sortedGroups.push(l);
        groupsSet.delete(l);
      }
    });

    // 剩下的組別（排除未分組）
    const remaining = Array.from(groupsSet).filter(g => g !== '未分組').sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    sortedGroups.push(...remaining);

    // 未分組放最後
    if (groupsSet.has('未分組')) {
      sortedGroups.push('未分組');
    }

    distinctGroupsCache = sortedGroups;

    // 填充分組選單 (階段一)
    const groupSelect = document.getElementById('select-group-name');
    if (groupSelect) {
      groupSelect.innerHTML = '<option value="" disabled selected>👉 請先選擇您的所屬分組...</option>';
      sortedGroups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.innerText = `👥 ${g} (${groupCountMap[g]} 人)`;
        groupSelect.appendChild(opt);
      });

      // 增加全體名單選項
      const totalNamed = allMembersCache.filter(m => m.name).length;
      const allOpt = document.createElement('option');
      allOpt.value = '__ALL__';
      allOpt.innerText = `🌐 全部青年成員 (共 ${totalNamed} 人)`;
      groupSelect.appendChild(allOpt);
    }

  } catch (err) {
    console.warn("Could not load member list:", err);
  }
}

/**
 * 分組選擇變更事件 (連動階段二：姓名選單)
 */
function onGroupChange(preferredMemberId) {
  const groupSelect = document.getElementById('select-group-name');
  const memberSelect = document.getElementById('select-member-name');
  const labelMember = document.getElementById('label-member-name');
  const badgeStep2 = document.getElementById('badge-step-2');
  const hintEl = document.getElementById('group-member-count-hint');

  if (!groupSelect || !memberSelect) return;

  const selectedGroup = groupSelect.value;
  if (!selectedGroup) {
    memberSelect.disabled = true;
    memberSelect.innerHTML = '<option value="" disabled selected>👈 請先選擇上方分組</option>';
    if (labelMember) labelMember.className = 'form-label text-muted fw-bold small mb-1';
    if (badgeStep2) badgeStep2.className = 'badge bg-secondary me-1';
    if (hintEl) hintEl.innerText = '';
    return;
  }

  // 篩選該組成員
  let filteredMembers = [];
  if (selectedGroup === '__ALL__') {
    filteredMembers = allMembersCache.filter(m => m.name);
  } else if (selectedGroup === '未分組') {
    filteredMembers = allMembersCache.filter(m => m.name && (!m.leader || m.leader.trim() === '' || m.leader === '未分組'));
  } else {
    filteredMembers = allMembersCache.filter(m => m.name && m.leader && m.leader.trim() === selectedGroup);
  }

  // 按姓名筆劃排序
  filteredMembers.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));

  // 啟用姓名選單
  memberSelect.disabled = false;
  memberSelect.style.borderColor = '#00F3FF';
  if (labelMember) labelMember.className = 'form-label text-info fw-bold small mb-1';
  if (badgeStep2) badgeStep2.className = 'badge bg-info text-dark me-1';

  memberSelect.innerHTML = `<option value="" disabled selected>👉 請點此選取您的姓名 (${filteredMembers.length} 人)...</option>`;

  filteredMembers.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    const shortDate = m.id.includes('A') ? m.id.split('A')[0] : '';
    opt.innerText = `${m.name}${shortDate ? ` (入信 ${shortDate})` : ''}`;
    if (preferredMemberId && m.id === preferredMemberId) {
      opt.selected = true;
    }
    memberSelect.appendChild(opt);
  });

  if (hintEl) {
    hintEl.innerText = `已為您列出「${selectedGroup === '__ALL__' ? '全體' : selectedGroup}」共 ${filteredMembers.length} 位成員`;
  }
}

function openIdentitySelector() {
  const groupSelect = document.getElementById('select-group-name');
  if (groupSelect && currentMember) {
    const targetGroup = currentMember.leader || '未分組';
    if (distinctGroupsCache.includes(targetGroup)) {
      groupSelect.value = targetGroup;
    } else {
      groupSelect.value = '__ALL__';
    }
    onGroupChange(currentMember.id);
  }

  if (identityModalInstance) {
    identityModalInstance.show();
  }
}

function confirmIdentity() {
  const groupSelect = document.getElementById('select-group-name');
  const select = document.getElementById('select-member-name');

  if (!groupSelect || !groupSelect.value) {
    alert("請先完成「步驟 1：選擇所屬分組」！");
    return;
  }

  const selectedId = select.value;
  if (!selectedId) {
    alert("請完成「步驟 2：選擇您的姓名」！");
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
    // 取得最新招募設定
    await fetchRecruitmentJobs();

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
        const tagMap = {};
        recruitmentJobs.forEach(j => {
          tagMap[j.id] = j.label;
        });

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

  // 只顯示啟用的招募項目
  const activeJobs = recruitmentJobs.filter(job => job.active !== false);

  if (activeJobs.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-4 text-muted small">
        目前無開放招募之工作項目。
      </div>
    `;
    return;
  }

  container.innerHTML = activeJobs.map(job => {
    const isVolunteered = myVolunteeredTags.has(job.id);
    const safeJobLabel = encodeURIComponent(job.label || '');
    return `
      <div class="work-card ${isVolunteered ? 'volunteer-active' : ''}">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div>
            <div class="h6 mb-1 fw-bold ${isVolunteered ? 'text-success' : 'text-white'}">
              ${escapeHtml(job.icon || '📌')} ${escapeHtml(job.label)}
            </div>
            <p class="text-muted small mb-0">${escapeHtml(job.desc || '')}</p>
          </div>
          <div class="flex-shrink-0">
            ${isVolunteered ? `
              <button class="btn btn-sm btn-outline-danger interactive" onclick="cancelVolunteerInterest('${job.id}')" style="font-size: 12px; border-radius: 8px;">
                取消意願
              </button>
            ` : `
              <button class="btn btn-sm btn-outline-warning interactive" onclick="openVolunteerModal('${job.id}', '${safeJobLabel}')" style="font-size: 12px; border-radius: 8px;">
                ✋ 我可以參與
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openVolunteerModal(tagId, tagLabelEncoded) {
  let tagLabel = tagLabelEncoded;
  try {
    tagLabel = decodeURIComponent(tagLabelEncoded || '');
  } catch (e) {
    tagLabel = tagLabelEncoded || '';
  }

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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
