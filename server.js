const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Store waiting users
let waitingUsers = [];

io.on('connection', (socket) => {
  console.log('👤 MeetOne User connected:', socket.id);

  // Handle user looking for a partner
  socket.on('find-partner', () => {
    console.log('🔍 User looking for partner:', socket.id);
    
    // Remove from waiting list if already there
    waitingUsers = waitingUsers.filter(id => id !== socket.id);
    
    if (waitingUsers.length > 0) {
      // Match with waiting user
      const partnerId = waitingUsers.shift();
      
      // Create a room for them
      const roomId = `${socket.id}-${partnerId}`;
      socket.join(roomId);
      io.sockets.sockets.get(partnerId)?.join(roomId);
      
      // Notify both users
      io.to(roomId).emit('partner-found', roomId);
      
      console.log('✅ Match made on MeetOne:', socket.id, 'with', partnerId);
    } else {
      // Add to waiting list
      waitingUsers.push(socket.id);
      console.log('⏳ User added to waiting list:', socket.id);
    }
  });

  // Handle WebRTC signaling
  socket.on('signal', (data) => {
    const { target, signal } = data;
    io.to(target).emit('signal', {
      signal: signal,
      from: socket.id
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('👋 MeetOne User disconnected:', socket.id);
    
    // Remove from waiting list
    waitingUsers = waitingUsers.filter(id => id !== socket.id);
    
    // Notify partner if in a call
    const rooms = Array.from(socket.rooms);
    rooms.forEach(room => {
      if (room !== socket.id) {
        socket.to(room).emit('partner-disconnected');
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
🚀 MeetOne Server is running!
🌐 Port: ${PORT}
📱 Ready to connect people!
  `);
});