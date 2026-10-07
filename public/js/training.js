/**
 * training.js - 研修營運、全自動輪調排班與家庭拜訪排程
 */

// Firebase 初始化
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

// 全域狀態
let trainingConfig = {
  campName: '',
  days: 3,
  groupCount: 4,
  teachers: '',
  members: []
};

// 執事項目標準範本
const DUTY_DEFINITIONS = [
  // 清掃項目 (早晨清掃)
  { id: 'clean_altar', type: 'clean', title: '神殿・拜殿清掃', desc: '拜殿擦拭、供桌整潔、拜席陳設', reqRatio: 0.25 },
  { id: 'clean_restroom', type: 'clean', title: '洗手間・浴室整潔', desc: '男女洗手間消毒、補紙、浴室刷洗', reqRatio: 0.25 },
  { id: 'clean_yard', type: 'clean', title: '玄關・外圍庭院', desc: '落葉掃除、鞋櫃整齊、通道淨化', reqRatio: 0.25 },
  { id: 'clean_hall', type: 'clean', title: '廊道・寮舍寢室', desc: '公用走廊吸塵、宿舍通風整理', reqRatio: 0.25 },

  // 炊事項目 (早中晚輪值)
  { id: 'cook_breakfast', type: 'cook', title: '早餐料理・備料組', desc: '清晨備餐、味噌汁、茶水供餐', reqRatio: 0.25 },
  { id: 'cook_lunch', type: 'cook', title: '午餐料理・配餐組', desc: '午膳掌廚、擺盤盛裝、動線引導', reqRatio: 0.25 },
  { id: 'cook_dinner', type: 'cook', title: '晚餐主廚・烹調組', desc: '晚餐烹調、營養配膳、分裝出餐', reqRatio: 0.25 },
  { id: 'cook_dishwash', type: 'cook', title: '餐後善後・洗碗清潔組', desc: '餐具清洗高溫消毒、廚餘整理', reqRatio: 0.25 }
];

let currentSchedule = []; // 存儲各天排班紀錄
let visitationList = []; // 存儲家庭拜訪排程
let allYouthMembersCache = []; // 青年部資料庫緩存

// DOM 載入後初始化
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  loadYouthMembersFromFirestore();
  loadVisitationPlans();
});

// 切換頁籤
function switchTrainingTab(tabId) {
  document.querySelectorAll('.tab-pill').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('section[id^="tab-"]').forEach(sec => sec.classList.add('d-none'));

  if (tabId === 'shifts') {
    document.querySelector('.tab-pill:nth-child(1)').classList.add('active');
    document.getElementById('tab-shifts').classList.remove('d-none');
  } else if (tabId === 'my-schedule') {
    document.querySelector('.tab-pill:nth-child(2)').classList.add('active');
    document.getElementById('tab-my-schedule').classList.remove('d-none');
  } else if (tabId === 'visitation') {
    document.querySelector('.tab-pill:nth-child(3)').classList.add('active');
    document.getElementById('tab-visitation').classList.remove('d-none');
  }
}

// 載入設定
function loadConfig() {
  const saved = localStorage.getItem('SHUMEI_TRAINING_CONFIG');
  if (saved) {
    try {
      trainingConfig = JSON.parse(saved);
    } catch (e) {
      console.warn("Config parse error:", e);
    }
  }

  // 更新介面文字
  document.getElementById('display-camp-name').innerText = trainingConfig.campName || '（尚未設定）';
  document.getElementById('display-camp-days').innerText = `${trainingConfig.days} 天`;
  document.getElementById('display-member-count').innerText = `${trainingConfig.members.length} 人`;
  document.getElementById('display-teachers').innerText = trainingConfig.teachers || '未設定';

  // 嘗試讀取已儲存的排班
  const savedSchedule = localStorage.getItem('SHUMEI_TRAINING_SCHEDULE');
  if (trainingConfig.members.length === 0) {
    // 尚未設定學員，顯示引導空狀態
    renderShiftMatrix('all');
  } else if (savedSchedule) {
    try {
      currentSchedule = JSON.parse(savedSchedule);
      renderShiftMatrix('all');
    } catch (e) {
      autoGenerateSchedule();
    }
  } else {
    autoGenerateSchedule();
  }
}

