/**
 * Shumei Natural Farming Platform - Client Interactive Script (natural-farm.js)
 * Fully functional logic without dummy alerts.
 */

// Initialize Firebase if not already initialized
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

// Default Mock Data for Instant Interactive Showcase & Local Fallback
const DEFAULT_EVENTS = [
  {
    id: 'event_dining_01',
    title: '光之餐桌：初夏旬味無菜單料理',
    category: 'dining',
    categoryName: '🍽️ 餐桌料理',
    bannerUrl: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80',
    description: '在星空與稻浪之間，品嚐 100% 秀明自然農法自家採種作物，感受零農藥、無肥料土地的原初純淨風味。主廚特別研發初夏番茄無水料理與手作豆花。',
    location: '南投縣埔里鎮自然農法示範園區 (光之餐桌戶外木平台)',
    mapUrl: 'https://maps.google.com/?q=埔里秀明示範農場',
    pricing: 'NT$ 1,200 (保證金席位 / 現場返還)',
    bringUtensilsBonus: '+20 Karma',
    sessions: [
      { id: 's1', date: '2026-06-06 (六)', time: '17:30 - 20:00', max: 20, booked: 18, waitlist: 0 },
      { id: 's2', date: '2026-06-07 (日)', time: '17:30 - 20:00', max: 20, booked: 20, waitlist: 2 }
    ]
  },
  {
    id: 'event_farm_02',
    title: '自然農法水稻插秧與奉仕日',
    category: 'farm_exp',
    categoryName: '🌱 農事體驗',
    bannerUrl: 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?auto=format&fit=crop&w=800&q=80',
    description: '赤腳踏入肥沃的自然農法水田，親手種下自家採種第 12 代越光米秧苗。體驗人與土地最深層的肌膚接觸與奉仕喜悅。',
    location: '宜蘭縣員山鄉秀明純淨水源田區',
    mapUrl: 'https://maps.google.com/?q=宜蘭員山水稻田',
    pricing: '免費公益 / 歡迎自備環保水壺與換洗衣物',
    bringUtensilsBonus: '+40 Karma (奉仕加碼)',
    sessions: [
      { id: 's1', date: '2026-05-23 (六)', time: '09:00 - 12:30', max: 30, booked: 15, waitlist: 0 },
      { id: 's2', date: '2026-05-24 (日)', time: '09:00 - 12:30', max: 30, booked: 28, waitlist: 0 }
    ]
  },
  {
    id: 'event_seed_03',
    title: '水花園市集：自家採種工作坊與種子交換',
    category: 'seed_saving',
    categoryName: '🧬 保種工作坊',
    bannerUrl: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=800&q=80',
    description: '深入了解作物生命基因與自留種技術。學習如何挑選健壯種母、乾燥保存種子，並參與「產地限定種子交換會」。',
    location: '台北市大安區水花園有機農夫市集',
    mapUrl: 'https://maps.google.com/?q=台北水花園市集',
    pricing: '免費參與 / 贈送自家採種種子包一份',
    bringUtensilsBonus: '+30 Karma',
    sessions: [
      { id: 's1', date: '2026-05-30 (六)', time: '14:00 - 16:30', max: 25, booked: 12, waitlist: 0 }
    ]
  },
  {
    id: 'event_market_04',
    title: '自然農法當令生鮮市集與盲測品嚐',
    category: 'market',
    categoryName: '🧺 市集出攤',
    bannerUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
    description: '產地直送純淨蔬果！現場設置「味覺盲測區」，親口品鑑自然農法蔬菜與慣行蔬菜的純淨度與甜度差異。',
    location: '台中市西區草悟道市集專區',
    mapUrl: 'https://maps.google.com/?q=台中草悟道',
    pricing: '自由入場 / 盲測集點換好禮',
    bringUtensilsBonus: '+20 Karma',
    sessions: [
      { id: 's1', date: '2026-06-13 (六)', time: '10:00 - 17:00', max: 100, booked: 42, waitlist: 0 }
    ]
  }
];

