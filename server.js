import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir le dossier public
app.use(express.static("public"));

// Quand un joueur se connecte
io.on("connection", (socket) => {
  console.log("🟢 Joueur connecté :", socket.id);

  socket.on("swing", (data) => {
    // Répercuter la poussée à tous les autres joueurs
    socket.broadcast.emit("swing", data);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Joueur déconnecté :", socket.id);
  });
});

// Lancer le serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
});

 
