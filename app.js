import express from 'express';
const app = express();
import http from 'http';
const server = http.createServer(app);
import {Server} from 'socket.io';
const io = new Server(server, {cors: {origin: ['https://chat-app-front-end-pi.vercel.app', 'http://localhost:8000', 'http://localhost:4173', 'https://localhost:8000']}});
import cookieParser from 'cookie-parser';
import indexRouter from './routes/index.js';
import cors from 'cors';
import crypto from 'crypto';

const randomId = () => crypto.randomBytes(8).toString('hex');

app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(cors());

app.use('/', indexRouter);

import {InMemorySessionStore} from './sessionStore.js';
const sessionStore = new InMemorySessionStore();

import {InMemoryMessageStore} from './messageStore.js';
const messageStore = new InMemoryMessageStore();

io.use((socket, next) => {
  const sessionID = socket.handshake.auth.sessionID;
  if (sessionID) {
    const session = sessionStore.findSession(sessionID);

    if (session) {
      socket.sessionID = sessionID;
      socket.userId = session.userId;
      socket.username = session.username;
      socket.picture = session.picture;
      return next();
    }
  }
  const username = socket.handshake.auth.user.email;

  if (!username) {
    console.log('Invalid name');
    return next(new Error('Invalid username'));
  }
  socket.username = username;
  socket.sessionID = socket.handshake.auth.user.sub;
  socket.userId = socket.handshake.auth.user.sub;
  socket.picture = socket.handshake.auth.user.picture;
  next();
});

io.on('connection', (socket) => {
  sessionStore.saveSession(socket.sessionID, {
    userId: socket.userId,
    username: socket.username,
    picture: socket.picture,
    connected: true,
  });

  socket.emit('session', {
    sessionID: socket.sessionID,
    userId: socket.userId,
    picture: socket.picture,
  });

  socket.join(socket.userId);

  const users = [];
  const messagesPerUser = new Map();
  messageStore.findMessagesForUser(socket.userId).forEach((message) => {
    const {from, to} = message;
    const otherUser = socket.userId === from ? to : from;
    if (messagesPerUser.has(otherUser)) {
      messagesPerUser.get(otherUser).push(message);
    } else {
      messagesPerUser.set(otherUser, [message]);
    }
  });
  sessionStore.findAllSessions().forEach((session) => {
    users.push({
      userId: session.userId,
      username: session.username,
      connected: session.connected,
      picture: session.picture,
      messages: messagesPerUser.get(session.userId) || [],
    });
  });

  socket.emit('users', users);

  socket.broadcast.emit('user connected', {
    userId: socket.userId,
    username: socket.username,
    picture: socket.picture,
    connected: true,
  });

  socket.on('private message', ({content, to}) => {
    const message = {
      content,
      from: socket.userId,
      to,
    };
    socket.to(to).to(socket.userId).emit('private message', message);
    messageStore.saveMessage(message);
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected');
    const matchingSockets = await io.in(socket.userId).allSockets();
    const isDisconnected = matchingSockets.size === 0;
    if (isDisconnected) {
      socket.broadcast.emit('user disconnected', socket.userId);
      sessionStore.saveSession(socket.sessionID, {
        userId: socket.userId,
        username: socket.username,
        picture: socket.picture,
        connected: false,
      });
    }
  });
});
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});

export default app;
