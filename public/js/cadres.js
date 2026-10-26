/**
 * Shumei Cadres & LINE Mapping Manager (幹部名單與 LINE 綁定管理)
 */

firebase.initializeApp({
  apiKey: 'AIzaSyA8KmjgG2SWv2XVTlqMcxxa2PbljlX7ueU',
  authDomain: 'shumei-2025.firebaseapp.com',
  databaseURL: 'https://shumei-2025.firebaseio.com',
  projectId: 'shumei-2025',
});

const auth = firebase.auth();
const db = firebase.firestore();

// System Preset Dropdown Options (系統預設選單項目)
const DEFAULT_CADRE_CONFIG = {
  roles: [
    "小組長",
    "副組長",
    "青年幹部",
    "世話人 / 助教師",
    "專案負責人",
    "總會幹部"
  ],
  groups: [
    "松恩組",
    "泰佑組",
    "惠婷組",
    "家綺組",
    "菱瞳組",
    "和生組",
    "宗珉組",
    "懿翎組",
    "大學生組",
    "秀明自然農法 / 市集組",
    "現場櫃檯 / 接待組",
    "資訊 / 文宣影音組",
    "跨組 / 總會直屬"
  ]
};

// Global State
let cadreConfig = {
  roles: [...DEFAULT_CADRE_CONFIG.roles],
  groups: [...DEFAULT_CADRE_CONFIG.groups]
};
let currentCadresData = {
  editorList: [],
  editors: {},
  lineUserIdToName: {}
};
let allMemberNames = [];
let cadrePass = 'shumei567sty';
let currentFilter = 'all'; // 'all', 'bound', 'unbound'
let cadreModalInstance = null;
let lineGuideModalInstance = null;
let cadreConfigModalInstance = null;

// Auth Listener
auth.onAuthStateChanged((user) => {
  if (user) {
    const isLeader = sessionStorage.getItem('SHUMEI_LEADER_AUTH') === 'true' || localStorage.getItem('SHUMEI_USER_ROLE') === 'leader';
    if (user.isAnonymous && !isLeader) {
      window.location.href = '/member/index.html';
      return;
    }
    initCadresPage();
  } else {
    window.location.href = '/index.html';
  }
});

function signOut() {
  sessionStorage.removeItem('SHUMEI_LEADER_AUTH');
  localStorage.removeItem('SHUMEI_USER_ROLE');
  auth.signOut().then(() => {
    window.location.href = '/index.html';
  });
}

function initCadresPage() {
  if (window.bootstrap) {
    const editEl = document.getElementById('cadreEditModal');
    if (editEl) cadreModalInstance = new bootstrap.Modal(editEl);
    const guideEl = document.getElementById('lineGuideModal');
    if (guideEl) lineGuideModalInstance = new bootstrap.Modal(guideEl);
    const configEl = document.getElementById('cadreConfigModal');
    if (configEl) cadreConfigModalInstance = new bootstrap.Modal(configEl);
  }

  loadSystemPassword();
  loadAllMemberNames();
  listenToCadreConfig();
  listenToCadresData();
}

/**
 * 即時監聽 info/cadre_config 自訂職稱與組別清單
 */
let unsubscribeConfig = null;
function listenToCadreConfig() {
  if (unsubscribeConfig) unsubscribeConfig();

  unsubscribeConfig = db.collection('info').doc('cadre_config').onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      const roles = (Array.isArray(data.roles) && data.roles.length > 0) ? data.roles : DEFAULT_CADRE_CONFIG.roles;
      const groups = (Array.isArray(data.groups) && data.groups.length > 0) ? data.groups : DEFAULT_CADRE_CONFIG.groups;
      cadreConfig = { roles, groups };
    } else {
      cadreConfig = {
        roles: [...DEFAULT_CADRE_CONFIG.roles],
        groups: [...DEFAULT_CADRE_CONFIG.groups]
      };
    }
    populateDropdownOptions();
    renderCadres();
  }, (err) => {
    console.warn("Failed to listen to cadre_config:", err);
    cadreConfig = {
      roles: [...DEFAULT_CADRE_CONFIG.roles],
      groups: [...DEFAULT_CADRE_CONFIG.groups]
    };
    populateDropdownOptions();
  });
}

/**
 * 填充下拉選單選項
 */