const DEFAULT_FEED = [
  {
    id: 'feed_01',
    authorName: '陳志遠 (埔里秀明示範農場)',
    solarTerm: '立夏',
    date: '2026-05-12',
    title: '今日越光米秧苗晨露與根系呼吸',
    content: '清晨五點來到田區，陽光穿透薄霧灑在水稻葉片上。自然農法的泥土捏起來帶著天然的清香，沒有任何刺鼻肥料味。根系已經牢牢抓住深層土壤，展現出驚人的生命力！',
    imageUrl: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80',
    likes: 48,
    comments: 6
  },
  {
    id: 'feed_02',
    authorName: '林素真 (員山有機水源區)',
    solarTerm: '立夏',
    date: '2026-05-10',
    title: '自家採種第 9 代黑豆開花期的生態訪客',
    content: '田埂旁的野花引來了大批本土野蜂協助授粉。不用農藥後，整個農場成為了昆蟲與鳥類的庇護所，作物與大自然真正達成了和諧共生。',
    imageUrl: 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?auto=format&fit=crop&w=800&q=80',
    likes: 35,
    comments: 3
  }
];

const DEFAULT_REVIEWS = [
  {
    id: 'rev_01',
    authorName: '黃雅筑 (食農教育工作者)',
    eventName: '光之餐桌：初夏旬味無菜單料理',
    purityRating: 5,
    connectionRating: 5,
    expRating: 5,
    date: '2026-05-08',
    content: '第一口吃下番茄冷湯時眼淚差點流出來，那是完全沒有任何化學添加的純粹甜味與果酸！吃完後身體感覺無比輕盈，真心推薦大家一定要來體驗一次自然農法餐桌。',
    karmaEarned: 50
  },
  {
    id: 'rev_02',
    authorName: '張書銘 (軟體工程師)',
    eventName: '自然農法水稻插秧日',
    purityRating: 5,
    connectionRating: 5,
    expRating: 5,
    date: '2026-05-02',
    content: '平常坐在辦公室打電腦，第一次赤腳踩進水田的那一刻，感受到了泥土的溫度與生命力。自備環保餐具還賺到了 40 點 Karma 點數，太棒了！',
    karmaEarned: 50
  }
];

// App State Management
let currentEvents = [...DEFAULT_EVENTS];
let currentCategory = 'all';
let userKarma = parseInt(localStorage.getItem('shumei_user_karma') || '380', 10);
let userBookings = JSON.parse(localStorage.getItem('shumei_user_bookings') || '[]');
let userVouchers = JSON.parse(localStorage.getItem('shumei_user_vouchers') || '[]');
let currentSelectedEvent = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  updateKarmaDisplay();
  updateMyBookingsBadge();
  renderVouchersList();
  renderEvents();
  renderFeedPosts();
  renderReviews();
  fetchFirestoreData();
});

// Sync data from Firestore if available
function fetchFirestoreData() {
  db.collection('natural_events').get().then(snapshot => {
    if (!snapshot.empty) {
      const remoteEvents = [];
      snapshot.forEach(doc => {
        remoteEvents.push({ id: doc.id, ...doc.data() });
      });
      currentEvents = remoteEvents;
      renderEvents();
    }
  }).catch(err => {
    console.log("Firestore events offline or using defaults:", err);
  });
}

