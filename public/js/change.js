// Initialize Firebase
    firebase.initializeApp({
      apiKey: 'AIzaSyA8KmjgG2SWv2XVTlqMcxxa2PbljlX7ueU',
      authDomain: 'shumei-2025.firebaseapp.com',
      databaseURL: 'https://shumei-2025.firebaseio.com',
      projectId: 'shumei-2025',
    });
    const auth = firebase.auth();
    const db = firebase.firestore();

    db.enablePersistence().catch((err) => {
      console.warn("Firestore offline persistence failed: ", err.code);
    });

    // State management
    let participants = [];
    let seedBags = JSON.parse(localStorage.getItem('EXCHANGE_SEED_BAGS')) || [];
    let currentParticipant = null;
    let html5QrCode = null;

    // Auth State & Link Banner
    auth.onAuthStateChanged(user => {
    const linkBanner = document.getElementById('link-google-banner');
    if (user) {
      if (user.isAnonymous && linkBanner) {
        linkBanner.classList.remove('d-none');
      } else if (linkBanner) {
        linkBanner.classList.add('d-none');
      }
      
      // Auto-route returning users to selection if they already submitted registration
      // Make sure we only do this if admin UI is not active
      if (localStorage.getItem('EXCHANGE_ADMIN') !== 'true') {
        const p = participants.find(p => p.id === user.uid);
        if (p) {
          switchTab('select');
          if (p.status === 'active' || p.status === 'completed') {
            loadActiveSession(p.id);
          } else if (p.status === 'pending') {
            document.getElementById('select-login-actions').classList.add('d-none');
            document.getElementById('select-pending-msg').classList.remove('d-none');
          }
        }
      }
    } else {
      if (linkBanner) linkBanner.classList.add('d-none');
    }
  });

    function linkGoogleAccount(btn) {
      const user = auth.currentUser;
      if (!user || !user.isAnonymous) return;
      if (btn) {
        btn.disabled = true;
        btn.innerText = '🔗 連結中...';
      }
      const provider = new firebase.auth.GoogleAuthProvider();
      user.linkWithPopup(provider).then((result) => {
        alert("✅ 成功連結 Google 帳號！您的資料已永久保存。");
        document.getElementById('link-google-banner').classList.add('d-none');
      }).catch((error) => {
        alert("連結失敗: " + error.message);
        if (btn) {
          btn.disabled = false;
          btn.innerText = '🔗 連結 Google';
        }
      });
    }

    document.addEventListener('DOMContentLoaded', () => {
      applyAdminState();
      updateSessionQuotaText();
      renderCartList();
      
      // Realtime Firestore Listener
      db.collection('exchange_participants').onSnapshot(snapshot => {
        participants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderPendingRegistrationList();
        renderPackagingList();
        renderExitParticipants();
        
        // Auto-update current participant session if modified externally
      if (currentParticipant) {
        const updated = participants.find(p => p.id === currentParticipant.id);
        if (updated) {
          currentParticipant = updated;
          updateSessionQuotaText();
          renderCartList();
        }
      } else if (auth.currentUser && localStorage.getItem('EXCHANGE_ADMIN') !== 'true') {
        // Auto-route if the snapshot loads after auth state changed
        const p = participants.find(p => p.id === auth.currentUser.uid);
        if (p) {
          if (!document.getElementById('panel-pub-entrance').classList.contains('d-none')) {
            switchTab('select');
          }
          if (p.status === 'active' || p.status === 'completed') {
            loadActiveSession(p.id);
          } else if (p.status === 'pending') {
            document.getElementById('select-login-actions').classList.add('d-none');
            document.getElementById('select-pending-msg').classList.remove('d-none');
          }
        }
      }
    });
    });

    // Tab switcher
    function switchTab(tabName) {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('d-none'));
      
      const adminBtn = document.getElementById(`btn-${tabName}`);
      if (adminBtn) adminBtn.classList.add('active');

      const pubBtn = document.getElementById(`btn-pub-${tabName}`);
      if (pubBtn) pubBtn.classList.add('active');

      document.getElementById(`panel-${tabName}`).classList.remove('d-none');
      stopQRScanner();

      if (tabName === 'staff-approval') {
        renderPendingRegistrationList();
      } else if (tabName === 'packaging') {
        renderPackagingList();
      } else if (tabName === 'exit') {
        renderExitParticipants();
      } else if (tabName === 'select') {
        renderActiveParticipantsTab3();
      }
    }

    // --- Tab 1: Self-Registration & Approval Logic ---
    function mockGoogleLogin(btn) {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm mr-2"></span> 登入中...';
      }
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider).then((result) => {
        const p = participants.find(p => p.id === result.user.uid);
        if (p) {
          // They already have a record, auto-router will handle it
          alert('✅ 歡迎回來！已找到您的報到紀錄，為您自動載入。');
        } else {
          document.getElementById('self-name').value = result.user.displayName || '陳 Google';
          alert('✅ Google 帳號授權成功！已帶入您的姓名，請繼續填寫報到表單。');
        }
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" width="20" /> 使用 Google 帳號報到';
        }
      }).catch((error) => {
        if (error.code !== 'auth/cancelled-popup-request') {
          alert("登入失敗: " + error.message);
        }
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" width="20" /> 使用 Google 帳號報到';
        }
      });
    }

    function selfRegister(event) {
      event.preventDefault();
      const name = document.getElementById('self-name').value;
      const phone = document.getElementById('self-phone').value;
      const seedName = document.getElementById('self-seed-name').value;
      const variety = document.getElementById('self-seed-variety').value;
      const weight = parseInt(document.getElementById('self-weight').value) || 0;

      const processRegistration = (user) => {
        const ticketId = user.uid;
        const newPart = {
          name, phone, seedName, variety, weight,
          quota: 0, selectedBags: [], status: 'pending',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        db.collection('exchange_participants').doc(ticketId).set(newPart).then(() => {
          document.getElementById('registration-success-modal').classList.remove('d-none');
          event.target.reset();
        });
      };

      if (!auth.currentUser) {
        auth.signInAnonymously().then((cred) => {
          processRegistration(cred.user);
        }).catch(err => alert("匿名登入失敗: " + err.message));
      } else {
        processRegistration(auth.currentUser);
      }
    }

    function closeRegistrationModalAndProceed() {
      document.getElementById('registration-success-modal').classList.add('d-none');
      switchTab('select');
      
      const user = auth.currentUser;
      if (user) {
        const p = participants.find(p => p.id === user.uid);
        if (p && p.status === 'pending') {
          document.getElementById('select-login-actions').classList.add('d-none');
          document.getElementById('select-pending-msg').classList.remove('d-none');
        }
      }
    }

    function renderPendingRegistrationList() {
      const tbody = document.getElementById('pending-registration-list');
      tbody.innerHTML = '';

      const pendingParts = participants.filter(p => p.status === 'pending');
      if (pendingParts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">目前沒有待核發的民眾報到資料</td></tr>';
        return;
      }

      pendingParts.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${p.name}</strong></td>
          <td>${p.seedName} (${p.variety})</td>
          <td>${p.weight}g</td>
          <td>
            <input type="number" id="quota-${p.id}" value="3" min="1" max="100" class="form-control bg-dark border-secondary text-white font-bold" style="width: 85px;" />
          </td>
          <td>
            <button onclick="approveParticipantRegistration('${p.id}')" class="btn btn-success btn-xs py-1.5 px-3 rounded-lg font-bold text-[11px] interactive">
              ✅ 核准
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    function approveParticipantRegistration(partId) {
      const part = participants.find(p => p.id === partId);
      if (!part) return;

      const quota = parseInt(document.getElementById(`quota-${partId}`).value) || 1;

      // Update state
      db.collection('exchange_participants').doc(partId).update({
        quota: quota,
        status: 'active'
      }).then(() => {
        alert(`🎉 成功核發！已給予 ${part.name} 兌換額度 ${quota} 包，民眾可直接前往選種。`);
      });
    }

    // --- Tab 2: Packaging & Labeling Logic ---
    function renderPackagingList() {
      const tbody = document.getElementById('packaging-list');
      tbody.innerHTML = '';

      // Only show participants that are active
      const activeParts = participants.filter(p => p.status === 'active');
      if (activeParts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">目前沒有等待分裝的登記資料</td></tr>';
        return;
      }

      activeParts.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${p.name}</strong></td>
          <td>${p.seedName}</td>
          <td>${p.weight}g</td>
          <td>${p.quota} 包</td>
          <td>
            <input type="number" id="pack-count-${p.id}" value="${p.quota}" min="1" max="100" class="form-control bg-dark border-secondary text-white font-bold" style="width: 80px;" />
          </td>
          <td>
            <button onclick="generateSeedBagLabels('${p.id}')" class="btn btn-outline-info btn-xs py-1.5 px-3 rounded-lg font-bold text-[11px] interactive">
              ⚙️ 生成分裝 QR 碼
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    function generateSeedBagLabels(partId) {
      const part = participants.find(p => p.id === partId);
      if (!part) return;

      const printArea = document.getElementById('labels-print-area');
      printArea.innerHTML = '';

      const packCount = parseInt(document.getElementById(`pack-count-${partId}`).value) || part.bagsBrought || part.quota;

      // Generate seed bags based on custom package count
      for (let i = 1; i <= packCount; i++) {
        const bagId = `BAG-${partId.substring(4)}-B${i}`;
        
        // Add to seedBags list if not exist
        if (!seedBags.some(b => b.id === bagId)) {
          seedBags.push({
            id: bagId,
            name: part.seedName,
            variety: part.variety,
            ownerId: partId
          });
        }

        // Render printable label UI
        const col = document.createElement('div');
        col.className = 'col-6 col-md-4';
        col.innerHTML = `
          <div class="bg-white p-3 rounded-xl border border-secondary text-slate-800 text-center" style="font-family: monospace;">
            <span class="text-[9px] font-bold text-emerald-600 block">🌱 秀明自然農法交換包</span>
            <strong class="text-xs block mt-1 leading-tight">${part.seedName}</strong>
            <span class="text-[10px] text-slate-500 block">品種: ${part.variety}</span>
            <div class="my-2 flex justify-center">
              <div id="qr-${bagId}" class="qr-container"></div>
            </div>
            <span class="text-[8px] text-red-600 font-bold block">${bagId}</span>
          </div>
        `;
        printArea.appendChild(col);

        // Generate QR code inside
        new QRCode(document.getElementById(`qr-${bagId}`), {
          text: bagId,
          width: 80,
          height: 80
        });
      }

      localStorage.setItem('EXCHANGE_SEED_BAGS', JSON.stringify(seedBags));
      document.getElementById('labels-modal').classList.remove('d-none');
    }

    // --- Tab 3: Participant Cart & Scanner Logic ---
    function mockGoogleLoginTab3(btn) {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm mr-2"></span> 登入中...';
      }
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider).then((result) => {
        const p = participants.find(p => p.id === result.user.uid && p.status === 'active');
        if (p) {
          loadActiveSession(p.id);
        } else {
          alert('找不到您的有效報到紀錄，請確認是否已經通過審核！');
        }
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" width="20" /> 使用 Google 帳號登入載入額度';
        }
      }).catch((error) => {
        if (error.code !== 'auth/cancelled-popup-request') {
          alert("登入失敗: " + error.message);
        }
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" width="20" /> 使用 Google 帳號登入載入額度';
        }
      });
    }

    // renderActiveParticipantsTab3 has been removed
    function loadActiveSession(partId) {
      const part = participants.find(p => p.id === partId);
      if (!part) return;

      currentParticipant = part;
      document.getElementById('session-username').innerText = `👋 您好，${part.name}`;
      updateSessionQuotaText();
      renderCartList();

      document.getElementById('select-step-login').classList.add('d-none');
      document.getElementById('select-active-session').classList.remove('d-none');

      const scanBtn = document.getElementById('btn-scan-bag');
      if (part.status === 'completed') {
        if (scanBtn) scanBtn.classList.add('d-none');
      } else {
        if (scanBtn) scanBtn.classList.remove('d-none');
      }
    }

    function exitSession() {
      currentParticipant = null;
      document.getElementById('select-active-session').classList.add('d-none');
      document.getElementById('select-step-login').classList.remove('d-none');
      document.getElementById('exit-verify-container').classList.add('d-none');
      stopQRScanner();
    }

    function updateSessionQuotaText() {
      if (!currentParticipant) return;
      const count = currentParticipant.selectedBags.length;
      const quota = currentParticipant.quota;
      const label = document.getElementById('session-quota');
      
      label.innerHTML = `已挑選：<strong class="text-white text-base">${count}</strong> / ${quota} 包`;
      
      if (count > quota) {
        label.innerHTML += ` <span class="text-rose-500 font-bold">(已超出額度！)</span>`;
      }
    }

    function renderCartList() {
      const container = document.getElementById('cart-list');
      container.innerHTML = '';

      if (!currentParticipant || currentParticipant.selectedBags.length === 0) {
        container.innerHTML = '<div class="text-center text-muted text-xs py-3 bg-dark/20 rounded-xl border border-dashed border-secondary/20">購物車為空，快去掃描二維碼挑選種子包吧！</div>';
        return;
      }

      currentParticipant.selectedBags.forEach((bagId, idx) => {
        const bag = seedBags.find(b => b.id === bagId);
        const name = bag ? bag.name : '未知種子包';
        const variety = bag ? bag.variety : '未知';

        const item = document.createElement('div');
        item.className = 'bg-dark/60 p-3 rounded-xl border border-secondary/20 flex items-center justify-between text-xs';
        const removeAction = currentParticipant.status === 'completed'
          ? '<span class="text-emerald-400 font-bold text-[10px]">✅ 已核准出關</span>'
          : `<button onclick="removeFromCart(${idx})" class="btn btn-outline-danger btn-xs py-1 px-2.5 rounded-lg text-[10px]">移除</button>`;

        item.innerHTML = `
          <div>
            <strong class="text-white">${name}</strong>
            <span class="text-muted block mt-0.5">品種: ${variety} | ${bagId}</span>
          </div>
          ${removeAction}
        `;
        container.appendChild(item);
      });
    }

    function removeFromCart(idx) {
      if (!currentParticipant || currentParticipant.status === 'completed') return;
      currentParticipant.selectedBags.splice(idx, 1);
      
      db.collection('exchange_participants').doc(currentParticipant.id).update({
        selectedBags: currentParticipant.selectedBags
      });

      updateSessionQuotaText();
      renderCartList();
    }

    // --- Admin Authentication Logic ---
    function promptLogin() {
      const pwd = prompt("請輸入工作人員密碼 (預設: 1234)");
      if (pwd === "1234") {
        localStorage.setItem('EXCHANGE_ADMIN', 'true');
        applyAdminState();
        alert("登入成功！切換至後台模式。");
      } else if (pwd !== null) {
        alert("密碼錯誤！");
      }
    }

    function logout() {
      localStorage.removeItem('EXCHANGE_ADMIN');
      applyAdminState();
      alert("已登出，返回民眾介面。");
    }

    function applyAdminState() {
      const isAdmin = localStorage.getItem('EXCHANGE_ADMIN') === 'true';
      if (isAdmin) {
        document.getElementById('btn-login').classList.add('d-none');
        document.getElementById('admin-badge').classList.remove('d-none');
        document.getElementById('admin-nav').classList.remove('d-none');
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('d-none'));
        
        switchTab('staff-approval');
      } else {
        document.getElementById('btn-login').classList.remove('d-none');
        document.getElementById('admin-badge').classList.add('d-none');
        document.getElementById('admin-nav').classList.add('d-none');
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('d-none'));
        
        switchTab('pub-entrance');
      }
    }

    function renderExitParticipants() {
      const container = document.getElementById('exit-participants-list');
      container.innerHTML = '';
      
      const activeParts = participants.filter(p => p.status === 'active');
      if (activeParts.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted py-4">目前沒有正在選種的民眾</div>';
        return;
      }
      
      activeParts.forEach(p => {
        const col = document.createElement('div');
        col.className = 'col-6 col-md-4';
        const count = p.selectedBags.length;
        const isOver = count > p.quota;
        const badgeClass = isOver ? 'bg-danger text-white' : 'bg-info text-dark';
        col.innerHTML = `
          <button onclick="loadExitCheckout('${p.id}')" class="w-full text-start p-3 bg-dark/60 border border-secondary/20 hover:border-cyan rounded-xl interactive flex flex-col justify-between" style="min-height: 80px; width: 100%;">
            <strong class="text-white text-sm">${p.name}</strong>
            <div class="d-flex justify-content-between align-items-center w-100 mt-2 text-[10px]">
              <span class="text-slate-400">額度: ${p.quota}包</span>
              <span class="badge ${badgeClass}">${count}包</span>
            </div>
          </button>
        `;
        container.appendChild(col);
      });
    }

    // --- Tab 4: Exit Checkout Logic ---
    function loadExitCheckout(partId) {
      const part = participants.find(p => p.id === partId);
      if (!part) {
        alert('無效的出口核對憑證！');
        return;
      }

      document.getElementById('exit-user-name').innerText = `民眾姓名：${part.name}`;
      document.getElementById('exit-ticket-id').innerText = `入場券編號: ${part.id}`;
      document.getElementById('exit-user-quota').innerText = `${part.quota} 包`;
      document.getElementById('exit-actual-count').innerText = `${part.selectedBags.length} 包`;

      const listContainer = document.getElementById('exit-cart-details');
      listContainer.innerHTML = '';

      part.selectedBags.forEach(bagId => {
        const bag = seedBags.find(b => b.id === bagId);
        const name = bag ? bag.name : '未知種子包';
        const variety = bag ? bag.variety : '未知';

        const row = document.createElement('div');
        row.className = 'flex justify-between items-center py-1.5 border-b border-secondary/10 text-xs';
        row.innerHTML = `
          <span>🌱 ${name} (${variety})</span>
          <span class="font-mono text-slate-400">${bagId}</span>
        `;
        listContainer.appendChild(row);
      });

      const badge = document.getElementById('exit-status-badge');
      if (part.selectedBags.length > part.quota) {
        badge.innerText = '⚠️ 超額警報';
        badge.className = 'badge-pill bg-rose-500/20 text-rose-400';
      } else {
        badge.innerText = '核對無誤';
        badge.className = 'badge-pill bg-emerald-500/20 text-emerald-400';
      }

      document.getElementById('exit-check-details').classList.remove('d-none');
    }

    function approveExitCheckout() {
      // Get the current checked participant id
      const txt = document.getElementById('exit-ticket-id').innerText;
      const partId = txt.split(': ')[1];
      const partIdx = participants.findIndex(p => p.id === partId);
      
      if (partIdx !== -1) {
        db.collection('exchange_participants').doc(partId).update({
          status: 'completed'
        });
        alert('🎉 核對通過！已扣除額度，准予放行出關。');
        document.getElementById('exit-check-details').classList.add('d-none');
        renderExitParticipants();
      }
    }

    // --- HTML5 QR Code Optical Camera Scanner Controller ---
    function startQRScanner(mode) {
      document.getElementById('scanner-container').classList.remove('d-none');
      
      if (html5QrCode) {
        html5QrCode.stop().then(() => startScanning(mode));
      } else {
        startScanning(mode);
      }
    }

    function startScanning(mode) {
      html5QrCode = new Html5Qrcode("reader");
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          stopQRScanner();
          handleScannedData(mode, decodedText);
        },
        (errorMessage) => {
          // suppress scanner noise
        }
      ).catch(err => {
        alert("無法啟用相機光學掃描：請確認是否給予相機權限！");
        document.getElementById('scanner-container').classList.add('d-none');
      });
    }

    function stopQRScanner() {
      if (html5QrCode) {
        html5QrCode.stop().then(() => {
          html5QrCode = null;
          document.getElementById('scanner-container').classList.add('d-none');
        }).catch(() => {});
      }
    }

    function handleScannedData(mode, data) {
      if (mode === 'bag') {
        if (!currentParticipant) return;
        if (currentParticipant.status === 'completed') {
          alert('您的購物車已經由工作人員核對出關，無法再新增或修改種子包！');
          return;
        }
        
        // Scan seed bag code BAG-xxx
        if (!data.startsWith('BAG-')) {
          alert('請掃描正確的種子分裝二維碼！');
          return;
        }

        if (currentParticipant.selectedBags.includes(data)) {
          alert('此種子包已經掃描過，不可重複選取！');
          return;
        }

        currentParticipant.selectedBags.push(data);
        
        // Update DB
        db.collection('exchange_participants').doc(currentParticipant.id).update({
          selectedBags: currentParticipant.selectedBags
        });

        updateSessionQuotaText();
        renderCartList();
        alert('🛒 成功加入購物車！');
      } else if (mode === 'exit') {
        loadExitCheckout(data);
      }
    }