function populateDropdownOptions(selectedTitle, selectedGroup) {
  const titleSelect = document.getElementById('cadre-title-select');
  const groupSelect = document.getElementById('cadre-group-select');

  if (titleSelect) {
    const currentVal = selectedTitle || titleSelect.value || cadreConfig.roles[0];
    let roles = [...cadreConfig.roles];
    if (currentVal && !roles.includes(currentVal)) {
      roles.unshift(currentVal);
    }
    titleSelect.innerHTML = roles.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
    titleSelect.value = currentVal;
  }

  if (groupSelect) {
    const currentVal = selectedGroup || groupSelect.value || cadreConfig.groups[0];
    let groups = [...cadreConfig.groups];
    if (currentVal && !groups.includes(currentVal)) {
      groups.unshift(currentVal);
    }
    groupSelect.innerHTML = groups.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');
    groupSelect.value = currentVal;
  }
}

/**
 * 解析職稱與所屬組別 (向下相容歷史字串)
 */
function parseCadreRole(item) {
  let roleTitle = (item.roleTitle || '').trim();
  let group = (item.group || '').trim();

  if (!roleTitle && !group && item.role) {
    const rawRole = String(item.role).trim();
    if (rawRole.includes('•')) {
      const parts = rawRole.split('•').map(s => s.trim());
      roleTitle = parts[0] || '';
      group = parts[1] || '';
    } else if (rawRole.includes(' / ')) {
      const parts = rawRole.split(' / ').map(s => s.trim());
      roleTitle = parts[0] || '';
      group = parts[1] || '';
    } else {
      if (cadreConfig.groups.includes(rawRole)) {
        roleTitle = '小組長';
        group = rawRole;
      } else {
        roleTitle = rawRole;
        group = '跨組 / 總會直屬';
      }
    }
  }

  if (!roleTitle) roleTitle = '青年幹部';
  if (!group) group = '跨組 / 總會直屬';

  return { roleTitle, group };
}

/**
 * 讀取幹部認證密碼
 */
function loadSystemPassword() {
  db.collection('info').doc('set').get().then((doc) => {
    if (doc.exists && doc.data().pass) {
      cadrePass = String(doc.data().pass);
      const cmdEl = document.getElementById('sample-line-command');
      if (cmdEl) {
        cmdEl.innerText = `幹部認證 ${cadrePass} 您的姓名`;
      }
    }
  }).catch(err => console.warn("Failed to load pass:", err));
}

/**
 * 載入資料庫所有成員姓名供下拉輔助選擇
 */
function loadAllMemberNames() {
  db.collection('member').get().then((snap) => {
    const namesSet = new Set();
    snap.forEach((doc) => {
      const d = doc.data();
      if (d.name && d.name.trim()) {
        namesSet.add(d.name.trim());
      }
    });
    allMemberNames = Array.from(namesSet).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    
    const datalist = document.getElementById('member-names-datalist');
    if (datalist) {
      datalist.innerHTML = allMemberNames.map(name => `<option value="${name}">${name}</option>`).join('');
    }
  }).catch(err => console.warn("Failed to load member names for datalist:", err));
}

/**
 * 即時監聽 info/editors 集合文件
 */
let unsubscribeEditors = null;
function listenToCadresData() {
  if (unsubscribeEditors) unsubscribeEditors();

  unsubscribeEditors = db.collection('info').doc('editors').onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      currentCadresData = {
        editorList: Array.isArray(data.editorList) ? data.editorList : [],
        editors: data.editors || {},
        lineUserIdToName: data.lineUserIdToName || {}
      };
      renderCadres();
    } else {
      // 若尚未建立，嘗試從 info/youth 載入小組長預設名單
      initializeFromYouthLeaders();
    }
  }, (err) => {
    console.error("Error listening to info/editors:", err);
    showToast("無法即時連線幹部資料: " + err.message);
  });
}

function initializeFromYouthLeaders() {
  db.collection('info').doc('youth').get().then((yDoc) => {
    const youthLeaders = (yDoc.exists && Array.isArray(yDoc.data().leader)) ? yDoc.data().leader : [];
    currentCadresData = {
      editorList: youthLeaders,
      editors: {},
      lineUserIdToName: {}
    };
    youthLeaders.forEach(name => {
      currentCadresData.editors[name] = {
        name: name,
        role: "青年小組長",
        active: true,
        lineDisplayName: "",
        lineUserId: ""
      };
    });
    renderCadres();
  }).catch(err => {
    console.warn("Init from youth leaders failed:", err);
    renderCadres();
  });
}

function reloadCadresData() {
  listenToCadresData();
  showToast("已重新整理幹部名冊");
}

