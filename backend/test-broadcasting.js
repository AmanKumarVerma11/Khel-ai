/**
 * Socket.io Broadcasting Test
 * Tests the score broadcasting functionality with multiple clients
 */

const io = require('socket.io-client');
const axios = require('axios');

const SERVER_URL = 'http://localhost:5000';
const API_URL = 'http://localhost:5000/api';

async function testBroadcasting() {
  console.log('🧪 Starting Socket.io Broadcasting Test\n');

  // Create two client connections
  const client1 = io(SERVER_URL);
  const client2 = io(SERVER_URL);
  
  let client1Connected = false;
  let client2Connected = false;
  let client1Updates = 0;
  let client2Updates = 0;

  // Client 1 setup
  client1.on('connect', () => {
    console.log('✅ Client 1 connected:', client1.id);
    client1Connected = true;
    client1.emit('join-match', 'broadcast-test');
  });

  client1.on('match-joined', (data) => {
    console.log('🏏 Client 1 joined match:', data.matchId);
  });

  client1.on('score-update', (data) => {
    client1Updates++;
    console.log(`📈 Client 1 received update #${client1Updates}:`, {
      runs: data.score.runs,
      wickets: data.score.wickets,
      overs: data.score.overs,
      lastEvent: data.lastEvent?.key
    });
  });

  // Client 2 setup
  client2.on('connect', () => {
    console.log('✅ Client 2 connected:', client2.id);
    client2Connected = true;
    client2.emit('join-match', 'broadcast-test');
  });

  client2.on('match-joined', (data) => {
    console.log('🏏 Client 2 joined match:', data.matchId);
  });

  client2.on('score-update', (data) => {
    client2Updates++;
    console.log(`📈 Client 2 received update #${client2Updates}:`, {
      runs: data.score.runs,
      wickets: data.score.wickets,
      overs: data.score.overs,
      lastEvent: data.lastEvent?.key
    });
  });

  // Wait for both clients to connect
  await new Promise(resolve => {
    const checkConnections = setInterval(() => {
      if (client1Connected && client2Connected) {
        clearInterval(checkConnections);
        resolve();
      }
    }, 100);
  });

  console.log('\n🚀 Both clients connected, starting score updates...\n');

  // Send some score updates via API
  const scoreUpdates = [
    { over: 1, ball: 1, runs: 4, wicket: false },
    { over: 1, ball: 2, runs: 0, wicket: false },
    { over: 1, ball: 3, runs: 6, wicket: false },
    { over: 1, ball: 4, runs: 1, wicket: true }
  ];

  for (let i = 0; i < scoreUpdates.length; i++) {
    const update = { ...scoreUpdates[i], matchId: 'broadcast-test' };
    
    console.log(`📤 Sending score update ${i + 1}:`, update);
    
    try {
      const response = await axios.post(`${API_URL}/update`, update);
      console.log(`✅ API Response: ${response.data.message}`);
    } catch (error) {
      console.error(`❌ API Error:`, error.response?.data || error.message);
    }

    // Wait a bit between updates
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Wait for all broadcasts to be received
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n📊 Test Results:');
  console.log(`Client 1 received ${client1Updates} updates`);
  console.log(`Client 2 received ${client2Updates} updates`);
  console.log(`Expected: ${scoreUpdates.length} updates each`);

  const success = client1Updates === scoreUpdates.length && 
                  client2Updates === scoreUpdates.length;

  console.log(`\n${success ? '✅ Test PASSED' : '❌ Test FAILED'}: Broadcasting working correctly`);

  // Test correction broadcasting
  console.log('\n🔧 Testing correction broadcasting...');
  
  try {
    const correction = {
      over: 1,
      ball: 3,
      runs: 0, // Correcting from 6 to 0
      wicket: false,
      matchId: 'broadcast-test',
      reason: 'Test correction'
    };

    console.log('📤 Sending correction:', correction);
    const response = await axios.post(`${API_URL}/correct`, correction);
    console.log('✅ Correction API Response:', response.data.message);

    // Wait for correction broadcast
    await new Promise(resolve => setTimeout(resolve, 1000));

  } catch (error) {
    console.error('❌ Correction Error:', error.response?.data || error.message);
  }

  // Get final connection stats
  try {
    const statsResponse = await axios.get(`${API_URL}/socket/stats`);
    console.log('\n📈 Final Connection Stats:', statsResponse.data.data);
  } catch (error) {
    console.error('❌ Stats Error:', error.message);
  }

  // Cleanup
  console.log('\n🔌 Disconnecting clients...');
  client1.disconnect();
  client2.disconnect();
  
  console.log('✅ Broadcasting test completed\n');
}

// Run the test
if (require.main === module) {
  testBroadcasting().catch(error => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testBroadcasting };