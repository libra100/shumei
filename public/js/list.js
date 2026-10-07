firebase.initializeApp({
  apiKey: 'AIzaSyA8KmjgG2SWv2XVTlqMcxxa2PbljlX7ueU',
  authDomain: 'shumei-2025.firebaseapp.com',
  databaseURL: 'https://shumei-2025.firebaseio.com',
  projectId: 'shumei-2025',
});
const db = firebase.firestore();
const auth = firebase.auth();
let day = new Date();

var leader, write, pass, data;
const table = document.getElementById('body');

auth.onAuthStateChanged((user) => {
  if (user) {
    console.log("已登入 UID:", user.uid);
    initData();
  } else {
    window.location.href = '/index.html';
  }
});

function signOut() {
  auth.signOut().then(() => {
    window.location.href = '/index.html';
  });
}

function initData() {
  db.collection('member')
    .get()
    .then((querySnapshot) => {
      data = querySnapshot;
    });

  db.collection('info')
    .doc('set')
    .get()
    .then((doc) => {
      pass = doc.data().pass;
      const user = auth.currentUser;
      if (user && user.email) {
        const userRef = db.collection('allowed_users').doc(user.email);
        userRef.get().then((uDoc) => {
          if (uDoc.exists && uDoc.data().linkedMemberId) {
            const btn = document.getElementById('btnClaimIdentity');
            if (btn) {
              btn.innerText = `✅ 已綁定身份：${uDoc.data().linkedName}`;
              btn.classList.remove('btn-outline-light');
              btn.classList.add('btn-success');
              btn.onclick = null;
            }
          }

          if (uDoc.exists && uDoc.data().allowDirectLogin === true) {
            able();
          } else {
            userRef.set({ 
              allowDirectLogin: uDoc.exists ? uDoc.data().allowDirectLogin : false, 
              email: user.email, 
              name: user.displayName || '', 
              lastLogin: firebase.firestore.FieldValue.serverTimestamp() 
            }, { merge: true }).catch(err => console.warn("Failed to update allowed_users (probably not admin):", err));
            login();
          }
        }).catch(err => {
          console.error("Failed to read allowed_users:", err);
          login();
        });
      } else {
        login();
      }
    });
}

function login() {
  document.getElementById('queryPasswordModal').style.display = 'flex';
}

function submitQueryPassword() {
  const entered = document.getElementById('queryPasswordInput').value;
  if (entered === String(pass)) {
    document.getElementById('queryPasswordModal').style.display = 'none';
    able();
  } else {
    alert('密碼錯誤，請重新輸入');
    document.getElementById('queryPasswordInput').value = '';
  }
}

function able() {
  getDate('青年部');
  remove();
  db.collection('info').doc('set').update({
    login: true,
  }).catch(err => console.warn("Failed to update global login status (probably not admin):", err));
}

function get_lead(ele) {
  db.collection('info')
    .doc('youth')
    .get()
    .then((doc) => {
      leader = doc.data().leader;
      leader.map((opt) => {
        var child = document.createElement('option');
        child.innerText = opt;
        ele.appendChild(child);
      });
    })
    .catch((err) => {
      console.log('Error getting document:', err);
    });
}

function get_part(ele) {
  db.collection('info')
    .doc('org')
    .get()
    .then((doc) => {
      part = doc.data().part;
      part.map((opt) => {
        var child = document.createElement('option');
        child.innerText = opt;
        ele.appendChild(child);
      });
    })
    .catch((err) => {
      console.log('Error getting document:', err);
    });
}

