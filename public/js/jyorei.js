/**
 * jyorei.js - 淨靈人次統計、靈線成員自動展開與願景儀表板
 * 特色：細分「信徒」與「未信徒」施光人次，移除接受淨靈記錄
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

// 全域狀態
let currentReporterName = '';
let allMembersCache = [];
let myLineageMembers = [];
let debounceTimer = null;

let globalBaseCount = 8620;
const MONTHLY_TARGET = 10000;

document.addEventListener('DOMContentLoaded', () => {
  // 設定今日日期
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('today-date-text').innerText = today;

  // 讀取暫存的姓名
  const cachedName = localStorage.getItem('SHUMEI_LAST_REPORTER_NAME') || '';
  if (cachedName) {
    document.getElementById('reporter-name').value = cachedName;
  }

  loadGlobalStats();
  loadAllMembersFromFirestore();
  loadRecentLogs();
});

// 讀取全會願景進度與個人成就
function loadGlobalStats() {
  const localAdded = parseInt(localStorage.getItem('SHUMEI_JYOREI_ADDED_COUNT') || '0');
  const total = globalBaseCount + localAdded;
  
  document.getElementById('global-counter').innerText = total.toLocaleString();
  const percent = Math.min(100, ((total / MONTHLY_TARGET) * 100)).toFixed(1);
  document.getElementById('progress-percent').innerText = `${percent}%`;
  document.getElementById('progress-bar').style.width = `${percent}%`;

  // 個人成就卡片 (信徒 / 未信徒)
  const believerTotal = parseInt(localStorage.getItem('SHUMEI_MY_JYOREI_BELIEVER_TOTAL') || '0');
  const nonBelieverTotal = parseInt(localStorage.getItem('SHUMEI_MY_JYOREI_NON_BELIEVER_TOTAL') || '0');
  const streak = parseInt(localStorage.getItem('SHUMEI_MY_JYOREI_STREAK') || '0');

  document.getElementById('stat-believer-total').innerText = believerTotal;
  document.getElementById('stat-non-believer-total').innerText = nonBelieverTotal;
  document.getElementById('stat-streak').innerText = `${streak} 天`;
}

// 載入所有名冊成員
function loadAllMembersFromFirestore() {
  db.collection('member').get().then(snapshot => {
    allMembersCache = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      allMembersCache.push({
        id: doc.id,
        name: d.name || '',
        guide: d.guide ? (Array.isArray(d.guide) ? d.guide : [d.guide]) : [],
        leader: d.leader || '青年部',
        phone: d.phone || d.tel || ''
      });
    });

    console.log(`[Jyorei] 成功載入成員庫：${allMembersCache.length} 人`);
    const initialName = document.getElementById('reporter-name').value.trim();
    if (initialName) {
      fetchMyLineage(initialName);
    }
  }).catch(err => {
    console.warn("載入名冊失敗:", err);
    allMembersCache = [];
    const initialName = document.getElementById('reporter-name').value.trim();
    if (initialName) {
      fetchMyLineage(initialName);
    }
  });
}

function debounceFetchLineage() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    confirmReporterName();
  }, 600);
}

function confirmReporterName() {
  const name = document.getElementById('reporter-name').value.trim();
  if (!name) return;

  currentReporterName = name;
  localStorage.setItem('SHUMEI_LAST_REPORTER_NAME', name);
  fetchMyLineage(name);
}

// 查詢並展開我底下的靈線成員
function fetchMyLineage(guideName) {
  myLineageMembers = allMembersCache.filter(m => {
    if (!m.guide || !Array.isArray(m.guide)) return false;
    return m.guide.some(g => g.trim() === guideName);
  });

  renderLineageMembers();
}

function renderLineageMembers() {
  const container = document.getElementById('lineage-container');
  const badge = document.getElementById('lineage-member-badge');
  badge.innerText = `${myLineageMembers.length} 位靈線成員`;

  if (myLineageMembers.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-muted small bg-dark bg-opacity-50 rounded-3 border border-secondary">
        <i class="fa-solid fa-seedling fa-2x mb-2 text-warning opacity-50"></i>
        <p class="mb-0">名冊中目前未登錄以「<strong>${currentReporterName}</strong>」為介紹人的靈線成員。<br>您仍可正常提交個人今日對信徒與未信徒的淨靈成果！</p>
      </div>
    `;
    calculateTotalSum();
    return;
  }

  let html = `<div class="d-flex flex-column gap-2">`;
  myLineageMembers.forEach((m, idx) => {
    html += `
      <div class="lineage-row d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <div class="d-flex align-items-center gap-2">
            <strong class="text-white">${m.name}</strong>
            <span class="badge bg-secondary" style="font-size: 10px;">${m.leader || '青年部'}</span>
          </div>
          <small class="text-muted" style="font-size: 11px;">
            <i class="fa-solid fa-phone me-1"></i>${m.phone || '無電話'}
          </small>
        </div>

        <div class="d-flex flex-wrap align-items-center gap-3">
          <!-- 信徒 -->
          <div class="d-flex align-items-center gap-1">
            <span class="badge bg-warning text-dark font-weight-bold" style="font-size: 11px;">信徒</span>
            <input type="number" id="lineage-believer-${idx}" class="form-control form-control-sm bg-dark text-white border-secondary num-input lineage-believer-input" min="0" value="0" oninput="calculateTotalSum()">
            <button type="button" class="quick-btn" onclick="addCount('lineage-believer-${idx}', 1)">+1</button>
            <button type="button" class="quick-btn" onclick="addCount('lineage-believer-${idx}', 2)">+2</button>
          </div>

          <!-- 未信徒 -->
          <div class="d-flex align-items-center gap-1">
            <span class="badge bg-success font-weight-bold" style="font-size: 11px;">未信徒</span>
            <input type="number" id="lineage-non-believer-${idx}" class="form-control form-control-sm bg-dark text-white border-secondary num-input lineage-non-believer-input" min="0" value="0" oninput="calculateTotalSum()">
            <button type="button" class="quick-btn" onclick="addCount('lineage-non-believer-${idx}', 1)">+1</button>
            <button type="button" class="quick-btn" onclick="addCount('lineage-non-believer-${idx}', 2)">+2</button>
          </div>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;

  calculateTotalSum();
}

// 快速加減數字
function addCount(inputId, amount) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const current = parseInt(input.value) || 0;
  input.value = current + amount;
  calculateTotalSum();
}

// 動態即時計算信徒、未信徒與總和
function calculateTotalSum() {
  const selfBeliever = parseInt(document.getElementById('self-believer-count').value) || 0;
  const selfNonBeliever = parseInt(document.getElementById('self-non-believer-count').value) || 0;

  let lineageBelieverSum = 0;
  let lineageNonBelieverSum = 0;

  document.querySelectorAll('.lineage-believer-input').forEach(input => {
    lineageBelieverSum += (parseInt(input.value) || 0);
  });

  document.querySelectorAll('.lineage-non-believer-input').forEach(input => {
    lineageNonBelieverSum += (parseInt(input.value) || 0);
  });

  const totalBeliever = selfBeliever + lineageBelieverSum;
  const totalNonBeliever = selfNonBeliever + lineageNonBelieverSum;
  const grandTotal = totalBeliever + totalNonBeliever;

  document.getElementById('sum-believers').innerText = totalBeliever;
  document.getElementById('sum-non-believers').innerText = totalNonBeliever;
  document.getElementById('lineage-total-sum').innerText = grandTotal;
}

// 送出打卡成果
function submitJyoreiRecord() {
  const reporter = document.getElementById('reporter-name').value.trim();
  if (!reporter) {
    alert("請先填寫您的姓名！");
    document.getElementById('reporter-name').focus();
    return;
  }

  const selfBeliever = parseInt(document.getElementById('self-believer-count').value) || 0;
  const selfNonBeliever = parseInt(document.getElementById('self-non-believer-count').value) || 0;

  // 蒐集靈線各成員回報
  const lineageDetails = [];
  let lineageBelieverSum = 0;
  let lineageNonBelieverSum = 0;

  myLineageMembers.forEach((m, idx) => {
    const bInput = document.getElementById(`lineage-believer-${idx}`);
    const nbInput = document.getElementById(`lineage-non-believer-${idx}`);
    const bCount = bInput ? (parseInt(bInput.value) || 0) : 0;
    const nbCount = nbInput ? (parseInt(nbInput.value) || 0) : 0;

    if (bCount > 0 || nbCount > 0) {
      lineageDetails.push({ 
        name: m.name, 
        believer: bCount,
        nonBeliever: nbCount,
        total: bCount + nbCount
      });
      lineageBelieverSum += bCount;
      lineageNonBelieverSum += nbCount;
    }
  });

  const totalBeliever = selfBeliever + lineageBelieverSum;
  const totalNonBeliever = selfNonBeliever + lineageNonBelieverSum;
  const grandTotal = totalBeliever + totalNonBeliever;

  if (grandTotal === 0) {
    alert("請至少填報一項對信徒或未信徒的淨靈人次！");
    return;
  }

  const record = {
    id: 'jyr_' + Date.now(),
    date: document.getElementById('today-date-text').innerText,
    reporter: reporter,
    selfBeliever: selfBeliever,
    selfNonBeliever: selfNonBeliever,
    selfTotal: selfBeliever + selfNonBeliever,
    lineageMembersCount: myLineageMembers.length,
    lineageBelieverSum: lineageBelieverSum,
    lineageNonBelieverSum: lineageNonBelieverSum,
    totalBeliever: totalBeliever,
    totalNonBeliever: totalNonBeliever,
    grandTotal: grandTotal,
    lineageDetails: lineageDetails,
    timestamp: firebase.firestore ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
  };

  // 寫入 Firestore
  db.collection('jyorei_logs').add(record).catch(err => {
    console.warn("Firestore record warning:", err);
  });

  // 本地快取與成就更新
  const prevAdded = parseInt(localStorage.getItem('SHUMEI_JYOREI_ADDED_COUNT') || '0');
  localStorage.setItem('SHUMEI_JYOREI_ADDED_COUNT', prevAdded + grandTotal);

  const prevBeliever = parseInt(localStorage.getItem('SHUMEI_MY_JYOREI_BELIEVER_TOTAL') || '0');
  localStorage.setItem('SHUMEI_MY_JYOREI_BELIEVER_TOTAL', prevBeliever + totalBeliever);

  const prevNonBeliever = parseInt(localStorage.getItem('SHUMEI_MY_JYOREI_NON_BELIEVER_TOTAL') || '0');
  localStorage.setItem('SHUMEI_MY_JYOREI_NON_BELIEVER_TOTAL', prevNonBeliever + totalNonBeliever);

  // 儲存近期紀錄
  const history = JSON.parse(localStorage.getItem('SHUMEI_JYOREI_HISTORY') || '[]');
  history.unshift(record);
  localStorage.setItem('SHUMEI_JYOREI_HISTORY', JSON.stringify(history.slice(0, 15)));

  loadGlobalStats();
  loadRecentLogs();

  // 重設表單
  document.getElementById('self-believer-count').value = '1';
  document.getElementById('self-non-believer-count').value = '0';
  document.querySelectorAll('.lineage-believer-input').forEach(input => input.value = '0');
  document.querySelectorAll('.lineage-non-believer-input').forEach(input => input.value = '0');
  calculateTotalSum();

  alert(`🎉 感謝您的誠心實踐！\n本次打卡共記錄：信徒 ${totalBeliever} 人次、未信徒 ${totalNonBeliever} 人次（總計 ${grandTotal} 人次），光明願景持續擴展！`);
}

// 載入近期紀錄
function loadRecentLogs() {
  const container = document.getElementById('recent-logs');
  const history = JSON.parse(localStorage.getItem('SHUMEI_JYOREI_HISTORY') || '[]');

  if (history.length === 0) {
    container.innerHTML = `
      <div class="text-center py-3 text-muted small">尚無最近打卡紀錄，完成首次打卡即可在此看見動態！</div>
    `;
    return;
  }

  let html = '';
  history.forEach(h => {
    const detailText = h.lineageDetails && h.lineageDetails.length > 0 
      ? `(含靈線夥伴: ${h.lineageDetails.map(d => `${d.name} [信:${d.believer}/未:${d.nonBeliever}]`).join(', ')})`
      : '';

    html += `
      <div class="list-group-item bg-dark text-light border-secondary small d-flex flex-wrap justify-content-between align-items-center py-2">
        <div>
          <span class="badge bg-warning text-dark me-2">${h.date}</span>
          <strong class="text-white">${h.reporter}</strong>
          <span class="text-muted ms-2">信徒 <strong>${h.totalBeliever || (h.selfBeliever || 0)}</strong> 人・未信徒 <strong>${h.totalNonBeliever || (h.selfNonBeliever || 0)}</strong> 人</span>
          <div class="text-info" style="font-size: 11px;">${detailText}</div>
        </div>
        <span class="badge bg-success font-weight-bold ms-auto" style="font-size: 12px;">+${h.grandTotal || h.totalGive || 0} 人次</span>
      </div>
    `;
  });
  container.innerHTML = html;
}
