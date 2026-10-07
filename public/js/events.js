/**
 * events.js - 活動發布、線上報名與現場 QR Code 簽到
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

let allEvents = [];
let allRegistrations = [];
let currentCategory = 'all';
let qrScanner = null;

document.addEventListener('DOMContentLoaded', () => {
  loadEventsData();
  loadRegistrationsData();
});

// 載入活動資料
function loadEventsData() {
  const saved = localStorage.getItem('SHUMEI_ACTIVITIES_EVENTS');
  if (saved) {
    try {
      allEvents = JSON.parse(saved);
    } catch (e) {
      allEvents = [];
    }
  } else {
    allEvents = [];
    localStorage.setItem('SHUMEI_ACTIVITIES_EVENTS', JSON.stringify(allEvents));
  }

  // 嘗試從 Firestore 同步
  db.collection('activities_events').get().then(snapshot => {
    if (!snapshot.empty) {
      const remoteEvents = [];
      snapshot.forEach(doc => remoteEvents.push({ id: doc.id, ...doc.data() }));
      allEvents = remoteEvents;
      localStorage.setItem('SHUMEI_ACTIVITIES_EVENTS', JSON.stringify(allEvents));
    }
    renderEvents();
  }).catch(err => {
    console.warn("Firestore events sync warning:", err);
    renderEvents();
  });
}

// 載入報名清單
function loadRegistrationsData() {
  const saved = localStorage.getItem('SHUMEI_ACTIVITIES_REGISTRATIONS');
  if (saved) {
    try {
      allRegistrations = JSON.parse(saved);
    } catch (e) {
      allRegistrations = [];
    }
  } else {
    allRegistrations = [];
  }
}

// 渲染活動卡片
function renderEvents() {
  const container = document.getElementById('events-container');
  container.innerHTML = '';

  const filtered = currentCategory === 'all' 
    ? allEvents 
    : allEvents.filter(e => e.category === currentCategory);

  document.getElementById('event-count-text').innerText = filtered.length;

  if (filtered.length === 0) {
    const categoryText = currentCategory === 'all' ? '' : `「${currentCategory}」類別的`;
    container.innerHTML = `
      <div class="col-12 text-center text-muted py-5">
        <i class="fa-solid fa-calendar-xmark fa-3x mb-3 opacity-50"></i>
        <p>目前尚無${categoryText}公開活動，點擊右上角「＋發布新活動」建立。</p>
      </div>
    `;
    return;
  }

  filtered.forEach(evt => {
    const isFull = evt.capacity > 0 && evt.registeredCount >= evt.capacity;
    const capacityText = evt.capacity > 0 
      ? `已報名 <strong>${evt.registeredCount || 0}</strong> / ${evt.capacity} 人`
      : `已報名 <strong>${evt.registeredCount || 0}</strong> 人 (名額不限)`;

    let badgeColor = 'bg-info text-dark';
    if (evt.category === '研修營隊') badgeColor = 'bg-warning text-dark';
    else if (evt.category === '自然農法') badgeColor = 'bg-success text-white';

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.location)}`;
    const formatTime = evt.startTime ? evt.startTime.replace('T', ' ') : '待定';

    container.innerHTML += `
      <div class="col-12 col-md-6 col-lg-4">
        <div class="event-card p-3 h-100 d-flex flex-column justify-content-between">
          <div>
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="event-badge ${badgeColor}">${evt.category}</span>
              ${isFull ? '<span class="badge bg-danger" style="font-size: 10px;">名額已滿</span>' : '<span class="badge bg-success" style="font-size: 10px;">開放報名</span>'}
            </div>

            <h6 class="text-white font-weight-bold mb-1">${evt.title}</h6>
            
            <div class="small text-muted mb-1" style="font-size: 11px;">
              <i class="fa-regular fa-clock me-1 text-warning"></i>${formatTime}
            </div>

            <div class="small text-light mb-1" style="font-size: 11px;">
              <a href="${mapsUrl}" target="_blank" class="text-decoration-none text-info" title="在 Google 地圖開啟">
                <i class="fa-solid fa-location-dot me-1 text-danger"></i>${evt.location}
              </a>
            </div>

            <div class="small text-muted mb-2" style="font-size: 11px;">
              <i class="fa-solid fa-ticket me-1 text-light"></i>費用：<span class="text-light">${evt.fee || '免費'}</span>
            </div>

            <p class="small text-muted mb-2" style="line-height: 1.4; font-size: 11px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${evt.desc || '無特別說明'}</p>
          </div>

          <div>
            <div class="small text-muted mb-2" style="font-size: 11px;">${capacityText}</div>
            <button class="btn btn-sm btn-primary-custom w-100 py-1 interactive font-weight-bold" 
              ${isFull ? 'disabled' : ''} 
              onclick="openRegisterModal('${evt.id}', '${evt.title.replace(/'/g, "\\'")}')"
              style="font-size: 12px;">
              ${isFull ? '名額已滿' : '<i class="fa-solid fa-signature me-1"></i> 即刻線上報名'}
            </button>
          </div>
        </div>
      </div>
    `;
  });
}

// 類別過濾
function filterEvents(category, btn) {
  currentCategory = category;
  document.querySelectorAll('#category-filter button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderEvents();
}

// ================= 報名流程與憑證生成 =================

function openRegisterModal(eventId, eventTitle) {
  document.getElementById('reg-event-id').value = eventId;
  document.getElementById('reg-event-title').innerText = `報名：${eventTitle}`;
  document.getElementById('reg-user-name').value = localStorage.getItem('SHUMEI_LAST_REPORTER_NAME') || '';
  document.getElementById('reg-user-phone').value = '';
  document.getElementById('reg-user-group').value = '';
  document.getElementById('reg-user-notes').value = '';

  new bootstrap.Modal(document.getElementById('registerModal')).show();
}

function submitRegistration() {
  const eventId = document.getElementById('reg-event-id').value;
  const name = document.getElementById('reg-user-name').value.trim();
  const phone = document.getElementById('reg-user-phone').value.trim();
  const group = document.getElementById('reg-user-group').value.trim();
  const notes = document.getElementById('reg-user-notes').value.trim();

  if (!name || !phone) {
    alert("請填寫參加者姓名與聯絡電話！");
    return;
  }

  const targetEvent = allEvents.find(e => e.id === eventId);
  if (!targetEvent) return;

  const ticketCode = `SHM-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random()*1000)}`;

  const regItem = {
    ticketCode: ticketCode,
    eventId: eventId,
    eventTitle: targetEvent.title,
    eventTime: targetEvent.startTime,
    eventLoc: targetEvent.location,
    name: name,
    phone: phone,
    group: group,
    notes: notes,
    checkedIn: false,
    timestamp: new Date().toISOString()
  };

  allRegistrations.push(regItem);
  localStorage.setItem('SHUMEI_ACTIVITIES_REGISTRATIONS', JSON.stringify(allRegistrations));

  // 人數加 1
  targetEvent.registeredCount = (targetEvent.registeredCount || 0) + 1;
  localStorage.setItem('SHUMEI_ACTIVITIES_EVENTS', JSON.stringify(allEvents));

  // 關閉報名 Modal
  bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
  renderEvents();

  // 展現專屬入場 QR Code 憑證
  showTicketModal(regItem);
}

function showTicketModal(regItem) {
  document.getElementById('ticket-event-name').innerText = regItem.eventTitle;
  document.getElementById('ticket-time-loc').innerText = `${regItem.eventTime} | ${regItem.eventLoc}`;
  document.getElementById('ticket-user-name').innerText = regItem.name;
  document.getElementById('ticket-code').innerText = regItem.ticketCode;

  // 生成 QR Code
  const qrContainer = document.getElementById('ticket-qrcode');
  qrContainer.innerHTML = '';
  new QRCode(qrContainer, {
    text: regItem.ticketCode,
    width: 180,
    height: 180,
    colorDark: "#111111",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  new bootstrap.Modal(document.getElementById('ticketModal')).show();
}

// ================= 發布新活動 =================

function openPublishModal() {
  document.getElementById('pub-title').value = '';
  document.getElementById('pub-category').value = '研修營隊';
  document.getElementById('pub-start-time').value = '';
  document.getElementById('pub-capacity').value = '30';
  document.getElementById('pub-location').value = '';
  document.getElementById('pub-fee').value = '免費參加';
  document.getElementById('pub-auth-pwd').value = '';
  document.getElementById('pub-desc').value = '';

  new bootstrap.Modal(document.getElementById('publishModal')).show();
}

function submitPublishEvent() {
  const pwd = document.getElementById('pub-auth-pwd').value.trim();
  if (pwd !== '1234') {
    alert("幹部授權密碼錯誤！(預設: 1234)");
    return;
  }

  const title = document.getElementById('pub-title').value.trim();
  const category = document.getElementById('pub-category').value;
  const startTime = document.getElementById('pub-start-time').value;
  const capacity = parseInt(document.getElementById('pub-capacity').value) || 0;
  const location = document.getElementById('pub-location').value.trim();
  const fee = document.getElementById('pub-fee').value.trim();
  const desc = document.getElementById('pub-desc').value.trim();

  if (!title || !startTime || !location) {
    alert("請完整填寫活動名稱、開始時間與集合地點！");
    return;
  }

  const newEvent = {
    id: 'evt_' + Date.now(),
    title: title,
    category: category,
    startTime: startTime,
    capacity: capacity,
    registeredCount: 0,
    location: location,
    fee: fee,
    desc: desc,
    status: 'open',
    createdAt: new Date().toISOString()
  };

  allEvents.unshift(newEvent);
  localStorage.setItem('SHUMEI_ACTIVITIES_EVENTS', JSON.stringify(allEvents));

  db.collection('activities_events').doc(newEvent.id).set(newEvent).catch(err => {
    console.warn("Firestore publish warning:", err);
  });

  bootstrap.Modal.getInstance(document.getElementById('publishModal')).hide();
  renderEvents();
  alert(`🎉 活動「${title}」已成功公開發布！`);
}

// ================= 現場相機 QR Code 簽到掃描器 =================

function openScannerModal() {
  new bootstrap.Modal(document.getElementById('scannerModal')).show();
  startScanner();
}

function startScanner() {
  const resultEl = document.getElementById('scan-result');
  resultEl.className = 'p-2 rounded-2 bg-dark text-center small text-light border border-secondary';
  resultEl.innerText = '鏡頭就緒，請對準學員手機憑證 QR Code...';

  if (!qrScanner) {
    qrScanner = new Html5Qrcode("scanner-reader");
  }

  qrScanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 220, height: 220 } },
    (decodedText) => {
      handleScannedTicket(decodedText);
    },
    (errorMessage) => {
      // 掃描過程中忽視一般無條碼錯誤
    }
  ).catch(err => {
    resultEl.className = 'p-2 rounded-2 bg-danger text-center small text-white';
    resultEl.innerText = '無法啟動相機鏡頭，請確認瀏覽器相機授權。';
  });
}

function handleScannedTicket(code) {
  const resultEl = document.getElementById('scan-result');
  const reg = allRegistrations.find(r => r.ticketCode === code);

  if (reg) {
    if (reg.checkedIn) {
      resultEl.className = 'p-2 rounded-2 bg-warning text-dark text-center font-weight-bold';
      resultEl.innerText = `⚠️【重複報到】${reg.name} 之前已完成簽到！`;
    } else {
      reg.checkedIn = true;
      reg.checkInTime = new Date().toLocaleTimeString();
      localStorage.setItem('SHUMEI_ACTIVITIES_REGISTRATIONS', JSON.stringify(allRegistrations));

      resultEl.className = 'p-2 rounded-2 bg-success text-white text-center font-weight-bold';
      resultEl.innerText = `✅【簽到成功】${reg.name} 歡迎參加！(${reg.checkInTime})`;

      // 播放輕柔成功音效（Web Audio API）
      playCheckInBeep();
    }
  } else {
    resultEl.className = 'p-2 rounded-2 bg-danger text-white text-center';
    resultEl.innerText = `❌ 無效的報到代碼：${code}`;
  }
}

function stopScanner() {
  if (qrScanner) {
    qrScanner.stop().then(() => {
      qrScanner.clear();
      qrScanner = null;
    }).catch(err => console.warn("Stop scanner error:", err));
  }
}

// 報到成功嗶聲音效
function playCheckInBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 音階
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {
    // 忽視音訊錯誤
  }
}
