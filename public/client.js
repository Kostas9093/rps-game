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

socket.on("roomUpdate", (players) => {
  const list = Object.values(players)
    .map(p => `${p.name}: ${p.score}`)
    .join(" | ");
  playersText.innerText = list;
});

socket.on("result", (data) => {
  status.innerText =
    `You chose ${data.yourChoice}, ${data.opponentName} chose ${data.opponentChoice}.
${data.result}
Score: You ${data.yourScore} - ${data.opponentScore}`;
});

socket.on("errorMessage", msg => alert(msg));
