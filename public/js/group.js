firebase.initializeApp({
  apiKey: 'AIzaSyA8KmjgG2SWv2XVTlqMcxxa2PbljlX7ueU',
  authDomain: 'shumei-2025.firebaseapp.com',
  databaseURL: 'https://shumei-2025.firebaseio.com',
  projectId: 'shumei-2025',
});
const db = firebase.firestore();
const auth = firebase.auth();
var leader;
var currentMemberId = '';

// 預設活動項目清單（若資料庫 info/activity_items 尚未設定時的備援）
const DEFAULT_ACTIVITY_ITEMS = ['青年秀勉', '百淨靈', '淨靈週', '農場', '市集', '桃子活動'];
// 舊版代碼對照表（向下相容）
const LEGACY_CODE_MAP = {
  '青年秀勉': 'a',
  '百淨靈': 'b',
  '淨靈週': 'c',
  '農場': 'd',
  '市集': 'e',
  '桃子活動': 'f'
};

var activityItems = [...DEFAULT_ACTIVITY_ITEMS];

auth.onAuthStateChanged((user) => {
  if (user) {
    console.log("已登入 UID:", user.uid);
    const isLeader = sessionStorage.getItem('SHUMEI_LEADER_AUTH') === 'true' || 
                     localStorage.getItem('SHUMEI_LEADER_AUTH') === 'true' || 
                     localStorage.getItem('SHUMEI_USER_ROLE') === 'leader';
    
    // Check user role to set links
    if (user.isAnonymous) {
      if (isLeader) {
        setLinks('admin.html');
      } else {
        setLinks('list.html');
      }
      initData();
    } else {
      db.collection('info').doc('admins').get().then((doc) => {
        if (doc.exists) {
          const emails = doc.data().emails || [];
          if (emails.includes(user.email)) {
            setLinks('admin.html');
          } else {
            setLinks('list.html');
          }
        } else {
          setLinks('list.html');
        }
        initData();
      }).catch((error) => {
        console.error("Error verifying admin role:", error);
        setLinks('list.html');
        initData();
      });
    }
  } else {
    window.location.href = '/index.html';
  }
});

function signOut() {
  sessionStorage.removeItem('SHUMEI_LEADER_AUTH');
  localStorage.removeItem('SHUMEI_LEADER_AUTH');
  localStorage.setItem('SHUMEI_USER_ROLE', '');
  localStorage.removeItem('SHUMEI_USER_ROLE');
  auth.signOut().then(() => {
    window.location.href = '/index.html';
  });
}

function setLinks(listPage) {
  const desktopList = document.getElementById('nav-desktop-list');
  const mobileList = document.getElementById('nav-mobile-list');
  if (desktopList) desktopList.setAttribute('href', listPage);
  if (mobileList) mobileList.setAttribute('href', listPage);
}

function getYearMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getYearMonthText() {
  const d = new Date();
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
}

// 從 Firestore info/activity_items 載入動態活動項目
async function loadActivityItems() {
  try {
    const doc = await db.collection('info').doc('activity_items').get();
    if (doc.exists && Array.isArray(doc.data().items) && doc.data().items.length > 0) {
      activityItems = doc.data().items;
    } else {
      activityItems = [...DEFAULT_ACTIVITY_ITEMS];
    }
  } catch (err) {
    console.warn("讀取 info/activity_items 失敗，使用預設項目:", err);
    activityItems = [...DEFAULT_ACTIVITY_ITEMS];
  }
  renderActivityModalInputs();
}

// 動態渲染活動登錄彈窗中的單選項目
function renderActivityModalInputs() {
  const container = document.getElementById('activityItemsContainer');
  if (!container) return;

  container.innerHTML = activityItems.map((itemName, idx) => `
    <div class="list-group-item justify-content-between d-flex align-items-center py-3 px-3 border-0">
      <span style="font-weight: 500; font-size: 15px;">${itemName}</span>
      <div class="d-flex gap-3">
        <div class="form-check form-check-inline m-0">
          <input class="form-check-input" type="radio" id="act_idx_${idx}_yes" name="act_idx_${idx}" value="true" style="width: auto;">
          <label class="form-check-label" for="act_idx_${idx}_yes">有</label>
        </div>
        <div class="form-check form-check-inline m-0">
          <input class="form-check-input" type="radio" id="act_idx_${idx}_no" name="act_idx_${idx}" value="false" checked style="width: auto;">
          <label class="form-check-label" for="act_idx_${idx}_no">無</label>
        </div>
      </div>
    </div>
  `).join('');
}

