const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Create a new room
app.post("/api/rooms", (req, res) => {
  const roomId = crypto.randomBytes(4).toString("hex").toUpperCase();

  res.status(200).json({
    success: true,
    roomId,
  });
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("room:join", ({ email, room }) => {
    // notify existing members first, then join
    socket.to(room).emit("user:joined", { email, id: socket.id });
    socket.join(room);
    socket.emit("room:join", { email, room });
  });

  socket.on("user:call", ({ to, offer }) => {
    io.to(to).emit("incoming:call", { from: socket.id, offer });
  });

  socket.on("call:accepted", ({ to, ans }) => {
    io.to(to).emit("call:accepted", { from: socket.id, ans });
  });

  socket.on("peer:nego:needed", ({ to, offer }) => {
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
  });

  socket.on("peer:nego:done", ({ to, ans }) => {
    io.to(to).emit("peer:nego:final", { from: socket.id, ans });
  });

  // NEW: relay ICE candidates
  socket.on("ice:candidate", ({ to, candidate }) => {
    io.to(to).emit("ice:candidate", { from: socket.id, candidate });
  });

  socket.on("call:ended", ({ to }) => {
  io.to(to).emit("call:ended", {
    from: socket.id,
  });
});

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(8000, () => {
  console.log("Server running on http://localhost:8000");
});