/**
 * 渲染名單主體與 KPI 卡片
 */
function renderCadres() {
  const list = currentCadresData.editorList || [];
  const editorsMap = currentCadresData.editors || {};
  const search = (document.getElementById('cadre-search-input')?.value || '').trim().toLowerCase();

  let totalCount = 0;
  let boundCount = 0;
  let unboundCount = 0;

  const cadreItems = list.map((name) => {
    const item = editorsMap[name] || { name: name, role: "青年幹部", active: true };
    const isBound = Boolean(item.lineUserId && item.lineUserId.trim());
    const parsed = parseCadreRole(item);
    
    totalCount++;
    if (isBound && item.active !== false) {
      boundCount++;
    } else {
      unboundCount++;
    }

    return {
      name: name,
      roleTitle: parsed.roleTitle,
      group: parsed.group,
      role: item.role || `${parsed.roleTitle} • ${parsed.group}`,
      lineDisplayName: item.lineDisplayName || "",
      lineUserId: item.lineUserId || "",
      active: item.active !== false,
      verifiedAt: item.verifiedAt || "",
      updatedAt: item.updatedAt || "",
      isBound: isBound
    };
  });

  // 更新 KPI 卡片
  const statTotal = document.getElementById('stat-total-cadres');
  const statBound = document.getElementById('stat-bound-cadres');
  const statUnbound = document.getElementById('stat-unbound-cadres');
  const statRate = document.getElementById('stat-active-rate');
  const countAll = document.getElementById('count-all');
  const countBound = document.getElementById('count-bound');
  const countUnbound = document.getElementById('count-unbound');

  if (statTotal) statTotal.innerText = totalCount;
  if (statBound) statBound.innerText = boundCount;
  if (statUnbound) statUnbound.innerText = unboundCount;
  if (countAll) countAll.innerText = totalCount;
  if (countBound) countBound.innerText = boundCount;
  if (countUnbound) countUnbound.innerText = unboundCount;

  const rate = totalCount > 0 ? Math.round((boundCount / totalCount) * 100) : 0;
  if (statRate) statRate.innerText = `${rate}%`;

  // 篩選與搜尋
  const filtered = cadreItems.filter(item => {
    if (currentFilter === 'bound' && !item.isBound) return false;
    if (currentFilter === 'unbound' && item.isBound) return false;

    if (search) {
      const matchName = item.name.toLowerCase().includes(search);
      const matchLine = item.lineDisplayName.toLowerCase().includes(search);
      const matchRole = item.role.toLowerCase().includes(search);
      const matchTitle = (item.roleTitle || '').toLowerCase().includes(search);
      const matchGroup = (item.group || '').toLowerCase().includes(search);
      const matchUid = item.lineUserId.toLowerCase().includes(search);
      return matchName || matchLine || matchRole || matchTitle || matchGroup || matchUid;
    }
    return true;
  });

  // 渲染 HTML
  const container = document.getElementById('cadres-list-container');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5 text-muted glass-card">
        <i class="fa-solid fa-users-slash fs-2 mb-2"></i>
        <div>找不到符合條件的幹部資料</div>
        <button class="btn btn-sm btn-outline-info mt-3" onclick="openAddCadreModal()">＋ 新增此幹部</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const maskedUid = item.lineUserId ? (item.lineUserId.slice(0, 6) + '...' + item.lineUserId.slice(-4)) : '';
    const statusBadge = item.isBound
      ? `<span class="line-badge-bound"><i class="fa-brands fa-line fs-6"></i> 已綁定 (${escapeHtml(item.lineDisplayName || '已認證')})</span>`
      : `<span class="line-badge-unbound"><i class="fa-solid fa-hourglass-half"></i> 尚未綁定 LINE</span>`;
    
    const activeBadge = !item.active
      ? `<span class="badge bg-secondary ms-1">已暫停授權</span>`
      : '';

    return `
      <div class="cadre-card">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div class="d-flex align-items-center gap-3">
            <div class="rounded-circle d-flex align-items-center justify-content-center fw-bold" style="width: 46px; height: 46px; background: rgba(0, 243, 255, 0.15); color: #00F3FF; border: 1px solid rgba(0, 243, 255, 0.3); font-size: 18px;">
              ${escapeHtml(item.name.slice(0, 1))}
            </div>
            <div>
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <span class="fs-5 fw-bold text-white">${escapeHtml(item.name)}</span>
                <span class="badge bg-black bg-opacity-40 border border-info border-opacity-50 text-info px-2 py-1" style="font-size: 11px;">
                  <i class="fa-solid fa-user-tag me-1"></i>${escapeHtml(item.roleTitle)}
                </span>
                <span class="badge bg-black bg-opacity-40 border border-secondary border-opacity-50 text-light px-2 py-1" style="font-size: 11px;">
                  <i class="fa-solid fa-users me-1 text-muted"></i>${escapeHtml(item.group)}
                </span>
                ${activeBadge}
              </div>
              <div class="small text-muted mt-1 d-flex flex-wrap align-items-center gap-2">
                <span>LINE 暱稱：<strong class="text-white">${escapeHtml(item.lineDisplayName || '—')}</strong></span>
                ${maskedUid ? `<span class="font-monospace text-muted">(${maskedUid})</span>` : ''}
                ${item.verifiedAt ? `<span class="text-muted" style="font-size: 11px;">• 認證: ${escapeHtml(item.verifiedAt)}</span>` : ''}
              </div>
            </div>
          </div>

          <div class="d-flex flex-wrap align-items-center gap-2 ms-auto">
            <div>${statusBadge}</div>
            
            <button class="btn btn-sm btn-outline-info interactive" onclick="copyCadreLineCommand('${escapeHtml(item.name)}')" title="複製此幹部的 LINE 認證指令">
              <i class="fa-regular fa-copy me-1"></i> 複製指令
            </button>
            <button class="btn btn-sm btn-outline-light interactive" onclick="openEditCadreModal('${escapeHtml(item.name)}')" title="編輯或手動綁定">
              <i class="fa-solid fa-pen-to-square"></i> 編輯
            </button>
            ${item.isBound ? `
              <button class="btn btn-sm btn-outline-warning interactive" onclick="unbindCadre('${escapeHtml(item.name)}')" title="解除此 LINE 帳號綁定">
                <i class="fa-solid fa-link-slash"></i> 解綁
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function setFilter(type, el) {
  currentFilter = type;
  document.querySelectorAll('.filter-pill').forEach(pill => pill.classList.remove('active'));
  if (el) el.classList.add('active');
  renderCadres();
}

function filterCadresList() {
  renderCadres();
}

/**
 * 彈窗操作：新增幹部
 */
function openAddCadreModal() {
  document.getElementById('edit-original-name').value = '';
  document.getElementById('cadre-db-name').value = '';
  document.getElementById('cadre-db-name').disabled = false;
  populateDropdownOptions(cadreConfig.roles[0], cadreConfig.groups[0]);
  document.getElementById('cadre-line-name').value = '';
  document.getElementById('cadre-line-uid').value = '';
  document.getElementById('cadre-active-switch').checked = true;
  document.getElementById('btn-delete-cadre').style.display = 'none';

  const modalTitle = document.getElementById('cadreEditModalLabel');
  if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-user-plus text-info"></i> 新增幹部與 LINE 綁定';

  if (cadreModalInstance) cadreModalInstance.show();
}

/**
 * 彈窗操作：編輯幹部
 */
function openEditCadreModal(name) {
  const item = (currentCadresData.editors && currentCadresData.editors[name]) || { name: name, role: "青年幹部", active: true };
  const parsed = parseCadreRole(item);
  
  document.getElementById('edit-original-name').value = name;
  document.getElementById('cadre-db-name').value = name;
  document.getElementById('cadre-db-name').disabled = true; // 名稱不隨意修改，需改請刪除重加
  populateDropdownOptions(parsed.roleTitle, parsed.group);
  document.getElementById('cadre-line-name').value = item.lineDisplayName || '';
  document.getElementById('cadre-line-uid').value = item.lineUserId || '';
  document.getElementById('cadre-active-switch').checked = item.active !== false;
  document.getElementById('btn-delete-cadre').style.display = 'inline-block';

  const modalTitle = document.getElementById('cadreEditModalLabel');
  if (modalTitle) modalTitle.innerHTML = `<i class="fa-solid fa-user-pen text-info"></i> 編輯幹部「${escapeHtml(name)}」LINE 綁定`;

  if (cadreModalInstance) cadreModalInstance.show();
}

/**
 * 儲存幹部設定與 LINE 對應
 */
async function saveCadreMapping(event) {
  if (event) event.preventDefault();

  const originalName = document.getElementById('edit-original-name').value.trim();
  const dbName = document.getElementById('cadre-db-name').value.trim();
  const titleSelect = document.getElementById('cadre-title-select');
  const groupSelect = document.getElementById('cadre-group-select');
  const roleTitle = (titleSelect ? titleSelect.value : '').trim() || '青年幹部';
  const group = (groupSelect ? groupSelect.value : '').trim() || '跨組 / 總會直屬';
  const compositeRole = `${roleTitle} • ${group}`;

  const lineName = document.getElementById('cadre-line-name').value.trim();
  const lineUid = document.getElementById('cadre-line-uid').value.trim();
  const active = document.getElementById('cadre-active-switch').checked;

  if (!dbName) {
    alert("請輸入資料庫成員姓名");
    return;
  }

  const saveBtn = document.getElementById('btn-save-cadre');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerText = '儲存中...';
  }

  try {
    const docRef = db.collection('info').doc('editors');
    const docSnap = await docRef.get();
    const existingData = docSnap.exists ? docSnap.data() : {};

    let editorList = Array.isArray(existingData.editorList) ? [...existingData.editorList] : [];
    let editorsMap = existingData.editors || {};
    let lineMap = existingData.lineUserIdToName || {};

    if (!editorList.includes(dbName)) {
      editorList.push(dbName);
    }

    // 若原先有舊的 lineUid 但這次更動了，清除舊映射
    const oldItem = editorsMap[dbName] || {};
    if (oldItem.lineUserId && oldItem.lineUserId !== lineUid) {
      delete lineMap[oldItem.lineUserId];
    }

    // 建立新項目
    editorsMap[dbName] = {
      name: dbName,
      roleTitle: roleTitle,
      group: group,
      role: compositeRole, // 向下相容
      lineDisplayName: lineName,
      lineUserId: lineUid,
      active: active,
      verifiedAt: lineUid ? (oldItem.verifiedAt || new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })) : '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // 若有提供 lineUid，寫入反向映射
    if (lineUid) {
      lineMap[lineUid] = dbName;
    }

    await docRef.set({
      editorList: editorList,
      editors: editorsMap,
      lineUserIdToName: lineMap,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    if (cadreModalInstance) cadreModalInstance.hide();
    showToast(`幹部「${dbName}」資料已成功儲存！`);
  } catch (err) {
    console.error("Error saving cadre mapping:", err);
    alert("儲存失敗: " + err.message);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = '💾 儲存設定';
    }
  }
}

