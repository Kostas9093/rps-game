/**
 * ================================
 * Rock Paper Scissors Multiplayer
 * Backend Server (Node.js)
 * ================================
 */

/* ---------- Imports ---------- */

const express = require("express"); // Express: simple web framework for Node.js
const http = require("http"); // HTTP: required to attach Socket.IO to Express
const { Server } = require("socket.io"); // Socket.IO: real-time communication (WebSockets)

/* ---------- Server Setup ---------- */


const app = express(); // Create express app
const server = http.createServer(app); // Create raw HTTP server from express app
const io = new Server(server); // Attach Socket.IO to the HTTP server
app.use(express.static("public")); // Serve static frontend files from /public folder

/* ---------- Game State (IN MEMORY) ---------- */

/**
 * rooms object holds ALL game data
 *
 * Structure:
 * rooms = {
 *   roomName: {
 *     players: {
 *       socketId: { name: string, score: number }
 *     },
 *     choices: {
 *       socketId: "rock" | "paper" | "scissors"
 *     }
 *   }
 * }
 */
const rooms = {};

/* ---------- Socket.IO Connection ---------- */

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // Player joins a room with a name
  
  socket.on("joinRoom", ({ room, name }) => {

    if (!room || !room.trim()) {
    socket.emit("errorMessage", "Room name is required");
    return;
    }

    if (!name || !name.trim()) {
    socket.emit("errorMessage", "Name is required");
     return;
   }

    // Join socket.io room (for broadcasting)
    socket.join(room);

    // Create room if it does not exist
    if (!rooms[room]) {
      rooms[room] = {
        players: {},
        choices: {},
        round: 1,
        maxRounds: 5,
        playAgainVotes: {}
      };
  }
    

    // Limit room to 2 players
    if (Object.keys(rooms[room].players).length >= 2) {
      socket.emit("errorMessage", "Room is full");
      return;
    }

    // Save player info
    rooms[room].players[socket.id] = {
      name: name,
      score: 0
    };

    // Store room name on socket for easy access later
    socket.room = room;

    // Notify everyone in room about updated players
    io.to(room).emit("roomUpdate", rooms[room].players);
  });

  // Player sends their RPS choice
  
  socket.on("choice", (choice) => {
    const room = socket.room;
    if (!room) return;

    // STOP game if max rounds reached
    if (rooms[room].round > rooms[room].maxRounds) {
    return;
    }

    if (Object.keys(rooms[room].players).length < 2) {
      socket.emit("errorMessage", "Waiting for second player");
      return;
    }
    // Save player's choice
    rooms[room].choices[socket.id] = choice;

    // Only continue once BOTH players made a choice
    if (Object.keys(rooms[room].choices).length === 2) {

      // Get both player socket IDs
      const [id1, id2] = Object.keys(rooms[room].choices);

      // Get their choices
      const c1 = rooms[room].choices[id1];
      const c2 = rooms[room].choices[id2];

      // Determine winner (returns socketId or null)
      const winnerId = getWinner(id1, c1, id2, c2);

      // Increase score for winner (if not a draw)
      if (winnerId) {
        rooms[room].players[winnerId].score++;
      }

      // Send updated scores to everyone in the room
      io.to(room).emit("roomUpdate", rooms[room].players);

      // Advance to next round
      rooms[room].round++;

      

      // Send results to both players
      io.to(id1).emit(
        "result",
        buildResult(room, id1, id2, c1, c2, winnerId)
      );

      io.to(id2).emit(
        "result",
        buildResult(room, id2, id1, c2, c1, winnerId)
      );

      // Clear choices for next round
      rooms[room].choices = {};

      // CHECK IF GAME IS OVER
      if (rooms[room].round > rooms[room].maxRounds) {
         endGame(room);
         return;
      }
    }
  });
   
 // Player asks to play again
socket.on("playAgain", () => {
  const room = socket.room;
  if (!room || !rooms[room]) return;

  const players = rooms[room].players;
  const playerName = players[socket.id].name;

  // Mark this player as WANTING to play again
  rooms[room].playAgainVotes[socket.id] = true;

  // Ask the other player
  socket.to(room).emit("playAgainRequest", {
    from: playerName
  });
});

// Player ACCEPTS replay
socket.on("acceptPlayAgain", () => {
  const room = socket.room;
  if (!room || !rooms[room]) return;

  rooms[room].playAgainVotes[socket.id] = true;

  // If BOTH accepted → restart
  if (Object.keys(rooms[room].playAgainVotes).length === 2) {
    restartGame(room);
  }
});

// Player REJECTS replay
socket.on("rejectPlayAgain", () => {
  const room = socket.room;
  if (!room || !rooms[room]) return;

  const name = rooms[room].players[socket.id].name;

  // Clear votes
  rooms[room].playAgainVotes = {};

  io.to(room).emit("playAgainRejected", {
    by: name
  });
});


  /**
   * Handle player disconnect
   */
  socket.on("disconnect", () => {
    const room = socket.room;
    if (!room || !rooms[room]) return;

    // Remove player data
    delete rooms[room].players[socket.id];
    delete rooms[room].choices[socket.id];

    // Notify remaining players
    io.to(room).emit("roomUpdate", rooms[room].players);

    // Delete room if empty
    if (Object.keys(rooms[room].players).length === 0) {
      delete rooms[room];
    }

    console.log("Player disconnected:", socket.id);
  });
});

/* ---------- Game Logic ---------- */

/**
 * Determines the winner of a round
 *
 * @param id1 socket ID of player 1
 * @param c1 choice of player 1
 * @param id2 socket ID of player 2
 * @param c2 choice of player 2
 * @returns socketId of winner OR null for draw
 */
function getWinner(id1, c1, id2, c2) {
  // Draw case
  if (c1 === c2) return null;

  // What each choice beats
  const wins = {
    rock: "scissors",
    scissors: "paper",
    paper: "rock"
  };

  // If player 1 wins, return id1; otherwise id2
  return wins[c1] === c2 ? id1 : id2;
}

  const choiceEmoji = {
  rock: "🪨",
  paper: "📄",
  scissors: "✂️"
 };

/**
 * Builds the result object sent to a player
 */
function buildResult(room, you, opp, yourChoice, oppChoice, winnerId) {
  const players = rooms[room].players;

  let resultText = "Draw!";
  if (winnerId) {
    resultText = winnerId === you ? "You win!" : "You lose!";
  }

  return {
    yourChoice: choiceEmoji[yourChoice],
    opponentChoice: choiceEmoji[oppChoice],
    opponentName: players[opp].name,
    yourScore: players[you].score,
    opponentScore: players[opp].score,
    result: resultText,
    round: rooms[room].round - 1,   // because we incremented already
    maxRounds: rooms[room].maxRounds
  };
}

function endGame(room) {
  const players = rooms[room].players;
  const ids = Object.keys(players);

  const p1 = players[ids[0]];
  const p2 = players[ids[1]];

  let winnerText = "It's a draw!";
  if (p1.score > p2.score) winnerText = `${p1.name} wins the game!`;
  if (p2.score > p1.score) winnerText = `${p2.name} wins the game!`;

  io.to(room).emit("gameOver", {
    winnerText
  });
}

function restartGame(room) {
  rooms[room].round = 1;
  rooms[room].choices = {};
  rooms[room].playAgainVotes = {};

  for (const id in rooms[room].players) {
    rooms[room].players[id].score = 0;
  }

  io.to(room).emit("roomUpdate", rooms[room].players);
  io.to(room).emit("newGame");
}


/* ---------- Start Server ---------- */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

