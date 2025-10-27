// main_game.js (revised + fixed based on analysis and Firebase structure)
// Assumes firebase compat libs are loaded (as in your HTML)

///// CONFIG /////
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

///// GLOBAL STATE /////
const playerName = localStorage.getItem('playerName');
if (!playerName) {
  alert('Player name missing in localStorage (playerName). Set it before playing.');
  throw new Error('Missing playerName in localStorage');
}

let currentUserKey = null;   // 'player1' or 'player2' for this client
let opponentKey = null;
const gameRef = database.ref('game');
const userRef = database.ref(`users/${playerName}`);
let gameData = null;         // latest snapshot value
let currentOverBalls = [];   // local for display, synced via Firebase

///// DOM SHORTCUTS /////
const scorecardEl = document.getElementById('scorecard');
const battingUIEl = document.getElementById('battingUI');
const bowlingUIEl = document.getElementById('bowlingUI');
const currentOverEl = document.getElementById('currentOver');
const popupEl = document.getElementById('popup');
const popupBody = document.getElementById('popupBody');
const popupClose = document.getElementById('popupClose');
const endGameUI = document.getElementById('endGameUI');
const gameContainer = document.getElementById('gameContainer');

popupClose.onclick = hidePopup;

///// Real-time game listener /////
gameRef.on('value', (snapshot) => {
  gameData = snapshot.val();
  if (!gameData) {
    gameRef.set({ play: 'None' });
    return;
  }

  if (gameData.player1 && gameData.player1.name === playerName) {
    currentUserKey = 'player1';
    opponentKey = 'player2';
  } else if (gameData.player2 && gameData.player2.name === playerName) {
    currentUserKey = 'player2';
    opponentKey = 'player1';
  }

  const playState = gameData.play;
  if (playState === 'None') handleNoneState();
  else if (playState === 'Yet') handleYetState();
  else if (playState === 'start') handleStartState();
  else if (playState === 'inning1' || playState === 'inning2') handleInningState();
});

///// STATE HANDLERS /////
async function handleNoneState() {
  if (!gameData.player1) {
    const playerTemplate = {
      name: playerName,
      wicket: 0,  // Fixed: Start at 0
      total_runs: 0,
      BALLS: 0,
      playing11: {},
      baller: '',
      batters: {},
      batting: {}
    };
    await gameRef.child('player1').set(playerTemplate);

    // Populate playing11 from selected_team, only if player exists
    try {
      const userSnap = await userRef.once('value');
      const userData = userSnap.val();
      if (userData && userData.selected_team) {
        const selectedTeam = userData.selected_team;
        const playing11 = {};
        Object.keys(selectedTeam).forEach(p => {
          if (p !== 'captain' && selectedTeam[p]) {  // Ensure player data exists
            playing11[p] = {
              ...selectedTeam[p],
              ball_faced: 0, ball_thrown: 0, runs_made: 0, runs_faced: 0,
              wicket_taken: 0, six: 0, four: 0, inning: 0
            };
          }
        });
        await gameRef.child('player1/playing11').update(playing11);
      }
    } catch (e) {
      console.warn('Error populating playing11:', e);
    }

    currentUserKey = 'player1';
    opponentKey = 'player2';
    await gameRef.update({ play: 'Yet' });
  }
}

async function handleYetState() {
  if (gameData.player1 && gameData.player1.name === playerName) {
    currentUserKey = 'player1';
    opponentKey = 'player2';
    return;
  }

  if (!gameData.player2) {
    const playerTemplate = {
      name: playerName,
      wicket: 0,
      total_runs: 0,
      BALLS: 0,
      playing11: {},
      baller: '',
      batters: {},
      batting: {}
    };
    await gameRef.child('player2').set(playerTemplate);

    try {
      const userSnap = await userRef.once('value');
      const userData = userSnap.val();
      if (userData && userData.selected_team) {
        const selectedTeam = userData.selected_team;
        const playing11 = {};
        Object.keys(selectedTeam).forEach(p => {
          if (p !== 'captain' && selectedTeam[p]) {
            playing11[p] = {
              ...selectedTeam[p],
              ball_faced: 0, ball_thrown: 0, runs_made: 0, runs_faced: 0,
              wicket_taken: 0, six: 0, four: 0, inning: 0
            };
          }
        });
        await gameRef.child('player2/playing11').update(playing11);
      }
    } catch (e) {
      console.warn('Error populating playing11:', e);
    }

    currentUserKey = 'player2';
    opponentKey = 'player1';
    await gameRef.update({ play: 'start' });
  }
}

function handleStartState() {
  if (!gameData.tossWinner) {
    const tossWinner = Math.random() < 0.5 ? 'player1' : 'player2';
    gameRef.update({ tossWinner });
    return;
  }

  if (gameData.tossWinner && currentUserKey === gameData.tossWinner) {
    showPopup('Toss won! Choose', `
      <div style="display:flex;gap:8px">
        <button onclick="setChoice('bat')">Bat</button>
        <button onclick="setChoice('ball')">Ball</button>
      </div>
    `);
  }

  if (gameData.chance && gameData.chance.player1 && gameData.chance.player2) {
    gameRef.update({ play: 'inning1' });
  }
}

