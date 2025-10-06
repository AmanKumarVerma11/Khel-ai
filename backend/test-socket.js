/**
 * Simple Socket.io test script
 * Tests the Socket.io server functionality
 */

const io = require('socket.io-client');

// Connect to the server
const socket = io('http://localhost:5000');

console.log('Connecting to Socket.io server...');

socket.on('connect', () => {
  console.log('✅ Connected to server with ID:', socket.id);
  
  // Test joining a match room
  console.log('🏏 Joining match room: test-match');
  socket.emit('join-match', 'test-match');
});

socket.on('match-joined', (data) => {
  console.log('✅ Successfully joined match:', data);
  
  // Test requesting current score
  console.log('📊 Requesting current score...');
  socket.emit('request-score', { matchId: 'test-match' });
});

socket.on('score-update', (data) => {
  console.log('📈 Received score update:', data);
});

socket.on('match-join-error', (error) => {
  console.error('❌ Error joining match:', error);
});

socket.on('score-request-error', (error) => {
  console.error('❌ Error requesting score:', error);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected from server:', reason);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
});

// Test for 10 seconds then disconnect
setTimeout(() => {
  console.log('🔌 Disconnecting from server...');
  socket.disconnect();
  process.exit(0);
}, 10000);