function excel() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('group');
  var tableData = [],
    leaders = [],
    max = 20;

  leader.forEach((lead) => {
    var list = [];
    leaders.push({ name: lead });
    data.forEach((doc) => {
      let d = doc.data();
      if (d.leader == lead && d.connect && (d.part == '青年部' || d.part == '大學生')) {
        let cellValue = d.name;
        if (d.part == '大學生') {
          cellValue = '__col__' + cellValue;
        }
        list.push(cellValue);
      }
    });
    tableData.push(list);
  });

  var fin = [];
  var newLeaders = [];
  tableData.forEach((group, index) => {
    let leaderName = leaders[index].name;
    if (group.length > max) {
      for (let j = 0; j < group.length; j += max) {
        fin.push(group.slice(j, j + max));
        if (j === 0) {
          newLeaders.push({ name: leaderName });
        } else {
          newLeaders.push({ name: ' ' });
        }
      }
    } else if (group.length > 0) {
      fin.push(group);
      newLeaders.push({ name: leaderName });
    } else {
      fin.push([]);
      newLeaders.push({ name: leaderName });
    }
  });
  leaders = newLeaders;
  fin = transpose(fin);

  sheet.addRow(leaders.map((l) => l.name));
  fin.forEach((row) => {
    sheet.addRow(row);
  });

  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      let isCollege = false;
      if (typeof cell.value === 'string' && cell.value.startsWith('__col__')) {
        cell.value = cell.value.substring(7);
        isCollege = true;
      }
      cell.font = { 
        name: '宋體-繁',
        size: 14, 
        bold: (rowNumber === 1),
        underline: isCollege 
      };
    });
  });

  sheet.properties.defaultColWidth = 15;
  sheet.pageSetup.paperSize = 9; // A4
  sheet.pageSetup.orientation = 'landscape';
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 0;
  sheet.pageSetup.margins = {
    left: 0.25, right: 0.25,
    top: 0.5, bottom: 0.5,
    header: 0.3, footer: 0.3
  };

  workbook.xlsx.writeBuffer().then((content) => {
    const link = document.createElement('a');
    const blobData = new Blob([content], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    link.download = '青年部秀勉名單.xlsx';
    link.href = URL.createObjectURL(blobData);
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

function transpose(cols) {
  const maxLen = Math.max(...cols.map((arr) => arr.length));
  const rows = [];
  for (let i = 0; i < maxLen; i++) {
    rows.push(cols.map((col) => col[i] || ''));
  }
  return rows;
}

// GanttCraft Schedule Fetching (上秀勉、換神光袋)
let ganttScheduleMap = {};
let ganttSchedulePromise = null;

function fetchGanttSchedule() {
  if (ganttSchedulePromise) return ganttSchedulePromise;
  ganttSchedulePromise = fetch("https://firestore.googleapis.com/v1/projects/gantt-craft-2026/databases/(default)/documents/ganttcraft_projects/shumei")
    .then(res => {
      if (!res.ok) throw new Error("GanttCraft network response was not ok");
      return res.json();
    })
    .then(json => {
      const rawAssignments = json.fields?.shumeiAssignments?.arrayValue?.values || [];
      const now = new Date();
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      ganttScheduleMap = {};
      rawAssignments.forEach(item => {
        const fields = item.mapValue?.fields;
        if (!fields) return;
        const staffId = fields.staffId?.stringValue || '';
        const tagId = fields.tagId?.stringValue || '';
        const date = fields.date?.stringValue || '';
        
        if (date.startsWith(currentYearMonth) && staffId) {
          if (!ganttScheduleMap[staffId]) {
            ganttScheduleMap[staffId] = { study: false, studyDate: '', bag: false, bagDate: '' };
          }
          if (tagId === 'tag_study' || tagId === '上秀勉') {
            ganttScheduleMap[staffId].study = true;
            ganttScheduleMap[staffId].studyDate = date;
          }
          if (tagId === 'tag_bag' || tagId === '換神光袋') {
            ganttScheduleMap[staffId].bag = true;
            ganttScheduleMap[staffId].bagDate = date;
          }
        }
      });
      return ganttScheduleMap;
    })
    .catch(err => {
      console.warn("Could not load GanttCraft schedule:", err);
      return {};
    });
  return ganttSchedulePromise;
}

// Call eagerly
fetchGanttSchedule();

async function getDate(s) {
  var list_lead = document.getElementById('leader');
  list_lead.innerHTML = '<option></option><option>大學生</option><option>青年部</option><option>男子部</option>';
  get_lead(list_lead);

  table.innerHTML = '';
  const cardList = document.getElementById('card-list');
  if (cardList) cardList.innerHTML = '';

  await fetchGanttSchedule();

  if (s.length == 3) {
    if (s == '青年部') {
      db.collection('member')
        .where('part', 'in', ['青年部', '大學生'])
        .get()
        .then((querySnapshot) => {
          querySnapshot.forEach((doc) => {
            list(doc);
            document.getElementById('leader').value = s;
          });
        })
        .catch((err) => console.log('Error getting documents: ', err));
    } else {
      db.collection('member')
        .where('part', '==', s)
        .get()
        .then((querySnapshot) => {
          querySnapshot.forEach((doc) => {
            list(doc);
            document.getElementById('leader').value = s;
          });
        })
        .catch((err) => console.log('Error getting documents: ', err));
    }
  } else if (s.length == 2) {
    db.collection('member')
      .where('leader', '==', s)
      .get()
      .then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
          list(doc);
          document.getElementById('leader').value = s;
        });
      })
      .catch((err) => console.log('Error getting documents: ', err));
  } else {
    db.collection('member')
      .get()
      .then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
          list(doc);
        });
      })
      .catch((err) => console.log('Error getting documents: ', err));
  }
}