window.setChoice = function(choice) {
  if (!currentUserKey || !opponentKey) return;
  const opponentChoice = choice === 'bat' ? 'ball' : 'bat';
  gameRef.update({
    [`chance/${currentUserKey}`]: choice,
    [`chance/${opponentKey}`]: opponentChoice
  });
  hidePopup();
};

function handleInningState() {
  console.log('handleInningState called, currentUserKey:', currentUserKey, 'gameData.play:', gameData.play); // Add logging
  if (gameData.play !== 'inning1' && gameData.play !== 'inning2') {
    console.log('Game ended, calling endGame'); // Add logging
    const winner = gameData.winner || 'tie';
    endGame(winner);
    return;
  }

  if (!currentUserKey) {
    console.log('No currentUserKey, waiting'); // Add logging
    scorecardEl.innerHTML = `<div>Waiting for players...</div>`;
    battingUIEl.style.display = 'none';
    bowlingUIEl.style.display = 'none';
    return;
  }

  const userNode = gameData[currentUserKey] || {};
  const opponentNode = gameData[opponentKey] || {};
  const userChance = gameData.chance ? gameData.chance[currentUserKey] : undefined;
  console.log('userChance:', userChance); // Add logging
  if (!userChance) {
    console.log('No userChance, waiting for toss'); // Add logging
    scorecardEl.innerHTML = `<div>Waiting for toss choice...</div>`;
    battingUIEl.style.display = 'none';
    bowlingUIEl.style.display = 'none';
    return;
  }

  if (userChance === 'bat') {
    console.log('Calling handleBatting'); // Add logging
    battingUIEl.style.display = 'block';
    bowlingUIEl.style.display = 'none';
    const battingCount = Object.keys(userNode.batting || {}).length;
    if (battingCount < 2 && Object.keys(userNode.batters || {}).length < 10) {
      batsmanSelection(userNode);
    }
    handleBatting(userNode, opponentNode, gameData);
  } else {
    console.log('Calling handleBowling'); // Add logging
    battingUIEl.style.display = 'none';
    bowlingUIEl.style.display = 'block';
    if (!userNode.baller || userNode.baller === '') {
      bowlerSelection(userNode);
    }
    handleBowling(userNode, opponentNode, gameData);
  }

  // Sync currentOverBalls from Firebase
  if (gameData.currentOver) {
    currentOverBalls = gameData.currentOver;
  }
}
///// BATTING LOGIC /////
///// BATTING LOGIC /////
function handleBatting(userData, opponentData, currentGameData) {
  displayScorecard(userData, opponentData, currentGameData.play);
  
  // Add bowler info
const bowlerName = opponentData.baller || 'Unknown';
console.log('Bowler name:', bowlerName, 'opponentData:', opponentData);
const bowlerStats = opponentData.playing11?.[bowlerName] || {};
const bowlerRuns = bowlerStats.runs_faced || 0;
const bowlerWickets = bowlerStats.wicket_taken || 0;
const bowlerOvers = Math.floor((bowlerStats.ball_thrown || 0) / 6);
const bowlerInfo = `${bowlerName} (${bowlerOvers} : ${bowlerRuns} : ${bowlerWickets})`;
const battingOverEl = document.getElementById('currentOverBatting');
if (battingOverEl) {
  battingOverEl.innerHTML = `Current Over: ${currentOverBalls.map(run => run === 7 || run === 8 ? 'W' : run === 9 ? 'N' : run).join(' ')}<br>Bowler: ${bowlerInfo}`;
  console.log('Batting over updated');
} else {
  console.warn('currentOverBatting element not found');
}
  document.getElementById('defenceBtn').onclick = () => playBall('defence');
  document.getElementById('strikeBtn').onclick = () => playBall('strike');
  document.getElementById('strokeBtn').onclick = () => playBall('stroke');

async function playBall(mood) {
  const latestGame = (await gameRef.once('value')).val();
  const userNode = latestGame[currentUserKey] || {};
  const opponentNode = latestGame[opponentKey] || {};
  const battingObj = userNode.batting || {};
  const strikerName = Object.keys(battingObj).find(b => battingObj[b].strike);
  const bowlerName = opponentNode.baller;
  if (!strikerName || !bowlerName) return;

  const batsmanP = userNode.playing11?.[strikerName] || {};
  const bowlerP = opponentNode.playing11?.[bowlerName] || {};
  const run = run_probability(userNode.BALLS || 0, batsmanP.battingRating, bowlerP.bowlingRating, batsmanP.battingSkills, bowlerP.bowlingSkills || bowlerP.battingSkills, mood);

  const updates = {};
  const userRoot = `/${currentUserKey}`;
  const oppRoot = `/${opponentKey}`;

  if (run === 9) {
    updates[`${userRoot}/total_runs`] = (userNode.total_runs || 0) + 1;
    updates[`${userRoot}/playing11/${strikerName}/runs_made`] = (batsmanP.runs_made || 0) + 1;
    updates[`${oppRoot}/playing11/${bowlerName}/runs_faced`] = (bowlerP.runs_faced || 0) + 1;
  } else if (run === 1) {
    updates[`${userRoot}/total_runs`] = (userNode.total_runs || 0) + 1;
    updates[`${userRoot}/playing11/${strikerName}/runs_made`] = (batsmanP.runs_made || 0) + 1;
    updates[`${oppRoot}/playing11/${bowlerName}/runs_faced`] = (bowlerP.runs_faced || 0) + 1;
    updates[`${userRoot}/batting/${strikerName}/strike`] = false;
    const other = Object.keys(battingObj).find(b => b !== strikerName);
    if (other) updates[`${userRoot}/batting/${other}/strike`] = true;
    // Confidence boost for batsman
    const newRuns = (batsmanP.runs_made || 0) + 1;
    if (newRuns === 50 || newRuns === 100) {
      updates[`${userRoot}/playing11/${strikerName}/battingRating`] = (batsmanP.battingRating || 0) + 1;
      alert(`${strikerName} has reached ${newRuns} runs! His confidence is boosted.`);
    }
  } else if ([2, 3].includes(run)) {
    updates[`${userRoot}/total_runs`] = (userNode.total_runs || 0) + run;
    updates[`${userRoot}/playing11/${strikerName}/runs_made`] = (batsmanP.runs_made || 0) + run;
    updates[`${oppRoot}/playing11/${bowlerName}/runs_faced`] = (bowlerP.runs_faced || 0) + run;
    if (run % 2 === 1) {
      updates[`${userRoot}/batting/${strikerName}/strike`] = false;
      const other = Object.keys(battingObj).find(b => b !== strikerName);
      if (other) updates[`${userRoot}/batting/${other}/strike`] = true;
    }
    // Confidence boost for batsman
    const newRuns = (batsmanP.runs_made || 0) + run;
    if (newRuns >= 50 && (batsmanP.runs_made || 0) < 50) {
      updates[`${userRoot}/playing11/${strikerName}/battingRating`] = (batsmanP.battingRating || 0) + 1;
      alert(`${strikerName} has reached 50 runs! His confidence is boosted.`);
    }
    if (newRuns >= 100 && (batsmanP.runs_made || 0) < 100) {
      updates[`${userRoot}/playing11/${strikerName}/battingRating`] = (batsmanP.battingRating || 0) + 1;
      alert(`${strikerName} has reached 100 runs! His confidence is boosted.`);
    }
  } else if (run === 4) {
    updates[`${userRoot}/total_runs`] = (userNode.total_runs || 0) + 4;
    updates[`${userRoot}/playing11/${strikerName}/runs_made`] = (batsmanP.runs_made || 0) + 4;
    updates[`${userRoot}/playing11/${strikerName}/four`] = (batsmanP.four || 0) + 1;
    updates[`${oppRoot}/playing11/${bowlerName}/runs_faced`] = (bowlerP.runs_faced || 0) + 4;
    // Confidence boost for batsman
    const newRuns = (batsmanP.runs_made || 0) + 4;
    if (newRuns >= 50 && (batsmanP.runs_made || 0) < 50) {
      updates[`${userRoot}/playing11/${strikerName}/battingRating`] = (batsmanP.battingRating || 0) + 1;
      alert(`${strikerName} has reached 50 runs! His confidence is boosted.`);
    }
    if (newRuns >= 100 && (batsmanP.runs_made || 0) < 100) {
      updates[`${userRoot}/playing11/${strikerName}/battingRating`] = (batsmanP.battingRating || 0) + 1;
      alert(`${strikerName} has reached 100 runs! His confidence is boosted.`);
    }
  } else if (run === 6) {
    updates[`${userRoot}/total_runs`] = (userNode.total_runs || 0) + 6;
    updates[`${userRoot}/playing11/${strikerName}/runs_made`] = (batsmanP.runs_made || 0) + 6;
    updates[`${userRoot}/playing11/${strikerName}/six`] = (batsmanP.six || 0) + 1;
    updates[`${oppRoot}/playing11/${bowlerName}/runs_faced`] = (bowlerP.runs_faced || 0) + 6;
    // Confidence boost for batsman
    const newRuns = (batsmanP.runs_made || 0) + 6;
    if (newRuns >= 50 && (batsmanP.runs_made || 0) < 50) {
      updates[`${userRoot}/playing11/${strikerName}/battingRating`] = (batsmanP.battingRating || 0) + 1;
      alert(`${strikerName} has reached 50 runs! His confidence is boosted.`);
    }
    if (newRuns >= 100 && (batsmanP.runs_made || 0) < 100) {
      updates[`${userRoot}/playing11/${strikerName}/battingRating`] = (batsmanP.battingRating || 0) + 1;
      alert(`${strikerName} has reached 100 runs! His confidence is boosted.`);
    }
  } else if (run === 7 || run === 8) {
    updates[`${userRoot}/playing11/${strikerName}/inning`] = 1;
    updates[`${userRoot}/batters/${strikerName}`] = { ...(batsmanP || {}) };
    updates[`${userRoot}/wicket`] = (userNode.wicket || 0) + 1;
    updates[`${oppRoot}/playing11/${bowlerName}/wicket_taken`] = (bowlerP.wicket_taken || 0) + 1;
    updates[`${userRoot}/batting/${strikerName}`] = null;
    const remainingBatsmen = Object.keys(battingObj).filter(b => b !== strikerName);
    if (remainingBatsmen.length > 0) {
      updates[`${userRoot}/batting/${remainingBatsmen[0]}/strike`] = true;
    }
    // Confidence boost for bowler
    updates[`${oppRoot}/playing11/${bowlerName}/bowlingRating`] = (bowlerP.bowlingRating || 0) + 0.5;
    alert(`${bowlerName} has taken a wicket! His confidence is boosted.`);
  }

  if (run !== 9) {
    updates[`${userRoot}/BALLS`] = (userNode.BALLS || 0) + 1;
    updates[`${userRoot}/playing11/${strikerName}/ball_faced`] = (batsmanP.ball_faced || 0) + 1;
    updates[`${oppRoot}/playing11/${bowlerName}/ball_thrown`] = (bowlerP.ball_thrown || 0) + 1;
    currentOverBalls.push(run);
    updates['currentOver'] = currentOverBalls;
  }

  await gameRef.update(updates);

  const newBalls = (userNode.BALLS || 0) + (run !== 9 ? 1 : 0);
  if (newBalls % 6 === 0 && run !== 9) {
    currentOverBalls = [];
    await gameRef.update({ currentOver: [], [`${opponentKey}/baller`]: '' });
  }

  const post = (await gameRef.once('value')).val();
  const updatedUser = post[currentUserKey] || {};
  const updatedOpp = post[opponentKey] || {};

  if (post.play === 'inning2' && (updatedUser.total_runs || 0) > (updatedOpp.total_runs || 0)) {
    await gameRef.update({ winner: currentUserKey });
    endGame(currentUserKey);
    return;
  }

  if ((updatedUser.wicket || 0) >= 10) {
    if (post.play === 'inning1') {
      const targetRuns = updatedUser.total_runs + 1;
      const battingUser = updatedUser.name;
      showInningsChangePopup(targetRuns, battingUser, post);
    } else {
      await gameRef.update({ winner: opponentKey });
      endGame(opponentKey);
    }
  }

  if ((updatedUser.BALLS || 0) >= 120) {
    if (post.play === 'inning1') {
      const targetRuns = updatedUser.total_runs + 1;
      const battingUser = updatedUser.name;
      showInningsChangePopup(targetRuns, battingUser, post);
    } else {
      const winner = (updatedUser.total_runs || 0) > (updatedOpp.total_runs || 0) ? currentUserKey : (updatedUser.total_runs || 0) < (updatedOpp.total_runs || 0) ? opponentKey : 'tie';
      await gameRef.update({ winner });
      endGame(winner);
    }
  }
}

}

