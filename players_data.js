// Firebase config (apna real config yahan hai)
const firebaseConfig = {
  apiKey: "AIzaSyDBhHt1wbY-gwlmUYkLSWblqgs8sptCWps",
  authDomain: "cricket-f3711.firebaseapp.com",
  databaseURL: "https://cricket-f3711-default-rtdb.firebaseio.com",
  projectId: "cricket-f3711",
  storageBucket: "cricket-f3711.firebasestorage.app",
  messagingSenderId: "84308127741",
  appId: "1:84308127741:web:9d7cc9843558d4d053b394"
};

// Firebase initialize karo
firebase.initializeApp(firebaseConfig);

// Firebase database reference
const db = firebase.database();

// Global variable for selected team (taaki baar-baar fetch na karo)
let selectedTeam = {};
let selectedCount = 0;

// Page load pe data fetch karo (aur selected_team bhi)
document.addEventListener('DOMContentLoaded', () => {
  const playerName = localStorage.getItem('playerName');
  if (!playerName) {
    alert('Player name not found in localStorage!');
    return;
  }

  // Dono data parallel fetch karo
  const teamPromise = db.ref('users/' + playerName + '/team').once('value');
  const selectedTeamPromise = db.ref('users/' + playerName + '/selected_team').once('value');

  Promise.all([teamPromise, selectedTeamPromise]).then(([teamSnapshot, selectedSnapshot]) => {
    const team = teamSnapshot.val();
    selectedTeam = selectedSnapshot.val() || {};
    selectedCount = Object.keys(selectedTeam).filter(key => key !== 'captain').length; // Captain ko count mein mat gino
    updateSelectedCountDisplay();

    if (!selectedTeam.captain) {
      // Agar captain nahi hai, toh set karo ""
      db.ref('users/' + playerName + '/selected_team/captain').set("");
    }

    if (team) {
      populateTable(team); // Ab dono data ready hone ke baad table populate karo
    } else {
      alert('No team data found!');
    }
  }).catch((error) => {
    console.error('Error fetching data:', error);
    alert('Error loading data!');
  });
});

// Function to update selected count on page (optional, ek <p> add karo HTML mein id="selectedCount")
function updateSelectedCountDisplay() {
  const countEl = document.getElementById('selectedCount');
  if (countEl) {
    countEl.textContent = `Selected Players: ${selectedCount}/11`;
  }
}

// Table populate karne ka function
function populateTable(team) {
  const tbody = document.getElementById('playersTableBody');
  tbody.innerHTML = ''; // Clear existing rows

  for (let playerKey in team) {
    const player = team[playerKey];
    const row = document.createElement('tr');
    row.setAttribute('data-player', playerKey); // For click event

    // Points: Hamesha batting aur bowling dono ratings show karo
    const points = `Batting: ${player.battingRating}, Bowling: ${player.bowlingRating}`;

    // Button text: Agar already selected hai toh "Deselect", else "Select"
    const isSelected = selectedTeam[playerKey] ? true : false;
    const selectButtonText = isSelected ? 'Deselect' : 'Select';

    // Captain button text: Agar ye player captain hai toh "Remove Captain", else "Make Captain"
    const isCaptain = selectedTeam.captain === player.name;
    const captainButtonText = isCaptain ? 'Remove Captain' : 'Make Captain';

    row.innerHTML = `
            <td>${player.name}</td>
            <td>${player.type}</td>
            <td>${player.battingSkills || 'N/A'}</td>
            <td>${points}</td>
            <td>
                <button class="select-btn" onclick="selectPlayer('${playerKey}', this)">${selectButtonText}</button>
                <button class="captain-btn" onclick="makeCaptain('${playerKey}', this)">${captainButtonText}</button>
            </td>
        `;

    // Row click pe modal show karo
    row.addEventListener('click', () => showPlayerDetails(player));
    tbody.appendChild(row);
  }
}

// Select/Deselect button logic
function selectPlayer(playerKey, buttonElement) {
  const playerName = localStorage.getItem('playerName');
  if (!playerName) return;

  const isSelected = selectedTeam[playerKey] ? true : false;

  if (isSelected) {
    // Deselect: selected_team se delete karo
    db.ref('users/' + playerName + '/selected_team/' + playerKey).remove().then(() => {
      delete selectedTeam[playerKey];
      selectedCount--;
      updateSelectedCountDisplay();
      buttonElement.textContent = 'Select'; // Button text change
      alert(`Player deselected!`);
    }).catch((error) => {
      console.error('Error deselecting player:', error);
      alert('Error deselecting player!');
    });
  } else {
    // Select: Check limit aur add karo
    if (selectedCount >= 11) {
      alert('You can select only 11 players!');
      return;
    }

    // Player ko team se fetch karo aur selected_team mein add karo
    db.ref('users/' + playerName + '/team/' + playerKey).once('value').then((snapshot) => {
      const player = snapshot.val();
      if (player) {
        db.ref('users/' + playerName + '/selected_team/' + playerKey).set(player).then(() => {
          selectedTeam[playerKey] = player;
          selectedCount++;
          updateSelectedCountDisplay();
          buttonElement.textContent = 'Deselect'; // Button text change
          alert(`Player ${player.name} selected!`);
        }).catch((error) => {
          console.error('Error selecting player:', error);
          alert('Error selecting player!');
        });
      } else {
        alert('Player not found in team!');
      }
    }).catch((error) => {
      console.error('Error fetching player:', error);
    });
  }
}

