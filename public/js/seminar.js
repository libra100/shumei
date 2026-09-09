firebase.initializeApp({
  apiKey: 'AIzaSyA8KmjgG2SWv2XVTlqMcxxa2PbljlX7ueU',
  authDomain: 'shumei-2025.firebaseapp.com',
  databaseURL: 'https://shumei-2025.firebaseio.com',
  projectId: 'shumei-2025',
});
const db = firebase.firestore();
const auth = firebase.auth();

let isAdmin = false;
let allMembers = [];
let allSeminars = [];
let currentEditId = null; // null = create mode, string = edit mode

// Enable offline persistence
db.enablePersistence().catch((err) => {
  console.warn("Firestore persistence failed:", err.code);
});

auth.onAuthStateChanged((user) => {
  if (user) {
    console.log("已登入 UID:", user.uid);
    if (user.isAnonymous) {
      isAdmin = false;
      setLinks('list.html');
      initData();
    } else {
      db.collection('info').doc('admins').get().then((doc) => {
        if (doc.exists) {
          const emails = doc.data().emails || [];
          if (emails.includes(user.email)) {
            isAdmin = true;
            setLinks('admin.html');
          } else {
            isAdmin = false;
            setLinks('list.html');
          }
        } else {
          isAdmin = false;
          setLinks('list.html');
        }
        initData();
      }).catch((error) => {
        console.error("Error verifying admin role:", error);
        isAdmin = false;
        setLinks('list.html');
        initData();
      });
    }
  } else {
    window.location.href = '/index.html';
  }
});

function signOut() {
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

function initData() {
  loadMembers();
  loadSeminars();
}

function loadMembers() {
  db.collection('member')
    .get()
    .then((querySnapshot) => {
      allMembers = [];
      const leaderSet = new Set();
      
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        const leader = d.leader || '未分組';
        leaderSet.add(leader);
        allMembers.push({
          id: doc.id,
          name: d.name || '未命名',
          leader: leader
        });
      });
      
      // Sort
      const allLeaders = Array.from(leaderSet).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
      allMembers.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
      
      // Populate leader dropdown
      const leaderSelect = document.getElementById('sem_leader');
      leaderSelect.innerHTML = '<option value="" disabled selected>請選擇組長</option><option value="all">顯示所有成員</option>';
      allLeaders.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l;
        opt.innerText = l;
        leaderSelect.appendChild(opt);
      });
      
      // Member dropdown remains empty until leader is chosen
      const memberSelect = document.getElementById('sem_member');
      memberSelect.innerHTML = '<option value="" disabled selected>請先選擇上方組長</option>';
    })
    .catch((err) => console.error("Error loading members:", err));
}

function filterMembersByLeader() {
  const selectedLeader = document.getElementById('sem_leader').value;
  const memberSelect = document.getElementById('sem_member');
  
  memberSelect.innerHTML = '<option value="" disabled selected>請選擇青年成員</option>';
  
  const filtered = selectedLeader === 'all' ? allMembers : allMembers.filter(m => m.leader === selectedLeader);
  filtered.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.innerText = m.name;
    memberSelect.appendChild(opt);
  });
}

function loadSeminars() {
  db.collection('seminars')
    .orderBy('date', 'desc')
    .get()
    .then((querySnapshot) => {
      allSeminars = [];
      querySnapshot.forEach((doc) => {
        allSeminars.push({
          id: doc.id,
          ...doc.data()
        });
      });
      renderSeminars(allSeminars);
      
      // Auto-filter if query parameter 'q' or 'search' exists in URL
      const urlParams = new URLSearchParams(window.location.search);
      const qParam = urlParams.get('q') || urlParams.get('search');
      if (qParam) {
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = qParam;
        searchSeminars(qParam);
      }
    })
    .catch((err) => {
      console.error("Error loading seminars:", err);
      // Fallback for first-time database structure where collection doesn't exist
      document.getElementById('timeline-list').innerHTML = `
        <div class="text-center py-5 text-muted stagger-item">
          <div>目前無座談會紀錄，點擊「登記座談會」開始建立第一筆資料。</div>
        </div>
      `;
    });
}

