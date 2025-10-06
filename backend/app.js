const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const { initializeDatabase, cleanupDatabase } = require('./utils/initDatabase');
const SocketManager = require('./services/socketManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ["https://your-app-name.vercel.app"] 
      : ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Initialize Socket Manager
const socketManager = new SocketManager(io);

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ["https://your-app-name.vercel.app"] 
    : ["http://localhost:3000"],
  credentials: true
}));
app.use(express.json());

// Make io instance and socketManager available to routes
app.set('io', io);
app.set('socketManager', socketManager);

// Routes
const scoreRoutes = require('./routes/scoreRoutes');
app.use('/api', scoreRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Cricket Score Tracker API' });
});

// Socket.io connection handling is now managed by SocketManager

const PORT = process.env.PORT || 5000;

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connection and indexes
    await initializeDatabase();
    
    // Start the server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Database initialized and ready for connections');
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  try {
    await cleanupDatabase();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('Error during shutdown:', error.message);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  try {
    await cleanupDatabase();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('Error during shutdown:', error.message);
    process.exit(1);
  }
});

// Start the server
startServer();

module.exports = { app, io };