///// BOWLING LOGIC /////
let previousWickets = 0; // Global or in function scope

async function handleBowling(userData, opponentData, currentGameData) {
    displayScorecard(opponentData, userData, currentGameData.play);
currentOverEl.innerHTML = `Current Over: ${currentOverBalls.map(run => run === 7 || run === 8 ? 'W' : run === 9 ? 'N' : run).join(' ')}`;

    // Check for bowler wicket alert
    const bowler = userData.baller;
    if (bowler) {
      const bowlerP = userData.playing11?.[bowler] || {};
      const currentWickets = bowlerP.wicket_taken || 0;
      if (currentWickets > previousWickets) {
        alert(`${bowler} has taken a wicket! His confidence is boosted.`);
        previousWickets = currentWickets;
      }
    } 
  

  // Add end conditions here (from playBallBowling)
  const oppNow = currentGameData[opponentKey] || {};
  const userNow = currentGameData[currentUserKey] || {};

  if ((oppNow.wicket || 0) >= 10) {
    if (currentGameData.play === 'inning1') {
      const targetRuns = oppNow.total_runs + 1;
      const battingUser = oppNow.name;
      showInningsChangePopup(targetRuns, battingUser, currentGameData);
      return;
    } else {
      await gameRef.update({ winner: currentUserKey });
      endGame(currentUserKey);
      return;
    }
  }

  if ((oppNow.BALLS || 0) >= 120) {
    if (currentGameData.play === 'inning1') {
      const targetRuns = oppNow.total_runs + 1;
      const battingUser = oppNow.name;
      showInningsChangePopup(targetRuns, battingUser, currentGameData);
      return;
    } else {
      const winner = (oppNow.total_runs || 0) > (userNow.total_runs || 0) ? opponentKey : currentUserKey;
      await gameRef.update({ winner });
      endGame(winner);
      return;
    }
  }

  if (currentGameData.play === 'inning2') {
    if ((oppNow.total_runs || 0) > (userNow.total_runs || 0)) {
      await gameRef.update({ winner: opponentKey });
      endGame(opponentKey);
      return;
    }
  }

  // Over completion logic - only if baller is empty and over just completed
  const ballsNow = oppNow.BALLS || 0;
  if (ballsNow % 6 === 0 && ballsNow > 0 && (!userNow.baller || userNow.baller === '')) {
    console.log('Over completed, calling bowlerSelection');
    currentOverBalls = [];
    await gameRef.update({ currentOver: [] });
    bowlerSelection(userNow);
  }

  displayScorecard(oppNow, userNow, currentGameData.play);
  currentOverEl.innerHTML = `Current Over: ${currentOverBalls.join(' ')}`;
}
// Batsman selection
function batsmanSelection(userData) {
  // Make selectBatsman global at the start
  window.selectBatsman = function() {
    const selected = document.querySelector('input[name="batsman"]:checked').value;
    const batting = gameData[currentUserKey].batting || {};
    if (Object.keys(batting).length === 0) {
      // Pehle batsman striker
      batting[selected] = { strike: true };
    } else if (Object.keys(batting).length === 1) {
      // Dusra batsman non-striker
      batting[selected] = { strike: false };
    }
    database.ref(`game/${currentUserKey}/batting`).update(batting);
    hidePopup();
    // Agar sirf ek batsman tha, toh doosra select karne ke liye popup fir se dikha
    if (Object.keys(batting).length === 1) {
      batsmanSelection(userData);
    }
  };

  const wicket = userData.wicket;
  const num = wicket + 2;
  const battingCount = Object.keys(gameData[currentUserKey].batting || {}).length;
  const role = battingCount === 0 ? 'Striker' : 'Non-Striker';
  let html = `<h3>Select Batsman ${num} (${role})</h3><table><tr><th>Name</th><th>Batting Rating</th><th>Skill</th><th>Select</th></tr>`;
  Object.keys(userData.playing11).forEach(player => {
    // Filter: Already selected or out batsmen ko exclude karo
    const isSelected = gameData[currentUserKey].batting && gameData[currentUserKey].batting[player];
    const isOut = gameData[currentUserKey].batters && gameData[currentUserKey].batters[player];
    if (!isSelected && !isOut) {
      html += `<tr><td>${player}</td><td>${userData.playing11[player].battingRating}</td><td>${userData.playing11[player].battingSkills}</td><td><input type="radio" name="batsman" value="${player}"></td></tr>`;
    }
  });
  html += `</table><button onclick="window.selectBatsman()">Play</button>`;
  showPopup('', html);
}
// Bowler selection
function bowlerSelection(userNode) {
  if (!gameData || !currentUserKey || !gameData.chance || gameData.chance[currentUserKey] !== 'ball') return;

  const playing11 = gameData[currentUserKey].playing11 || {};
  let html = `<h3>Select Bowler</h3><table><tr><th>Name</th><th>Bowling Rating</th><th>Skill</th><th>Ball Thrown</th><th>Runs Faced</th><th>Wickets Taken</th><th>Select</th></tr>`;
  Object.keys(playing11).forEach(player => {
    const p = playing11[player];
    if (p.ball_thrown>=30) return; 
    html += `<tr><td>${player}</td><td>${p.bowlingRating || '-'}</td><td>${p.bowlingSkills || p.battingSkills || '-'}</td><td>${p.ball_thrown || 0}</td><td>${p.runs_faced || 0}</td><td>${p.wicket_taken || 0}</td><td><input type="radio" name="bowler" value="${player}"></td></tr>`;
  });
  html += `</table><div style="text-align:right"><button onclick="selectBowler()">Play</button></div>`;
  showPopup('', html);

  window.selectBowler = function() {
    const sel = document.querySelector('input[name="bowler"]:checked');
    if (!sel) return alert('Select a bowler');
    const selected = sel.value;
    gameRef.child(`${currentUserKey}/baller`).set(selected);
    hidePopup();
    bowlingUIEl.style.display = 'block';
  };
}