// Make Captain / Remove Captain logic
function makeCaptain(playerKey, buttonElement) {
  const playerName = localStorage.getItem('playerName');
  if (!playerName) return;

  // Check: Agar player selected nahi hai, toh captain banao mat
  if (!selectedTeam[playerKey]) {
    alert('You can only make captain from selected players!');
    return;
  }

  // Player ka naam fetch karo (team se)
  db.ref('users/' + playerName + '/team/' + playerKey).once('value').then((snapshot) => {
    const player = snapshot.val();
    if (!player) {
      alert('Player not found!');
      return;
    }

    const isCaptain = selectedTeam.captain === player.name;
    const originalBatting = player.battingRating; // Original team batting rating
    const originalBowling = player.bowlingRating; // Original team bowling rating

    if (isCaptain) {
      // Remove Captain: captain="" set karo aur ratings ko original team values pe laao
      db.ref('users/' + playerName + '/selected_team/captain').set("").then(() => {
        selectedTeam.captain = "";
        // Update local selectedTeam ratings back to originals
        selectedTeam[playerKey].battingRating = originalBatting;
        selectedTeam[playerKey].bowlingRating = originalBowling;
        // Update DB ratings back to originals
        db.ref('users/' + playerName + '/selected_team/' + playerKey + '/battingRating').set(originalBatting);
        db.ref('users/' + playerName + '/selected_team/' + playerKey + '/bowlingRating').set(originalBowling);
        buttonElement.textContent = 'Make Captain'; // Button text change
        alert(`Captain removed!`);
      }).catch((error) => {
        console.error('Error removing captain:', error);
        alert('Error removing captain!');
      });
    } else {
      // Make Captain: Check if already captain hai
      if (selectedTeam.captain && selectedTeam.captain !== "") {
        alert('Another captain is already selected! Remove the current captain first.');
        return;
      }

      // Set captain aur ratings ko +2 karo
      db.ref('users/' + playerName + '/selected_team/captain').set(player.name).then(() => {
        selectedTeam.captain = player.name;
        // Update local selectedTeam ratings to originals + 2
        selectedTeam[playerKey].battingRating = originalBatting + 2;
        selectedTeam[playerKey].bowlingRating = originalBowling + 2;
        // Update DB ratings to originals + 2
        db.ref('users/' + playerName + '/selected_team/' + playerKey + '/battingRating').set(originalBatting + 2);
        db.ref('users/' + playerName + '/selected_team/' + playerKey + '/bowlingRating').set(originalBowling + 2);
        buttonElement.textContent = 'Remove Captain'; // Button text change
        alert(`${player.name} is now captain!`);
      }).catch((error) => {
        console.error('Error setting captain:', error);
        alert('Error setting captain!');
      });
    }
  }).catch((error) => {
    console.error('Error fetching player for captain:', error);
  });
}

// Modal show karne ka function
function showPlayerDetails(player) {
  document.getElementById('modalPlayerName').textContent = player.name;
  document.getElementById('modalType').textContent = player.type;
  document.getElementById('modalBattingSkills').textContent = player.battingSkills || 'N/A';
  document.getElementById('modalBattingRating').textContent = player.battingRating;
  document.getElementById('modalBowlingRating').textContent = player.bowlingRating;
  document.getElementById('modalPrice').textContent = player.price;
  document.getElementById('modalMatches').textContent = player.matches;
  document.getElementById('modalRuns').textContent = player.runs;
  document.getElementById('modalWickets').textContent = player.wickets;
  document.getElementById('modalFifties').textContent = player.fifties;
  document.getElementById('modalHundreds').textContent = player.hundreds;
  document.getElementById('modal5WicketHauls').textContent = player['5 wicket hauls'];
  document.getElementById('modalAvg').textContent = player.avg;

  const modal = document.getElementById('playerModal');
  modal.style.display = 'block';

  // Close button
  document.querySelector('.close').onclick = () => modal.style.display = 'none';
  window.onclick = (event) => {
    if (event.target === modal) modal.style.display = 'none';
  };
}
