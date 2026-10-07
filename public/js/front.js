/**
 * 現場櫃檯自助報到系統 (ShumeiFront)
 * 神慈秀明會 - shumei-2025 原生邏輯
 */

// 1. Firebase 雙實例設定
const shumeiFirebaseConfig = {
  apiKey: "AIzaSyBbzTRUs27I0ksU4RtTP6Eezuh09rSp1Zg",
  authDomain: "shumei-2025.firebaseapp.com",
  databaseURL: "https://shumei-2025-default-rtdb.firebaseio.com",
  projectId: "shumei-2025",
  storageBucket: "shumei-2025.firebasestorage.app",
  messagingSenderId: "540567757935",
  appId: "1:540567757935:web:5940555836860d1679599a",
};

const ganttFirebaseConfig = {
  apiKey: "AIzaSyDhgmR4eEp7RtNPL2cLw9rgAP605xVttb0",
  authDomain: "gantt-craft-2026.firebaseapp.com",
  projectId: "gantt-craft-2026",
  storageBucket: "gantt-craft-2026.firebasestorage.app",
  messagingSenderId: "360443536934",
  appId: "1:360443536934:web:937d149a6ca1d8dc5f68e7",
};

const DEFAULT_TAGS = [
  { id: "tag_worship", name: "參拜", color: "#3b82f6" },
  { id: "tag_study", name: "上秀勉", color: "#10b981" },
  { id: "tag_bag", name: "換神光袋", color: "#f59e0b" },
  { id: "tag_johrei", name: "做淨靈", color: "#8b5cf6" },
  { id: "tag_nonbeliever", name: "未信徒淨靈", color: "#ec4899" },
];

let shumeiApp, ganttApp, shumeiDb, ganttDb;

function initFirebase() {
  if (!firebase.apps.some(app => app.name === "shumeiFrontApp")) {
    shumeiApp = firebase.initializeApp(shumeiFirebaseConfig, "shumeiFrontApp");
  } else {
    shumeiApp = firebase.app("shumeiFrontApp");
  }

  if (!firebase.apps.some(app => app.name === "ganttFrontApp")) {
    ganttApp = firebase.initializeApp(ganttFirebaseConfig, "ganttFrontApp");
  } else {
    ganttApp = firebase.app("ganttFrontApp");
  }

  shumeiDb = shumeiApp.firestore();
  ganttDb = ganttApp.firestore();
}

// 2. 狀態資料
let state = {
  step: "group", // 'group' | 'name' | 'tag' | 'success'
  leaders: [],
  members: [],
  tags: DEFAULT_TAGS,
  assignments: [],
  selectedLeader: "",
  selectedMember: null,
  isSubmitting: false,
  autoResetTimer: null
};

// 格式化今日日期 YYYY-MM-DD
function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 3. 認證檢查 (密碼 1223)
function checkAuthentication() {
  const isAuth = sessionStorage.getItem("shumei_front_auth") === "true";
  const authModal = document.getElementById("auth-layer");
  const mainApp = document.getElementById("front-app");

  if (isAuth) {
    if (authModal) authModal.style.display = "none";
    if (mainApp) mainApp.style.display = "flex";
  } else {
    if (authModal) authModal.style.display = "flex";
    if (mainApp) mainApp.style.display = "none";
    const pwdInput = document.getElementById("auth-pwd-input");
    if (pwdInput) {
      pwdInput.value = "";
      setTimeout(() => pwdInput.focus(), 150);
    }
  }
}

function handleAuthSubmit(e) {
  if (e) e.preventDefault();
  const pwdInput = document.getElementById("auth-pwd-input");
  if (!pwdInput) return;
  const clean = pwdInput.value.trim().replace(/[／\-\s]/g, "");
  if (clean === "1223") {
    sessionStorage.setItem("shumei_front_auth", "true");
    checkAuthentication();
  } else {
    alert("密碼錯誤，請輸入 1223");
    pwdInput.value = "";
  }
}

function lockCounter() {
  sessionStorage.removeItem("shumei_front_auth");
  checkAuthentication();
}

// 4. 即時監聽資料庫
function subscribeData() {
  // 1. 監聽小組幹部
  shumeiDb.collection("info").doc("youth").onSnapshot((docSnap) => {
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data && data.leader) {
        state.leaders = Array.isArray(data.leader) ? data.leader : [data.leader];
      } else {
        state.leaders = [];
      }
    }
    if (state.step === "group") renderGroupStep();
  }, (err) => {
    console.error("Leaders subscription error:", err);
  });

  // 2. 監聽成員資料
  shumeiDb.collection("member").onSnapshot((snapshot) => {
    const mems = [];
    snapshot.forEach((doc) => {
      mems.push({ id: doc.id, ...doc.data() });
    });
    state.members = mems;
    if (state.step === "name") renderNameStep();
  }, (err) => {
    console.error("Members subscription error:", err);
  });

  // 3. 監聽 GanttCraft 標籤與指派紀錄
  ganttDb.collection("ganttcraft_projects").doc("shumei").onSnapshot((docSnap) => {
    if (docSnap.exists) {
      const proj = docSnap.data() || {};
      state.tags = proj.shumeiTags && proj.shumeiTags.length > 0 ? proj.shumeiTags : DEFAULT_TAGS;
      state.assignments = proj.shumeiAssignments || [];
    } else {
      state.tags = DEFAULT_TAGS;
      state.assignments = [];
    }
    if (state.step === "tag") renderTagStep();
  }, (err) => {
    console.error("Project subscription error:", err);
  });
}