async function endGame(winnerKey) {
  console.log('endGame called with winner:', winnerKey);

  // Determine winner/loser
  const isWinner = currentUserKey === winnerKey;
  const alertMessage = isWinner ? 'YOU WON!' : 'YOU LOST!';
  alert(alertMessage);

  // Show first scorecard
  showPlayerScorecard('player1', winnerKey);

  // Update user stats
  try {
    const snapshot = (await gameRef.once('value')).val() || {};
    console.log('Snapshot for stats update:', snapshot);
    const playersToUpdate = [snapshot.player1, snapshot.player2];
    for (const p of playersToUpdate) {
      if (!p || !p.name) continue;
      console.log('Updating stats for:', p.name);
      const userSnapshot = await database.ref(`users/${p.name}`).once('value');
      const userObj = userSnapshot.val() || {};
      console.log('Current userObj:', userObj);
      const newMatches = (userObj.matchesPlayed || 0) + 1;
      const newWins = ((winnerKey === (p === snapshot.player1 ? 'player1' : 'player2')) ? ((userObj.wins || 0) + 1) : (userObj.wins || 0));
      await database.ref(`users/${p.name}`).update({
        matchesPlayed: newMatches,
        wins: newWins
      });
      console.log('Updated matchesPlayed:', newMatches, 'wins:', newWins);

      const teamObj = userObj.team || {};
      const p11 = p.playing11 || {};
      for (const plName of Object.keys(p11)) {
        if (teamObj[plName]) {
          const p11Stats = p11[plName];
          const newRuns = (teamObj[plName].runs || 0) + (p11Stats.runs_made || 0);
          const newWickets = (teamObj[plName].wickets || 0) + (p11Stats.wicket_taken || 0);
          const newMatchesP = (teamObj[plName].matches || 0) + 1;
          const newFifties = (teamObj[plName].fifties || 0) + ((p11Stats.runs_made >= 50 && p11Stats.runs_made < 100) ? 1 : 0);
          const newHundreds = (teamObj[plName].hundreds || 0) + ((p11Stats.runs_made >= 100) ? 1 : 0);
          const newHauls = (teamObj[plName]['5 wicket hauls'] || 0) + ((p11Stats.wicket_taken >= 5) ? 1 : 0);
          if (p11Stats.wicket_taken>=5){
            const newBowl=teamObj[plName].bowlingRating+0.2;
          }
          if (p11Stats.runs_made >= 50 && p11Stats.runs_made < 100) {
  const newBat = teamObj[plName].battingRating + 0.1;
}
          if (p11Stats.runs_made>=100) {
  const newBat = teamObj[plName].battingRating + 0.2;
}
          await database.ref(`users/${p.name}/team/${plName}`).update({
            runs: newRuns,
            wickets: newWickets,
            matches: newMatchesP,
            fifties: newFifties,
            hundreds: newHundreds,
            '5 wicket hauls': newHauls,
            battingRating : newBat,
            bowlingRating : newBowl
          });
          console.log('Updated player:', plName, 'runs:', newRuns, 'wickets:', newWickets);
        } else {
          console.warn('Player not in team:', plName);
        }
      }
    }
    console.log('User stats updated successfully');
  } catch (e) {
    console.warn('Error updating user stats:', e);
  }
}

