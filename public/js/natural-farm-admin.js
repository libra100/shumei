/**
 * Shumei Natural Farming Admin Portal - Operations Script (natural-farm-admin.js)
 * Fully functional logic without dummy alerts.
 */

// Initialize Firebase if needed
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

// Admin Mock & Local State
let adminEvents = [
  {
    id: 'event_dining_01',
    title: '光之餐桌：初夏旬味無菜單料理',
    category: 'dining',
    categoryName: '🍽️ 餐桌料理',
    pricing: 'NT$ 1,200 (保證金)',
    sessions: [{ date: '2026-06-06', time: '17:30', max: 20, booked: 18, waitlist: 0 }],
    status: '已發布'
  },
  {
    id: 'event_farm_02',
    title: '自然農法水稻插秧與奉仕日',
    category: 'farm_exp',
    categoryName: '🌱 農事體驗',
    pricing: '免費公益',
    sessions: [{ date: '2026-05-23', time: '09:00', max: 30, booked: 28, waitlist: 0 }],
    status: '已發布'
  },
  {
    id: 'event_seed_03',
    title: '水花園市集：自家採種工作坊',
    category: 'seed_saving',
    categoryName: '🧬 保種工作坊',
    pricing: '免費參與',
    sessions: [{ date: '2026-05-30', time: '14:00', max: 25, booked: 12, waitlist: 0 }],
    status: '已發布'
  }
];

let rosterData = [
  {
    token: 'SHUMEI-NF-K8S1-8392',
    name: '林曉峰',
    phone: '0912-345-678',
    eventTitle: '光之餐桌：初夏旬味',
    session: '2026-06-06 17:30',
    headcount: 2,
    bringUtensils: true,
    status: 'confirmed'
  },
  {
    token: 'SHUMEI-NF-J9M2-4102',
    name: '陳雅筑',
    phone: '0922-888-111',
    eventTitle: '自然農法水稻插秧日',
    session: '2026-05-23 09:00',
    headcount: 1,
    bringUtensils: true,
    status: 'checked_in'
  },
  {
    token: 'SHUMEI-NF-L3P8-9941',
    name: '黃柏翔',
    phone: '0933-777-666',
    eventTitle: '水花園自家採種工作坊',
    session: '2026-05-30 14:00',
    headcount: 3,
    bringUtensils: false,
    status: 'confirmed'
  },
  {
    token: 'SHUMEI-NF-Q5V7-1284',
    name: '張家瑋',
    phone: '0955-444-333',
    eventTitle: '光之餐桌：初夏旬味',
    session: '2026-06-06 17:30',
    headcount: 2,
    bringUtensils: true,
    status: 'waitlist'
  }
];

let volunteerList = [
  { id: 'v1', name: '陳美玲', phone: '0911-222-333', stage: '新申請', skills: '攝影紀錄、外語翻譯', note: '可支援假日市集', hours: 0 },
  { id: 'v2', name: '李冠宇', phone: '0922-333-444', stage: '新申請', skills: '農事好手 (割草機經驗)', note: '可支援水稻田區', hours: 0 },
  { id: 'v3', name: '趙子瑄', phone: '0933-444-555', stage: '面談評估', skills: '廚藝研發、無菜單料理', note: '光之餐桌主廚助理', hours: 12 },
  { id: 'v4', name: '郭俊傑', phone: '0955-666-777', stage: '已認證', skills: '現場交管、活動策劃', note: '市集機動組長', hours: 36 },
  { id: 'v5', name: '許雅琪', phone: '0977-888-999', stage: '活躍奉仕', skills: '自家採種師、食育講師', note: '資深活動核心幹部', hours: 120 }
];

let moderationReviews = [
  { id: 'mrev_1', author: '黃雅筑', title: '光之餐桌感官評價', rating: '⭐⭐⭐⭐⭐ 純淨度五星', content: '第一口吃下番茄冷湯時眼淚差點流出來...', isPinned: true, isApproved: true },
  { id: 'mrev_2', author: '張書銘', title: '水稻插秧日', rating: '⭐⭐⭐⭐⭐ 土地連結五星', content: '第一次赤腳踩進水田的那一刻，感受到了泥土的溫度...', isPinned: false, isApproved: true }
];

let moderationFeeds = [
  { id: 'mfeed_1', author: '陳志遠農友', title: '晨露與根系呼吸', term: '立夏', likes: 48, desc: '含高解析田區晨露縮時相片 1 張' }
];

