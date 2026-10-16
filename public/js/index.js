firebase.initializeApp({
  apiKey: 'AIzaSyA8KmjgG2SWv2XVTlqMcxxa2PbljlX7ueU',
  authDomain: 'shumei-2025.firebaseapp.com',
  databaseURL: 'https://shumei-2025.firebaseio.com',
  projectId: 'shumei-2025',
});
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence for Firestore
db.enablePersistence().catch((err) => {
  if (err.code == 'failed-precondition') {
    console.warn("Firestore offline persistence failed: Multiple tabs open.");
  } else if (err.code == 'unimplemented') {
    console.warn("Firestore offline persistence failed: Browser not supported.");
  }
});

let leaderPasswordModalInstance = null;

function showLoading() {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'inline-block';
}

function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
}

function openLeaderPasswordModal() {
  const modalEl = document.getElementById('leaderPasswordModal');
  if (!modalEl) return;
  if (!leaderPasswordModalInstance && window.bootstrap) {
    leaderPasswordModalInstance = new bootstrap.Modal(modalEl);
  }
  
  // 重置表單狀態
  const inputEl = document.getElementById('leaderPasswordInput');
  const alertEl = document.getElementById('leaderPasswordAlert');
  const submitBtn = document.getElementById('btnSubmitLeaderPassword');
  const spinner = document.getElementById('pwdSubmitSpinner');
  const btnText = document.getElementById('pwdSubmitText');

  if (inputEl) inputEl.value = '';
  if (alertEl) {
    alertEl.classList.add('d-none');
    alertEl.innerText = '';
  }
  if (submitBtn) submitBtn.disabled = false;
  if (spinner) spinner.classList.add('d-none');
  if (btnText) btnText.innerText = '確認登入';

  if (leaderPasswordModalInstance) {
    leaderPasswordModalInstance.show();
  }
  setTimeout(() => {
    if (inputEl) inputEl.focus();
  }, 400);
}

function toggleLeaderPasswordVisibility() {
  const input = document.getElementById('leaderPasswordInput');
  const btn = document.getElementById('togglePasswordBtn');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.innerText = '🙈';
  } else {
    input.type = 'password';
    if (btn) btn.innerText = '👁️';
  }
}

async function submitLeaderPassword(event) {
  if (event) event.preventDefault();
  const inputEl = document.getElementById('leaderPasswordInput');
  const alertEl = document.getElementById('leaderPasswordAlert');
  const submitBtn = document.getElementById('btnSubmitLeaderPassword');
  const spinner = document.getElementById('pwdSubmitSpinner');
  const btnText = document.getElementById('pwdSubmitText');

  const entered = (inputEl ? inputEl.value : '').trim();
  if (!entered) {
    if (alertEl) {
      alertEl.innerText = '請輸入幹部管理密碼';
      alertEl.classList.remove('d-none');
    }
    return;
  }

  // 進入驗證 Loading 狀態
  if (submitBtn) submitBtn.disabled = true;
  if (spinner) spinner.classList.remove('d-none');
  if (btnText) btnText.innerText = '驗證中...';
  if (alertEl) alertEl.classList.add('d-none');

  try {
    let validPass = 'shumei567sty'; // 系統預設密碼備援
    try {
      const doc = await db.collection('info').doc('set').get();
      if (doc.exists && doc.data().pass) {
        validPass = String(doc.data().pass);
      }
    } catch (fetchErr) {
      console.warn("讀取線上密碼失敗，使用預設幹部密碼驗證:", fetchErr);
    }

    if (entered !== validPass) {
      if (alertEl) {
        alertEl.innerText = '密碼錯誤，請重新確認後再試';
        alertEl.classList.remove('d-none');
      }
      if (submitBtn) submitBtn.disabled = false;
      if (spinner) spinner.classList.add('d-none');
      if (btnText) btnText.innerText = '確認登入';
      return;
    }

    // 密碼正確：若尚未登入則執行匿名登入以取得合法 Firebase Auth Token
    if (!auth.currentUser) {
      await auth.signInAnonymously();
    }

    // 儲存幹部授權旗標
    sessionStorage.setItem('SHUMEI_LEADER_AUTH', 'true');
    localStorage.setItem('SHUMEI_USER_ROLE', 'leader');

    if (leaderPasswordModalInstance) {
      leaderPasswordModalInstance.hide();
    }

    showLoading();
    window.location.href = '/youth/dashboard.html';
  } catch (error) {
    console.error("幹部密碼登入發生錯誤:", error);
    if (alertEl) {
      alertEl.innerText = '登入失敗: ' + (error.message || error);
      alertEl.classList.remove('d-none');
    }
    if (submitBtn) submitBtn.disabled = false;
    if (spinner) spinner.classList.add('d-none');
    if (btnText) btnText.innerText = '確認登入';
  }
}

function signInWithGoogle() {
  showLoading();
  sessionStorage.removeItem('SHUMEI_LEADER_AUTH');
  localStorage.setItem('SHUMEI_USER_ROLE', 'leader');

  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider)
    .then((result) => {
      // 成功後會自動觸發 onAuthStateChanged
    })
    .catch((error) => {
      console.error("Google登入失敗:", error);
      hideLoading();
      alert("登入失敗: " + error.message);
    });
}

function signInAsGuest(role) {
  showLoading();
  sessionStorage.removeItem('SHUMEI_LEADER_AUTH');
  localStorage.setItem('SHUMEI_USER_ROLE', 'member');

  auth.signInAnonymously()
    .then(() => {
      window.location.href = '/member/index.html';
    })
    .catch((error) => {
      console.error("匿名登入失敗:", error);
      hideLoading();
      alert("登入失敗: " + error.message);
    });
}

// 監聽登入狀態，如果已經登入，自動導向對應頁面
auth.onAuthStateChanged((user) => {
  if (user) {
    // 若為匿名使用者：
    // 若本工作階段已驗證過小組長密碼，自動進入總覽
    if (user.isAnonymous) {
      const isLeader = sessionStorage.getItem('SHUMEI_LEADER_AUTH') === 'true';
      if (isLeader) {
        showLoading();
        window.location.href = '/youth/dashboard.html';
      }
      return;
    }
    
    showLoading();
    // Google 登入使用者：檢查是否為管理員（幹部）
    db.collection('info').doc('admins').get().then((doc) => {
      if (doc.exists) {
        const emails = doc.data().emails || [];
        if (emails.includes(user.email)) {
          window.location.href = '/youth/dashboard.html';
        } else {
          window.location.href = '/youth/dashboard.html'; // 世話人與幹部相同入口
        }
      } else {
        window.location.href = '/youth/dashboard.html';
      }
    }).catch((error) => {
      console.error("驗證權限時發生錯誤:", error);
      window.location.href = '/youth/dashboard.html';
    });
  }
});