async function initData() {
  await loadActivityItems();

  db.collection('info')
    .doc('youth')
    .get()
    .then((doc) => {
      leader = doc.data().leader;

      const list_lead = document.getElementById('body');
      list_lead.innerHTML = '';
      
      var content = leader.map((opt) => {
        const optId = opt.replace(/\s+/g, '_');
        return `
        <div class='accordion-item stagger-item'>
          <h2 class='accordion-header' id='${optId}-heading'>
            <button
              class='accordion-button collapsed'
              type='button'
              data-bs-toggle='collapse'
              data-bs-target='#${optId}-collapse'
              aria-expanded='false'
              aria-controls='${optId}-collapse'
            >
              ${opt}
            </button>
          </h2>
          <div
            id='${optId}-collapse'
            class='accordion-collapse collapse'
            aria-labelledby='${optId}-heading'
            data-bs-parent="#body"
          >
            <div class='accordion-body' id='${optId}-team'>
              <div class="activity-grid" id="${optId}-team-grid"></div>
            </div>
          </div>
        </div>`;
      });
      
      content.map((item) => {
        list_lead.innerHTML += item;
      });
      listMembers();
    })
    .catch((err) => {
      console.log('Error getting document:', err);
    });
}

function listMembers() {
  const currentKey = getYearMonthKey();
  
  leader.map((item) => {
    const optId = item.replace(/\s+/g, '_');
    var grid = document.getElementById(optId + '-team-grid');
    if (!grid) return;
    
    db.collection('member')
      .where('leader', '==', item)
      .get()
      .then((query) => {
        grid.innerHTML = '';
        query.forEach((doc) => {
          const d = doc.data();
          const hasActivities = d.activities && d.activities[currentKey];
          let badgeHtml = '';
          
          if (hasActivities) {
            const acts = d.activities[currentKey];
            const activeCount = Object.values(acts).filter(Boolean).length;
            if (activeCount > 0) {
              badgeHtml = `<span class="badge bg-success" style="font-size: 11px;">已參與 ${activeCount} 項</span>`;
            } else {
              badgeHtml = `<span class="badge bg-light text-dark" style="font-size: 11px; border: 1px solid #ccc;">無參與</span>`;
            }
          } else {
            badgeHtml = `<span class="badge bg-secondary" style="font-size: 11px; opacity: 0.6;">未登錄</span>`;
          }

          var card = document.createElement('div');
          card.classList.add('member-activity-item');
          card.setAttribute('onclick', `openLogModal('${doc.id}')`);
          card.setAttribute('data-bs-toggle', 'modal');
          card.setAttribute('data-bs-target', '#logModal');
          
          card.innerHTML = `
            <span style="font-weight: 600;">${d.name}</span>
            ${badgeHtml}
          `;
          
          grid.appendChild(card);
        });
      })
      .catch((err) => {
        console.error(err);
      });
  });
}

function openLogModal(memberId) {
  currentMemberId = memberId;
  const currentKey = getYearMonthKey();
  const currentText = getYearMonthText();
  
  document.getElementById('monthBadge').innerText = `${currentText} 活動登錄`;
  renderActivityModalInputs();
  
  db.collection('member')
    .doc(memberId)
    .get()
    .then((doc) => {
      if (!doc.exists) return;
      const d = doc.data();
      document.getElementById('logModalLabel').innerText = d.name;
      
      // 載入該成員當月份的活動紀錄（支援直接中文名稱鍵值，並向下相容舊代碼）
      if (d.activities && d.activities[currentKey]) {
        const acts = d.activities[currentKey];
        activityItems.forEach((itemName, idx) => {
          const legacyKey = LEGACY_CODE_MAP[itemName];
          const val = (itemName in acts) ? acts[itemName] : (legacyKey ? acts[legacyKey] : false);
          setRadioVal(`act_idx_${idx}`, Boolean(val));
        });
      }
      
      const btnUp = document.getElementById('btn_up');
      btnUp.setAttribute('onclick', `saveActivities('${memberId}')`);
    });
}