// 5. 流程推進與返回
function setStep(newStep) {
  state.step = newStep;
  updateHeaderUI();

  const containerGroup = document.getElementById("step-group");
  const containerName = document.getElementById("step-name");
  const containerTag = document.getElementById("step-tag");
  const containerSuccess = document.getElementById("step-success");

  if (containerGroup) containerGroup.style.display = newStep === "group" ? "grid" : "none";
  if (containerName) containerName.style.display = newStep === "name" ? "grid" : "none";
  if (containerTag) containerTag.style.display = newStep === "tag" ? "grid" : "none";
  if (containerSuccess) containerSuccess.style.display = newStep === "success" ? "flex" : "none";

  if (newStep === "group") renderGroupStep();
  if (newStep === "name") renderNameStep();
  if (newStep === "tag") renderTagStep();
  if (newStep === "success") renderSuccessStep();
}

function handleBackStep() {
  if (state.step === "name") {
    setStep("group");
  } else if (state.step === "tag") {
    setStep("name");
  }
}

function updateHeaderUI() {
  const subtitleEl = document.getElementById("header-subtitle");
  const backBtn = document.getElementById("btn-back-step");

  if (backBtn) {
    backBtn.style.display = (state.step === "name" || state.step === "tag") ? "inline-flex" : "none";
  }

  if (subtitleEl) {
    if (state.step === "group") {
      subtitleEl.textContent = "第一步：選擇您所屬的小組";
    } else if (state.step === "name") {
      subtitleEl.textContent = `第二步：選擇您的名字 (${state.selectedLeader} 的小組)`;
    } else if (state.step === "tag") {
      subtitleEl.textContent = `第三步：為「${state.selectedMember ? state.selectedMember.name : ""}」選擇報到標籤`;
    } else if (state.step === "success") {
      subtitleEl.textContent = "報到完成！系統即將重設...";
    }
  }
}

