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

auth.onAuthStateChanged((user) => {
  if (user) {
    console.log("已登入 UID:", user.uid);
    
    // Check user role to set links
    if (user.isAnonymous) {
      setLinks('list.html');
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

function initData() {
  db.collection('info')
    .doc('youth')
    .get()
    .then((doc) => {
      leader = doc.data().leader;

      const list_lead = document.getElementById('body');
      list_lead.innerHTML = '';
      
      var content = leader.map((opt) => {
        // Clean ID for Bootstrap Collapse selector (remove spaces)
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
            // Count active activities
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
  
  db.collection('member')
    .doc(memberId)
    .get()
    .then((doc) => {
      if (!doc.exists) return;
      const d = doc.data();
      document.getElementById('logModalLabel').innerText = d.name;
      
      // Default reset all radio buttons
      resetRadioButtons();
      
      // Load saved activities
      if (d.activities && d.activities[currentKey]) {
        const acts = d.activities[currentKey];
        setRadioVal('act_a', acts.a);
        setRadioVal('act_b', acts.b);
        setRadioVal('act_c', acts.c);
        setRadioVal('act_d', acts.d);
        setRadioVal('act_e', acts.e);
        setRadioVal('act_f', acts.f);
      }
      
      // Configure save button click handler
      const btnUp = document.getElementById('btn_up');
      btnUp.setAttribute('onclick', `saveActivities('${memberId}')`);
    });
}

function resetRadioButtons() {
  setRadioVal('act_a', false);
  setRadioVal('act_b', false);
  setRadioVal('act_c', false);
  setRadioVal('act_d', false);
  setRadioVal('act_e', false);
  setRadioVal('act_f', false);
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
  
  const acts = {
    a: getRadioVal('act_a'),
    b: getRadioVal('act_b'),
    c: getRadioVal('act_c'),
    d: getRadioVal('act_d'),
    e: getRadioVal('act_e'),
    f: getRadioVal('act_f')
  };
  
  const updateData = {};
  updateData[`activities.${currentKey}`] = acts;
  
  db.collection('member')
    .doc(memberId)
    .update(updateData)
    .then(() => {
      alert("活動紀錄更新成功");
      // Reload UI
      initData();
    })
    .catch((err) => {
      console.error("Error saving activities:", err);
      alert("儲存失敗: " + err.message);
    });
}
