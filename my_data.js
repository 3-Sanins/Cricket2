document.addEventListener('DOMContentLoaded', function() {
  const firebaseConfig = {
    apiKey: "AIzaSyClRQbU3N7F2F9Pp6BYirjcQxZEyVuxcXo",
    authDomain: "cric-283bd.firebaseapp.com",
    databaseURL: "https://cric-283bd-default-rtdb.firebaseio.com",
    projectId: "cric-283bd",
    storageBucket: "cric-283bd.firebasestorage.app",
    messagingSenderId: "509305000521",
    appId: "1:509305000521:web:2c16c4f7d2e85f98476598"
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
