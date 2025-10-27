// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDBhHt1wbY-gwlmUYkLSWblqgs8sptCWps",
  authDomain: "cricket-f3711.firebaseapp.com",
  databaseURL: "https://cricket-f3711-default-rtdb.firebaseio.com",
  projectId: "cricket-f3711",
  storageBucket: "cricket-f3711.firebasestorage.app",
  messagingSenderId: "84308127741",
  appId: "1:84308127741:web:9d7cc9843558d4d053b394"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Get current user from localStorage (default to "Akshit" if not set)
let currentUser = localStorage.getItem('playerName') || "Akshit";

// Global variables
let players = [];
let currentPlayerIndex = 0; // Back to 0
let userData = {}; // Store user data globally for checks

// Fetch data from Firebase
function fetchData() {
  const playersRef = database.ref('players');
  const usersRef = database.ref('users/' + currentUser);

  playersRef.once('value', (snapshot) => {
    players = snapshot.val() || [];
    displayPlayer();
    checkBidderStatus(); // Check if user already bid on this player
    checkUserBidStatus(); // Check if user's bid=1
  });

  usersRef.once('value', (snapshot) => {
    userData = snapshot.val() || {};
    document.getElementById('user-money').textContent = 'Money: ' + (userData.money || 0);
    document.getElementById('user-players').textContent = 'Players Owned: ' + (userData.playersOwned || 0);
  });
}

// Display current player (at currentPlayerIndex = 0)
function displayPlayer() {
  if (players[currentPlayerIndex]) {
    const player = players[currentPlayerIndex];
    document.getElementById('player-name').textContent = player.name;
    document.getElementById('player-type').textContent = 'Type: ' + player.type;
    document.getElementById('player-batting').textContent = 'Batting Rating: ' + player.battingRating;
    document.getElementById('player-bowling').textContent = 'Bowling Rating: ' + player.bowlingRating;
    document.getElementById('player-skills').textContent = 'Skills: ' + (player.battingSkills || 'N/A');
    document.getElementById('player-bidder').textContent = 'Bidder: ' + (player.bidder || 'None');
    document.getElementById('player-price').textContent = 'Price: ' + player.price;
  } else {
    alert('No players available!');
  }
}

// Check if current user already bid on this player (disable buttons if yes)
function checkBidderStatus() {
  if (players[currentPlayerIndex] && players[currentPlayerIndex].bidder === currentUser) {
    document.getElementById('take-btn').disabled = true;
    document.getElementById('leave-btn').disabled = true;
    //alert('You have already bid on this player!');
  } else {
    document.getElementById('take-btn').disabled = false;
    document.getElementById('leave-btn').disabled = false;
  }
}

// Check if current user's bid=1 (disable buttons if yes)
function checkUserBidStatus() {
  if (userData.bid == 1) {
    document.getElementById('take-btn').disabled = true;
    document.getElementById('leave-btn').disabled = true;
    alert('Your bid is set to 1. You cannot take or leave until resolved.');
  }
}

// Helper function to transfer player to a user's team and update their stats
function transferPlayerToTeam(player, receivingUser, callback) {
  const teamRef = database.ref('users/' + receivingUser + '/team');
  const playersRef = database.ref('players');
  const userRef = database.ref('users/' + receivingUser);

  // Prepare player data for team
  const teamPlayerData = {
    ...player,
    matches: 0,
    runs: 0,
    wickets: 0,
    fifties: 0,
    hundreds: 0,
    '5 wicket hauls': 0,
    avg: 0
  };

  // Add to team
  teamRef.once('value', (snapshot) => {
    let team = snapshot.val() || {};
    team[player.name] = teamPlayerData; // Use name as key
    teamRef.set(team).then(() => {
      // Remove from players array at currentPlayerIndex (0)
      players.splice(currentPlayerIndex, 1);
      // Reindex to start from 0
      const reindexed = {};
      let newKey = 0;
      players.forEach((p) => {
        reindexed[newKey] = p;
        newKey++;
      });
      playersRef.set(reindexed).then(() => {
        // Update receiving user's money and playersOwned
        userRef.once('value', (userSnapshot) => {
          const userData = userSnapshot.val() || {};
          const newMoney = (userData.money || 0) - parseFloat(player.price);
          const newPlayersOwned = (userData.playersOwned || 0) + 1;
          userRef.update({
            money: newMoney,
            playersOwned: newPlayersOwned
          }).then(() => {
            callback(); // Success callback
          }).catch((error) => {
            alert('Error updating user stats: ' + error.message);
          });
        });
      }).catch((error) => {
        alert('Error removing player: ' + error.message);
      });
    }).catch((error) => {
      alert('Error adding to team: ' + error.message);
    });
  });
}

