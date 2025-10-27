const firebaseConfig = {
  apiKey: "AIzaSyDBhHt1wbY-gwlmUYkLSWblqgs8sptCWps",
  authDomain: "cricket-f3711.firebaseapp.com",
  databaseURL: "https://cricket-f3711-default-rtdb.firebaseio.com",
  projectId: "cricket-f3711",
  storageBucket: "cricket-f3711.firebasestorage.app",
  messagingSenderId: "84308127741",
  appId: "1:84308127741:web:9d7cc9843558d4d053b394"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

function setupUserData() {
  const users = {
    Arnav: {
      money: 3000000,
      matchesPlayed: 0,
      wins: 0
    },
    Akshit: {
      money: 3000000,
      matchesPlayed: 0,
      wins: 0
    }
  };

  database.ref('users').set(users)
    .then(() => console.log('Users data saved successfully'))
    .catch(error => console.error('Error saving users data:', error));
}

const auc_list = [
    ['Virat', 'Batter', 'striker', 98, 40],
    ['Rohit', 'Batter', 'powerplay basher', 96, 50],
    ['Dhoni', 'Batter', 'finisher', 93, 7],
    ['Sachin', 'Batter', 'striker', 99, 60],
    ['AB devillers', 'Batter', 'finisher', 95, 7],
    ['Ricky ponting', 'Batter', '', 92, 40],
    ['sehwag', 'Batter', 'powerplay basher', 90, 55],
    ['yuvraj', 'Batter', 'finisher', 90, 85],
    ['Raina', 'Batter', '', 85, 80],
    ['Surya', 'Batter', 'striker', 88, 30],
    ['hardik', 'Batter', 'finisher', 95, 90],
    ['Miller', 'Batter', '', 88, 40],
    ['Maxwell', 'Batter', '', 90, 84],
    ['buttler', 'Batter', 'powerplay basher', 90, 32],
    ['abhishek', 'Batter', 'powerplay basher', 91, 69],
    ['jaiswal', 'Batter', '', 90, ''],
    ['jadeja', 'all rounder', 'econmical', 90, 95],
    ['axar', 'all rounder', '', 85, 90],
    ['brendom mcclum', 'Batter', 'powerplay bsher', 90, 40],
    ['steve smith', 'Batter', '', 91, 69],
    ['head', 'Batter', 'powerplay basher', 90, 69],
    ['bumrah', 'bowler', 'death bowler', 33, 99],
    ['siraj', 'bowler', 'powerplay bowler', 33, 96],
    ['starc', 'bowler', 'death bowler', 50, 95],
    ['pat cummins', 'bowler', '', 69, 90],
    ['Dale steyn', 'bowler', 'powerplay bowler', 29, 97],
    ['shami', 'bowler', 'powerplay basher', 50, 94],
    ['boult', 'bowler', 'powerplay bowler', 10, 94],
    ['kuldeep', 'bowler', 'econmical', 40, 93],
    ['chahal', 'bowler', 'econmical', 8, 88],
    ['zampa', 'bowler', 'econmical', 37, 85],
    ['rabada', 'bowler', 'death bowler', 9, 90],
    ['rahul', 'Batter', '', 95, 40],
    ['gayle', 'Batter', 'powerplay basher', 93, 69],
    ['hazlewood', 'bowler', 'death bowler', 50, 90]
];

function setupPlayersData() {
  database.ref('players').set(auc_list.map(player => ({
      name: player[0],
      type: player[1],
      battingSkills: player[2],
      battingRating: player[3] || 0,
      bowlingRating: player[4] || 0
    })))
    .then(() => console.log('Players data saved successfully'))
    .catch(error => console.error('Error saving players data:', error));
}

function saveTeamAfterBidding(userID, teamData, recordData) {
  database.ref(`teams/${userID}/players`).set(teamData);
  database.ref(`users/${userID}/record`).set(recordData);
  console.log(`Team and record saved for ${userID}`);
}

setupUserData();
setupPlayersData();
console.log('Data setup complete. Bidding ke baad saveTeamAfterBidding use karo.');