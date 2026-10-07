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
    if (user.isAnonymous) {
      console.log("匿名管理員登入 UID:", user.uid);
      initData();
    } else {
      // 驗證是否為管理員
      db.collection('info').doc('admins').get().then((doc) => {
        if (doc.exists) {
          const emails = doc.data().emails || [];
          if (emails.includes(user.email)) {
            console.log("管理員登入 UID:", user.uid);
            initData();
          } else {
            alert("權限不足，您將被導向唯讀頁面");
            window.location.href = 'list.html';
          }
        } else {
          alert("尚未設定管理員名單，您將被導向唯讀頁面");
          window.location.href = 'list.html';
        }
      }).catch((error) => {
        console.error("驗證權限時發生錯誤:", error);
        window.location.href = 'list.html';
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
          if (uDoc.exists && uDoc.data().allowDirectLogin === true) {
            able();
          } else {
            userRef.set({ 
              allowDirectLogin: uDoc.exists ? uDoc.data().allowDirectLogin : false, 
              email: user.email, 
              name: user.displayName || '', 
              lastLogin: firebase.firestore.FieldValue.serverTimestamp() 
            }, { merge: true }).catch(err => console.warn("Failed to update allowed_users:", err));
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
  const btnUpload = document.getElementById('btn_upload');
  if (btnUpload) {
    btnUpload.setAttribute('onclick', 'get_date()');
  }
  db.collection('info').doc('set').update({
    login: true,
  }).catch(err => console.warn("Failed to update global login status:", err));
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
  var set_lead = document.getElementById('set_lead');
  var list_part = document.getElementById('list_part');
  var leader_add = document.getElementById('leader_add');

  list_lead.innerHTML = '<option></option><option>大學生</option><option>青年部</option><option>男子部</option>';
  set_lead.innerHTML = '<option></option>';
  list_part.innerHTML = '<option></option>';
  if (leader_add) {
    leader_add.innerHTML = '<option></option>';
    get_lead(leader_add);
  }

  get_lead(list_lead);
  get_lead(set_lead);
  get_part(list_part);

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
    <td>${guide0}</td>
    <td>${guide1}</td>
    <td>${d.sewajin || ''}</td>
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
    <td>
      <button type="button" class="btn btn-sm btn-outline-primary interactive" style="border-color: var(--primary-color); color: var(--primary-color);" onclick="set('${doc.id}')" data-bs-toggle="modal" data-bs-target="#setModal">修改</button>
    </td>
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
    const editBtn = `
      <button type="button" class="quick-icon-btn edit-btn" onclick="set('${doc.id}')" data-bs-toggle="modal" data-bs-target="#setModal" title="編輯成員資料">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
      </button>
    `;
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
          ${editBtn}
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

function get(o) {
  db.collection('member')
    .doc(o)
    .get()
    .then((doc) => {
      document.getElementById('set_sewa').value = doc.data().sewajin || '';
      document.getElementById('set_adress').value = doc.data().adress || '';
      document.getElementById('set_tel').value = doc.data().tel || '';
      document.getElementById('set_phone').value = doc.data().phone || '';
      document.getElementById('set_lead').value = doc.data().leader || '';
      document.getElementById('set_note').value = doc.data().note || '';
      document.getElementById('list_part').value = doc.data().part || '青年部';
      if (doc.data().connect) {
        document.getElementById('set_cnt_y').checked = true;
      } else {
        document.getElementById('set_cnt_n').checked = true;
      }
    })
    .catch((e) => {
      console.log(e);
    });
}

function get_date() {
  var date = document.getElementById('join').value;
  if (!date) {
    alert("請選擇入信日期");
    return;
  }
  check_num(date);
}

function check_num(date) {
  db.collection('member')
    .doc(date)
    .get()
    .then((doc) => {
      if (doc.data()) check_num(date + 'A');
      else add(date);
    })
    .catch((e) => {
      console.log(e);
    });
}

function add(join) {
  var name = document.getElementById('name').value;
  var guide1 = document.getElementById('guide1').value;
  var guide2 = document.getElementById('guide2').value;
  var sewajin = document.getElementById('sewajin').value;
  var adress = document.getElementById('adress').value;
  var tel = document.getElementById('tel').value;
  var phone = document.getElementById('phone').value;
  var born = document.getElementById('born').value;
  var leaderVal = document.getElementById('leader_add').value;
  var note = document.getElementById('note').value;
  var connect = document.getElementsByName('connect');
  var cont = true;
  var post = '';
  
  if (connect[1].checked) cont = false;

  if (guide1.length < 1) guide1 = '';
  if (guide2.length < 1) guide2 = '';

  if (leaderVal == '青年部') leaderVal = '';

  if (note.includes('助教師')) {
    post += '助教師';
    note = note.replace('助教師', '').trim();
  } else if (note.includes('世話人')) {
    post += '世話人';
    note = note.replace('世話人', '').trim();
  }

  db.collection('member')
    .doc(join)
    .set({
      name: name,
      guide: [guide1, guide2],
      sewajin: sewajin,
      adress: adress,
      tel: tel,
      phone: phone,
      born: born,
      leader: leaderVal,
      note: note,
      post: post,
      connect: cont,
      part: '青年部',
    })
    .then(() => {
      alert('上傳成功');
      // Clear inputs
      clear();
      // Reload list
      getDate('青年部');
    });
}

function set(o) {
  var name;
  db.collection('member')
    .doc(o)
    .get()
    .then((doc) => {
      var title = document.getElementById('ModalTitle');
      var btn_up = document.getElementById('btn_up');
      var btn_del = document.getElementById('btn_del');
      name = doc.data().name;
      title.innerText = o.split('A')[0] + ' ' + name;
      btn_up.setAttribute('onclick', 'set_up("' + o + '")');
      btn_del.setAttribute(
        'onclick',
        'del("' + doc.data().name + '", "' + o + '")'
      );
      get(o);
    });
}

function set_up(o) {
  var sewajin = document.getElementById('set_sewa').value;
  var adress = document.getElementById('set_adress').value;
  var tel = document.getElementById('set_tel').value;
  var phone = document.getElementById('set_phone').value;
  var leaderVal = document.getElementById('set_lead').value;
  var note = document.getElementById('set_note').value;
  var part = document.getElementById('list_part').value;
  var conect = document.getElementsByName('conect');
  var cont = true;
  var post = '';
  
  if (conect[1].checked) cont = false;

  if (note.includes('助教師')) {
    post += '助教師';
    note = note.replace('助教師', '').trim();
  } else if (note.includes('世話人')) {
    post += '世話人';
    note = note.replace('世話人', '').trim();
  }

  db.collection('member')
    .doc(o)
    .update({
      sewajin: sewajin,
      adress: adress,
      tel: tel,
      phone: phone,
      leader: leaderVal,
      note: note,
      part: part,
      post: post,
      connect: cont,
    })
    .then(() => {
      alert('上傳成功');
      getDate('青年部');
    });
}

function del(n, o) {
  if (confirm('確定要刪除' + n + '的資料嗎?')) {
    db.collection('member')
      .doc(o)
      .delete()
      .then(() => {
        alert('已刪除' + n);
        window.location.reload();
      })
      .catch((e) => {
        console.log(e);
      });
  }
}

function clear() {
  document.getElementById('join').value = '';
  document.getElementById('name').value = '';
  document.getElementById('guide1').value = '';
  document.getElementById('guide2').value = '';
  document.getElementById('sewajin').value = '';
  document.getElementById('adress').value = '';
  document.getElementById('tel').value = '';
  document.getElementById('phone').value = '';
  document.getElementById('born').value = '';
  document.getElementById('leader_add').value = '';
  document.getElementById('note').value = '';
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