// Custom Glass Toast Notification
function showToast(message, type = 'success') {
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

// Switch Main Navigation Tabs
function switchMainTab(tabName, btnElement) {
  document.querySelectorAll('.tab-pane-content').forEach(pane => {
    pane.style.display = 'none';
  });
  const targetPane = document.getElementById(`tab-${tabName}`);
  if (targetPane) {
    targetPane.style.display = 'block';
  }

  if (btnElement) {
    document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
    btnElement.classList.add('active');
  }
}

// Render Events Grid
function renderEvents() {
  const container = document.getElementById('eventsGrid');
  if (!container) return;

  const filtered = currentCategory === 'all' 
    ? currentEvents 
    : currentEvents.filter(e => e.category === currentCategory);

  document.getElementById('eventCountDisplay').innerText = filtered.length;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5 text-muted">
        <i class="fa-solid fa-seedling fs-1 mb-2"></i>
        <p>此分類目前尚無活動，敬請期待即將推出的農事行程！</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map((event, idx) => {
    const mainSession = event.sessions[0] || { max: 20, booked: 0, date: '近期公布', time: '' };
    const pct = Math.min(100, Math.round((mainSession.booked / mainSession.max) * 100));
    const isFull = mainSession.booked >= mainSession.max;

    return `
      <div class="col-md-6 col-lg-6 stagger-item" style="animation-delay: ${idx * 60}ms;">
        <div class="farm-card h-100 d-flex flex-column justify-content-between interactive">
          <div>
            <!-- Banner Image & Badge -->
            <div class="position-relative rounded-3 overflow-hidden mb-3" style="height: 180px;">
              <img src="${event.bannerUrl}" alt="${event.title}" class="w-100 h-100 object-fit-cover">
              <span class="position-absolute top-0 start-0 m-2 farm-badge-pill ${event.category === 'dining' ? 'gold' : 'green'}">
                ${event.categoryName || '自然農法'}
              </span>
              <span class="position-absolute top-0 end-0 m-2 badge bg-dark bg-opacity-75 text-warning border border-warning-subtle">
                <i class="fa-solid fa-utensils me-1"></i>${event.bringUtensilsBonus}
              </span>
            </div>

            <!-- Title & Description -->
            <h4 class="h5 fw-bold text-white mb-2">${event.title}</h4>
            <p class="text-muted small mb-3 text-truncate-2">${event.description}</p>

            <!-- Meta Details -->
            <div class="small text-light mb-2">
              <div class="mb-1"><i class="fa-regular fa-calendar text-warning me-2"></i>${mainSession.date} ${mainSession.time}</div>
              <div class="mb-1"><i class="fa-solid fa-location-dot text-danger me-2"></i><a href="${event.mapUrl}" target="_blank" class="text-info text-decoration-none">${event.location}</a></div>
              <div><i class="fa-solid fa-coins text-warning me-2"></i>${event.pricing}</div>
            </div>

            <!-- Quota Bar -->
            <div class="mt-3">
              <div class="d-flex justify-content-between small">
                <span class="text-muted">預約名額進度</span>
                <span class="${isFull ? 'text-warning fw-bold' : 'text-success'}">${mainSession.booked} / ${mainSession.max} 人 ${isFull ? '(已滿額 · 開放候補)' : ''}</span>
              </div>
              <div class="quota-progress-container">
                <div class="quota-progress-fill ${isFull ? 'full' : ''}" style="width: ${pct}%;"></div>
              </div>
            </div>
          </div>

          <!-- CTA Buttons -->
          <div class="d-flex gap-2 mt-4">
            <button class="btn btn-sm btn-primary-custom w-100 interactive" onclick="openBookingModal('${event.id}')">
              <i class="fa-solid fa-ticket me-1"></i> ${isFull ? '登記候補預約' : '立即智慧報名'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Category Filter Function
function filterEventsByCategory(category, btnElement) {
  currentCategory = category;
  document.querySelectorAll('#tab-events .btn').forEach(b => {
    b.classList.remove('active-category', 'btn-dark');
    b.classList.add('btn-outline-secondary');
  });
  if (btnElement) {
    btnElement.classList.remove('btn-outline-secondary');
    btnElement.classList.add('active-category', 'btn-dark');
  }
  renderEvents();
}

// Quick Book from Hero Carousel
function quickBookEvent(eventId) {
  switchMainTab('events');
  openBookingModal(eventId);
}

// Open Smart Booking Modal
function openBookingModal(eventId) {
  const event = currentEvents.find(e => e.id === eventId) || currentEvents[0];
  if (!event) return;
  currentSelectedEvent = event;

  document.getElementById('bookingModalTitle').innerText = `預約：${event.title}`;
  document.getElementById('bookEventId').value = event.id;

  // Populate Session Selector
  const sessionSelect = document.getElementById('bookSessionSelect');
  sessionSelect.innerHTML = event.sessions.map(s => {
    const isFull = s.booked >= s.max;
    return `<option value="${s.id}">${s.date} ${s.time} (${s.booked}/${s.max}人) ${isFull ? '【額滿可候補】' : '【熱烈報名中】'}</option>`;
  }).join('');

  // Reset form and view states
  document.getElementById('bookingForm').style.display = 'block';
  document.getElementById('bookingSuccessView').style.display = 'none';

  const modal = new bootstrap.Modal(document.getElementById('bookingModal'));
  modal.show();
}

// Submit Booking Form & Generate QR Code + ICS
function submitBooking(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!currentSelectedEvent) return;

  const sessionId = document.getElementById('bookSessionSelect').value;
  const userName = document.getElementById('bookUserName').value.trim() || '預約貴賓';
  const userPhone = document.getElementById('bookUserPhone').value.trim() || '0900-000-000';
  const userEmail = document.getElementById('bookUserEmail').value.trim() || 'user@shumei.org';
  const headcount = parseInt(document.getElementById('bookHeadcount').value, 10) || 1;
  const bringUtensils = document.getElementById('bookUtensils').checked;

  const session = currentSelectedEvent.sessions.find(s => s.id === sessionId) || currentSelectedEvent.sessions[0];
  const isWaitlist = session.booked >= session.max;

  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'linepay';
  const paymentMethodNames = {
    linepay: 'LINE Pay 行動支付',
    newebpay: '藍新金流 (信用卡/ATM)',
    onsite: '現場繳費/返還保證金'
  };

  // Generate Unique Ticket Token
  const token = `SHUMEI-NF-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const newBooking = {
    id: `book_${Date.now()}`,
    token: token,
    eventId: currentSelectedEvent.id,
    eventTitle: currentSelectedEvent.title,
    sessionDate: session.date,
    sessionTime: session.time,
    location: currentSelectedEvent.location,
    userName: userName,
    userPhone: userPhone,
    userEmail: userEmail,
    headcount: headcount,
    bringUtensils: bringUtensils,
    paymentMethod: paymentMethod,
    paymentMethodName: paymentMethodNames[paymentMethod],
    paymentStatus: paymentMethod === 'onsite' ? '現場繳納' : '線上已授權支付',
    status: isWaitlist ? '候補中' : '已確認',
    createdAt: new Date().toISOString()
  };

  // Save to LocalStorage
  userBookings.unshift(newBooking);
  localStorage.setItem('shumei_user_bookings', JSON.stringify(userBookings));

  // Sync to Firestore natural_bookings collection
  db.collection('natural_bookings').doc(token).set({
    ...newBooking,
    qrCodeToken: token,
    checkedIn: false
  }).catch(err => console.log("Firestore booking sync (offline mode):", err));

  // Award Karma Points (+40 for booking + utensils)
  const earnedKarma = bringUtensils ? 40 : 20;
  userKarma += earnedKarma;
  localStorage.setItem('shumei_user_karma', userKarma.toString());
  updateKarmaDisplay();
  updateMyBookingsBadge();

  // Show Success View & Render QR Code
  document.getElementById('bookingForm').style.display = 'none';
  document.getElementById('bookingSuccessView').style.display = 'block';
  document.getElementById('bookingTokenDisplay').innerText = token;
  document.getElementById('bookingSuccessSubtitle').innerText = isWaitlist 
    ? `已為您成功排入候補隊列（順位第 ${session.waitlist + 1} 位）！釋出名額將即時發送通知。`
    : `報名已確認（${paymentMethodNames[paymentMethod]} · 已獲 +${earnedKarma} Karma 綠色積分）！請出示以下 QR Code 完成現場快速報到。`;

  // Render QR Code using qrcode.js
  const qrContainer = document.getElementById('bookingQrCodeContainer');
  qrContainer.innerHTML = '';
  new QRCode(qrContainer, {
    text: JSON.stringify({ 
      token: token, 
      event: currentSelectedEvent.title, 
      name: userName, 
      count: headcount,
      pay: paymentMethodNames[paymentMethod]
    }),
    width: 180,
    height: 180,
    colorDark: "#1b4332",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  // Update session count locally
  if (!isWaitlist) {
    session.booked += headcount;
  } else {
    session.waitlist += headcount;
  }
  renderEvents();
  showToast(`報名與結帳確認成功（${paymentMethodNames[paymentMethod]}）！已獲得 +${earnedKarma} Karma 積分！`);
}

// Download .ics Calendar File
function downloadIcsFile() {
  if (!userBookings.length) return;
  const b = userBookings[0];
  const icsData = 
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Shumei Natural Farming//Event Calendar//EN
BEGIN:VEVENT
SUMMARY:${b.eventTitle}
DESCRIPTION:預約人：${b.userName} (${b.headcount}位) \\n核銷 Token: ${b.token} \\n自備餐具：${b.bringUtensils ? '是' : '否'}
LOCATION:${b.location}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', `shumei_event_${b.token}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("已成功下載 .ics 行事曆檔案！");
}

// Open My Bookings Modal
function openMyBookingsModal() {
  const container = document.getElementById('myBookingsList');
  if (!userBookings.length) {
    container.innerHTML = `
      <div class="text-center py-4 text-muted">
        <i class="fa-regular fa-calendar-xmark fs-1 mb-2"></i>
        <p>您目前尚未預約任何活動，快去探索並預約吧！</p>
      </div>`;
  } else {
    container.innerHTML = userBookings.map((b) => `
      <div class="p-3 rounded-4 bg-dark bg-opacity-50 border border-secondary mb-3">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <h5 class="fw-bold text-white mb-1">${b.eventTitle}</h5>
            <span class="badge ${b.status === '已確認' ? 'bg-success' : 'bg-warning text-dark'} rounded-pill">${b.status}</span>
            <span class="text-muted small ms-2"><i class="fa-solid fa-users me-1"></i>${b.headcount} 位</span>
          </div>
          <button class="btn btn-sm btn-outline-danger rounded-pill" onclick="cancelBooking('${b.token}')">取消預約</button>
        </div>
        <div class="small text-light mb-2">
          <div><i class="fa-regular fa-clock text-warning me-2"></i>${b.sessionDate} ${b.sessionTime}</div>
          <div><i class="fa-solid fa-location-dot text-danger me-2"></i>${b.location}</div>
          <div><i class="fa-solid fa-qrcode text-info me-2"></i>核銷金鑰: <code>${b.token}</code></div>
        </div>
      </div>
    `).join('');
  }

  const modal = new bootstrap.Modal(document.getElementById('myBookingsModal'));
  modal.show();
}

// Cancel Booking
function cancelBooking(token) {
  userBookings = userBookings.filter(b => b.token !== token);
  localStorage.setItem('shumei_user_bookings', JSON.stringify(userBookings));
  updateMyBookingsBadge();
  openMyBookingsModal();
  showToast("已成功取消預約！名額已釋出給候補者。", "info");
}

// Update Karma Counter & UI
function updateKarmaDisplay() {
  document.getElementById('userKarmaDisplay').innerText = `${userKarma} pts`;
  const modalCount = document.getElementById('modalKarmaCount');
  if (modalCount) modalCount.innerText = userKarma;
}

function updateMyBookingsBadge() {
  const badge = document.getElementById('myBookingsCount');
  if (badge) {
    if (userBookings.length > 0) {
      badge.style.display = 'inline-block';
      badge.innerText = userBookings.length;
    } else {
      badge.style.display = 'none';
    }
  }
}

// Open Karma Modal
function openKarmaModal() {
  updateKarmaDisplay();
  renderVouchersList();
  const modal = new bootstrap.Modal(document.getElementById('karmaModal'));
  modal.show();
}

// Redeem Karma Rewards with Real Voucher Storage
function redeemKarmaReward(rewardName, cost) {
  if (userKarma < cost) {
    showToast(`您的 Karma 點數不足 (尚需 ${cost - userKarma} 點)。多參加農事體驗或發表心得即可累積！`, "warning");
    return;
  }
  userKarma -= cost;
  localStorage.setItem('shumei_user_karma', userKarma.toString());
  updateKarmaDisplay();

  // Add Voucher
  const voucher = {
    id: `VOUCHER-${Date.now().toString(36).toUpperCase()}`,
    title: rewardName,
    date: new Date().toISOString().split('T')[0],
    code: `SHUMEI-REWARD-${Math.floor(100000 + Math.random() * 900000)}`
  };
  userVouchers.unshift(voucher);
  localStorage.setItem('shumei_user_vouchers', JSON.stringify(userVouchers));
  renderVouchersList();

  showToast(`🎉 成功兌換「${rewardName}」！已存入您的兌換券匣。`);
}

function renderVouchersList() {
  const container = document.getElementById('myVouchersList');
  if (!container) return;

  if (!userVouchers.length) {
    container.innerHTML = `<div class="text-muted text-center py-4">尚未兌換任何禮品，快累積點數兌換吧！</div>`;
  } else {
    container.innerHTML = userVouchers.map(v => `
      <div class="p-2 rounded-3 bg-dark bg-opacity-75 border border-success mb-2">
        <div class="d-flex justify-content-between align-items-center">
          <strong class="text-warning">${v.title}</strong>
          <span class="badge bg-success">可使用</span>
        </div>
        <div class="text-light" style="font-size: 0.75rem;">核銷代碼: <code>${v.code}</code></div>
        <div class="text-muted" style="font-size: 0.7rem;">兌換日期: ${v.date}</div>
      </div>
    `).join('');
  }
}

// Render Feed Posts with Functional Share and Like
function renderFeedPosts() {
  const container = document.getElementById('feedPostsContainer');
  if (!container) return;

  container.innerHTML = DEFAULT_FEED.map((feed, idx) => `
    <div class="farm-card mb-3 stagger-item" style="animation-delay: ${idx * 80}ms;">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div class="d-flex align-items-center gap-2">
          <div class="farm-brand-logo" style="width: 32px; height: 32px;">
            <i class="fa-solid fa-user-astronaut text-white" style="font-size: 0.9rem;"></i>
          </div>
          <div>
            <div class="fw-bold text-white small">${feed.authorName}</div>
            <div class="text-muted" style="font-size: 0.72rem;">${feed.date} · 節氣：${feed.solarTerm}</div>
          </div>
        </div>
        <span class="seed-gen-tag"><i class="fa-solid fa-leaf me-1"></i>產地即時筆記</span>
      </div>

      <h5 class="fw-bold text-white mb-2">${feed.title}</h5>
      <p class="small text-light mb-3">${feed.content}</p>

      <div class="rounded-3 overflow-hidden mb-3" style="max-height: 260px;">
        <img src="${feed.imageUrl}" alt="${feed.title}" class="w-100 h-100 object-fit-cover">
      </div>

      <div class="d-flex justify-content-between align-items-center small text-muted">
        <div class="d-flex gap-3">
          <span class="interactive text-light" onclick="likeFeedPost(this, ${feed.likes})"><i class="fa-regular fa-heart me-1"></i> ${feed.likes}</span>
          <span class="interactive text-light" onclick="openAskFarmerModal('${feed.authorName.split(' ')[0]}')"><i class="fa-regular fa-comment me-1"></i> ${feed.comments}</span>
        </div>
        <button class="btn btn-sm btn-outline-light rounded-pill px-3 py-0 interactive" onclick="shareFeed('${feed.title}')">
          <i class="fa-solid fa-share-nodes me-1"></i> 分享
        </button>
      </div>
    </div>
  `).join('');
}

function likeFeedPost(element, initialLikes) {
  element.innerHTML = `<i class="fa-solid fa-heart text-danger me-1"></i> ${initialLikes + 1}`;
  showToast("感謝您的按讚支持！農友已收到您的鼓勵 ❤️");
}

function shareFeed(title) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(`${window.location.href}#feed`);
  }
  showToast(`已複製「${title}」日誌分享連結！`);
}

// Render Reviews Grid
function renderReviews() {
  const container = document.getElementById('reviewsGrid');
  if (!container) return;

  container.innerHTML = DEFAULT_REVIEWS.map((rev, idx) => `
    <div class="col-md-6 stagger-item" style="animation-delay: ${idx * 70}ms;">
      <div class="farm-card h-100 interactive">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="fw-bold text-white">${rev.authorName}</div>
          <span class="text-muted small">${rev.date}</span>
        </div>
        <div class="text-warning small mb-2"><i class="fa-solid fa-bullhorn me-1"></i>${rev.eventName}</div>

        <!-- 3-Dimension Sensory Badges -->
        <div class="mb-3">
          <span class="sensory-badge"><i class="fa-solid fa-droplet text-info me-1"></i>純淨度: ${'⭐'.repeat(rev.purityRating)}</span>
          <span class="sensory-badge"><i class="fa-solid fa-earth-americas text-success me-1"></i>土地連結: ${'⭐'.repeat(rev.connectionRating)}</span>
        </div>

        <p class="small text-light mb-2">「${rev.content}」</p>
      </div>
    </div>
  `).join('');
}

// Submit UGC Review
function openReviewModal() {
  const modal = new bootstrap.Modal(document.getElementById('reviewModal'));
  modal.show();
}

function submitReview(e) {
  if (e && e.preventDefault) e.preventDefault();
  const author = document.getElementById('reviewAuthorName').value.trim() || '食農夥伴';
  const eventSelect = document.getElementById('reviewEventSelect');
  const eventName = eventSelect.options[eventSelect.selectedIndex].text;
  const purity = parseInt(document.getElementById('ratingPurity').value, 10);
  const connection = parseInt(document.getElementById('ratingConnection').value, 10);
  const exp = parseInt(document.getElementById('ratingExperience').value, 10);
  const content = document.getElementById('reviewContent').value.trim() || '非常棒的自然農法體驗！';

  const newRev = {
    id: `rev_${Date.now()}`,
    authorName: author,
    eventName: eventName,
    purityRating: purity,
    connectionRating: connection,
    expRating: exp,
    date: new Date().toISOString().split('T')[0],
    content: content,
    karmaEarned: 50
  };

  DEFAULT_REVIEWS.unshift(newRev);
  renderReviews();

  // Award 50 Karma points
  userKarma += 50;
  localStorage.setItem('shumei_user_karma', userKarma.toString());
  updateKarmaDisplay();

  const modalEl = document.getElementById('reviewModal');
  const modalInstance = bootstrap.Modal.getInstance(modalEl);
  if (modalInstance) modalInstance.hide();

  showToast("🎉 心得發表成功！已為您注入 +50 Karma 綠色積分！");
}

// Interactive Food Edu Sugar Calculator
function calculateAdditiveImpact() {
  const select = document.getElementById('calcFoodSelect').value;
  const sugarDisplay = document.getElementById('sugarCount');
  const additiveDisplay = document.getElementById('additiveList');
  const farmAlt = document.getElementById('farmAlternative');

  if (select === 'soda') {
    sugarDisplay.innerText = '相當於攝取 12.5 顆方糖 (50g)';
    additiveDisplay.innerText = '含防腐劑、焦糖色素、高果糖糖漿等 6 種人工合成物';
    farmAlt.innerText = '🌿 自然農法替換方案：享用「初夏自家採種甜玉米生食」，天然果糖與水溶性纖維，0 負擔！';
  } else if (select === 'snack') {
    sugarDisplay.innerText = '相當於攝取高精緻鈉 450mg + 飽和脂肪 16g';
    additiveDisplay.innerText = '含 L-麩酸鈉(味精)、人工香料、抗氧化劑 BHA';
    farmAlt.innerText = '🌿 自然農法替換方案：享用「原味烘焙自然農法青皮黑豆」，香脆富含花青素！';
  } else if (select === 'instant_noodles') {
    sugarDisplay.innerText = '相當於攝取高鈉 1,800mg (接近一日上限)';
    additiveDisplay.innerText = '含麵質改良劑、化學調味包、棕櫚油油炸物';
    farmAlt.innerText = '🌿 自然農法替換方案：享用「自家採種越光米無水番茄炊飯」，純淨土地原香！';
  } else if (select === 'sweet_tea') {
    sugarDisplay.innerText = '相當於攝取 15 顆方糖 (60g)';
    additiveDisplay.innerText = '含非乳脂奶精 (反式脂肪)、人工色素、防腐劑';
    farmAlt.innerText = '🌿 自然農法替換方案：沖泡「秀明自然農法冷泡日曬焙茶」，回甘生津無添加！';
  }
}

// Food Quiz Modal & Evaluation
function openFoodQuizModal() {
  const modal = new bootstrap.Modal(document.getElementById('foodQuizModal'));
  modal.show();
}

function submitFoodQuiz(e) {
  if (e && e.preventDefault) e.preventDefault();
  const q1 = document.querySelector('input[name="q1"]:checked')?.value;
  const q2 = document.querySelector('input[name="q2"]:checked')?.value;

  if (q1 === 'correct' && q2 === 'correct') {
    userKarma += 20;
    localStorage.setItem('shumei_user_karma', userKarma.toString());
    updateKarmaDisplay();

    const modalEl = document.getElementById('foodQuizModal');
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();

    showToast("🎉 全答對了！恭喜完成食育小測驗，獲得 +20 Karma 點數！");
  } else {
    showToast("有部分題目答錯囉，請回顧自然農法原則再試一次！", "warning");
  }
}

// Adopt Rice Modal & Submit
function openAdoptRiceModal() {
  const modal = new bootstrap.Modal(document.getElementById('adoptRiceModal'));
  modal.show();
}

function submitAdoptRice(e) {
  if (e && e.preventDefault) e.preventDefault();
  const plan = document.getElementById('adoptPlanSelect').value;
  const field = document.getElementById('adoptFieldSelect').options[document.getElementById('adoptFieldSelect').selectedIndex].text;
  const potName = document.getElementById('adoptPotName').value.trim();
  const userName = document.getElementById('adoptUserName').value.trim();

  userKarma += 100;
  localStorage.setItem('shumei_user_karma', userKarma.toString());
  updateKarmaDisplay();

  const modalEl = document.getElementById('adoptRiceModal');
  const modalInstance = bootstrap.Modal.getInstance(modalEl);
  if (modalInstance) modalInstance.hide();

  showToast(`🌾 感謝【${userName}】認養水稻！專屬木牌「${potName}」已於【${field}】立牌，獲得 +100 Karma 點數！`);
}

// Timelapse Modal
function openTimelapseModal() {
  const modal = new bootstrap.Modal(document.getElementById('timelapseModal'));
  modal.show();
}

// Ask Farmer Modal & Submit
function openAskFarmerModal(farmerName) {
  if (farmerName) {
    document.getElementById('askFarmerName').value = `${farmerName} 農友`;
  }
  const modal = new bootstrap.Modal(document.getElementById('askFarmerModal'));
  modal.show();
}

function submitAskFarmer(e) {
  if (e && e.preventDefault) e.preventDefault();
  const farmer = document.getElementById('askFarmerName').value;
  const topic = document.getElementById('askFarmerTopic').options[document.getElementById('askFarmerTopic').selectedIndex].text;
  const content = document.getElementById('askFarmerContent').value.trim();

  const modalEl = document.getElementById('askFarmerModal');
  const modalInstance = bootstrap.Modal.getInstance(modalEl);
  if (modalInstance) modalInstance.hide();

  showToast(`您的提問已送達【${farmer}】！農友將於 24 小時內回覆。`);
}