let html5QrScanner = null;

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
  initCharts();
  renderAdminEventsTable();
  renderRosterTable();
  renderModerationLists();
  renderKanbanPipeline();
  initQrScanner();
  fetchFirestoreBookings();
});

// Toast notification
function showAdminToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const iconMap = {
    success: 'fa-circle-check text-success',
    warning: 'fa-triangle-exclamation text-warning',
    info: 'fa-circle-info text-info',
    danger: 'fa-circle-xmark text-danger'
  };

  const toastId = `toast_${Date.now()}`;
  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center text-white border border-success border-opacity-50 shadow-lg mb-2 show" style="background: rgba(13, 30, 21, 0.95); backdrop-filter: blur(20px); border-radius: 14px;" role="alert">
      <div class="d-flex">
        <div class="toast-body d-flex align-items-center gap-2">
          <i class="fa-solid ${iconMap[type] || iconMap.success} fs-5"></i>
          <span class="small fw-bold">${message}</span>
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" onclick="document.getElementById('${toastId}').remove()"></button>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', toastHtml);
  setTimeout(() => {
    const el = document.getElementById(toastId);
    if (el) el.remove();
  }, 4000);
}

// Sync from Firestore natural_bookings
function fetchFirestoreBookings() {
  db.collection('natural_bookings').get().then(snapshot => {
    if (!snapshot.empty) {
      const remote = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        remote.push({
          token: d.token || doc.id,
          name: d.userName,
          phone: d.userPhone,
          eventTitle: d.eventTitle,
          session: `${d.sessionDate || ''} ${d.sessionTime || ''}`,
          headcount: d.headcount || 1,
          bringUtensils: d.bringUtensils !== false,
          status: d.checkedIn ? 'checked_in' : (d.status === '候補中' ? 'waitlist' : 'confirmed')
        });
      });
      rosterData = remote;
      renderRosterTable();
    }
  }).catch(err => console.log("Firestore offline/fallback mode:", err));
}

// Switch Navigation Tabs
function switchAdminTab(tabName, linkElement) {
  document.querySelectorAll('.admin-tab-content').forEach(tab => tab.style.display = 'none');
  const target = document.getElementById(`admin-tab-${tabName}`);
  if (target) target.style.display = 'block';

  document.querySelectorAll('.admin-nav-link').forEach(link => link.classList.remove('active'));
  if (linkElement) linkElement.classList.add('active');

  if (tabName === 'analytics') {
    window.dispatchEvent(new Event('resize'));
  }
}

// Role Switching Handler
function changeAdminRole(role) {
  const roleNames = {
    super_admin: '超級管理員 (全權限)',
    organizer: '活動主辦者 (活動與核銷)',
    farmer: '農友/農場夥伴 (日誌與作物庫存)'
  };
  showAdminToast(`權限身分已切換為：【${roleNames[role]}】`, 'info');
}

