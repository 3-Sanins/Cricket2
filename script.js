// Firebase config (same as before, agar alag file hai toh yahan add karo)
const firebaseConfig = {
    apiKey: "AIzaSyClRQbU3N7F2F9Pp6BYirjcQxZEyVuxcXo",
    authDomain: "cric-283bd.firebaseapp.com",
    databaseURL: "https://cric-283bd-default-rtdb.firebaseio.com",
    projectId: "cric-283bd",
    storageBucket: "cric-283bd.firebasestorage.app",
    messagingSenderId: "509305000521",
    appId: "1:509305000521:web:2c16c4f7d2e85f98476598"
  };
// Firebase initialize karo (agar pehle initialize nahi hai)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Firebase database reference
const db = firebase.database();

// Function to validate team: exactly 11 players and captain != ""
function validateTeam(callback) {
  const playerName = localStorage.getItem('playerName');
  if (!playerName) {
    alert('Player name not found in localStorage!');
    callback(false);
    return;
  }
  
  db.ref('users/' + playerName + '/team').once('value').then((snapshot) => {
      const selectedTeam = snapshot.val();
      if (!selectedTeam) {
        window.location.href = 'bidding.html';
      }
    const playerCount = Object.keys(selectedTeam).filter(key => key !== 'captain').length;
    if (playerCount<11) window.location.href = 'bidding.html';
  });
    

  // selected_team fetch karo
  db.ref('users/' + playerName + '/selected_team').once('value').then((snapshot) => {
    const selectedTeam = snapshot.val();
    if (!selectedTeam) {
      alert('No selected team found!');
      callback(false);
      return;
    }
    
    

    // Count players (captain ko exclude karo)
    const playerCount = Object.keys(selectedTeam).filter(key => key !== 'captain').length;
    

    // Check conditions
    if (playerCount !== 11) {
      alert(`You must select exactly 11 players. Currently selected: ${playerCount}`);
      callback(false);
      return;
    }

    if (!selectedTeam.captain || selectedTeam.captain === "") {
      alert('You must select a captain!');
      callback(false);
      return;
    }

    // Sab theek hai
    alert('Team is valid! Ready to play.');
    callback(true);
  }).catch((error) => {
    console.error('Error validating team:', error);
    alert('Error validating team!');
    callback(false);
  });
}


document.addEventListener('DOMContentLoaded', function() {
  const savedName = localStorage.getItem('playerName');
  if (savedName) {
    document.getElementById('nameInput').style.display = 'none';
    document.getElementById('mainButtons').style.display = 'block';
  }

  document.getElementById('saveNameBtn').addEventListener('click', function() {
    const name = document.getElementById('playerName').value;
    if (name) {
      localStorage.setItem('playerName', name);
      document.getElementById('nameInput').style.display = 'none';
      document.getElementById('mainButtons').style.display = 'block';
    } else {
      alert('Please enter a name');
    }
  });

  document.getElementById('startGameBtn').addEventListener('click', function() {
    validateTeam((isvalid) => {
      if (isvalid){
        window.location.href = 'main_game.html';
      }
    });
    
//    window.location.href = 'bidding.html'; // Link to start_game.html
  });

  document.getElementById('myDataBtn').addEventListener('click', function() {
    window.location.href = 'my_data.html'; // Link to my_data.html
  });

  document.getElementById('playersDataBtn').addEventListener('click', function() {
    window.location.href = 'players_data.html'; // Link to players_data.html
  });
});
