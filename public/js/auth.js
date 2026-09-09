auth.onAuthStateChanged((user) => {
  if (user) {
    // User is signed in, see docs for a list of available properties
    var uid = user.uid;
    able();
    document.getElementById('title').setAttribute('data-bs-target', '#');
    document.getElementById('title').setAttribute('onclick', 'signOut()');
    // ...
  } else {
    // User is signed out
    // ...
    // document
    //   .getElementById('title')
    //   .setAttribute('data-bs-target', '#loginModal');
    // document.getElementById('title').setAttribute('onclick', '');
    document.getElementById('body').innerHTML = '';
  }
});

function signIn() {
  var email = document.getElementById('log_email').value;
  var pass = document.getElementById('log_pass').value;
  auth
    .signInWithEmailAndPassword(email, pass)
    .then((userCredential) => {
      // Signed in
      var user = userCredential.user;
      // ...
    })
    .catch((error) => {
      var errorCode = error.code;
      var errorMessage = error.message;
    });
}

function create() {
  var email = document.getElementById('log_email').value;
  var pass = document.getElementById('log_pass').value;
  auth
    .createUserWithEmailAndPassword(email, pass)
    .then((userCredential) => {
      // Signed in
      var user = userCredential.user;
      alert('已登入');
      timer = setTimeout('reflesh()', 1000);
    })
    .catch((error) => {
      //   var errorCode = error.code;
      //   var errorMessage = error.message;
      console.log(error);
    });
}

function signOut() {
  auth
    .signOut()
    .then(() => {
      // Sign-out successful.
    })
    .catch((error) => {
      // An error happened.
    });
}

function reflesh() {
  window.location.reload();
}
