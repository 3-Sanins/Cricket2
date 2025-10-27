document.addEventListener('DOMContentLoaded', function() {
  const firebaseConfig = {
    apiKey: "AIzaSyDBhHt1wbY-gwlmUYkLSWblqgs8sptCWps",
    authDomain: "cricket-f3711.firebaseapp.com",
    databaseURL: "https://cricket-f3711-default-rtdb.firebaseio.com",
    projectId: "cricket-f3711",
    storageBucket: "cricket-f3711.firebasestorage.app",
    messagingSenderId: "84308127741",
    appId: "1:84308127741:web:9d7cc9843558d4d053b394"
  };

  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    const userName = localStorage.getItem('playerName');
    if (userName) {
      const userRef = database.ref('users/' + userName);
      userRef.once('value', snapshot => {
        const userData = snapshot.val() || { money: 0, matchesPlayed: 0, wins: 0, playersOwned: 0 };
        document.getElementById('name').textContent = userName;
        document.getElementById('money').textContent = userData.money;
        document.getElementById('matchesPlayed').textContent = userData.matchesPlayed;
        document.getElementById('wins').textContent = userData.wins;
        document.getElementById('winRatio').textContent = userData.matchesPlayed > 0 ? ((userData.wins / userData.matchesPlayed) * 100).toFixed(2) + '%' : '0%';
        document.getElementById('playersOwned').textContent = userData.playersOwned || 0;
      });
    } else {
      alert('No user name found');
    }

    document.getElementById('backBtn').addEventListener('click', function() {
      window.location.href = 'index.html';
    });
  } else {
    console.error('Firebase not loaded - check scripts');
  }
});