function setRadioVal(name, boolVal) {
  const valStr = boolVal ? 'true' : 'false';
  const radios = document.getElementsByName(name);
  for (let r of radios) {
    if (r.value === valStr) {
      r.checked = true;
    }
  }
}

function getRadioVal(name) {
  const checkedRadio = document.querySelector(`input[name="${name}"]:checked`);
  return checkedRadio ? (checkedRadio.value === 'true') : false;
}

function saveActivities(memberId) {
  const currentKey = getYearMonthKey();
  const btnUp = document.getElementById('btn_up');
  if (btnUp) {
    btnUp.disabled = true;
    btnUp.innerText = '更新中...';
  }
  
  // 直接以清楚易讀的「中文活動名稱」作為欄位鍵值儲存
  const acts = {};
  activityItems.forEach((itemName, idx) => {
    acts[itemName] = getRadioVal(`act_idx_${idx}`);
  });
  
  const updateData = {};
  updateData[`activities.${currentKey}`] = acts;
  
  db.collection('member')
    .doc(memberId)
    .update(updateData)
    .then(() => {
      alert("活動紀錄更新成功！");
      if (btnUp) {
        btnUp.disabled = false;
        btnUp.innerText = '更新紀錄';
      }
      const logModalEl = document.getElementById('logModal');
      if (logModalEl && typeof bootstrap !== 'undefined') {
        const modalInstance = bootstrap.Modal.getInstance(logModalEl) || new bootstrap.Modal(logModalEl);
        modalInstance.hide();
      }
      listMembers();
    })
    .catch((err) => {
      console.error("Error saving activities:", err);
      alert("儲存失敗: " + err.message);
      if (btnUp) {
        btnUp.disabled = false;
        btnUp.innerText = '更新紀錄';
      }
    });
}

// ==========================================
// 動態管理活動項目 (對應 Firestore info/activity_items)
// ==========================================
function openManageActivityModal() {
  renderManageActivityList();
  const modalEl = document.getElementById('manageActivityModal');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modalInstance.show();
  }
}

function renderManageActivityList() {
  const container = document.getElementById('manageActivityListContainer');
  if (!container) return;

  container.innerHTML = activityItems.map((name, idx) => `
    <div class="list-group-item d-flex justify-content-between align-items-center py-2 px-3 border-0" style="border-radius: 10px;">
      <span style="font-weight: 500;">${idx + 1}. ${name}</span>
      <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeActivityItem(${idx})" style="border-radius: 8px; padding: 2px 10px; font-size: 12px;">
        移除
      </button>
    </div>
  `).join('');
}

async function addNewActivityItem() {
  const input = document.getElementById('newActivityNameInput');
  if (!input) return;
  const newName = input.value.trim();
  if (!newName) {
    alert("請輸入新活動名稱");
    input.focus();
    return;
  }
  if (activityItems.includes(newName)) {
    alert("此活動名稱已經存在！");
    return;
  }

  const updated = [...activityItems, newName];
  try {
    await db.collection('info').doc('activity_items').set({
      description: "青年部每月活動登錄項目清單（可直接新增或移除中文活動名稱）",
      items: updated,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    activityItems = updated;
    input.value = '';
    renderManageActivityList();
    renderActivityModalInputs();
  } catch (err) {
    console.error("新增活動項目失敗:", err);
    alert("新增失敗：" + err.message);
  }
}

async function removeActivityItem(idx) {
  const targetName = activityItems[idx];
  if (!targetName) return;
  if (!confirm(`確定要從活動登錄清單中移除「${targetName}」嗎？\n（已儲存的歷史紀錄不會被刪除）`)) {
    return;
  }

  const updated = activityItems.filter((_, i) => i !== idx);
  try {
    await db.collection('info').doc('activity_items').set({
      items: updated,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    activityItems = updated;
    renderManageActivityList();
    renderActivityModalInputs();
  } catch (err) {
    console.error("移除活動項目失敗:", err);
    alert("移除失敗：" + err.message);
  }
}
