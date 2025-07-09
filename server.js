require('dotenv').config();

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);

const path = require('path');
const session = require('express-session');

const PORT = process.env.PORT || 3000;

const adminUser = process.env.ADMIN_USER;
const adminPass = process.env.ADMIN_PASS;

app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'secretadmin',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,     // passer a true pour la prod
    maxAge: 60 * 60 * 1000
  }
}));

const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3, 
  message: "Trop de tentatives, veuillez réessayer plus tard."
});

app.get('/admin.html', (req, res, next) => {
  if (req.session.isAdmin) {
    next(); 
  } else {
    res.redirect('/admin_login.html');
  }
});

app.post('/admin_login', loginLimiter, (req, res) => {
  const { username, password } = req.body;

  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    req.session.isAdmin = true;
    res.redirect('/admin.html');
  } else {
    res.redirect('/admin_login.html?error=1');
  }
});

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

io.on('connection', (socket) => {
  socket.on('join room', ({ username, room }) => {
    socket.username = username;
    socket.room = room;
    socket.join(room);

    if (!rooms.has(room)) rooms.set(room, new Set());
    rooms.get(room).add(username);

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
      const roomSet = rooms.get(socket.room);
      if (roomSet) {
        roomSet.delete(socket.username);
        if (roomSet.size === 0) rooms.delete(socket.room);
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
  for (const [room, users] of rooms.entries()) {
    result.push({ room, users: Array.from(users) });
  }
  return result;
}

http.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});
