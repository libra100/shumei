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

function showLoading() {
  document.getElementById('loading').style.display = 'inline-block';
}

function signInWithGoogle() {
  showLoading();
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider)
    .then((result) => {
      // 成功後會自動觸發 onAuthStateChanged
    })
    .catch((error) => {
      console.error("Google登入失敗:", error);
      document.getElementById('loading').style.display = 'none';
      alert("登入失敗: " + error.message);
    });
}

function signInAsGuest(role) {
  showLoading();
  auth.signInAnonymously()
    .then(() => {
      if (role === 'admin') {
        window.location.href = '/youth/admin.html';
      } else {
        window.location.href = '/youth/list.html';
      }
    })
    .catch((error) => {
      console.error("匿名登入失敗:", error);
      document.getElementById('loading').style.display = 'none';
      alert("登入失敗: " + error.message);
    });
}

// 監聽登入狀態，如果已經登入，自動導向對應頁面
auth.onAuthStateChanged((user) => {
  if (user) {
    // 若為匿名使用者，跳過此處的自動導向，交由 signInAsGuest 的 .then() 處理
    if (user.isAnonymous) {
      return;
    }
    
    showLoading();
    // 檢查是否為管理員
    db.collection('info').doc('admins').get().then((doc) => {
      if (doc.exists) {
        const emails = doc.data().emails || [];
        if (emails.includes(user.email)) {
          window.location.href = '/youth/admin.html';
        } else {
          alert("您為一般使用者，將進入唯讀模式");
          window.location.href = '/youth/list.html';
        }
      } else {
        alert("您為一般使用者，將進入唯讀模式");
        window.location.href = '/youth/list.html';
      }
    }).catch((error) => {
      console.error("驗證權限時發生錯誤:", error);
      alert("權限驗證失敗，將進入唯讀模式");
      window.location.href = '/youth/list.html';
    });
  }
});