function renderSeminars(seminars) {
  const timeline = document.getElementById('timeline-list');
  timeline.innerHTML = '';
  
  if (seminars.length === 0) {
    timeline.innerHTML = `
      <div class="text-center py-5 text-muted stagger-item">
        <div>沒有找到符合條件的座談會紀錄。</div>
      </div>
    `;
    return;
  }
  
  seminars.forEach((sem, index) => {
    const item = document.createElement('div');
    item.classList.add('timeline-item', 'stagger-item');
    item.style.animationDelay = (index * 50) + 'ms';
    
    // Check if edit/delete buttons should be shown
    const editBtn = `
      <button class="btn btn-sm btn-outline-warning interactive" onclick="editSeminar('${sem.id}')" style="padding: 4px 8px; font-size: 12px; border-radius: 6px;">
        ✏️ 編輯
      </button>
    `;
    const deleteBtn = isAdmin ? `
      <button class="btn btn-sm btn-outline-danger interactive" onclick="deleteSeminar('${sem.id}')" style="padding: 4px 8px; font-size: 12px; border-radius: 6px;">
        刪除
      </button>
    ` : '';
    
    const isValidVal = (v) => v && String(v).trim() !== '' && String(v).trim() !== '未提供' && String(v).trim() !== '未指定' && String(v).trim() !== '無' && String(v).trim() !== 'null';

    const locationHtml = isValidVal(sem.location) ? `<div class="text-muted" style="font-size: 13px; margin-top: 2px;">📍 ${sem.location}</div>` : '';
    const timeStr = isValidVal(sem.time) ? ` ${sem.time}` : '';
    const dateStr = (sem.date || '未指定') + timeStr;

    const feelingsHtml = isValidVal(sem.feelings) ? `
      <div class="timeline-section-title">當下的感受</div>
      <div class="timeline-text">${sem.feelings.replace(/\n/g, '<br>')}</div>
    ` : '';

    const goalsHtml = isValidVal(sem.goals) ? `
      <div class="timeline-section-title">信仰提升的目標（內容）</div>
      <div class="timeline-text" style="background: rgba(0, 243, 255, 0.05); color: rgba(255, 255, 255, 0.85);">${sem.goals.replace(/\n/g, '<br>')}</div>
    ` : '';

    const attendeesHtml = isValidVal(sem.attendees) ? `
      <div class="timeline-section-title">參加者</div>
      <div class="timeline-text" style="background: rgba(128, 128, 128, 0.05); color: rgba(255, 255, 255, 0.7);">${sem.attendees.replace(/\n/g, '<br>')}</div>
    ` : '';

    item.innerHTML = `
      <div class="timeline-marker"></div>
      <div class="timeline-card">
        <div class="timeline-header">
          <div>
            <h4 class="timeline-title">${sem.memberName || '未指定'} ${sem.source === 'line' ? '<span class="badge bg-success" style="font-size: 10px; margin-left: 4px;">LINE</span>' : ''}</h4>
            ${locationHtml}
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="timeline-date">${dateStr}</span>
            ${editBtn}
            ${deleteBtn}
          </div>
        </div>
        <div class="timeline-body">
          ${feelingsHtml}
          ${goalsHtml}
          ${attendeesHtml}
        </div>
      </div>
    `;
    timeline.appendChild(item);
  });
}

function prepareAddSeminar() {
  currentEditId = null;
  document.getElementById('registerSeminarModalLabel').innerText = '登記座談會紀錄';
  document.getElementById('seminar-submit-btn').innerText = '確認登錄';
  document.getElementById('seminar-form').reset();
  
  // Show AI section, hide structured fields
  document.getElementById('ai-input-section').style.display = 'block';
  document.getElementById('structured-fields').style.display = 'none';
  document.getElementById('ai-raw-input').required = true;
  
  const modal = new bootstrap.Modal(document.getElementById('registerSeminarModal'));
  modal.show();
}

