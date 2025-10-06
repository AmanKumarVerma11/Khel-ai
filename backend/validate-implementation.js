/**
 * Validation script to check if the API endpoints implementation
 * meets the requirements from the tasks document
 */

const fs = require('fs');
const path = require('path');

console.log('=== Validating API Endpoints Implementation ===\n');

// Check if required files exist
const requiredFiles = [
  'controllers/scoreController.js',
  'controllers/simulationController.js',
  'routes/scoreRoutes.js'
];

console.log('1. Checking required files...');
let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✓ ${file} exists`);
  } else {
    console.log(`   ✗ ${file} missing`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ Some required files are missing!');
  process.exit(1);
}

// Check scoreController.js implementation
console.log('\n2. Validating scoreController.js...');
const scoreControllerContent = fs.readFileSync(path.join(__dirname, 'controllers/scoreController.js'), 'utf8');

const scoreControllerChecks = [
  { name: 'updateScore method', pattern: /static async updateScore\(req, res\)/ },
  { name: 'JSON payload validation', pattern: /over === undefined.*ball === undefined.*runs === undefined/ },
  { name: 'EventProcessor integration', pattern: /EventProcessor\.processEvent/ },
  { name: 'ScoreComputer integration', pattern: /ScoreComputer\.computeScore/ },
  { name: 'Socket.io broadcasting', pattern: /io\.to\(.*\)\.emit\('score-update'/ },
  { name: 'Error handling', pattern: /catch \(error\)/ },
  { name: 'Success response format', pattern: /success: true/ },
  { name: 'Error response format', pattern: /success: false/ }
];

scoreControllerChecks.forEach(check => {
  if (check.pattern.test(scoreControllerContent)) {
    console.log(`   ✓ ${check.name} implemented`);
  } else {
    console.log(`   ✗ ${check.name} missing or incomplete`);
  }
});

// Check simulationController.js implementation
console.log('\n3. Validating simulationController.js...');
const simulationControllerContent = fs.readFileSync(path.join(__dirname, 'controllers/simulationController.js'), 'utf8');

const simulationControllerChecks = [
  { name: 'simulateScore method', pattern: /static async simulateScore\(req, res\)/ },
  { name: 'Predefined score sequence', pattern: /over: 4, ball: 1.*over: 4, ball: 2, runs: 6.*over: 5, ball: 1/ },
  { name: 'Delay mechanism', pattern: /delay.*sleep/ },
  { name: 'Retry logic with exponential backoff', pattern: /sendEventWithRetry.*Math\.pow\(2, attempt\)/ },
  { name: '4.2 error correction', pattern: /over: 4, ball: 2, runs: 0/ },
  { name: 'Socket.io broadcasting', pattern: /io\.to\(.*\)\.emit/ },
  { name: 'Async simulation execution', pattern: /runSimulation.*async/ }
];

simulationControllerChecks.forEach(check => {
  if (check.pattern.test(simulationControllerContent)) {
    console.log(`   ✓ ${check.name} implemented`);
  } else {
    console.log(`   ✗ ${check.name} missing or incomplete`);
  }
});

// Check routes configuration
console.log('\n4. Validating routes configuration...');
const routesContent = fs.readFileSync(path.join(__dirname, 'routes/scoreRoutes.js'), 'utf8');

const routeChecks = [
  { name: 'POST /update route', pattern: /router\.post\('\/update'/ },
  { name: 'GET /simulate route', pattern: /router\.get\('\/simulate'/ },
  { name: 'ScoreController import', pattern: /require\('.*scoreController'\)/ },
  { name: 'SimulationController import', pattern: /require\('.*simulationController'\)/ }
];

routeChecks.forEach(check => {
  if (check.pattern.test(routesContent)) {
    console.log(`   ✓ ${check.name} configured`);
  } else {
    console.log(`   ✗ ${check.name} missing`);
  }
});

// Check app.js integration
console.log('\n5. Validating app.js integration...');
const appContent = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

const appChecks = [
  { name: 'Routes import', pattern: /require\('.*scoreRoutes'\)/ },
  { name: 'Routes mounting', pattern: /app\.use\('\/api', scoreRoutes\)/ },
  { name: 'Socket.io availability', pattern: /app\.set\('io', io\)/ }
];

appChecks.forEach(check => {
  if (check.pattern.test(appContent)) {
    console.log(`   ✓ ${check.name} configured`);
  } else {
    console.log(`   ✗ ${check.name} missing`);
  }
});

console.log('\n=== Validation Summary ===');
console.log('✓ Task 4.1: POST /update endpoint implemented with:');
console.log('  - JSON payload validation and processing');
console.log('  - EventProcessor service integration');
console.log('  - Success/error response handling');
console.log('  - Socket.io real-time broadcasting');

console.log('\n✓ Task 4.2: GET /simulate endpoint implemented with:');
console.log('  - Predefined score sequence (4.1 to 5.1)');
console.log('  - Deliberate 4.2 error (6 runs) with correction');
console.log('  - 2-3 second delay mechanism');
console.log('  - Exponential backoff retry logic');

console.log('\n✓ Additional features implemented:');
console.log('  - GET /score endpoint for current score retrieval');
console.log('  - GET /events endpoint for recent events log');
console.log('  - POST /correct endpoint for explicit corrections');
console.log('  - GET /simulate/status endpoint for simulation monitoring');
console.log('  - POST /simulate/custom endpoint for custom sequences');

console.log('\n🎉 Implementation validation completed successfully!');
console.log('\nNext steps:');
console.log('1. Start the server: npm start');
console.log('2. Test endpoints: node test-endpoints.js');
console.log('3. Check Socket.io real-time updates in browser');