// Function to show player scorecard
function showPlayerScorecard(playerKey, winnerKey) {
  const snapshot = gameData;  // Use current gameData
  const data = snapshot[playerKey] || {};
  const isWinner = playerKey === winnerKey;
  const status = isWinner ? 'WON' : 'LOST';
  let html = `<h3>${playerKey} (${data.name || playerKey}) ${status}</h3>`;
  
  // Batsmen
  html += `<h5>Batsmen</h5><table><tr><th>Batsman</th><th>Runs</th><th>Balls</th><th>SR</th></tr>`;
  const p11 = data.playing11 || {};
  let totalRuns = 0, totalBalls = 0;
  Object.keys(p11).forEach(b => {
    if ((p11[b].ball_faced || 0) > 0) {
      const runs = p11[b].runs_made || 0;
      const balls = p11[b].ball_faced || 0;
      const sr = balls > 0 ? ((runs / balls) * 100).toFixed(2) : '0.00';
      html += `<tr><td>${b}</td><td>${runs}</td><td>${balls}</td><td>${sr}</td></tr>`;
      totalRuns += runs;
      totalBalls += balls;
    }
  });
  const totalSR = totalBalls > 0 ? ((totalRuns / totalBalls) * 100).toFixed(2) : '0.00';
  html += `<tr style="font-weight:bold;"><td>Total</td><td>${totalRuns}</td><td>${totalBalls}</td><td>${totalSR}</td></tr>`;
  html += '</table>';
  
  // Bowlers
  html += `<h5>Bowlers</h5><table><tr><th>Bowler</th><th>Wickets</th><th>Balls Thrown</th><th>Runs Faced</th></tr>`;
  Object.keys(p11).forEach(b => {
    const wickets = p11[b].wicket_taken || 0;
    const ballsThrown = p11[b].ball_thrown || 0;
    const runsFaced = p11[b].runs_faced || 0;
    if (wickets > 0 || ballsThrown > 0) {
      html += `<tr><td>${b}</td><td>${wickets}</td><td>${ballsThrown}</td><td>${runsFaced}</td></tr>`;
    }
  });
  html += '</table>';

  const nextButton = playerKey === 'player1' ? '<button onclick="showPlayerScorecard(\'player2\', \'' + winnerKey + '\')">Next</button>' : '<button onclick="confirmEnd()">OK</button>';
  html += nextButton;

  showPopup('Scorecard', html);
}