function submitSeminar(event) {
  event.preventDefault();
  
  const memberSelect = document.getElementById('sem_member');
  const memberId = memberSelect.value;
  const memberName = memberSelect.options[memberSelect.selectedIndex].text;
  const isEditing = currentEditId !== null;

  let date = '', time = '', location = '', feelings = '', goals = '', attendees = '', rawText = '';

  if (isEditing) {
    date = document.getElementById('sem_date').value;
    time = document.getElementById('sem_time').value;
    location = document.getElementById('sem_location').value;
    feelings = document.getElementById('sem_feelings').value;
    goals = document.getElementById('sem_goals').value;
    attendees = document.getElementById('sem_attendees').value;
    // We don't overwrite rawText when editing so it retains original if we wanted, or we just leave it undefined
  } else {
    rawText = document.getElementById('ai-raw-input').value.trim();
    if (!rawText) {
      alert("請輸入座談會紀錄內容");
      return;
    }

    // ---- AI Parsing Logic ----
    let m = rawText.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (m) { date = `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`; }
    if (!date) {
      m = rawText.match(/(?<![\d])(\d{1,2})\/(\d{1,2})(?![\d\/-])/);
      if (m) {
        const yr = new Date().getFullYear();
        date = `${yr}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
      }
    }
    if (!date) {
      m = rawText.match(/(\d{2,3})年(\d{1,2})月(\d{1,2})日/);
      if (m) {
        const yr = parseInt(m[1]) + 1911;
        date = `${yr}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
      }
    }
    if (!date) {
      m = rawText.match(/(\d{1,2})月(\d{1,2})日/);
      if (m) {
        const yr = new Date().getFullYear();
        date = `${yr}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
      }
    }

    m = rawText.match(/(上午|下午|早上|晚上|中午|凌晨)?\s*(\d{1,2}):(\d{2})/);
    if (m) {
      let h = parseInt(m[2]);
      const period = m[1] || '';
      if (period === '下午' || period === '晚上') { if (h < 12) h += 12; }
      time = `${String(h).padStart(2,'0')}:${m[3]}`;
    }
    if (!time) {
      m = rawText.match(/(上午|下午|早上|晚上|中午|凌晨)?\s*(一|二|兩|三|四|五|六|七|八|九|十|十一|十二|十三|\d{1,2})\s*點(半)?/);
      if (m) {
        const chMap = {'一':1,'二':2,'兩':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12,'十三':13};
        let h = chMap[m[2]] ?? parseInt(m[2]);
        const period = m[1] || '';
        if (period === '下午' || period === '晚上') { if (h < 12) h += 12; }
        const min = m[3] ? '30' : '00';
        time = `${String(h).padStart(2,'0')}:${min}`;
      }
    }

    m = rawText.match(/(?:地點|地址|在|@)：?\s*([^\n。,，]{2,20})/);
    if (m) location = m[1].trim();
    if (!location) {
      m = rawText.match(/([^\n]{2,15}(?:支部|道場|會場|家中|公寤|center|hall))/);
      if (m) location = m[1].trim();
    }

    m = rawText.match(/(?:感受|心得|感想|感覺)：?\s*([\s\S]+?)(?=\n(?:目標|內容|參加者|出席|座談|地點|地址)|$)/);
    if (m) feelings = m[1].trim();

    m = rawText.match(/(?:目標|今日內容|座談內容|提升|內容)：?\s*([\s\S]+?)(?=\n(?:參加者|出席|感受|心得|地點)|$)/);
    if (m) goals = m[1].trim();

    m = rawText.match(/(?:參加者|出席|人員|參與者)：?\s*([\s\S]+?)(?=\n(?:感受|目標|地點)|$)/);
    if (m) attendees = m[1].trim();
  }

  const payload = {
    memberId,
    memberName,
    date,
    time,
    location,
    feelings,
    goals,
    attendees
  };
  if (!isEditing) payload.rawText = rawText;

  const promise = isEditing
    ? db.collection('seminars').doc(currentEditId).update({ ...payload, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    : db.collection('seminars').add({ ...payload, source: 'web', createdAt: firebase.firestore.FieldValue.serverTimestamp() });

  promise.then(() => {
    alert(isEditing ? "編輯成功！" : "座談會紀錄登錄成功！");
    currentEditId = null;
    document.getElementById('seminar-submit-btn').innerText = '確認登錄';
    document.getElementById('registerSeminarModalLabel').innerText = '登記座談會紀錄';
    document.getElementById('seminar-form').reset();
    document.getElementById('ai-raw-input').value = '';
    const modalEl = document.getElementById('registerSeminarModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
    loadSeminars();
  }).catch((err) => {
    console.error("Error saving seminar:", err);
    alert("儲存失敗: " + err.message);
  });
}

function editSeminar(id) {
  const sem = allSeminars.find(s => s.id === id);
  if (!sem) return;

  currentEditId = id;

  // Update modal title & button
  document.getElementById('registerSeminarModalLabel').innerText = '編輯座談會紀錄';
  document.getElementById('seminar-submit-btn').innerText = '儲存修改';

  // Hide AI input, show structured fields
  document.getElementById('ai-input-section').style.display = 'none';
  document.getElementById('ai-raw-input').required = false;
  document.getElementById('structured-fields').style.display = 'block';

  // Pre-fill fields
  document.getElementById('sem_date').value = sem.date || '';
  document.getElementById('sem_time').value = sem.time || '';
  document.getElementById('sem_location').value = sem.location || '';
  document.getElementById('sem_feelings').value = sem.feelings || '';
  document.getElementById('sem_goals').value = sem.goals || '';
  document.getElementById('sem_attendees').value = sem.attendees || '';

  // Pre-select member — first pick the right leader then the member
  const member = allMembers.find(m => m.id === sem.memberId);
  if (member) {
    const leaderSelect = document.getElementById('sem_leader');
    leaderSelect.value = member.leader;
    filterMembersByLeader();
    document.getElementById('sem_member').value = sem.memberId;
  }

  // Open modal
  const modal = new bootstrap.Modal(document.getElementById('registerSeminarModal'));
  modal.show();
}



function deleteSeminar(id) {
  if (confirm("確認要刪除此筆座談會紀錄嗎？此動作無法復原。")) {
    db.collection('seminars')
      .doc(id)
      .delete()
      .then(() => {
        alert("已刪除紀錄。");
        loadSeminars();
      })
      .catch((err) => {
        console.error("Error deleting seminar:", err);
        alert("刪除失敗: " + err.message);
      });
  }
}

function searchSeminars(query) {
  const q = query.trim().toLowerCase();
  
  if (q.length === 0) {
    renderSeminars(allSeminars);
    return;
  }
  
  const filtered = allSeminars.filter((sem) => {
    const name = (sem.memberName || '').toLowerCase();
    const loc = (sem.location || '').toLowerCase();
    const feel = (sem.feelings || '').toLowerCase();
    const goals = (sem.goals || '').toLowerCase();
    const attendees = (sem.attendees || '').toLowerCase();
    
    return name.includes(q) || loc.includes(q) || feel.includes(q) || goals.includes(q) || attendees.includes(q);
  });
  
  renderSeminars(filtered);
}

function autoSelectMember(rawText) {
  if (!rawText || rawText.length < 2) return;
  
  // Find longest matching name to avoid partial match issues
  const sortedMembers = [...allMembers].sort((a, b) => b.name.length - a.name.length);
  
  let matchedMember = null;
  for (const m of sortedMembers) {
    // Only match names with at least 2 characters to avoid random single character matches
    if (m.name && m.name.length > 1 && rawText.includes(m.name)) {
      matchedMember = m;
      break;
    }
  }
  
  if (matchedMember) {
    const leaderSelect = document.getElementById('sem_leader');
    const memberSelect = document.getElementById('sem_member');
    
    // Auto switch leader if different
    if (leaderSelect.value !== matchedMember.leader) {
      leaderSelect.value = matchedMember.leader;
      filterMembersByLeader(); // Populates member options for this leader
    }
    
    // Set member
    memberSelect.value = matchedMember.id;
  }
}