/**
 * 一鍵解除 LINE 綁定
 */
async function unbindCadre(name) {
  if (!confirm(`確定要為幹部「${name}」解除 LINE 帳號綁定嗎？\n解除後其 LINE 小幫手查詢與 OCR 權限將暫時撤銷，需重新認證。`)) {
    return;
  }

  try {
    const docRef = db.collection('info').doc('editors');
    const docSnap = await docRef.get();
    if (!docSnap.exists) return;

    const existingData = docSnap.data();
    const editorsMap = existingData.editors || {};
    const lineMap = existingData.lineUserIdToName || {};

    if (editorsMap[name]) {
      const oldUid = editorsMap[name].lineUserId;
      if (oldUid && lineMap[oldUid]) {
        delete lineMap[oldUid];
      }
      editorsMap[name].lineUserId = "";
      editorsMap[name].lineDisplayName = "";
      editorsMap[name].verifiedAt = "";
      editorsMap[name].updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    }

    await docRef.update({
      editors: editorsMap,
      lineUserIdToName: lineMap,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast(`已解除「${name}」的 LINE 綁定`);
  } catch (err) {
    console.error("Error unbinding cadre:", err);
    alert("解綁失敗: " + err.message);
  }
}

/**
 * 移除幹部
 */
async function deleteCadreMapping() {
  const name = document.getElementById('edit-original-name').value.trim();
  if (!name) return;

  if (!confirm(`確定要將「${name}」自幹部與編輯名冊中永久移除嗎？`)) {
    return;
  }

  try {
    const docRef = db.collection('info').doc('editors');
    const docSnap = await docRef.get();
    if (!docSnap.exists) return;

    const existingData = docSnap.data();
    let editorList = Array.isArray(existingData.editorList) ? existingData.editorList.filter(n => n !== name) : [];
    let editorsMap = existingData.editors || {};
    let lineMap = existingData.lineUserIdToName || {};

    if (editorsMap[name]) {
      const oldUid = editorsMap[name].lineUserId;
      if (oldUid && lineMap[oldUid]) {
        delete lineMap[oldUid];
      }
      delete editorsMap[name];
    }

    await docRef.set({
      editorList: editorList,
      editors: editorsMap,
      lineUserIdToName: lineMap,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    if (cadreModalInstance) cadreModalInstance.hide();
    showToast(`已自名單移除幹部「${name}」`);
  } catch (err) {
    console.error("Error deleting cadre:", err);
    alert("移除失敗: " + err.message);
  }
}

/**
 * 複製專屬 LINE 認證指令
 */
function copyCadreLineCommand(name) {
  const cmd = `幹部認證 ${cadrePass} ${name}`;
  copyTextToClipboard(cmd, `已複製指令「${cmd}」！請傳給幹部進行 LINE 認證。`);
}

function copySampleCommand() {
  const cmd = `幹部認證 ${cadrePass} 您的姓名`;
  copyTextToClipboard(cmd, `已複製範例指令「${cmd}」`);
}

function openLineGuideModal() {
  if (lineGuideModalInstance) lineGuideModalInstance.show();
}

function copyTextToClipboard(text, successMsg) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg);
    }).catch(err => {
      fallbackCopy(text, successMsg);
    });
  } else {
    fallbackCopy(text, successMsg);
  }
}