// Function to confirm end (track both OKs)
window.confirmEnd = async function() {
  const okRef = database.ref(`game/okClicks/${currentUserKey}`);
  await okRef.set(true);
  
  // Check if both have clicked OK
  const okClicks = (await database.ref('game/okClicks').once('value')).val() || {};
  if (okClicks.player1 && okClicks.player2) {
    // Both OK, delete data and redirect
    await gameRef.remove();
    console.log('Game node deleted for next game');
    window.location.href = 'index.html';
  } else {
    // Wait for other player
    showPopup('Waiting', 'Waiting for other player to confirm...');
  }
};
// New global function for OK click
window.endMatch = async function() {
  try {
    await gameRef.remove();
    console.log('Game node deleted for next game');
  } catch (e) {
    console.warn('Error deleting game:', e);
  }
  window.location.href = 'index.html';
};


///// UI HELPERS /////
function displayScorecard(userData, opponentData, play) {
  userData = userData || {};
  opponentData = opponentData || {};
  const overs = String(Math.floor((userData.BALLS || 0) / 6))+"."+String(userData.BALLS%6);
  const runRate = (userData.BALLS || 0) > 0 ? ((userData.total_runs || 0) / (userData.BALLS || 0) * 6).toFixed(2) : '0.00';
  let html = `<div>Total Runs: ${(userData.total_runs || 0)} (${overs} overs, RR: ${runRate})`;
  if (play === 'inning2') {
    const chasing = (opponentData.total_runs || 0);
    const ballsLeft = Math.max(120 - (userData.BALLS || 0), 0);
    const runsRequired = Math.max(chasing - (userData.total_runs || 0), 0);
    const rrr = ballsLeft > 0 ? ((runsRequired / ballsLeft) * 6).toFixed(2) : '0.00';
    html += ` Chasing: ${chasing} (RRR: ${rrr})`;
  }
  const wickets = userData.wicket || 0 //play === 'inning1' ? (userData.wicket || 0) : (opponentData.playing11 ? Object.values(opponentData.playing11).reduce((sum, p) => sum + (p.wickets_taken || 0), 0) : 0);
  html += `<br>Wickets: ${wickets}`;

  // Add current over and bowler info
  const bowlerName = opponentData.baller || 'Not selected';
  const bowlerStats = opponentData.playing11?.[bowlerName] || {};
  const bowlerRuns = bowlerStats.runs_faced || 0;
  const bowlerWickets = bowlerStats.wicket_taken || 0;
  const bowlerOvers = String(Math.floor((bowlerStats.ball_thrown || 0) / 6))+"."+(String(bowlerStats.ball_thrown%6) || "0");
  const bowlerInfo = `${bowlerName} (${bowlerOvers} : ${bowlerRuns} : ${bowlerWickets})`;
  html += `<br>Current Over: ${currentOverBalls.map(run => run === 7 || run === 8 ? 'W' : run === 9 ? 'N' : run).join(' ')}<br>Bowler: ${bowlerInfo}(${bowlerStats.bowlingRating || 0} : ${bowlerStats.battingSkills || "NIL"} )`;
  

  Object.keys(userData.batting || {}).forEach(batsman => {
    const strike = userData.batting[batsman].strike ? '● ' : '';
    const p = userData.playing11 && userData.playing11[batsman] ? userData.playing11[batsman] : {};
    const runs = p.runs_made || 0;
    const balls = p.ball_faced || 0;
    const sr = balls > 0 ? ((runs / balls) * 100).toFixed(2) : '0.00';
    html += `<br>${strike}${batsman}: ${runs} (${balls}, SR: ${sr})`;
  
  });
  html += `</div>`;
  scorecardEl.innerHTML = html;
}

