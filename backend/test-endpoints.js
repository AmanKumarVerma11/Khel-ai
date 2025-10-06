const http = require('http');

// Test configuration
const BASE_URL = 'http://localhost:5000';
const TEST_MATCH_ID = 'test-match';

/**
 * Make HTTP request helper
 */
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user'
      }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

/**
 * Test the POST /api/update endpoint
 */
async function testUpdateEndpoint() {
  console.log('\n=== Testing POST /api/update endpoint ===');
  
  try {
    // Test valid score update
    const response1 = await makeRequest('POST', '/api/update', {
      over: 1,
      ball: 1,
      runs: 4,
      wicket: false,
      matchId: TEST_MATCH_ID
    });
    
    console.log('✓ Valid score update:', response1.status, response1.data.success ? 'SUCCESS' : 'FAILED');
    if (response1.data.data) {
      console.log('  Score:', response1.data.data.currentScore);
    }

    // Test another score update
    const response2 = await makeRequest('POST', '/api/update', {
      over: 1,
      ball: 2,
      runs: 6,
      wicket: false,
      matchId: TEST_MATCH_ID
    });
    
    console.log('✓ Second score update:', response2.status, response2.data.success ? 'SUCCESS' : 'FAILED');
    if (response2.data.data) {
      console.log('  Score:', response2.data.data.currentScore);
    }

    // Test correction (update same ball with different runs)
    const response3 = await makeRequest('POST', '/api/update', {
      over: 1,
      ball: 2,
      runs: 0,
      wicket: false,
      matchId: TEST_MATCH_ID
    });
    
    console.log('✓ Score correction:', response3.status, response3.data.success ? 'SUCCESS' : 'FAILED');
    if (response3.data.data) {
      console.log('  Score after correction:', response3.data.data.currentScore);
      console.log('  Is correction:', response3.data.data.isCorrection);
    }

    // Test invalid data
    const response4 = await makeRequest('POST', '/api/update', {
      over: 0,
      ball: 7,
      runs: 10
    });
    
    console.log('✓ Invalid data test:', response4.status, response4.data.success ? 'UNEXPECTED SUCCESS' : 'EXPECTED FAILURE');
    if (response4.data.error) {
      console.log('  Error:', response4.data.error.message);
    }

  } catch (error) {
    console.error('✗ Error testing update endpoint:', error.message);
  }
}

/**
 * Test the GET /api/simulate endpoint
 */
async function testSimulateEndpoint() {
  console.log('\n=== Testing GET /api/simulate endpoint ===');
  
  try {
    const response = await makeRequest('GET', `/api/simulate?matchId=${TEST_MATCH_ID}&delay=1000`);
    
    console.log('✓ Simulation start:', response.status, response.data.success ? 'SUCCESS' : 'FAILED');
    if (response.data.data) {
      console.log('  Match ID:', response.data.data.matchId);
      console.log('  Sequence:', response.data.data.sequence);
      console.log('  Started at:', response.data.data.startedAt);
    }

    // Wait a bit for simulation to process some events
    console.log('  Waiting 5 seconds for simulation to process...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check simulation status
    const statusResponse = await makeRequest('GET', `/api/simulate/status?matchId=${TEST_MATCH_ID}`);
    console.log('✓ Simulation status:', statusResponse.status, statusResponse.data.success ? 'SUCCESS' : 'FAILED');
    if (statusResponse.data.data) {
      console.log('  Current score:', statusResponse.data.data.currentScore);
      console.log('  Simulated events:', statusResponse.data.data.simulatedEventsCount);
    }

  } catch (error) {
    console.error('✗ Error testing simulate endpoint:', error.message);
  }
}

/**
 * Test the GET /api/score endpoint
 */
async function testScoreEndpoint() {
  console.log('\n=== Testing GET /api/score endpoint ===');
  
  try {
    const response = await makeRequest('GET', `/api/score?matchId=${TEST_MATCH_ID}`);
    
    console.log('✓ Get score:', response.status, response.data.success ? 'SUCCESS' : 'FAILED');
    if (response.data.data) {
      console.log('  Match ID:', response.data.data.matchId);
      console.log('  Score:', response.data.data.score);
      console.log('  Balls faced:', response.data.data.ballsFaced);
      console.log('  Last event:', response.data.data.lastEvent?.key);
    }

  } catch (error) {
    console.error('✗ Error testing score endpoint:', error.message);
  }
}

/**
 * Test the GET /api/events endpoint
 */
async function testEventsEndpoint() {
  console.log('\n=== Testing GET /api/events endpoint ===');
  
  try {
    const response = await makeRequest('GET', `/api/events?matchId=${TEST_MATCH_ID}&limit=10`);
    
    console.log('✓ Get events:', response.status, response.data.success ? 'SUCCESS' : 'FAILED');
    if (response.data.data) {
      console.log('  Match ID:', response.data.data.matchId);
      console.log('  Event count:', response.data.data.count);
      console.log('  Recent events:');
      response.data.data.events.slice(0, 3).forEach(event => {
        console.log(`    ${event.key}: ${event.runs} runs${event.wicket ? ' + wicket' : ''} (${event.eventType})`);
      });
    }

  } catch (error) {
    console.error('✗ Error testing events endpoint:', error.message);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('Starting API endpoint tests...');
  console.log('Make sure the server is running on port 5000');
  
  // Wait a moment for server to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testUpdateEndpoint();
  await testScoreEndpoint();
  await testEventsEndpoint();
  await testSimulateEndpoint();
  
  console.log('\n=== Tests completed ===');
  console.log('Check the server logs for Socket.io broadcast messages');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, makeRequest };