function fallbackCopy(text, successMsg) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast(successMsg);
  } catch (err) {
    alert("複製失敗，請手動複製：" + text);
  }
  document.body.removeChild(textArea);
}

function showToast(message) {
  const toastEl = document.getElementById('actionToast');
  const msgEl = document.getElementById('toast-message');
  if (msgEl) msgEl.innerText = message;
  if (toastEl && window.bootstrap) {
    const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
    toast.show();
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 開啟自訂/微調職稱與組別選項對話框
 */
function openConfigModal() {
  const rolesText = document.getElementById('config-roles-text');
  const groupsText = document.getElementById('config-groups-text');

  if (rolesText) rolesText.value = cadreConfig.roles.join('\n');
  if (groupsText) groupsText.value = cadreConfig.groups.join('\n');

  updateConfigCounts();
  if (cadreConfigModalInstance) cadreConfigModalInstance.show();
}

/**
 * 即時統計項目數量
 */
function updateConfigCounts() {
  const rolesText = document.getElementById('config-roles-text')?.value || '';
  const groupsText = document.getElementById('config-groups-text')?.value || '';

  const roleCount = rolesText.split('\n').map(s => s.trim()).filter(Boolean).length;
  const groupCount = groupsText.split('\n').map(s => s.trim()).filter(Boolean).length;

  const roleBadge = document.getElementById('badge-roles-count');
  const groupBadge = document.getElementById('badge-groups-count');
  if (roleBadge) roleBadge.innerText = `${roleCount} 項`;
  if (groupBadge) groupBadge.innerText = `${groupCount} 項`;
}

/**
 * 恢復系統預設清單
 */
function resetConfigToDefault() {
  if (!confirm("確定要將職稱與組別選單清單恢復為系統預設值嗎？")) return;

  const rolesText = document.getElementById('config-roles-text');
  const groupsText = document.getElementById('config-groups-text');

  if (rolesText) rolesText.value = DEFAULT_CADRE_CONFIG.roles.join('\n');
  if (groupsText) groupsText.value = DEFAULT_CADRE_CONFIG.groups.join('\n');

  updateConfigCounts();
  showToast("已帶入預設清單，點擊「儲存」即可生效");
}

/**
 * 儲存自訂選單設定至 info/cadre_config
 */
async function saveCadreConfig() {
  const rolesText = document.getElementById('config-roles-text')?.value || '';
  const groupsText = document.getElementById('config-groups-text')?.value || '';

  const roles = rolesText.split('\n').map(s => s.trim()).filter(Boolean);
  const groups = groupsText.split('\n').map(s => s.trim()).filter(Boolean);

  if (roles.length === 0) {
    alert("請至少保留一個職稱/級別項目！");
    return;
  }
  if (groups.length === 0) {
    alert("請至少保留一個所屬組別項目！");
    return;
  }

  const saveBtn = document.getElementById('btn-save-config');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerText = '儲存中...';
  }

  try {
    await db.collection('info').doc('cadre_config').set({
      roles: roles,
      groups: groups,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    cadreConfig = { roles, groups };
    populateDropdownOptions();

    if (cadreConfigModalInstance) cadreConfigModalInstance.hide();
    showToast("🎉 職稱與組別選單設定已成功更新！");
  } catch (err) {
    console.error("Failed to save cadre config:", err);
    alert("儲存選單設定失敗：" + err.message);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = '💾 儲存選單設定';
    }
  }
}