function showPopup(title, body) {
  popupBody.innerHTML = `<h2>${title}</h2>${body}`;
  popupEl.style.display = 'flex';
  //popupEl.style.position = 'fixed';
  popupEl.style.top = '5%'; // Changed to 5% to avoid top cut
  popupEl.style.left = '50%';
  popupEl.style.transform = 'translateX(-50%)';
  popupEl.style.maxHeight = '100vh'; // Increased to 90vh
  popupEl.style.overflowY = 'auto';
  popupEl.style.zIndex = '1000';
}

function hidePopup() {
  popupEl.style.display = 'none';
}

window.showInningsChangePopup = function(targetRuns, battingUser, snapshot) {
    console.log('showInningsChangePopup called for:', battingUser);
    // Reset current over at inning end
    currentOverBalls = [];
    gameRef.update({ currentOver: [] });
  let scorecardHTML = '<div style="max-height: 400px; overflow-y: auto;"><h4>Scorecard</h4>';
  ['player1', 'player2'].forEach(player => {
    const data = snapshot[player] || {};
    scorecardHTML += `<h5>${data.name || player}</h5>`;

    // Batsmen (only those with balls_faced > 0)
    scorecardHTML += `<table><tr><th>Batsman</th><th>Runs</th><th>Balls</th><th>SR</th></tr>`;
    const p11 = data.playing11 || {};
    Object.keys(p11).forEach(b => {
      if ((p11[b].ball_faced || 0) > 0) {
        const runs = p11[b].runs_made || 0;
        const balls = p11[b].ball_faced || 0;
        const sr = balls > 0 ? ((runs / balls) * 100).toFixed(2) : '0.00';
        scorecardHTML += `<tr><td>${b}</td><td>${runs}</td><td>${balls}</td><td>${sr}</td></tr>`;
      }
    });
    scorecardHTML += '</table>';

    // Bowlers (add balls_thrown and runs_faced)
    scorecardHTML += `<table><tr><th>Bowler</th><th>Wickets</th><th>Balls Thrown</th><th>Runs Faced</th></tr>`;
    Object.keys(p11).forEach(b => {
      const wickets = p11[b].wicket_taken || 0;
      const ballsThrown = p11[b].ball_thrown || 0;
      const runsFaced = p11[b].runs_faced || 0;
      if (wickets > 0 || ballsThrown > 0) { // Show if any stat
        scorecardHTML += `<tr><td>${b}</td><td>${wickets}</td><td>${ballsThrown}</td><td>${runsFaced}</td></tr>`;
      }
    });
    scorecardHTML += '</table>';
  });
  scorecardHTML += '</div>';

  showPopup('Innings Change', `
    Batting over of ${battingUser}. Target set ${targetRuns}.<br>
    ${scorecardHTML}<br>
    <button onclick="startInning2()">OKAY</button>
  `);
};

