import re
import os

html_path = '/Users/tsaisungen/Sites/shumei/public/change.html'
js_path = '/Users/tsaisungen/Sites/shumei/public/js/change.js'

with open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

# Extract script content
script_pattern = re.compile(r'<script>(.*?)</script>\s*</body>', re.DOTALL)
match = script_pattern.search(html_content)

if not match:
    print("Script not found!")
    exit(1)

js_content = match.group(1).strip()

# Add Firebase Init at the top
firebase_init = """
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

auth.onAuthStateChanged(user => {
  const linkBanner = document.getElementById('link-google-banner');
  if (user) {
    if (user.isAnonymous && linkBanner) {
      linkBanner.classList.remove('d-none');
    } else if (linkBanner) {
      linkBanner.classList.add('d-none');
    }
  } else {
    if (linkBanner) linkBanner.classList.add('d-none');
  }
});

function linkGoogleAccount() {
  const user = auth.currentUser;
  if (!user || !user.isAnonymous) return;
  const provider = new firebase.auth.GoogleAuthProvider();
  user.linkWithPopup(provider).then((result) => {
    alert("✅ 成功連結 Google 帳號！您的資料已永久保存。");
    document.getElementById('link-google-banner').classList.add('d-none');
  }).catch((error) => {
    alert("連結失敗: " + error.message);
  });
}
"""

# Replace local storage arrays logic
js_content = re.sub(
    r"let participants = JSON\.parse\(localStorage\.getItem\('EXCHANGE_PARTICIPANTS'\)\) \|\| \[\];",
    "let participants = [];",
    js_content
)

js_content = re.sub(
    r"document\.addEventListener\('DOMContentLoaded', \(\) => \{([\s\S]*?)\}\);",
    r"""document.addEventListener('DOMContentLoaded', () => {\1
      // Realtime Firestore Listener
      db.collection('exchange_participants').onSnapshot(snapshot => {
        participants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderPendingRegistrationList();
        renderPackagingList();
        renderExitParticipants();
        renderActiveParticipantsTab3();
        
        if (currentParticipant) {
          const updated = participants.find(p => p.id === currentParticipant.id);
          if (updated) {
            currentParticipant = updated;
            updateSessionQuotaText();
            renderCartList();
          }
        }
      });
    });""",
    js_content
)

# Refactor mockGoogleLogin
mock_google_login = """
    function mockGoogleLogin() {
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider).then((result) => {
        document.getElementById('self-name').value = result.user.displayName || '陳 Google';
        alert('✅ Google 帳號授權成功！已帶入您的姓名。');
      }).catch((error) => {
        alert("登入失敗: " + error.message);
      });
    }
"""
js_content = re.sub(r"function mockGoogleLogin\(\) \{.*?\alert\('.*?'\);\s*\}", mock_google_login.strip(), js_content, flags=re.DOTALL)

# Refactor mockGoogleLoginTab3
mock_google_login_tab3 = """
    function mockGoogleLoginTab3() {
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider).then((result) => {
        const p = participants.find(p => p.id === result.user.uid && p.status === 'active');
        if (p) {
          loadActiveSession(p.id);
        } else {
          alert('找不到您的有效報到紀錄，請確認是否已經通過審核！');
        }
      });
    }
"""
js_content = re.sub(r"function mockGoogleLoginTab3\(\) \{.*?\alert\('.*?'\);\s*\}?\}", mock_google_login_tab3.strip(), js_content, flags=re.DOTALL)


# Refactor selfRegister
self_register = """
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
          alert('🎉 報名登記已送出！請將您的種子交給工作人員審核，確認後將核發入場券與兌換額度。');
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
"""
js_content = re.sub(r"function selfRegister\(event\) \{.*?\event\.target\.reset\(\);\s*\}", self_register.strip(), js_content, flags=re.DOTALL)

# Refactor all DB updates to use Firestore instead of localStorage arrays
def replace_db_update(match):
    code = match.group(0)
    if "participants.push" in code or "participants[partIdx]" in code or "participants[idx]" in code:
        pass
    # We will just replace localStorage.setItem('EXCHANGE_PARTICIPANTS', ...) with firestore updates.
    return code

# approveParticipantRegistration
js_content = re.sub(
    r"participants\[partIdx\]\.quota = quota;[\s\n]*participants\[partIdx\]\.status = 'active';[\s\n]*localStorage\.setItem\('EXCHANGE_PARTICIPANTS', JSON\.stringify\(participants\)\);[\s\n]*renderPendingRegistrationList\(\);[\s\n]*renderPackagingList\(\);",
    "db.collection('exchange_participants').doc(partId).update({ quota: quota, status: 'active' });",
    js_content
)

# checkoutExitParticipant
js_content = re.sub(
    r"participants\[partIdx\]\.status = 'completed';[\s\n]*localStorage\.setItem\('EXCHANGE_PARTICIPANTS', JSON\.stringify\(participants\)\);",
    "db.collection('exchange_participants').doc(partId).update({ status: 'completed' });",
    js_content
)

# handleScannedData bag scan
js_content = re.sub(
    r"currentParticipant\.selectedBags\.push\(data\);[\s\n]*// Update DB[\s\n]*const idx = participants\.findIndex.*?;[\s\n]*participants\[idx\] = currentParticipant;[\s\n]*localStorage\.setItem\('EXCHANGE_PARTICIPANTS', JSON\.stringify\(participants\)\);[\s\n]*updateSessionQuotaText\(\);[\s\n]*renderCartList\(\);",
    "currentParticipant.selectedBags.push(data);\n        db.collection('exchange_participants').doc(currentParticipant.id).update({ selectedBags: currentParticipant.selectedBags });",
    js_content
)

js_content = firebase_init + "\n" + js_content

# Write out to js/change.js
with open(js_path, 'w', encoding='utf-8') as f:
    f.write(js_content)

# Replace script in html
new_html_content = script_pattern.sub(r'<script src="./js/change.js"></script>\n</body>', html_content)
with open(html_path, 'w', encoding='utf-8') as f:
    f.write(new_html_content)

print("Refactoring complete.")
