require('dotenv').config();

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const PORT = process.env.PORT || 3000;
const adminUser = process.env.ADMIN_USER;
const adminPass = process.env.ADMIN_PASS;
const usersFile = path.join(__dirname, 'users.json');
const roomsFile = path.join(__dirname, 'rooms.json');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'secretadmin',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // true en production avec HTTPS
    maxAge: 60 * 60 * 1000
  }
}));

// Limiteur de tentative de connexion
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: "Trop de tentatives, veuillez réessayer plus tard."
});

// --- Gestion des salons dans fichier JSON ---

function loadRooms() {
  if (!fs.existsSync(roomsFile)) {
    fs.writeFileSync(roomsFile, JSON.stringify([]));
  }
  const data = fs.readFileSync(roomsFile);
  return JSON.parse(data);
}

function saveRooms(rooms) {
  fs.writeFileSync(roomsFile, JSON.stringify(rooms, null, 2));
}

// --- Routes existantes ---

// Authentification unique (admin + user)
app.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;

  // Vérification admin
  if (username === adminUser && password === adminPass) {
    req.session.isAdmin = true;
    return res.redirect('/admin.html');
  }

  // Vérification utilisateur normal
  if (!username || !password) return res.redirect('/?error=1');

  let users = {};
  if (fs.existsSync(usersFile)) {
    users = JSON.parse(fs.readFileSync(usersFile));
  }

  if (users[username] && users[username].password === password) {
    return res.redirect(`/home_user.html?username=${encodeURIComponent(username)}`);
  }

  return res.redirect('/?error=1');
});

// Accès sécurisé à admin.html
app.get('/admin.html', (req, res, next) => {
  if (req.session.isAdmin) {
    next(); // autorisé
  } else {
    res.redirect('/admin_login.html');
  }
});

// Création de compte utilisateur
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).send('Champs requis');
  }

  let users = {};
  if (fs.existsSync(usersFile)) {
    users = JSON.parse(fs.readFileSync(usersFile));
  }

  if (users[username]) {
    return res.send('<script>alert("Ce nom d\'utilisateur est déjà pris."); window.location.href="/register.html";</script>');
  }

  users[username] = { password };
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

  res.send('<script>alert("Compte créé avec succès ! Vous pouvez maintenant vous connecter."); window.location.href="/";</script>');
});

// Fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// --- Nouvelles routes API pour gestion des salons ---

// Récupérer la liste des salons d’un utilisateur
app.get('/api/user-rooms', (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json([]);

  const rooms = loadRooms();

  const userRooms = rooms
    .filter(r => r.users.includes(username))
    .map(r => ({
      name: r.name,
      isOwner: r.owner === username
    }));

  res.json(userRooms);
});

// Créer un salon
app.post('/api/create-room', (req, res) => {
  const { roomName, username } = req.body;
  if (!roomName || !username) return res.status(400).send('Champs requis');

  let rooms = loadRooms();

  if (rooms.find(r => r.name === roomName)) {
    return res.status(409).send('Salon existe déjà');
  }

  rooms.push({
    name: roomName,
    owner: username,
    users: [username]
  });

  saveRooms(rooms);
  res.status(201).send('Salon créé');
});

// Rejoindre un salon
app.post('/api/join-room', (req, res) => {
  const { roomName, username } = req.body;
  if (!roomName || !username) return res.status(400).send('Champs requis');

  let rooms = loadRooms();
  const room = rooms.find(r => r.name === roomName);

  if (!room) return res.status(404).send('Salon non trouvé');

  if (!room.users.includes(username)) {
    room.users.push(username);
    saveRooms(rooms);
  }

  res.status(200).send('Rejoint salon');
});

// Supprimer un salon (seul propriétaire)
app.post('/api/delete-room', (req, res) => {
  const { roomName, username } = req.body;
  if (!roomName || !username) return res.status(400).send('Champs requis');

  let rooms = loadRooms();
  const roomIndex = rooms.findIndex(r => r.name === roomName);

  if (roomIndex === -1) return res.status(404).send('Salon non trouvé');

  if (rooms[roomIndex].owner !== username) {
    return res.status(403).send('Non autorisé');
  }

  rooms.splice(roomIndex, 1);
  saveRooms(rooms);
  res.status(200).send('Salon supprimé');
});

// --- WebSocket (Socket.io) ---

const roomsMap = new Map();

io.on('connection', (socket) => {
  socket.on('join room', ({ username, room }) => {
    socket.username = username;
    socket.room = room;
    socket.join(room);

    if (!roomsMap.has(room)) roomsMap.set(room, new Set());
    roomsMap.get(room).add(username);

    socket.to(room).emit('chat message', {
      user: 'Système',
      text: `${username} a rejoint le salon.`,
    });

    io.emit('update rooms', getRoomData());
  });

  socket.on('chat message', (msg) => {
    if (socket.room && socket.username) {
      io.to(socket.room).emit('chat message', {
        user: socket.username,
        text: msg,
      });
    }
  });

  socket.on('disconnect', () => {
    if (socket.room && socket.username) {
      const roomSet = roomsMap.get(socket.room);
      if (roomSet) {
        roomSet.delete(socket.username);
        if (roomSet.size === 0) roomsMap.delete(socket.room);
      }

      socket.to(socket.room).emit('chat message', {
        user: 'Système',
        text: `${socket.username} a quitté le salon.`,
      });

      io.emit('update rooms', getRoomData());
    }
  });
});

function getRoomData() {
  const result = [];
  for (const [room, users] of roomsMap.entries()) {
    result.push({ room, users: Array.from(users) });
  }
  return result;
}

// Démarrage serveur
http.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});
