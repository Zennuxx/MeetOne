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

// Serve static files from current directory
app.use(express.static(path.join(__dirname)));

// Explicitly serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Store waiting users
let waitingUsers = [];

io.on('connection', (socket) => {
  console.log('👤 MeetOne User connected:', socket.id);

  // Handle user looking for a partner
  socket.on('find-partner', () => {
    console.log('🔍 User looking for partner:', socket.id);
    
    waitingUsers = waitingUsers.filter(id => id !== socket.id);
    
    if (waitingUsers.length > 0) {
      const partnerId = waitingUsers.shift();
      
      const roomId = `${socket.id}-${partnerId}`;
      socket.join(roomId);
      io.sockets.sockets.get(partnerId)?.join(roomId);
      
      io.to(roomId).emit('partner-found', roomId);
      
      console.log('✅ Match made on MeetOne:', socket.id, 'with', partnerId);
    } else {
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
    
    waitingUsers = waitingUsers.filter(id => id !== socket.id);
    
    const rooms = Array.from(socket.rooms);
    rooms.forEach(room => {
      if (room !== socket.id) {
        socket.to(room).emit('partner-disconnected');
      }
    });
  });
});

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`
🚀 MeetOne Server is running!
🌐 Local: http://localhost:${PORT}
📱 Ready to connect people!
    `);
  });
}

// Export for Vercel
module.exports = app;