window.startInning2 = function() {
  const currentChance = gameData.chance;
  const newChance = {
    [currentUserKey]: currentChance[opponentKey],
    [opponentKey]: currentChance[currentUserKey]
  };
  gameRef.update({ play: 'inning2', chance: newChance });
  hidePopup();
};
///// Random run probability placeholder /////
function run_probability(BALLS, battingRating, bowlingRating, battingRole, bowlingRole, mood, battingSkill=0, bowlingSkill=0) {
    // Convert BALLS to over number
    const over = Math.ceil(BALLS / 6);

    // -----------------------
    // 1️⃣ BASE PROBABILITIES (neutral case)
    // -----------------------
    const base = {
        defence: { 0: 50, 1: 30, 2: 5, 3: 4, 4: 4, 6: 1, out: 5 },
        strike:  { 0: 5, 1: 25, 2: 10, 3: 10, 4: 25, 6: 10, out: 15 },
        stroke:  { 0: 20, 1: 10, 2: 10, 3: 5, 4: 30, 6: 25, out: 20 }
    };

    // -----------------------
    // 2️⃣ CHOOSE MOOD TABLE
    // -----------------------
    let probs = { ...base[mood] };

    // -----------------------
    // 3️⃣ RATING & SKILL EFFECT
    // -----------------------
    let ratingDiff = battingRating - bowlingRating; // can be negative

    // scale to -10..+10 range effect
    //ratingDiff = Math.max(-20, Math.min(20, ratingDiff));

    // dynamic scaling — every rating difference has impact
    let impactFactor = 1 + (ratingDiff *0.004); // small but noticeable
    for (let key in probs) {
        if (key !== 'out') probs[key] *= impactFactor; // runs scale up
    }
    // higher ratingDiff => slightly less out chance
    probs.out *= (1 - ratingDiff / 120);

    // -----------------------
    // 4️⃣ BOWLING & BATTING SKILL MODIFIER
    // -----------------------
    let skillDiff = battingSkill - bowlingSkill;
    skillDiff = Math.max(-10, Math.min(10, skillDiff));

    let skillFactor = 1 + (skillDiff / 200); // subtle impact
    for (let key in probs) {
        if (key !== 'out') probs[key] *= skillFactor;
    }
    probs.out *= (1 - skillDiff / 150);

    // -----------------------
    // 5️⃣ ABILITIES (roles)
    // -----------------------
    const applyRoleBuffs = () => {
        // --- Batsman Roles ---
        if (battingRole === "powerplay_basher" && over <= 6) {
            probs[6] = (probs[6] || 0) + 3;
            probs.out -= 3;
        }
        if (battingRole === "striker" && over >= 7 && over <= 15) {
            probs[1] = (probs[1] || 0) + 3;
            probs[2] = (probs[2] || 0) + 3;
            probs[4] -= 3;
            probs.out -= 7;
        }
        if (battingRole === "finisher" && over >= 16) {
            probs[6] = (probs[6] || 0) + 3;
            probs.out -= 3;
        }

        // --- Bowler Roles ---
        if (bowlingRole === "powerplay_bowler" && over <= 4) {
            probs.out += 4;
            probs[4] -= 2;
            probs[6] -= 2;
        }
        if (bowlingRole === "economical_bowler" && over >= 6 && over <= 15) {
            probs.out -= 5;
            probs[4] -= 5;
            probs[6] -= 5;
            probs[0] += 7;
            probs[1] += 8;
        }
        if (bowlingRole === "death_bowler" && over >= 16) {
            probs.out += 4;
            probs[4] -= 2;
            probs[6] -= 2;
        }
        
        if (battingRole === "Finisher") {
  if (over >= 6 && over <= 15) {
    // defensive consistency phase
    wicketChance *= 0.65;   // 35% less likely to get out
    runProbabilities = runProbabilities.map((p, i) => {
      if (i <= 2) return p * 1.15;   // 0–2 run shots slightly up
      return p;
    });
  } else if (over >= 16 && over <= 20) {
    // explosive death phase
    //wicketChance *= 1.05;  // slightly riskier but okay
    runProbabilities = runProbabilities.map((p, i) => {
      if (i === 4) return p * 1.3;  // 4s
      if (i === 6) return p * 1.4;  // 6s
      return p;
    });
  }
}

    };
    applyRoleBuffs();

    // ensure no negative values
    for (let k in probs) {
        if (probs[k] < 0) probs[k] = 0;
    }

    // -----------------------
    // 6️⃣ NORMALIZE TO TOTAL 100
    // -----------------------
    let total = Object.values(probs).reduce((a, b) => a + b, 0);
    for (let k in probs) probs[k] = (probs[k] / total) * 100;

    // -----------------------
    // 7️⃣ RANDOM PICK
    // -----------------------
    const outcomes = [0, 1, 2, 3, 4, 6, 'out'];
    let rand = Math.random() * 100;
    let cumulative = 0;

    for (let outcome of outcomes) {
        cumulative += probs[outcome];
        if (rand <= cumulative) {
            return outcome === 'out' ? 7 : outcome;
        }
    }

    return 0; // fallback safety
}




///// END OF FILE /////    
