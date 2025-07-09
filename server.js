const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// Initialisation
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware pour servir les fichiers statiques (HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

// Connexion Socket.IO
io.on('connection', (socket) => {
  console.log('Nouvelle connexion WebSocket :', socket.id);

  // Réception de la demande de rejoindre une room
  socket.on('joinRoom', ({ username, room }) => {
    socket.join(room);
    socket.data.username = username;
    socket.data.room = room;

    // Message de bienvenue
    socket.emit('chat message', `✅ Bienvenue ${username} dans le salon "${room}"`);

    // Notifier les autres utilisateurs du salon
    socket.to(room).emit('chat message', `ℹ️ ${username} a rejoint le salon`);
  });

  // Réception d'un message depuis le client
  socket.on('chat message', (msg) => {
    const { username, room } = socket.data;

    if (!username || !room) return; // sécurité

    // Diffusion du message dans le salon uniquement
    io.to(room).emit('chat message', `💬 ${username} : ${msg}`);
  });

  // Déconnexion
  socket.on('disconnect', () => {
    const { username, room } = socket.data || {};
    if (username && room) {
      socket.to(room).emit('chat message', `❌ ${username} a quitté le salon`);
    }
  });
});

// Lancer le serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});