// 從 Firestore 緩存青年名冊
function loadYouthMembersFromFirestore() {
  db.collection('member').get().then(snapshot => {
    allYouthMembersCache = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      allYouthMembersCache.push({
        id: doc.id,
        name: d.name || '無名',
        phone: d.phone || d.tel || '',
        address: d.adress || '',
        guide: d.guide ? (Array.isArray(d.guide) ? d.guide.join(', ') : d.guide) : '',
        leader: d.leader || ''
      });
    });
    console.log(`[Training] 成功載入青年名冊：${allYouthMembersCache.length} 人`);
  }).catch(err => console.warn("Load members warning:", err));
}

// 全自動公平輪替演算法 (Round-Robin Shift Allocation)
function autoGenerateSchedule() {
  const members = [...trainingConfig.members];
  const totalMembers = members.length;
  if (totalMembers === 0) {
    currentSchedule = [];
    renderShiftMatrix('all');
    return;
  }

  const days = parseInt(trainingConfig.days) || 3;
  const schedule = [];

  // 將清掃與炊事分別輪替
  const cleanDuties = DUTY_DEFINITIONS.filter(d => d.type === 'clean');
  const cookDuties = DUTY_DEFINITIONS.filter(d => d.type === 'cook');

  for (let day = 1; day <= days; day++) {
    // 每日清掃分配（按天位移索引）
    const dayCleanDuties = [];
    const cleanSlotSize = Math.max(1, Math.floor(totalMembers / cleanDuties.length));

    cleanDuties.forEach((duty, idx) => {
      const assigned = [];
      for (let i = 0; i < cleanSlotSize; i++) {
        const memberIdx = (idx * cleanSlotSize + i + (day - 1) * 2) % totalMembers;
        assigned.push(members[memberIdx]);
      }
      dayCleanDuties.push({
        dutyId: duty.id,
        dutyTitle: duty.title,
        dutyType: 'clean',
        dutyDesc: duty.desc,
        members: [...new Set(assigned)]
      });
    });

    // 每日炊事分配（與清掃錯開位移）
    const dayCookDuties = [];
    const cookSlotSize = Math.max(1, Math.floor(totalMembers / cookDuties.length));

    cookDuties.forEach((duty, idx) => {
      const assigned = [];
      for (let i = 0; i < cookSlotSize; i++) {
        const memberIdx = (totalMembers - 1 - (idx * cookSlotSize + i + (day - 1) * 3)) % totalMembers;
        const safeIdx = (memberIdx + totalMembers) % totalMembers;
        assigned.push(members[safeIdx]);
      }
      dayCookDuties.push({
        dutyId: duty.id,
        dutyTitle: duty.title,
        dutyType: 'cook',
        dutyDesc: duty.desc,
        members: [...new Set(assigned)]
      });
    });

    schedule.push({
      day: day,
      dayLabel: `第 ${day} 天`,
      duties: [...dayCleanDuties, ...dayCookDuties]
    });
  }

  currentSchedule = schedule;
  localStorage.setItem('SHUMEI_TRAINING_SCHEDULE', JSON.stringify(currentSchedule));
  renderShiftMatrix('all');
}