function list(doc) {
  const d = doc.data();
  var connt = d.connect ? '可' : '否';
  const bornStr = d.born || '';
  let yearsold = bornStr.length >= 4 ? day.getFullYear() - Number.parseInt(bornStr.slice(0, 4)) : 0;
  const guide0 = (d.guide && d.guide.length > 0) ? d.guide[0] : '';
  const guide1 = (d.guide && d.guide.length > 1) ? d.guide[1] : '';

  // Get GanttCraft schedule status for this member
  const sched = ganttScheduleMap[doc.id] || 
                ganttScheduleMap[doc.id.split('A')[0]] || 
                ganttScheduleMap[d.name] || 
                { study: false, bag: false, studyDate: '', bagDate: '' };

  const studyPill = sched.study
    ? `<span class="schedule-pill study-active" title="本月已排程上秀勉 (${sched.studyDate})">✓ 秀勉</span>`
    : `<span class="schedule-pill study-inactive" title="本月尚未排程上秀勉">— 秀勉</span>`;

  const bagPill = sched.bag
    ? `<span class="schedule-pill bag-active" title="本月已排程換神光袋 (${sched.bagDate})">✓ 神光袋</span>`
    : `<span class="schedule-pill bag-inactive" title="本月尚未排程換神光袋">— 神光袋</span>`;

  // 1. Table Row (Desktop)
  var tr = document.createElement('tr');
  tr.classList.add('stagger-item');
  // Cap animation delay so it doesn't take 30+ seconds for large lists
  const delay = Math.min(table.children.length * 50, 1000);
  tr.style.animationDelay = delay + 'ms';

  const rowHtml = `
    <th><span class="glow-badge" style="background: rgba(255,255,255,0.1); border:none;">${doc.id.split('A')[0]}</span></th>
    <td style="font-weight: 600; color: var(--primary-color); white-space: nowrap;">
      ${d.name || ''}
      <span class="d-inline-flex gap-1 ms-1 align-middle">
        ${studyPill}
        ${bagPill}
      </span>
    </td>
    <td style="white-space: nowrap;">${guide0}</td>
    <td style="white-space: nowrap;">${guide1}</td>
    <td style="white-space: nowrap;">${d.sewajin || ''}</td>
    <td onclick="openGoogleMaps('${d.adress || ''}')" style="cursor: pointer; color: #00F3FF; text-decoration: underline;">
      ${d.adress || ''}
    </td>
    <td>${d.tel || ''}</td>
    <td>${d.phone || ''}</td>
    <td style="color: ${yearsold > 35 ? '#FFA100' : (yearsold < 18 ? '#00F3FF' : 'inherit')};">
      <span class="age-tooltip-container" data-age="${yearsold}歲">${bornStr}</span>
    </td>
    <td><span class="glow-badge" style="background: rgba(255,255,255,0.1);">${d.leader || ''}</span></td>
    <td>${d.note || ''}</td>
    <td><span class="glow-badge ${d.connect ? 'primary' : ''}">${connt}</span></td>
  `;
  tr.innerHTML = rowHtml;
  table.appendChild(tr);

  // 2. Card View (Mobile Compact Collapsible)
  const cardList = document.getElementById('card-list');
  if (cardList) {
    var card = document.createElement('div');
    card.id = 'card-' + doc.id;
    card.classList.add('member-card-compact', 'stagger-item');
    const cardDelay = Math.min(cardList.children.length * 20, 500);
    card.style.animationDelay = cardDelay + 'ms';
    card.setAttribute('onclick', `toggleCard('${doc.id}')`);

    const phoneNum = d.phone || d.tel || '';
    const phoneBtn = phoneNum ? `
      <a href="tel:${phoneNum}" class="quick-icon-btn phone-btn" title="撥打電話：${phoneNum}">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.24.2 2.45.57 3.57a1 1 0 01-.25 1.02l-2.2 2.2z"/></svg>
      </a>
    ` : '';
    const mapBtn = d.adress ? `
      <button type="button" class="quick-icon-btn map-btn" onclick="openGoogleMaps('${d.adress || ''}')" title="導航至：${d.adress}">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>
      </button>
    ` : '';
    const chevronBtn = `
      <button type="button" class="quick-icon-btn chevron-btn" onclick="toggleCard('${doc.id}')" title="展開/收合詳情">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
      </button>
    `;

    const cardHtml = `
      <div class="member-card-compact-header">
        <div class="d-flex flex-column gap-1 flex-grow-1 overflow-hidden">
          <div class="d-flex align-items-center gap-2 overflow-hidden">
            <span class="member-compact-name">${d.name || ''}</span>
            <span class="glow-badge py-0 px-2" style="font-size: 10px; border:none; background: rgba(255,255,255,0.08);">${d.leader || '未分組'}</span>
            <span class="badge-dot ${d.connect ? 'connected' : 'disconnected'}" title="${connt}接觸"></span>
          </div>
          <div class="d-flex align-items-center gap-1">
            ${studyPill}
            ${bagPill}
          </div>
        </div>
        <div class="d-flex align-items-center gap-1 flex-shrink-0" onclick="event.stopPropagation()">
          ${phoneBtn}
          ${mapBtn}
          ${chevronBtn}
        </div>
      </div>
      <div class="member-card-expandable-body" id="body-${doc.id}" style="display: none;" onclick="event.stopPropagation()">
        <div class="member-details pt-2 mt-2" style="border-top: 1px solid var(--glass-border);">
          <div class="row g-2" style="font-size: 12px;">
            <div class="col-6"><span class="text-muted">入信：</span>${doc.id.split('A')[0]}</div>
            <div class="col-6"><span class="text-muted">年齡：</span><span style="color: ${yearsold > 35 ? '#FFA100' : (yearsold < 18 ? '#00F3FF' : 'inherit')}">${yearsold}歲 (${bornStr || '無'})</span></div>
            <div class="col-6"><span class="text-muted">介紹人：</span>${[guide0, guide1].filter(Boolean).join(', ') || '無'}</div>
            <div class="col-6"><span class="text-muted">世話人：</span>${d.sewajin || '無'}</div>
            <div class="col-12"><span class="text-muted">電話：</span>${d.phone ? `${d.phone} (手機)` : ''} ${d.tel ? `${d.tel} (市話)` : ''}</div>
            <div class="col-12" onclick="openGoogleMaps('${d.adress || ''}')" style="cursor: pointer; color: #00F3FF; word-break: break-all;">
              <span class="text-muted">地址：</span><u>${d.adress || '無'}</u>
            </div>
            <div class="col-12 mt-1 pt-1" style="border-top: 1px dashed rgba(255,255,255,0.08);">
              <span class="text-muted">本月秀勉排程：</span>
              <span class="${sched.study ? 'text-success fw-bold' : 'text-muted'}">${sched.study ? '✓ 已安排 (' + sched.studyDate + ')' : '未安排'}</span>
              <span class="text-muted mx-2">|</span>
              <span class="text-muted">換神光袋：</span>
              <span class="${sched.bag ? 'text-warning fw-bold' : 'text-muted'}">${sched.bag ? '✓ 已安排 (' + sched.bagDate + ')' : '未安排'}</span>
            </div>
            ${d.note ? `<div class="col-12"><div class="p-2 rounded mt-1" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); font-size: 12px;"><span class="text-muted">備註：</span>${d.note}</div></div>` : ''}
          </div>
        </div>
      </div>
    `;
    card.innerHTML = cardHtml;
    cardList.appendChild(card);
  }
}

function remove() {
  db.collection('info')
    .doc('set')
    .get()
    .then((doc) => {
      var body = document.getElementsByClassName('write');
      write = doc.data().write;
      Array.from(body).forEach((item) => {
        if (write) item.classList.remove('d-none');
        else item.classList.add('d-none');
      });
    });
}

function searchAll(query) {
  const q = query.trim().toLowerCase();
  table.innerHTML = '';
  const cardList = document.getElementById('card-list');
  if (cardList) cardList.innerHTML = '';

  if (q.length === 0) {
    getDate(document.getElementById('leader').value || '青年部');
    return;
  }

  data.forEach((doc) => {
    const d = doc.data();
    const name = (d.name || '').toLowerCase();
    const tel = (d.tel || '').toLowerCase();
    const phone = (d.phone || '').toLowerCase();
    const adress = (d.adress || '').toLowerCase();
    const sewajin = (d.sewajin || '').toLowerCase();
    const note = (d.note || '').toLowerCase();
    const guide1 = (d.guide && d.guide[0] || '').toLowerCase();
    const guide2 = (d.guide && d.guide[1] || '').toLowerCase();

    if (
      name.includes(q) ||
      tel.includes(q) ||
      phone.includes(q) ||
      adress.includes(q) ||
      sewajin.includes(q) ||
      note.includes(q) ||
      guide1.includes(q) ||
      guide2.includes(q)
    ) {
      list(doc);
    }
  });
}

function openGoogleMaps(address) {
  if (!address || address === '無') return;
  const url = `https://www.google.com/maps/dir//${encodeURIComponent(address)}`;
  window.open(url);
}