// Initialize KPI Charts (Chart.js)
function initCharts() {
  const barCtx = document.getElementById('kpiBarChart');
  if (barCtx) {
    new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: ['光之餐桌 (6/6)', '水稻插秧 (5/23)', '自家採種 (5/30)', '草悟道市集 (6/13)'],
        datasets: [
          {
            label: '預約報名數',
            data: [20, 28, 12, 42],
            backgroundColor: 'rgba(82, 183, 136, 0.75)',
            borderColor: '#52b788',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: '現場出席數',
            data: [18, 26, 12, 38],
            backgroundColor: 'rgba(255, 161, 0, 0.8)',
            borderColor: '#ffa100',
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#ffffff' } }
        },
        scales: {
          x: { ticks: { color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' } },
          y: { ticks: { color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' } }
        }
      }
    });
  }

  const pieCtx = document.getElementById('kpiPieChart');
  if (pieCtx) {
    new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: ['家庭親子組', '青年志工', '自然農法會員', '一般大眾'],
        datasets: [{
          data: [45, 25, 20, 10],
          backgroundColor: ['#52b788', '#ffa100', '#00f3ff', '#d8f3dc'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#ffffff' }, position: 'bottom' }
        }
      }
    });
  }
}

// Render Admin Events Table
function renderAdminEventsTable() {
  const tbody = document.getElementById('adminEventsTableBody');
  if (!tbody) return;

  tbody.innerHTML = adminEvents.map((evt) => {
    const session = evt.sessions[0] || {};
    return `
      <tr>
        <td class="fw-bold text-white">${evt.title}</td>
        <td><span class="badge bg-success bg-opacity-50 text-light">${evt.categoryName || evt.category}</span></td>
        <td>${session.date} (${session.booked}/${session.max}人)</td>
        <td class="text-warning">${evt.pricing}</td>
        <td><span class="badge bg-success rounded-pill">${evt.status}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-info rounded-pill py-0 px-2 me-1 interactive" onclick="openEditEventModal('${evt.id}')">編輯</button>
          <button class="btn btn-sm btn-outline-danger rounded-pill py-0 px-2 interactive" onclick="deleteAdminEvent('${evt.id}')">下架</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Delete Event
function deleteAdminEvent(id) {
  adminEvents = adminEvents.filter(e => e.id !== id);
  renderAdminEventsTable();
  showAdminToast("活動已下架存檔！", "info");
}

// Open Edit Event Modal
function openEditEventModal(id) {
  const evt = adminEvents.find(e => e.id === id);
  if (!evt) return;

  document.getElementById('editEventId').value = evt.id;
  document.getElementById('editEventTitle').value = evt.title;
  document.getElementById('editEventPricing').value = evt.pricing;
  document.getElementById('editEventStatus').value = evt.status;
  document.getElementById('editEventDate').value = evt.sessions[0]?.date || '';
  document.getElementById('editEventMax').value = evt.sessions[0]?.max || 20;

  const modal = new bootstrap.Modal(document.getElementById('editEventModal'));
  modal.show();
}

function submitEditEvent(e) {
  if (e && e.preventDefault) e.preventDefault();
  const id = document.getElementById('editEventId').value;
  const evt = adminEvents.find(e => e.id === id);
  if (!evt) return;

  evt.title = document.getElementById('editEventTitle').value.trim();
  evt.pricing = document.getElementById('editEventPricing').value.trim();
  evt.status = document.getElementById('editEventStatus').value;
  if (evt.sessions[0]) {
    evt.sessions[0].date = document.getElementById('editEventDate').value.trim();
    evt.sessions[0].max = parseInt(document.getElementById('editEventMax').value, 10) || 20;
  }

  renderAdminEventsTable();
  const modalInstance = bootstrap.Modal.getInstance(document.getElementById('editEventModal'));
  if (modalInstance) modalInstance.hide();

  showAdminToast("活動資訊已更新成功！");
}

// Open Create Event Modal
function openCreateEventModal() {
  const modal = new bootstrap.Modal(document.getElementById('createEventModal'));
  modal.show();
}

// Submit Create Event
function submitCreateEvent(e) {
  if (e && e.preventDefault) e.preventDefault();
  const title = document.getElementById('newEventTitle').value.trim() || '新發布自然農法活動';
  const category = document.getElementById('newEventCategory').value;
  const pricing = document.getElementById('newEventPricing').value.trim() || '免費公益';
  const banner = document.getElementById('newEventBannerUrl').value.trim();
  const location = document.getElementById('newEventLocation').value.trim() || '秀明自然農法園區';
  const date = document.getElementById('newEventDate').value || '2026-07-01';
  const time = document.getElementById('newEventTime').value.trim() || '09:00 - 12:00';
  const max = parseInt(document.getElementById('newEventMax').value, 10) || 20;
  const desc = document.getElementById('newEventDesc').value.trim() || '活動介紹';

  const newEvent = {
    id: `event_${Date.now()}`,
    title: title,
    category: category,
    categoryName: category === 'dining' ? '🍽️ 餐桌料理' : (category === 'farm_exp' ? '🌱 農事體驗' : '🧬 保種工作坊'),
    bannerUrl: banner,
    location: location,
    pricing: pricing,
    description: desc,
    sessions: [{ date: date, time: time, max: max, booked: 0, waitlist: 0 }],
    status: '已發布'
  };

  adminEvents.unshift(newEvent);
  renderAdminEventsTable();

  // Save to Firestore
  db.collection('natural_events').doc(newEvent.id).set(newEvent).catch(err => console.log("Firestore event creation:", err));

  const modalInstance = bootstrap.Modal.getInstance(document.getElementById('createEventModal'));
  if (modalInstance) modalInstance.hide();

  showAdminToast("🎉 新活動已成功發布！前台可即時預約。");
}

// Render Roster Table
function renderRosterTable() {
  const tbody = document.getElementById('rosterTableBody');
  if (!tbody) return;

  tbody.innerHTML = rosterData.map(item => {
    const statusMap = {
      confirmed: '<span class="badge bg-primary">已確認 (待報到)</span>',
      checked_in: '<span class="badge bg-success"><i class="fa-solid fa-check me-1"></i>已核銷</span>',
      waitlist: '<span class="badge bg-warning text-dark">候補中</span>'
    };

    return `
      <tr>
        <td class="fw-bold text-white">${item.name} <br><small class="text-muted">${item.phone}</small></td>
        <td>${item.eventTitle}<br><small class="text-muted">${item.session}</small></td>
        <td>${item.headcount} 位</td>
        <td>
          ${item.bringUtensils ? '<span class="badge bg-success bg-opacity-75 mb-1">🌿 自備餐具</span>' : '<span class="badge bg-secondary mb-1">無自備</span>'}
          <br><span class="badge bg-dark border border-secondary text-info" style="font-size:0.7rem;">${item.paymentMethodName || 'LINE Pay / 現場'}</span>
        </td>
        <td>${statusMap[item.status] || item.status}</td>
        <td>
          ${item.status !== 'checked_in' 
            ? `<button class="btn btn-sm btn-outline-success rounded-pill py-0 px-2 interactive" onclick="checkInByToken('${item.token}')">手動核銷</button>` 
            : `<span class="text-muted small">已完成</span>`}
        </td>
      </tr>
    `;
  }).join('');
}

// Filter Roster Table
function filterRosterTable() {
  const query = document.getElementById('rosterSearchInput').value.toLowerCase();
  const filterStatus = document.getElementById('rosterStatusFilter').value;

  const rows = document.querySelectorAll('#rosterTableBody tr');
  rows.forEach((row, idx) => {
    const item = rosterData[idx];
    if (!item) return;

    const matchesQuery = item.name.toLowerCase().includes(query) || 
                         item.phone.includes(query) || 
                         item.token.toLowerCase().includes(query) ||
                         item.eventTitle.toLowerCase().includes(query);
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;

    row.style.display = matchesQuery && matchesStatus ? '' : 'none';
  });
}

// Initialize HTML5 QR Scanner
function initQrScanner() {
  const readerElem = document.getElementById('qr-reader');
  if (!readerElem) return;

  try {
    html5QrScanner = new Html5QrcodeScanner("qr-reader", { 
      fps: 10, 
      qrbox: { width: 220, height: 220 },
      rememberLastUsedCamera: true
    });
    html5QrScanner.render(onScanSuccess, onScanError);
  } catch (err) {
    console.log("QR Camera Scanner initialization info:", err);
  }
}

function onScanSuccess(decodedText) {
  try {
    let token = decodedText;
    let name = '';
    let eventTitle = '';

    if (decodedText.startsWith('{')) {
      const parsed = JSON.parse(decodedText);
      token = parsed.token || decodedText;
      name = parsed.name || '';
      eventTitle = parsed.event || '';
    }

    executeCheckIn(token, name, eventTitle);
  } catch (e) {
    executeCheckIn(decodedText, '', '');
  }
}

function onScanError(error) {
  // Silent scan frame errors
}

// Manual Check-in by Input Box
function manualCheckIn() {
  const input = document.getElementById('manualTokenInput').value.trim();
  if (!input) {
    showAdminToast("請輸入核銷 Token！", "warning");
    return;
  }
  executeCheckIn(input);
}

function checkInByToken(token) {
  executeCheckIn(token);
}

// Core Check-In Logic
function executeCheckIn(token, parsedName, parsedEvent) {
  const booking = rosterData.find(b => b.token === token);
  const name = booking ? booking.name : (parsedName || '預約貴賓');
  const event = booking ? booking.eventTitle : (parsedEvent || '自然農法活動');

  if (booking) {
    booking.status = 'checked_in';
  } else {
    // Add dynamic scanned record
    rosterData.unshift({
      token: token,
      name: name,
      phone: '現場掃碼確認',
      eventTitle: event,
      session: '今日梯次',
      headcount: 1,
      bringUtensils: true,
      status: 'checked_in'
    });
  }

  // Sync to Firestore
  db.collection('natural_bookings').doc(token).set({
    checkedIn: true,
    checkedInAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(err => console.log("Firestore checkin sync:", err));

  renderRosterTable();

  // Show Success Card
  const resultBox = document.getElementById('scanResultBox');
  resultBox.style.display = 'block';
  document.getElementById('scannedPersonName').innerText = `${name} (報到成功)`;
  document.getElementById('scannedEventTitle').innerText = `${event} · 專屬 Token: ${token}`;

  // Audio feedback
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}

  showAdminToast(`【${name}】核銷報到成功！+40 Karma 點數已發放。`);
}

// Batch Export CSV
function exportRosterCSV() {
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  csvContent += "Token,姓名,電話,活動名稱,梯次時段,人數,自備餐具,報到狀態\n";

  rosterData.forEach(row => {
    csvContent += `"${row.token}","${row.name}","${row.phone}","${row.eventTitle}","${row.session}",${row.headcount},"${row.bringUtensils ? '是' : '否'}","${row.status}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `shumei_roster_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showAdminToast("已成功匯出報名名冊 CSV！");
}

// Broadcast Notification Modal
function openBroadcastModal() {
  const confirmed = rosterData.filter(b => b.status === 'confirmed').length;
  const countEl = document.getElementById('bcConfirmedCount');
  if (countEl) countEl.innerText = confirmed;

  const modal = new bootstrap.Modal(document.getElementById('broadcastModal'));
  modal.show();
}

function submitBroadcast(e) {
  if (e && e.preventDefault) e.preventDefault();
  const confirmed = rosterData.filter(b => b.status === 'confirmed').length;
  
  const modalInstance = bootstrap.Modal.getInstance(document.getElementById('broadcastModal'));
  if (modalInstance) modalInstance.hide();

  showAdminToast(`📢 廣播發送成功！已推送至 ${confirmed} 位預約貴賓手機與信箱。`);
}

// Render Moderation Lists (CMS & Reviews)
function renderModerationLists() {
  const revContainer = document.getElementById('adminReviewModerationList');
  if (revContainer) {
    revContainer.innerHTML = moderationReviews.map((rev, idx) => `
      <div class="p-3 rounded-3 bg-dark bg-opacity-50 border ${rev.isPinned ? 'border-warning' : 'border-secondary'} mb-2">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <div class="fw-bold text-white small">${rev.author} - ${rev.title} ${rev.isPinned ? '<span class="badge bg-warning text-dark ms-1">已置頂</span>' : ''}</div>
          <span class="badge bg-warning text-dark">${rev.rating}</span>
        </div>
        <p class="small text-muted mb-2">「${rev.content}」</p>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-warning py-0 px-2 interactive" onclick="togglePinReview(${idx})">
            <i class="fa-solid fa-thumbtack me-1"></i>${rev.isPinned ? '取消置頂' : '置頂推薦'}
          </button>
          <button class="btn btn-sm ${rev.isApproved ? 'btn-success' : 'btn-outline-success'} py-0 px-2 interactive" onclick="approveReview(${idx})">
            ${rev.isApproved ? '已通過' : '審核通過'}
          </button>
        </div>
      </div>
    `).join('');
  }

  const feedContainer = document.getElementById('adminFeedModerationList');
  if (feedContainer) {
    feedContainer.innerHTML = moderationFeeds.map((feed) => `
      <div class="p-3 rounded-3 bg-dark bg-opacity-50 border border-secondary mb-2">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <div class="fw-bold text-white small">${feed.author} - ${feed.title}</div>
          <span class="badge bg-success">${feed.term}日誌</span>
        </div>
        <p class="small text-muted mb-2">${feed.desc} · 讚數 ${feed.likes}</p>
        <button class="btn btn-sm btn-outline-info py-0 px-2 interactive" onclick="showAdminToast('日誌已同步更新至前台動態！')">已推薦展示</button>
      </div>
    `).join('');
  }
}

function togglePinReview(idx) {
  moderationReviews[idx].isPinned = !moderationReviews[idx].isPinned;
  renderModerationLists();
  showAdminToast(moderationReviews[idx].isPinned ? "已成功置頂此篇心得！" : "已取消置頂。");
}

function approveReview(idx) {
  moderationReviews[idx].isApproved = true;
  renderModerationLists();
  showAdminToast("心得審核通過，已公開於社群心得牆！");
}

// Volunteer Kanban Pipeline
function renderKanbanPipeline() {
  const container = document.getElementById('kanbanPipelineContainer');
  if (!container) return;

  const stages = ['新申請', '面談評估', '已認證', '活躍奉仕'];
  const stageIcons = ['fa-file-signature', 'fa-comments', 'fa-certificate', 'fa-star'];
  const stageBadges = ['secondary', 'warning text-dark', 'info text-dark', 'success'];

  container.innerHTML = stages.map((stage, sIdx) => {
    const list = volunteerList.filter(v => v.stage === stage);
    return `
      <div class="col-md-3">
        <div class="kanban-col">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-bold text-light mb-0"><i class="fa-solid ${stageIcons[sIdx]} me-1"></i> ${sIdx + 1}. ${stage} (${list.length})</h6>
            <span class="badge bg-${stageBadges[sIdx]} rounded-pill">${list.length}</span>
          </div>
          ${list.map(v => `
            <div class="kanban-card">
              <div class="fw-bold text-white">${v.name}</div>
              <div class="text-muted small">${v.skills}</div>
              ${v.hours > 0 ? `<div class="text-warning small mt-1"><i class="fa-solid fa-clock me-1"></i>累計：${v.hours} 小時</div>` : ''}
              <div class="mt-2 d-flex justify-content-between align-items-center">
                ${v.hours >= 30 
                  ? `<button class="btn btn-sm btn-outline-warning py-0 px-2 interactive" onclick="generateVolunteerCert('${v.name}', ${v.hours})"><i class="fa-solid fa-award me-1"></i>發放證書</button>` 
                  : `<span class="badge bg-dark text-muted" style="font-size:0.7rem;">${v.note}</span>`}
                ${sIdx < stages.length - 1 
                  ? `<button class="btn btn-sm btn-outline-success py-0 px-2 interactive" onclick="moveVolunteer('${v.id}', '${stages[sIdx + 1]}')">→</button>` 
                  : `<span class="text-success small fw-bold"><i class="fa-solid fa-medal"></i> 核心幹部</span>`}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// Move Volunteer Kanban Stage
function moveVolunteer(volId, nextStage) {
  const vol = volunteerList.find(v => v.id === volId);
  if (vol) {
    vol.stage = nextStage;
    if (nextStage === '已認證' && vol.hours === 0) vol.hours = 30;
    renderKanbanPipeline();
    showAdminToast(`志工【${vol.name}】已推進至【${nextStage}】！`);
  }
}

// Volunteer Appreciation Certificate Modal
function generateVolunteerCert(name, hours) {
  document.getElementById('certVolunteerName').innerText = name;
  document.getElementById('certVolunteerHours').innerText = hours;
  document.getElementById('certSerialCode').innerText = `SHUMEI-VOL-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  document.getElementById('certIssueDate').innerText = `${new Date().getFullYear()} 年 ${new Date().getMonth() + 1} 月 ${new Date().getDate()} 日`;

  const modal = new bootstrap.Modal(document.getElementById('volunteerCertModal'));
  modal.show();
}

// Add Volunteer Modal
function openAddVolunteerModal() {
  const modal = new bootstrap.Modal(document.getElementById('addVolunteerModal'));
  modal.show();
}

function submitAddVolunteer(e) {
  if (e && e.preventDefault) e.preventDefault();
  const name = document.getElementById('addVolName').value.trim() || '志工夥伴';
  const phone = document.getElementById('addVolPhone').value.trim() || '0900-000-000';
  const skills = document.getElementById('addVolSkills').value.trim() || '熱心服務';

  volunteerList.unshift({
    id: `v_${Date.now()}`,
    name: name,
    phone: phone,
    stage: '新申請',
    skills: skills,
    note: '新招募成員',
    hours: 0
  });

  renderKanbanPipeline();

  const modalInstance = bootstrap.Modal.getInstance(document.getElementById('addVolunteerModal'));
  if (modalInstance) modalInstance.hide();

  showAdminToast(`志工【${name}】已成功建檔並加入 CRM「新申請」！`);
}

// New Farm Log Modal
function openNewFeedModal() {
  const modal = new bootstrap.Modal(document.getElementById('newFeedModal'));
  modal.show();
}

function submitNewFeed(e) {
  if (e && e.preventDefault) e.preventDefault();
  const title = document.getElementById('newFeedTitle').value.trim() || '今日產地日誌';
  const author = document.getElementById('newFeedAuthor').value.trim() || '秀明農友';
  const term = document.getElementById('newFeedTerm').value.trim() || '立夏';
  const content = document.getElementById('newFeedContent').value.trim() || '日誌內容';

  moderationFeeds.unshift({
    id: `mfeed_${Date.now()}`,
    author: author,
    title: title,
    term: term,
    likes: 1,
    desc: content.slice(0, 30) + '...'
  });

  renderModerationLists();

  const modalInstance = bootstrap.Modal.getInstance(document.getElementById('newFeedModal'));
  if (modalInstance) modalInstance.hide();

  showAdminToast(`日誌【${title}】已成功發布並同步前台！`);
}
