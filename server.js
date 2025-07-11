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

const roomsData = new Map();
const rooms = new Map();
const roomMessages = new Map(); 


app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'secretadmin',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    maxAge: 60 * 60 * 1000
  }
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: "Trop de tentatives, veuillez réessayer plus tard."
});




// route d'authentification
app.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;

  if (username === adminUser && password === adminPass) {
    req.session.isAdmin = true;
    return res.redirect('/admin.html');
  }

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

app.get('/admin.html', (req, res, next) => {
  if (req.session.isAdmin) {
    next();
  } else {
    res.redirect('/?error=unauthorized');
  }
});

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



// API room
app.get('/api/user-rooms', (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: 'Username required' });

  const rooms = [];
  for (const [roomName, data] of roomsData.entries()) {
    rooms.push({
      name: roomName,
      owner: data.owner,
      isOwner: data.owner === username
    });
  }
  res.json(rooms);
});

app.get('/api/admin-rooms', (req, res) => {
  const rooms = readJSON('rooms.json');
  const result = Object.values(rooms).map(room => ({
    name: room.name,
    owner: room.owner,
    users: room.users.length,
  }));
  res.json(result);
});

app.post('/api/create-room', (req, res) => {
  const { roomName, username } = req.body;
  if (!roomName || !username) return res.status(400).json({ error: 'Missing parameters' });

  if (roomsData.has(roomName)) {
    return res.status(409).json({ error: 'Room already exists' });
  }

  roomsData.set(roomName, { owner: username, users: new Set() });
  return res.status(201).json({ message: 'Room created' });
});

app.post('/api/join-room', (req, res) => {
  const { roomName, username } = req.body;
  if (!roomName || !username) return res.status(400).json({ error: 'Missing parameters' });

  const room = roomsData.get(roomName);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  room.users.add(username);
  return res.status(200).json({ message: 'Joined room' });
});

app.post('/api/delete-room', (req, res) => {
  const { roomName, username } = req.body;
  if (!roomName || !username) return res.status(400).json({ error: 'Missing parameters' });

  const room = roomsData.get(roomName);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  if (room.owner !== username && username !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  roomsData.delete(roomName);
  return res.status(200).json({ message: 'Room deleted' });
});

app.use(express.static(path.join(__dirname, 'public')));



// Socket.io
io.on('connection', (socket) => {
  socket.on('join room', ({ username, room }) => {
    if (!username || !room) return;

    socket.username = username;
    socket.room = room;
    socket.join(room);

    const isAdminViewer = username === 'admin_viewer';

    if (!rooms.has(room)) rooms.set(room, new Set());
    rooms.get(room).add(username);

    if (!roomMessages.has(room)) {
      roomMessages.set(room, []);
    }
    socket.emit('chat history', roomMessages.get(room));

    if (!isAdminViewer) {
      const systemMsg = {
        user: 'Système',
        text: `${username} a rejoint le salon.`,
        timestamp: new Date().toISOString()
      };
      roomMessages.get(room).push(systemMsg);
      socket.to(room).emit('chat message', systemMsg);
    }

    io.emit('update rooms', getRoomData());
  });

  socket.on('chat message', (msg) => {
    if (!socket.room || !socket.username || !msg.trim()) return;

    if (socket.username === 'admin_viewer') return;

    const messageData = {
      user: socket.username,
      text: msg,
      timestamp: new Date().toISOString(),
    };

    if (!roomMessages.has(socket.room)) {
      roomMessages.set(socket.room, []);
    }
    roomMessages.get(socket.room).push(messageData);

    io.to(socket.room).emit('chat message', messageData);
  });

  socket.on('disconnect', () => {
    if (socket.room && socket.username) {
      const roomSet = rooms.get(socket.room);
      if (roomSet) {
        roomSet.delete(socket.username);
        if (roomSet.size === 0) rooms.delete(socket.room);
      }

      if (socket.username !== 'admin_viewer') {
        const systemMsg = {
          user: 'Système',
          text: `${socket.username} a quitté le salon.`,
          timestamp: new Date().toISOString()
        };
        if (roomMessages.has(socket.room)) {
          roomMessages.get(socket.room).push(systemMsg);
        }
        socket.to(socket.room).emit('chat message', systemMsg);
      }

      io.emit('update rooms', getRoomData());
    }
  });
});

function getRoomData() {
  const result = [];
  for (const [room, users] of rooms.entries()) {
    result.push({ room, users: Array.from(users) });
  }
  return result;
}

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

// Lancer le serveur
http.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});