let claimModalInstance = null;

function openClaimIdentityModal() {
  if (!data) {
    alert("資料尚未載入完成，請稍候再試。");
    return;
  }
  
  const select = document.getElementById('claimNameSelect');
  select.innerHTML = '<option value="" disabled selected>請選擇您的名字</option>';
  
  const names = [];
  data.forEach(doc => {
    names.push(doc.data().name);
  });
  names.sort().forEach(name => {
    if (name) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.innerText = name;
      select.appendChild(opt);
    }
  });

  const modalEl = document.getElementById('claimIdentityModal');
  claimModalInstance = new bootstrap.Modal(modalEl);
  claimModalInstance.show();
}

function submitClaimIdentity() {
  const selectedName = document.getElementById('claimNameSelect').value;
  const inputBirth = document.getElementById('claimBirthDate').value;
  const inputJoin = document.getElementById('claimJoinDate').value;

  if (!selectedName || !inputBirth || !inputJoin) {
    alert("請完整填寫所有欄位！");
    return;
  }

  let matchedDoc = null;
  data.forEach(doc => {
    if (doc.data().name === selectedName) {
      matchedDoc = doc;
    }
  });

  if (!matchedDoc) {
    alert("找不到該姓名！");
    return;
  }

  const d = matchedDoc.data();
  
  // Normalize date string (e.g. 1990/1/1 or 1990-1-1 to 1990-01-01)
  const normalizeDateStr = (dStr) => {
    if (!dStr) return '';
    const m = dStr.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (m) {
      return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    }
    return dStr.trim();
  };

  const dbBorn = normalizeDateStr(d.born);
  const dbJoin = normalizeDateStr(d.join);
  const inBorn = normalizeDateStr(inputBirth);
  const inJoin = normalizeDateStr(inputJoin);

  if (dbBorn !== inBorn || dbJoin !== inJoin) {
    alert("出生日期或入信日期錯誤，認領失敗！\n(資料庫紀錄與您輸入的不相符)");
    return;
  }

  const user = auth.currentUser;
  if (!user || !user.email) return;

  const userRef = db.collection('allowed_users').doc(user.email);
  userRef.set({
    linkedMemberId: matchedDoc.id,
    linkedName: d.name
  }, { merge: true }).then(() => {
    alert("✅ 身份綁定成功！");
    if (claimModalInstance) claimModalInstance.hide();
    
    const btn = document.getElementById('btnClaimIdentity');
    if (btn) {
      btn.innerText = `✅ 已綁定身份：${d.name}`;
      btn.classList.remove('btn-outline-light');
      btn.classList.add('btn-success');
      btn.onclick = null;
    }
  }).catch(err => {
    console.error(err);
    alert("綁定失敗，權限不足。請確認已更新 Firestore 安全規則！");
  });
}

function toggleCard(id) {
  const body = document.getElementById('body-' + id);
  const card = document.getElementById('card-' + id);
  if (!body || !card) return;
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? 'block' : 'none';
  card.classList.toggle('is-expanded', isHidden);
}

let allCardsExpanded = false;
function toggleAllCards() {
  allCardsExpanded = !allCardsExpanded;
  const bodies = document.querySelectorAll('.member-card-expandable-body');
  const cards = document.querySelectorAll('.member-card-compact');
  bodies.forEach(b => b.style.display = allCardsExpanded ? 'block' : 'none');
  cards.forEach(c => c.classList.toggle('is-expanded', allCardsExpanded));
  const btn = document.getElementById('btnToggleAll');
  if (btn) {
    btn.innerHTML = allCardsExpanded
      ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" class="me-1" style="vertical-align: -2px;"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-14v3h3v2h-5V5h2z"/></svg>折疊全部'
      : '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" class="me-1" style="vertical-align: -2px;"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>展開全部';
  }
}

