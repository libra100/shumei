/**
 * Shumei Seed Swap Event - Intake & Temporary Vault Controller (swap.js)
 * Implements public seed intake, temporary event vault, and end-of-event archiving.
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

// Default Dictionaries matching Seed-Bank NamingRule engine
const FAMILY_CODES = {
  SO: { name: '茄科 (Solanaceae)', code: 'SO', defaultVariety: 'LY', latin: 'Solanum lycopersicum' },
  PO: { name: '禾本科 (Poaceae)', code: 'PO', defaultVariety: 'OS', latin: 'Oryza sativa' },
  FA: { name: '豆科 (Fabaceae)', code: 'FA', defaultVariety: 'GM', latin: 'Glycine max' },
  CU: { name: '葫蘆科 (Cucurbitaceae)', code: 'CU', defaultVariety: 'ME', latin: 'Cucumis melo' },
  BR: { name: '十字花科 (Brassicaceae)', code: 'BR', defaultVariety: 'OL', latin: 'Raphanus sativus' },
  AS: { name: '菊科 (Asteraceae)', code: 'AS', defaultVariety: 'LA', latin: 'Lactuca sativa' },
  MA: { name: '錦葵科 (Malvaceae)', code: 'MA', defaultVariety: 'ES', latin: 'Abelmoschus esculentus' },
  LA: { name: '唇形科 (Lamiaceae)', code: 'LA', defaultVariety: 'BA', latin: 'Ocimum basilicum' },
  OTHER: { name: '其他科別 (Spec.)', code: 'SP', defaultVariety: 'VA', latin: 'Species spec.' }
};

const REGION_LABELS = {
  TW01: '新北北海岸 (淡水/三芝)',
  TW02: '宜蘭員山純淨水源區',
  TW03: '桃園大溪大漢溪畔',
  TW04: '新竹關西丘陵區',
  TW05: '南投埔里自然農法示範園區',
  TW06: '台南後壁無米樂產區',
  TW07: '高雄旗美平原',
  TW08: '屏東大樹水源區',
  TW09: '花蓮壽豐無污染淨土',
  TW10: '台東池上日照田區',
  OTHER: '台灣在地區域 (自留種)'
};

// Initial Seed Data for Temporary Event Vault Showcase
const DEFAULT_TEMP_VAULT_ITEMS = [
  {
    id: 'vault_temp_001',
    tempCode: 'TEMP-SWAP-2026-X001',
    seedName: '黑柿留種番茄',
    family: 'SO',
    variety: '在來黑柿',
    harvestDate: '2026-05',
    generation: 5,
    method: 'S',
    packages: 8,
    grams: 40,
    providerName: '林健國 (幸福農莊)',
    phone: '0912-345-678',
    email: 'farmer.lin@shumei.org',
    region: 'TW01',
    traits: ['耐豪雨高濕', '直根系抗倒伏', '純淨甘甜'],
    notes: '連續 5 年未施肥料農藥，果實紮實，果酸果香濃郁，母株耐梅雨性極佳。',
    status: 'pending_review', // 'pending_review' | 'archived_to_bank' | 'rejected'
    storageLocation: 'ST-04',
    officialCode: '',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'vault_temp_002',
    tempCode: 'TEMP-SWAP-2026-X002',
    seedName: '自家留種青皮黑豆',
    family: 'FA',
    variety: '青仁黑豆',
    harvestDate: '2026-04',
    generation: 8,
    method: 'S',
    packages: 12,
    grams: 60,
    providerName: '林大姐 (員山有機水源區)',
    phone: '0922-888-111',
    email: 'sister.lin@gmail.com',
    region: 'TW02',
    traits: ['耐雨水高濕', '高花青素', '釀造純醬油首選'],
    notes: '員山水源區第 8 代，抗蟲性強，豆粒飽滿黑亮，煮湯或發酵豆豉風味絕佳。',
    status: 'pending_review',
    storageLocation: 'ST-04',
    officialCode: '',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: 'vault_temp_003',
    tempCode: 'TEMP-SWAP-2026-X003',
    seedName: '自家採種越光水稻',
    family: 'PO',
    variety: '在來越光系',
    harvestDate: '2025-11',
    generation: 12,
    method: 'S',
    packages: 20,
    grams: 100,
    providerName: '陳志遠 (埔里示範園區)',
    phone: '0933-777-666',
    email: 'chen.farm@shumei.org',
    region: 'TW05',
    traits: ['直根系抗倒伏', '耐乾旱', '淡雅米香'],
    notes: '已由保種小組完成發芽率測試（92%），正式完成驗收入庫。',
    status: 'archived_to_bank',
    storageLocation: 'ST-01',
    officialCode: 'PO-OS-S-TW05-2511-001',
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    archivedAt: new Date(Date.now() - 3600000 * 1).toISOString()
  }
];

// App State
let tempVaultItems = JSON.parse(localStorage.getItem('SHUMEI_SWAP_TEMP_VAULT')) || DEFAULT_TEMP_VAULT_ITEMS;
let activeProcessingItem = null;
let html5QrScanner = null;

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
  renderTempVaultTable();
  updateVaultKPIs();
  fetchFirestoreTempVault();
});

// Toast notification helper
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

// Switch between Public Intake view and Staff Temp Vault view
function switchViewMode(mode) {
  const viewPublic = document.getElementById('view-public');
  const viewStaff = document.getElementById('view-staff');
  const btnPublic = document.getElementById('btn-mode-public');
  const btnStaff = document.getElementById('btn-mode-staff');

  if (mode === 'staff') {
    viewPublic.style.display = 'none';
    viewStaff.style.display = 'block';
    btnPublic.classList.remove('btn-primary-custom');
    btnPublic.classList.add('btn-outline-light');
    btnStaff.classList.remove('btn-outline-light');
    btnStaff.classList.add('btn-primary-custom');
    renderTempVaultTable();
    updateVaultKPIs();
  } else {
    viewStaff.style.display = 'none';
    viewPublic.style.display = 'block';
    btnStaff.classList.remove('btn-primary-custom');
    btnStaff.classList.add('btn-outline-light');
    btnPublic.classList.remove('btn-outline-light');
    btnPublic.classList.add('btn-primary-custom');
  }
}

// Sync from Firestore `seed_temp_vault`
function fetchFirestoreTempVault() {
  db.collection('seed_temp_vault').get().then(snapshot => {
    if (!snapshot.empty) {
      const remote = [];
      snapshot.forEach(doc => {
        remote.push({ id: doc.id, ...doc.data() });
      });
      // Merge with remote
      tempVaultItems = remote;
      localStorage.setItem('SHUMEI_SWAP_TEMP_VAULT', JSON.stringify(tempVaultItems));
      renderTempVaultTable();
      updateVaultKPIs();
    }
  }).catch(err => {
    console.log("Firestore offline/fallback for seed_temp_vault:", err);
  });
}

// Submit Seed Intake Form (Public)
function submitSeedIntake(e) {
  if (e && e.preventDefault) e.preventDefault();

  const providerName = document.getElementById('intakeProviderName').value.trim();
  const phone = document.getElementById('intakePhone').value.trim();
  const email = document.getElementById('intakeEmail').value.trim();
  const region = document.getElementById('intakeRegion').value;

  const seedName = document.getElementById('intakeSeedName').value.trim();
  const family = document.getElementById('intakeFamily').value;
  const variety = document.getElementById('intakeVariety').value.trim() || '自留種在來系';
  const harvestDate = document.getElementById('intakeHarvestDate').value || '2026-05';
  const generation = parseInt(document.getElementById('intakeGeneration').value, 10) || 1;
  const method = document.getElementById('intakeMethod').value;
  const packages = parseInt(document.getElementById('intakePackages').value, 10) || 5;
  const grams = parseInt(document.getElementById('intakeGrams').value, 10) || (packages * 5);
  const notes = document.getElementById('intakeNotes').value.trim();

  // Selected Traits
  const traits = [];
  if (document.getElementById('trait-drought').checked) traits.push('耐乾旱');
  if (document.getElementById('trait-rain').checked) traits.push('耐豪雨高濕');
  if (document.getElementById('trait-deep-root').checked) traits.push('直根系抗倒伏');
  if (document.getElementById('trait-sweet').checked) traits.push('純淨甘甜');

  // Generate Unique Temporary Vault Sequence
  const seqSuffix = Math.floor(1000 + Math.random() * 9000);
  const tempCode = `TEMP-SWAP-2026-X${seqSuffix}`;

  const newItem = {
    id: `vault_item_${Date.now()}`,
    tempCode: tempCode,
    seedName: seedName,
    family: family,
    variety: variety,
    harvestDate: harvestDate,
    generation: generation,
    method: method,
    packages: packages,
    grams: grams,
    providerName: providerName,
    phone: phone,
    email: email,
    region: region,
    traits: traits,
    notes: notes,
    status: 'pending_review',
    storageLocation: 'ST-04 (暫時倉)',
    officialCode: '',
    createdAt: new Date().toISOString()
  };

  // Add to local state & storage
  tempVaultItems.unshift(newItem);
  localStorage.setItem('SHUMEI_SWAP_TEMP_VAULT', JSON.stringify(tempVaultItems));

  // Sync to Firestore
  db.collection('seed_temp_vault').doc(newItem.id).set(newItem).catch(err => {
    console.log("Firestore temp vault sync:", err);
  });

  // Award Karma points to user (+50)
  let currentKarma = parseInt(localStorage.getItem('shumei_user_karma') || '380', 10);
  currentKarma += 50;
  localStorage.setItem('shumei_user_karma', currentKarma.toString());

  // Render QR Code in modal
  const qrContainer = document.getElementById('intakeQrCodeContainer');
  qrContainer.innerHTML = '';
  new QRCode(qrContainer, {
    text: tempCode,
    width: 180,
    height: 180,
    colorDark: "#1b4332",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });

  document.getElementById('successVoucherCode').innerText = tempCode;

  // Reset form
  document.getElementById('swapIntakeForm').reset();

  // Show Success Modal
  const modal = new bootstrap.Modal(document.getElementById('intakeSuccessModal'));
  modal.show();

  renderTempVaultTable();
  updateVaultKPIs();
  showToast(`🎉 成功登記「${seedName}」！已存入本次交流會暫時倉，獲得 +50 Karma！`);
}

// Update Top Bar and KPI counts
function updateVaultKPIs() {
  const total = tempVaultItems.length;
  const pending = tempVaultItems.filter(i => i.status === 'pending_review').length;
  const archived = tempVaultItems.filter(i => i.status === 'archived_to_bank').length;
  const rejected = tempVaultItems.filter(i => i.status === 'rejected').length;

  const totalPkgs = tempVaultItems.reduce((acc, cur) => acc + (cur.packages || 0), 0);

  const topCount = document.getElementById('top-vault-count');
  if (topCount) topCount.innerText = total;

  const kpiTotal = document.getElementById('kpi-total-items');
  if (kpiTotal) kpiTotal.innerHTML = `${total} <span class="fs-6 text-muted">批</span>`;

  const kpiTotalPkgs = document.getElementById('kpi-total-packages');
  if (kpiTotalPkgs) kpiTotalPkgs.innerText = `共 ${totalPkgs} 包`;

  const kpiPending = document.getElementById('kpi-pending-items');
  if (kpiPending) kpiPending.innerHTML = `${pending} <span class="fs-6 text-muted">批</span>`;

  const kpiArchived = document.getElementById('kpi-archived-items');
  if (kpiArchived) kpiArchived.innerHTML = `${archived} <span class="fs-6 text-muted">批</span>`;

  const kpiRejected = document.getElementById('kpi-rejected-items');
  if (kpiRejected) kpiRejected.innerHTML = `${rejected} <span class="fs-6 text-muted">批</span>`;
}

// Render Table in Staff View
function renderTempVaultTable() {
  const tbody = document.getElementById('tempVaultTableBody');
  if (!tbody) return;

  const search = (document.getElementById('vaultSearchInput')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('vaultStatusFilter')?.value || 'all';

  const filtered = tempVaultItems.filter(item => {
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesQuery = !search ||
      item.seedName.toLowerCase().includes(search) ||
      item.tempCode.toLowerCase().includes(search) ||
      item.providerName.toLowerCase().includes(search) ||
      (REGION_LABELS[item.region] || '').toLowerCase().includes(search);
    return matchesStatus && matchesQuery;
  });

  const countDisplay = document.getElementById('displayed-vault-count');
  if (countDisplay) countDisplay.innerText = filtered.length;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-5 text-muted">
          <i class="fa-solid fa-box-open fs-2 mb-2 d-block"></i>
          暫無符合條件的暫時倉種子項目
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const fam = FAMILY_CODES[item.family] || FAMILY_CODES.OTHER;
    const regionName = REGION_LABELS[item.region] || item.region;

    let statusBadge = '';
    if (item.status === 'pending_review') {
      statusBadge = `<span class="vault-status-badge status-pending"><i class="fa-solid fa-clock"></i> 待整理檢驗</span>`;
    } else if (item.status === 'archived_to_bank') {
      statusBadge = `<span class="vault-status-badge status-archived"><i class="fa-solid fa-circle-check"></i> 已正式入庫</span>`;
    } else {
      statusBadge = `<span class="vault-status-badge status-rejected"><i class="fa-solid fa-ban"></i> 淘汰退回</span>`;
    }

    return `
      <tr>
        <td>
          <code class="text-warning fw-bold">${item.tempCode}</code>
          ${item.officialCode ? `<br><small class="text-info font-mono fw-bold">${item.officialCode}</small>` : ''}
        </td>
        <td>
          <strong class="text-white">${item.seedName}</strong>
          <br><small class="text-muted">${fam.name}</small>
        </td>
        <td>
          <span class="text-light">${item.providerName}</span>
          <br><small class="text-muted">${item.phone || ''}</small>
        </td>
        <td>
          <span class="badge bg-success bg-opacity-75 font-mono">第 ${item.generation} 代</span>
        </td>
        <td>
          <span class="text-light small">${item.harvestDate}</span>
          <br><small class="text-muted">${regionName.split(' ')[0]}</small>
        </td>
        <td>
          <strong class="text-white">${item.packages}</strong> 包
          <br><small class="text-muted">${item.grams || item.packages * 5}g</small>
        </td>
        <td>${statusBadge}</td>
        <td class="text-end">
          ${item.status === 'pending_review' 
            ? `<button class="btn btn-sm btn-outline-warning rounded-pill px-2 py-0 interactive" onclick="openProcessModal('${item.id}')">
                 <i class="fa-solid fa-clipboard-check me-1"></i> 檢驗入庫
               </button>` 
            : `<button class="btn btn-sm btn-outline-info rounded-pill px-2 py-0 interactive" onclick="openLabelPreview('${item.id}')">
                 <i class="fa-solid fa-tag me-1"></i> 標籤
               </button>`
          }
        </td>
      </tr>
    `;
  }).join('');
}

function filterVaultList() {
  renderTempVaultTable();
}

// Open Staff Process Modal for Item
function openProcessModal(itemId) {
  const item = tempVaultItems.find(i => i.id === itemId);
  if (!item) return;
  activeProcessingItem = item;

  document.getElementById('processItemId').value = item.id;
  document.getElementById('processSeedNameTitle').innerText = item.seedName;
  document.getElementById('processTempCode').innerText = item.tempCode;
  document.getElementById('processProviderMeta').innerText = `提供者：${item.providerName} ｜ 採收：${item.harvestDate} ｜ 產地：${REGION_LABELS[item.region] || item.region}`;
  document.getElementById('processVerifiedPackages').value = item.packages;
  document.getElementById('processQualityResult').value = 'pass';
  document.getElementById('processStorageSpace').value = 'ST-01';

  // Automatically generate NamingRule
  regenerateOfficialCode();

  const modal = new bootstrap.Modal(document.getElementById('processVaultModal'));
  modal.show();
}

// Automatic NamingRule Generation according to Seed-Bank formula: [Family]-[Variety]-[Method]-[Region]-[YYMM]-[Batch]
function regenerateOfficialCode() {
  if (!activeProcessingItem) return;
  const fam = FAMILY_CODES[activeProcessingItem.family] || FAMILY_CODES.OTHER;
  const famCode = fam.code;
  const varCode = fam.defaultVariety;
  const methodCode = activeProcessingItem.method || 'S';
  const regionCode = activeProcessingItem.region || 'TW01';

  // YYMM
  const yymm = activeProcessingItem.harvestDate ? activeProcessingItem.harvestDate.replace('-', '').slice(2, 6) : '2605';
  const batchSeq = String(Math.floor(1 + Math.random() * 99)).padStart(3, '0');

  const formula = `${famCode}-${varCode}-${methodCode}-${regionCode}-${yymm}-${batchSeq}`;
  document.getElementById('processOfficialCode').value = formula;
}

function handleQualityChange(val) {
  const btn = document.getElementById('btnConfirmArchive');
  if (val === 'reject') {
    btn.innerHTML = `<i class="fa-solid fa-ban me-1"></i> 確認淘汰退回`;
    btn.className = 'btn btn-danger flex-grow-1 py-2 interactive';
  } else {
    btn.innerHTML = `<i class="fa-solid fa-check-double me-1"></i> 核准正式入庫 (移出暫時倉)`;
    btn.className = 'btn btn-primary-custom flex-grow-1 py-2 interactive';
  }
}

// Submit Archive to Official Permanent Bank
function submitArchiveToBank(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!activeProcessingItem) return;

  const quality = document.getElementById('processQualityResult').value;
  const verifiedPkgs = parseInt(document.getElementById('processVerifiedPackages').value, 10) || activeProcessingItem.packages;
  const storageSpace = document.getElementById('processStorageSpace').value;
  const officialCode = document.getElementById('processOfficialCode').value.trim();
  const notes = document.getElementById('processInspectorNotes').value.trim();

  if (quality === 'reject') {
    activeProcessingItem.status = 'rejected';
    activeProcessingItem.inspectorNotes = notes;
    showToast(`種子【${activeProcessingItem.seedName}】已標記為淘汰退回！`, 'warning');
  } else {
    activeProcessingItem.status = 'archived_to_bank';
    activeProcessingItem.packages = verifiedPkgs;
    activeProcessingItem.storageLocation = storageSpace;
    activeProcessingItem.officialCode = officialCode;
    activeProcessingItem.inspectorNotes = notes;
    activeProcessingItem.archivedAt = new Date().toISOString();

    // Sync to official `seeds` collection in Firestore
    db.collection('seeds').doc(officialCode).set({
      id: officialCode,
      shumeiCode: officialCode,
      name: activeProcessingItem.seedName,
      family: activeProcessingItem.family,
      generation: activeProcessingItem.generation,
      harvester: activeProcessingItem.providerName,
      harvestYear: parseInt(activeProcessingItem.harvestDate.split('-')[0], 10),
      packages: verifiedPkgs,
      quantityGrams: verifiedPkgs * 5,
      storageLocationId: storageSpace,
      climateAttributes: activeProcessingItem.traits,
      sourceEvent: '2026 秀明自然農法種子交換會 (暫時倉移入)',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(err => console.log("Firestore official seed sync:", err));

    showToast(`🎉【${activeProcessingItem.seedName}】已成功核發編碼【${officialCode}】並正式移入種子庫 (${storageSpace})！`);
  }

  // Update temp vault item in Firestore
  db.collection('seed_temp_vault').doc(activeProcessingItem.id).set(activeProcessingItem, { merge: true })
    .catch(err => console.log("Firestore update temp vault item:", err));

  localStorage.setItem('SHUMEI_SWAP_TEMP_VAULT', JSON.stringify(tempVaultItems));

  const modalInstance = bootstrap.Modal.getInstance(document.getElementById('processVaultModal'));
  if (modalInstance) modalInstance.hide();

  renderTempVaultTable();
  updateVaultKPIs();
}

// 100mm x 60mm Thermal Label Preview
function previewAndPrintLabel() {
  if (!activeProcessingItem) return;
  openLabelPreview(activeProcessingItem.id);
}

function openLabelPreview(itemId) {
  const item = tempVaultItems.find(i => i.id === itemId);
  if (!item) return;

  const fam = FAMILY_CODES[item.family] || FAMILY_CODES.OTHER;
  const officialCode = item.officialCode || item.tempCode;

  document.getElementById('labelGenBadge').innerText = `F${item.generation} 代`;
  document.getElementById('labelGenText').innerText = `第 ${item.generation} 代自家留種`;
  document.getElementById('labelCropName').innerText = item.seedName;
  document.getElementById('labelLatinName').innerText = fam.latin;
  document.getElementById('labelHarvestYear').innerText = item.harvestDate ? `${item.harvestDate.replace('-', '年')}月` : '2026年05月';
  document.getElementById('labelHarvester').innerText = item.providerName;
  document.getElementById('labelRegion').innerText = `${REGION_LABELS[item.region] || item.region} (${item.region})`;
  document.getElementById('labelStorageId').innerText = item.storageLocation || 'ST-01';
  document.getElementById('labelShumeiCode').innerText = `[${officialCode}]`;

  // Render QR Code pointing to public provenance route
  const qrBox = document.getElementById('labelQrContainer');
  qrBox.innerHTML = '';
  new QRCode(qrBox, {
    text: `https://shumei-2025.web.app/trace/${officialCode}`,
    width: 80,
    height: 80,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });

  const modal = new bootstrap.Modal(document.getElementById('labelPreviewModal'));
  modal.show();
}

// Staff WebCam QR Scanner
function openScanModal() {
  const modal = new bootstrap.Modal(document.getElementById('scanModal'));
  modal.show();

  setTimeout(() => {
    try {
      if (!html5QrScanner) {
        html5QrScanner = new Html5Qrcode("swap-qr-reader");
      }
      html5QrScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          handleScannedQrText(decodedText);
          html5QrScanner.stop();
        },
        (error) => {}
      );
    } catch (e) {
      console.log("Scanner start info:", e);
    }
  }, 500);
}

function handleScannedQrText(text) {
  let code = text;
  try {
    const parsed = JSON.parse(text);
    if (parsed.tempCode) code = parsed.tempCode;
  } catch (e) {}

  document.getElementById('manualScanInput').value = code;
  manualLookupCode();
}

function manualLookupCode() {
  const input = document.getElementById('manualScanInput').value.trim();
  if (!input) return;

  const item = tempVaultItems.find(i => i.tempCode === input || i.id === input || (i.officialCode && i.officialCode === input));
  if (item) {
    const scanModalInstance = bootstrap.Modal.getInstance(document.getElementById('scanModal'));
    if (scanModalInstance) scanModalInstance.hide();
    openProcessModal(item.id);
    showToast(`已找到暫存種子【${item.seedName}】(${item.tempCode})！`);
  } else {
    showToast(`未找到流水號「${input}」之紀錄，請重新確認！`, 'warning');
  }
}

// Export Temp Vault as CSV
function exportTempVaultCSV() {
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  csvContent += "暫存流水號,作物名稱,植物科別,品種,世代,農法,包數,估計重量g,提供者,電話,Email,產地區域,採收年月,生長特徵,備註故事,狀態,實體儲位,正式編碼\n";

  tempVaultItems.forEach(i => {
    const fam = (FAMILY_CODES[i.family] || FAMILY_CODES.OTHER).name;
    const region = REGION_LABELS[i.region] || i.region;
    const traits = (i.traits || []).join(';');
    csvContent += `"${i.tempCode}","${i.seedName}","${fam}","${i.variety}",${i.generation},"${i.method}",${i.packages},${i.grams},"${i.providerName}","${i.phone}","${i.email}","${region}","${i.harvestDate}","${traits}","${(i.notes || '').replace(/"/g, '""')}","${i.status}","${i.storageLocation}","${i.officialCode || ''}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `shumei_seed_swap_temp_vault_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast("已成功匯出交換會暫時倉清單 CSV！");
}
