const socket = io();

const status = document.getElementById("status");
const playersText = document.getElementById("players");
const game = document.getElementById("game");

function join() {
  const name = document.getElementById("name").value;
  const room = document.getElementById("room").value;

  
  if (!name) {
    alert("Please enter your name");
    return;
  }

  if (!room) {
    alert("Please enter a room name");
    return;
  }
  
  socket.emit("joinRoom", { name, room });
  game.style.display = "block";
}

function play(choice) {
  status.innerText = "Waiting for opponent...";
  socket.emit("choice", choice);
}

function playAgain() {
  socket.emit("playAgain");
}


socket.on("roomUpdate", (players) => {
  const list = Object.values(players)
    .map(p => `${p.name}: ${p.score}`)
    .join(" | ");
  playersText.innerText = list;
});

function acceptPlayAgain() {
  socket.emit("acceptPlayAgain");
  status.innerText = "Waiting for other player...";
}

function rejectPlayAgain() {
  socket.emit("rejectPlayAgain");
}

socket.on("result", (data) => {
  let emoji = "🤝";
  if (data.result === "You win!") emoji = "🏆";
  if (data.result === "You lose!") emoji = "😞";
  status.innerHTML =
  `🕹️ Round ${data.round} / ${data.maxRounds}<br><br>
    You chose ${data.yourChoice}, ${data.opponentName} chose ${data.opponentChoice}<br>.
 <strong>${data.result}</strong><br>
Score: You ${data.yourScore} - ${data.opponentScore}`;
});

socket.on("playAgainRejected", (data) => {
  status.innerHTML = `❌ ${data.by} rejected playing again`;
  document.getElementById("playAgain").style.display = "none";
});


socket.on("gameOver", (data) => {
  status.innerHTML = `🏁 <strong>${data.winnerText}</strong>`;
  document.getElementById("playAgain").style.display = "block";
});

socket.on("newGame", () => {
  status.innerText = "🎮 New game started!";
  document.getElementById("playAgain").style.display = "none";
});

socket.on("playAgainRequest", (data) => {
  status.innerHTML = `
    🔁 <strong>${data.from}</strong> wants to play again<br><br>
    <button onclick="acceptPlayAgain()">✅ Accept</button>
    <button onclick="rejectPlayAgain()">❌ Reject</button>
  `;
});

socket.on("errorMessage", msg => alert(msg));