// Button event listeners
document.getElementById('take-btn').addEventListener('click', () => {
  if (players[currentPlayerIndex] && userData.money !== undefined && userData.money>=1000000) {
    // Check if the other user's bid == 1
    const otherUser = currentUser === "Akshit" ? "Arnav" : "Akshit";
    const otherUserRef = database.ref('users/' + otherUser + '/bid');
    otherUserRef.once('value', (snapshot) => {
      const otherBid = snapshot.val() || 0;
      if (otherBid == 1) {
        // Transfer current player to current user's team
        const player = players[currentPlayerIndex];
        transferPlayerToTeam(player, currentUser, () => {
          // Set other user's bid to 0
          otherUserRef.set(0);
          alert('Player transferred to your team due to ' + otherUser + '\'s bid=1!');
          fetchData();
        });
        return; // End here
      }

      // Normal bid logic (if no bid=1)
      const currentPrice = parseFloat(players[currentPlayerIndex].price);
      const newPrice = currentPrice + (currentPrice * 0.1); // Increase by 10%
      const userMoney = userData.money;
      const playersOwned = userData.playersOwned || 0;
      const remainingPlayersNeeded = 11 - playersOwned - 1; // After this bid, how many more for 11
      const reserveNeeded = remainingPlayersNeeded > 0 ? remainingPlayersNeeded * 20000 : 0;

      // Checks
      if (newPrice > userMoney) {
        alert('Insufficient funds! You need at least ' + newPrice + ' to bid.');
        return;
      }
      if (playersOwned >= 24) {
        alert('You cannot own more than 24 players!');
        return;
      }
      const remainingMoneyAfterBid = userMoney - newPrice;
      if (remainingMoneyAfterBid < reserveNeeded) {
        alert('Not enough reserve money! You need to keep ' + reserveNeeded + ' for remaining players.');
        return;
      }

      // All checks passed: Proceed with bid
      const playerRef = database.ref('players/' + currentPlayerIndex); // Update at currentPlayerIndex

      // Disable buttons immediately
      document.getElementById('take-btn').disabled = true;
      document.getElementById('leave-btn').disabled = true;

      // Update Firebase
      playerRef.update({
        bidder: currentUser,
        price: newPrice
      }).then(() => {
        alert('Bid placed successfully! Price updated.');
        // Refresh data to reflect changes
        fetchData();
      }).catch((error) => {
        alert('Error placing bid: ' + error.message);
        // Re-enable buttons on error
        document.getElementById('take-btn').disabled = false;
        document.getElementById('leave-btn').disabled = false;
      });
    });
  } else {
    alert('Data not loaded yet. Please refresh.');
  }
});

document.getElementById('leave-btn').addEventListener('click', () => {
  if (players[currentPlayerIndex]) {
    const player = players[currentPlayerIndex];
    const bidder = player.bidder || "";

    // Check if other user's bid == 1, delete player and reindex
    const otherUser = currentUser === "Akshit" ? "Arnav" : "Akshit";
    const otherUserRef = database.ref('users/' + otherUser + '/bid');
    otherUserRef.once('value', (snapshot) => {
      const otherBid = snapshot.val() || 0;
      if (otherBid == 1) {
        // Delete current player and reindex
        players.splice(currentPlayerIndex, 1);
        const reindexed = {};
        let newKey = 0;
        players.forEach((p) => {
          reindexed[newKey] = p;
          newKey++;
        });
        const playersRef = database.ref('players');
        playersRef.set(reindexed).then(() => {
          alert('Player deleted due to ' + otherUser + '\'s bid=1.');
          fetchData();
        }).catch((error) => {
          alert('Error deleting player: ' + error.message);
        });
        return;
      }

      if (bidder === currentUser) {
        // Already disabled, no action
        return;
      }

      // Disable buttons during action
      document.getElementById('take-btn').disabled = true;
      document.getElementById('leave-btn').disabled = true;

      if (bidder === "" || bidder === "None") {
        // Set user's bid to 1 and disable buttons
        const userBidRef = database.ref('users/' + currentUser + '/bid');
        userBidRef.set(1).then(() => {
          alert('Bid set to 1. You have left the player.');
          // Disable buttons permanently for this session
          document.getElementById('take-btn').disabled = true;
          document.getElementById('leave-btn').disabled = true;
          fetchData();
        }).catch((error) => {
          alert('Error: ' + error.message);
          document.getElementById('take-btn').disabled = false;
          document.getElementById('leave-btn').disabled = false;
        });
      } else {
        // Bidder is another user: Move player to their team
        transferPlayerToTeam(player, bidder, () => {
          alert('Player moved to ' + bidder + "'s team.");
          fetchData();
        });
      }
    });
  }
});

document.getElementById('refresh-btn').addEventListener('click', () => {
  // Refresh data
  fetchData();
});

// Initialize on load
window.onload = fetchData;