// 渲染輪調大表
function renderShiftMatrix(filterDay = 'all') {
  const tbody = document.getElementById('matrix-tbody');
  tbody.innerHTML = '';

  // 產生天數篩選按鈕
  const dayFilterBox = document.getElementById('day-filter-container');
  dayFilterBox.innerHTML = '';
  for (let d = 1; d <= trainingConfig.days; d++) {
    const isChecked = filterDay == d ? 'checked' : '';
    dayFilterBox.innerHTML += `
      <input type="radio" class="btn-check" name="dayFilter" id="day-${d}" ${isChecked} onchange="renderShiftMatrix(${d})">
      <label class="btn btn-outline-secondary text-light btn-sm" for="day-${d}">第 ${d} 天</label>
    `;
  }

  const daysToShow = filterDay === 'all' 
    ? currentSchedule 
    : currentSchedule.filter(s => s.day == filterDay);

  daysToShow.forEach(dayPlan => {
    dayPlan.duties.forEach((d, idx) => {
      const tr = document.createElement('tr');
      const isClean = d.dutyType === 'clean';
      const badgeClass = isClean ? 'duty-clean' : 'duty-cook';
      const icon = isClean ? 'fa-broom' : 'fa-utensils';

      let dayCell = '';
      if (idx === 0) {
        dayCell = `<td rowspan="${dayPlan.duties.length}" class="text-center font-weight-bold bg-dark bg-opacity-25" style="border-right: 2px solid rgba(255,255,255,0.15);">
          <div class="badge bg-warning text-dark mb-1" style="font-size: 12px;">${dayPlan.dayLabel}</div>
        </td>`;
      }

      const memberTags = d.members.map(m => `
        <span class="badge bg-dark border border-secondary text-light me-1 mb-1" style="padding: 6px 10px; font-size: 13px;">
          <i class="fa-regular fa-circle-user me-1 text-info"></i>${m}
        </span>
      `).join('');

      tr.innerHTML = `
        ${dayCell}
        <td>
          <div class="d-flex align-items-center gap-2">
            <span class="duty-badge ${badgeClass}"><i class="fa-solid ${icon}"></i> ${isClean ? '環境打掃' : '炊事輪值'}</span>
            <strong class="text-white">${d.dutyTitle}</strong>
          </div>
          <small class="text-muted d-block mt-1" style="font-size: 11px;">${d.dutyDesc}</small>
        </td>
        <td class="text-center text-light font-weight-bold">${d.members.length} 人</td>
        <td>
          <div class="d-flex flex-wrap">${memberTags}</div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });

  if (daysToShow.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted py-4">
          <i class="fa-solid fa-calendar-xmark fa-2x mb-2 d-block opacity-50"></i>
          尚未建立排班表，請先點擊右上角「⚙ 研修設定」填寫學員名單以自動產生輪調排班。
        </td>
      </tr>
    `;
  }
}

// 個人任務卡查詢
function searchPersonalTasks() {
  const name = document.getElementById('personal-search-name').value.trim();
  const container = document.getElementById('personal-results');
  if (!name) {
    alert("請輸入姓名進行查詢！");
    return;
  }

  const results = [];
  currentSchedule.forEach(dayPlan => {
    const myDuties = dayPlan.duties.filter(d => d.members.includes(name));
    if (myDuties.length > 0) {
      results.push({
        day: dayPlan.day,
        dayLabel: dayPlan.dayLabel,
        duties: myDuties
      });
    }
  });

  if (results.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center text-warning py-5">
        <i class="fa-solid fa-triangle-exclamation fa-2x mb-2"></i>
        <p>找不到 <strong>${name}</strong> 的排班任務。請確認姓名是否包含在學員名冊中！</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="col-12 mb-2">
      <h6 class="text-info"><i class="fa-solid fa-user-check me-2"></i>${name} 的個人研修任務清單 (共 ${results.length} 天執事安排)：</h6>
    </div>
  `;

  results.forEach(res => {
    const dutyCards = res.duties.map(d => {
      const isClean = d.dutyType === 'clean';
      const color = isClean ? '#00F3FF' : '#ffa100';
      const icon = isClean ? 'fa-broom' : 'fa-utensils';
      const partners = d.members.filter(m => m !== name).join(', ') || '無其他同伴';
      return `
        <div class="p-3 mb-2 rounded-3 bg-dark border border-secondary">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="badge" style="background: rgba(255,255,255,0.1); color: ${color}; border: 1px solid ${color};">
              <i class="fa-solid ${icon} me-1"></i> ${isClean ? '早晨打掃' : '炊事料理'}
            </span>
            <span class="text-white font-weight-bold">${d.dutyTitle}</span>
          </div>
          <p class="small text-muted mb-2">${d.dutyDesc}</p>
          <div class="small text-light">
            <span class="text-muted"><i class="fa-solid fa-users me-1"></i>同組夥伴：</span>${partners}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML += `
      <div class="col-12 col-md-6">
        <div class="glass-card personal-card p-3 h-100">
          <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom border-secondary border-opacity-50">
            <h5 class="text-white mb-0 font-weight-bold">${res.dayLabel}</h5>
            <span class="badge bg-warning text-dark">排定 ${res.duties.length} 項執事</span>
          </div>
          ${dutyCards}
        </div>
      </div>
    `;
  });
}

// 匯出 Excel 排班大表
function exportTrainingExcel() {
  if (typeof ExcelJS === 'undefined') {
    alert("Excel 工具載入中，請稍候重試");
    return;
  }
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('研修排班大表');

  worksheet.columns = [
    { header: '日期天數', key: 'day', width: 14 },
    { header: '執事分類', key: 'type', width: 16 },
    { header: '執事項目', key: 'title', width: 22 },
    { header: '工作職責說明', key: 'desc', width: 35 },
    { header: '需求人數', key: 'count', width: 12 },
    { header: '負責學員', key: 'members', width: 45 }
  ];

  currentSchedule.forEach(dayPlan => {
    dayPlan.duties.forEach(d => {
      worksheet.addRow({
        day: dayPlan.dayLabel,
        type: d.dutyType === 'clean' ? '早晨環境清掃' : '炊事煮飯輪值',
        title: d.dutyTitle,
        desc: d.dutyDesc,
        count: d.members.length,
        members: d.members.join(', ')
      });
    });
  });

  workbook.xlsx.writeBuffer().then(buffer => {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trainingConfig.campName}_輪調排班大表.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ======================= 研修設定與名單管理 =======================

function openConfigModal() {
  document.getElementById('cfg-camp-name').value = trainingConfig.campName;
  document.getElementById('cfg-camp-days').value = trainingConfig.days;
  document.getElementById('cfg-groups').value = trainingConfig.groupCount || 4;
  document.getElementById('cfg-teachers').value = trainingConfig.teachers || '';
  document.getElementById('cfg-members').value = trainingConfig.members.join('\n');
  
  new bootstrap.Modal(document.getElementById('configModal')).show();
}

function saveTrainingConfig() {
  const name = document.getElementById('cfg-camp-name').value.trim() || '2026 青年特別研修會';
  const days = parseInt(document.getElementById('cfg-camp-days').value) || 3;
  const groups = parseInt(document.getElementById('cfg-groups').value) || 4;
  const teachers = document.getElementById('cfg-teachers').value.trim();
  const rawMembers = document.getElementById('cfg-members').value;

  const memberList = rawMembers
    .split(/[\n,，]+/)
    .map(m => m.trim())
    .filter(m => m.length > 0);

  if (memberList.length === 0) {
    alert("請至少輸入一位學員姓名！");
    return;
  }

  trainingConfig = {
    campName: name,
    days: days,
    groupCount: groups,
    teachers: teachers,
    members: memberList
  };

  localStorage.setItem('SHUMEI_TRAINING_CONFIG', JSON.stringify(trainingConfig));
  bootstrap.Modal.getInstance(document.getElementById('configModal')).hide();
  
  // 更新介面並自動重新計算輪替
  loadConfig();
  alert(`✅ 研修設定已成功儲存！共收錄 ${memberList.length} 位學員，已自動更新輪調排班。`);
}

function importFromYouthMembers() {
  if (allYouthMembersCache.length === 0) {
    alert("青年名冊載入中，請稍候重試！");
    return;
  }
  const names = allYouthMembersCache.map(m => m.name).slice(0, 30);
  document.getElementById('cfg-members').value = names.join('\n');
  alert(`✅ 已自動載入青年部現有 ${names.length} 位成員名單！`);
}

// ======================= 家庭拜訪計劃表 (Visitation Schedule) =======================

function loadVisitationPlans() {
  const saved = localStorage.getItem('SHUMEI_VISITATION_PLANS');
  if (saved) {
    try {
      visitationList = JSON.parse(saved);
    } catch (e) {
      visitationList = [];
    }
  } else {
    visitationList = [];
  }
  renderVisitationList();
}

function renderVisitationList() {
  const container = document.getElementById('visitation-list');
  container.innerHTML = '';

  if (visitationList.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center text-muted py-5">
        <i class="fa-solid fa-map-location fa-3x mb-3 opacity-50"></i>
        <p>目前尚未安排家庭拜訪排程，點擊右上角「＋新增拜訪排程」開始規劃！</p>
      </div>
    `;
    return;
  }

  visitationList.forEach((v, index) => {
    const isCompleted = v.status === 'completed';
    const isOngoing = v.status === 'ongoing';
    
    let statusBadge = `<span class="badge bg-secondary">預定中</span>`;
    if (isCompleted) {
      statusBadge = `<span class="badge bg-success"><i class="fa-solid fa-check me-1"></i>已完成 (${v.jyoreiCount || 0}人淨靈)</span>`;
    } else if (isOngoing) {
      statusBadge = `<span class="badge bg-warning text-dark"><i class="fa-solid fa-car-side me-1"></i>拜訪中</span>`;
    }

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.address)}`;
    const phoneUrl = `tel:${v.phone.replace(/[^0-9+]/g, '')}`;

    container.innerHTML += `
      <div class="col-12 col-md-6">
        <div class="glass-card visit-card p-4 h-100">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <h5 class="text-white mb-1 font-weight-bold">
                <i class="fa-solid fa-house-user me-2 text-success"></i>${v.name}
              </h5>
              <div class="small text-muted">
                <i class="fa-regular fa-clock me-1 text-warning"></i>${v.date} ${v.time}
              </div>
            </div>
            ${statusBadge}
          </div>

          <div class="mb-3">
            <div class="small text-light mb-1">
              <i class="fa-solid fa-location-dot me-2 text-danger"></i>${v.address || '尚未填寫地址'}
            </div>
            <div class="small text-light">
              <i class="fa-solid fa-phone me-2 text-info"></i>${v.phone || '尚未填寫電話'}
            </div>
          </div>

          <div class="p-2 mb-3 rounded-2 bg-dark border border-secondary small">
            <div class="text-light mb-1"><strong class="text-warning">同行老師：</strong>${v.teacher || '帶隊幹部'}</div>
            <div class="text-light mb-1"><strong class="text-info">隨行青年小組：</strong>${v.escorts || '全體小組'}</div>
            ${v.notes ? `<div class="text-muted"><strong class="text-light">注意事項：</strong>${v.notes}</div>` : ''}
          </div>

          <!-- Actions -->
          <div class="d-flex flex-wrap gap-2 pt-2 border-top border-secondary border-opacity-50">
            ${v.address ? `
              <a href="${mapsUrl}" target="_blank" class="btn btn-sm btn-outline-info rounded-pill px-3 interactive">
                <i class="fa-solid fa-diamond-turn-right me-1"></i> 導航路線
              </a>
            ` : ''}
            ${v.phone ? `
              <a href="${phoneUrl}" class="btn btn-sm btn-outline-success rounded-pill px-3 interactive">
                <i class="fa-solid fa-phone-flip me-1"></i> 撥打電話
              </a>
            ` : ''}
            <button class="btn btn-sm btn-outline-light rounded-pill px-3 ms-auto interactive" onclick="toggleVisitStatus(${index})">
              <i class="fa-solid fa-arrows-rotate me-1"></i> 更新狀態
            </button>
            <button class="btn btn-sm btn-outline-danger rounded-pill px-2 interactive" onclick="deleteVisitPlan(${index})">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  });
}

function openAddVisitModal() {
  document.getElementById('visit-name').value = '';
  document.getElementById('visit-phone').value = '';
  document.getElementById('visit-address').value = '';
  document.getElementById('visit-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('visit-time').value = '14:00 - 15:30';
  document.getElementById('visit-teacher').value = trainingConfig.teachers.split(',')[0] || '';
  document.getElementById('visit-escorts').value = '';
  document.getElementById('visit-notes').value = '';

  new bootstrap.Modal(document.getElementById('visitModal')).show();
}

function saveVisitationPlan() {
  const name = document.getElementById('visit-name').value.trim();
  if (!name) {
    alert("請輸入拜訪對象姓名！");
    return;
  }

  const newPlan = {
    id: 'v_' + Date.now(),
    name: name,
    phone: document.getElementById('visit-phone').value.trim(),
    address: document.getElementById('visit-address').value.trim(),
    date: document.getElementById('visit-date').value,
    time: document.getElementById('visit-time').value.trim(),
    teacher: document.getElementById('visit-teacher').value.trim(),
    escorts: document.getElementById('visit-escorts').value.trim(),
    notes: document.getElementById('visit-notes').value.trim(),
    status: 'pending',
    jyoreiCount: 0
  };

  visitationList.push(newPlan);
  localStorage.setItem('SHUMEI_VISITATION_PLANS', JSON.stringify(visitationList));
  bootstrap.Modal.getInstance(document.getElementById('visitModal')).hide();
  renderVisitationList();
  alert(`✅ 拜訪排程「${name}」已新增！`);
}

function toggleVisitStatus(index) {
  const item = visitationList[index];
  if (!item) return;

  if (item.status === 'pending') {
    item.status = 'ongoing';
  } else if (item.status === 'ongoing') {
    const count = prompt(`請輸入拜訪「${item.name}」期間施光之淨靈人次：`, '2');
    item.jyoreiCount = parseInt(count) || 0;
    item.status = 'completed';
    alert(`🎉 恭喜完成拜訪！已記錄 ${item.jyoreiCount} 人次淨靈。`);
  } else {
    item.status = 'pending';
  }

  localStorage.setItem('SHUMEI_VISITATION_PLANS', JSON.stringify(visitationList));
  renderVisitationList();
}

function deleteVisitPlan(index) {
  if (confirm("確定要刪除這筆拜訪排程嗎？")) {
    visitationList.splice(index, 1);
    localStorage.setItem('SHUMEI_VISITATION_PLANS', JSON.stringify(visitationList));
    renderVisitationList();
  }
}

// 選擇名冊成員彈窗
function openMemberPickerForVisit() {
  const listEl = document.getElementById('picker-list');
  listEl.innerHTML = '';

  if (allYouthMembersCache.length === 0) {
    alert("正在連線名冊資料庫，請稍候...");
    return;
  }

  allYouthMembersCache.forEach(m => {
    const item = document.createElement('a');
    item.href = 'javascript:void(0)';
    item.className = 'list-group-item list-group-item-action bg-dark text-light border-secondary small d-flex justify-content-between align-items-center py-2';
    item.innerHTML = `
      <div>
        <strong class="text-white">${m.name}</strong>
        <span class="text-muted ms-2">${m.leader || '青年部'}</span>
        <div class="text-muted" style="font-size: 11px;">${m.address || '無地址'} | ${m.phone || '無電話'}</div>
      </div>
      <span class="badge bg-warning text-dark">選擇</span>
    `;
    item.onclick = () => {
      document.getElementById('visit-name').value = m.name;
      document.getElementById('visit-phone').value = m.phone;
      document.getElementById('visit-address').value = m.address;
      bootstrap.Modal.getInstance(document.getElementById('memberPickerModal')).hide();
    };
    listEl.appendChild(item);
  });

  new bootstrap.Modal(document.getElementById('memberPickerModal')).show();
}

function filterMemberPicker(keyword) {
  const q = keyword.trim().toLowerCase();
  const items = document.querySelectorAll('#picker-list a');
  items.forEach(el => {
    const text = el.innerText.toLowerCase();
    el.style.display = text.includes(q) ? 'flex' : 'none';
  });
}