// 6. 步驟畫面渲染
function renderGroupStep() {
  const container = document.getElementById("step-group");
  if (!container) return;

  if (state.leaders.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5 text-muted h5">
        <div class="spinner-border text-warning spinner-border-sm me-2"></div>載入小組資料中...
      </div>
    `;
    return;
  }

  container.innerHTML = state.leaders.map(leader => `
    <button type="button" class="group-select-card" onclick="selectLeader('${encodeURIComponent(leader)}')">
      <div class="group-icon-circle">
        <i class="fa-solid fa-users"></i>
      </div>
      <span class="group-name-text">${leader}</span>
    </button>
  `).join("");
}

function selectLeader(encodedLeader) {
  state.selectedLeader = decodeURIComponent(encodedLeader);
  setStep("name");
}

function renderNameStep() {
  const container = document.getElementById("step-name");
  if (!container) return;

  const filtered = state.members.filter(m => m.leader === state.selectedLeader);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5 text-muted h5">
        此小組目前沒有成員，請回上一步選擇其他組別。
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(member => `
    <button type="button" class="member-select-card" onclick="selectMember('${member.id}')">
      <div class="member-icon-circle">
        <i class="fa-solid fa-user"></i>
      </div>
      <span class="member-name-text">${member.name}</span>
    </button>
  `).join("");
}

function selectMember(memberId) {
  state.selectedMember = state.members.find(m => m.id === memberId) || null;
  setStep("tag");
}

function renderTagStep() {
  const container = document.getElementById("step-tag");
  if (!container || !state.selectedMember) return;

  const todayStr = getTodayStr();

  const tagCardsHtml = state.tags.map(tag => {
    const isAssigned = state.assignments.some(
      a => a.staffId === state.selectedMember.id && a.date === todayStr && a.tagId === tag.id
    );

    return `
      <button type="button" 
              class="tag-select-card ${isAssigned ? 'active-assigned' : ''}" 
              style="--tag-color: ${tag.color};"
              onclick="toggleTag('${tag.id}')"
              ${state.isSubmitting ? 'disabled' : ''}>
        ${isAssigned ? `
          <div class="assigned-check-badge">
            <i class="fa-solid fa-circle-check"></i>
          </div>
        ` : ''}
        <div class="tag-icon-circle" style="background-color: ${tag.color};">
          <i class="fa-solid fa-tag"></i>
        </div>
        <span class="tag-name-text">${tag.name}</span>
      </button>
    `;
  }).join("");

  const actionButtonsHtml = `
    <div class="col-12 action-row-container mt-4 pt-3 border-top border-secondary border-opacity-25">
      <div class="row g-3">
        <div class="col-6">
          <button type="button" class="btn btn-finish-reporting w-100" onclick="finishReporting()" ${state.isSubmitting ? 'disabled' : ''}>
            <i class="fa-solid fa-circle-check fa-lg me-2"></i>完成報到
          </button>
        </div>
        <div class="col-6">
          <button type="button" class="btn btn-clear-reporting w-100" onclick="clearTodayReporting()" ${state.isSubmitting ? 'disabled' : ''}>
            <i class="fa-solid fa-trash-can fa-lg me-2"></i>清空紀錄
          </button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = tagCardsHtml + actionButtonsHtml;
}

// 7. 標籤打卡操作
async function toggleTag(tagId) {
  if (!state.selectedMember || state.isSubmitting) return;
  const tag = state.tags.find(t => t.id === tagId);
  if (!tag) return;

  state.isSubmitting = true;
  renderTagStep();

  try {
    const todayStr = getTodayStr();
    const isAssigned = state.assignments.some(
      a => a.staffId === state.selectedMember.id && a.date === todayStr && a.tagId === tag.id
    );

    let newAssignments = [...state.assignments];

    if (isAssigned) {
      // 移除標籤
      newAssignments = newAssignments.filter(
        a => !(a.staffId === state.selectedMember.id && a.date === todayStr && a.tagId === tag.id)
      );
    } else {
      // 新增標籤
      let value = undefined;
      if (tag.name.includes("做淨靈") || tag.name.includes("未信徒淨靈") || tag.name.includes("淨靈")) {
        const numStr = window.prompt(`請輸入【${tag.name}】的人數：`, "1");
        if (numStr === null) {
          state.isSubmitting = false;
          renderTagStep();
          return;
        }
        const parsed = parseInt(numStr, 10);
        if (!isNaN(parsed) && parsed > 0) {
          value = parsed;
        } else {
          alert("請輸入有效的數字");
          state.isSubmitting = false;
          renderTagStep();
          return;
        }
      }

      const newAssign = {
        id: `assign_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        staffId: state.selectedMember.id,
        tagId: tag.id,
        date: todayStr,
        ...(value !== undefined ? { value } : {})
      };
      newAssignments.push(newAssign);
    }

    await ganttDb.collection("ganttcraft_projects").doc("shumei").set({
      shumeiAssignments: newAssignments
    }, { merge: true });

    state.assignments = newAssignments;
  } catch (err) {
    console.error("Toggle tag error:", err);
    alert("儲存失敗，請檢查網路連線");
  } finally {
    state.isSubmitting = false;
    renderTagStep();
  }
}

async function clearTodayReporting() {
  if (!state.selectedMember || state.isSubmitting) return;
  if (!confirm(`確定要清空「${state.selectedMember.name}」今天的報到紀錄嗎？`)) return;

  state.isSubmitting = true;
  renderTagStep();

  try {
    const todayStr = getTodayStr();
    const filtered = state.assignments.filter(
      a => !(a.staffId === state.selectedMember.id && a.date === todayStr)
    );

    await ganttDb.collection("ganttcraft_projects").doc("shumei").set({
      shumeiAssignments: filtered
    }, { merge: true });

    state.assignments = filtered;
  } catch (err) {
    console.error("Clear reporting error:", err);
    alert("清空失敗，請檢查網路連線");
  } finally {
    state.isSubmitting = false;
    renderTagStep();
  }
}

// 8. 完成報到與成功慶祝
function finishReporting() {
  setStep("success");
}

function renderSuccessStep() {
  const nameEl = document.getElementById("success-member-name");
  if (nameEl && state.selectedMember) {
    nameEl.textContent = `${state.selectedMember.name} 已成功登記`;
  }

  if (state.autoResetTimer) clearTimeout(state.autoResetTimer);
  state.autoResetTimer = setTimeout(() => {
    resetFlow();
  }, 3000);
}

function resetFlow() {
  if (state.autoResetTimer) clearTimeout(state.autoResetTimer);
  state.selectedLeader = "";
  state.selectedMember = null;
  setStep("group");
}

// 9. 登出系統
function handleSignOut() {
  if (typeof firebase !== "undefined" && firebase.auth) {
    firebase.auth().signOut().then(() => {
      window.location.href = "/";
    }).catch(() => {
      window.location.href = "/";
    });
  } else {
    window.location.href = "/";
  }
}

// 初始化啟動
document.addEventListener("DOMContentLoaded", () => {
  initFirebase();
  checkAuthentication();
  subscribeData();
  setStep("group");
});
