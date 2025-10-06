#!/usr/bin/env node

/**
 * Standalone Cricket Score Simulation Script
 * 
 * This script sends HTTP requests to the backend API to simulate cricket scores.
 * It implements the same score sequence as the API endpoint with configurable parameters.
 * 
 * Usage:
 *   node simulate.js [options]
 * 
 * Options:
 *   --matchId <id>     Match ID to simulate (default: "default")
 *   --delay <ms>       Delay between events in milliseconds (default: 2500)
 *   --maxRetries <n>   Maximum retry attempts per event (default: 3)
 *   --baseUrl <url>    Backend server URL (default: "http://localhost:5000")
 *   --help             Show help information
 * 
 * Examples:
 *   node simulate.js
 *   node simulate.js --matchId "match-001" --delay 1000
 *   node simulate.js --baseUrl "http://localhost:3001" --maxRetries 5
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

class CricketScoreSimulator {
  constructor(options = {}) {
    this.matchId = options.matchId || 'default';
    this.delay = parseInt(options.delay) || 2500;
    this.maxRetries = parseInt(options.maxRetries) || 3;
    this.baseUrl = options.baseUrl || 'http://localhost:5000';
    
    // Validate configuration
    this.validateConfig();
    
    console.log('Cricket Score Simulator initialized with:');
    console.log(`  Match ID: ${this.matchId}`);
    console.log(`  Delay: ${this.delay}ms`);
    console.log(`  Max Retries: ${this.maxRetries}`);
    console.log(`  Backend URL: ${this.baseUrl}`);
    console.log('');
  }

  /**
   * Validate configuration parameters
   */
  validateConfig() {
    if (this.delay < 100) {
      throw new Error('Delay must be at least 100ms');
    }
    
    if (this.maxRetries < 1 || this.maxRetries > 10) {
      throw new Error('Max retries must be between 1 and 10');
    }
    
    try {
      new URL(this.baseUrl);
    } catch (error) {
      throw new Error(`Invalid base URL: ${this.baseUrl}`);
    }
  }

  /**
   * Get the predefined score sequence
   * Same sequence as used in the backend simulation controller
   */
  getScoreSequence() {
    return [
      // Over 4
      { over: 4, ball: 1, runs: 1, wicket: false },
      { over: 4, ball: 2, runs: 6, wicket: false }, // Deliberate error (should be 0)
      { over: 4, ball: 3, runs: 0, wicket: false },
      { over: 4, ball: 4, runs: 4, wicket: false },
      { over: 4, ball: 5, runs: 2, wicket: false },
      { over: 4, ball: 6, runs: 1, wicket: false },
      
      // Over 5
      { over: 5, ball: 1, runs: 0, wicket: true }
    ];
  }

  /**
   * Get the correction event
   */
  getCorrectionEvent() {
    return { over: 4, ball: 2, runs: 0, wicket: false }; // Correct the error from 6 to 0 runs
  }

  /**
   * Send HTTP POST request to the backend
   */
  async sendHttpRequest(path, data) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const postData = JSON.stringify(data);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Cricket-Score-Simulator/1.0'
        },
        timeout: 10000 // 10 second timeout
      };

      const req = httpModule.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData);
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                success: true,
                statusCode: res.statusCode,
                data: parsedData
              });
            } else {
              resolve({
                success: false,
                statusCode: res.statusCode,
                error: parsedData.error || { message: `HTTP ${res.statusCode}` }
              });
            }
          } catch (parseError) {
            resolve({
              success: false,
              statusCode: res.statusCode,
              error: { 
                message: 'Invalid JSON response',
                details: responseData.substring(0, 200)
              }
            });
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Send a single score event with retry logic
   */
  async sendEventWithRetry(eventData) {
    let attempt = 0;
    let lastError = null;

    while (attempt < this.maxRetries) {
      try {
        attempt++;
        console.log(`  Attempt ${attempt}/${this.maxRetries} for event ${eventData.over}.${eventData.ball}`);

        const requestData = {
          over: eventData.over,
          ball: eventData.ball,
          runs: eventData.runs,
          wicket: eventData.wicket,
          matchId: this.matchId
        };

        const response = await this.sendHttpRequest('/update', requestData);

        if (response.success) {
          console.log(`  ✓ Successfully processed event ${eventData.over}.${eventData.ball}`);
          
          if (response.data && response.data.data) {
            const { isCorrection, currentScore } = response.data.data;
            console.log(`    Score: ${currentScore.runs}/${currentScore.wickets} in ${currentScore.overs} overs${isCorrection ? ' (correction)' : ''}`);
          }
          
          return true;
        } else {
          throw new Error(`Server error: ${response.error.message || 'Unknown error'}`);
        }

      } catch (error) {
        lastError = error;
        console.log(`  ✗ Attempt ${attempt} failed: ${error.message}`);

        if (attempt < this.maxRetries) {
          // Exponential backoff: wait 2^attempt seconds
          const backoffDelay = Math.pow(2, attempt) * 1000;
          console.log(`    Waiting ${backoffDelay}ms before retry...`);
          await this.sleep(backoffDelay);
        }
      }
    }

    console.log(`  ✗ All ${this.maxRetries} attempts failed for event ${eventData.over}.${eventData.ball}`);
    console.log(`    Last error: ${lastError.message}`);
    return false;
  }

  /**
   * Sleep utility function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run the complete simulation sequence
   */
  async runSimulation() {
    try {
      console.log('Starting cricket score simulation...');
      console.log('=====================================');
      
      const scoreSequence = this.getScoreSequence();
      let successCount = 0;
      let failureCount = 0;

      // Process main score sequence
      console.log(`\nProcessing ${scoreSequence.length} events:`);
      
      for (let i = 0; i < scoreSequence.length; i++) {
        const event = scoreSequence[i];
        
        console.log(`\n[${i + 1}/${scoreSequence.length}] Simulating: ${event.over}.${event.ball} - ${event.runs} runs${event.wicket ? ' + wicket' : ''}`);

        const success = await this.sendEventWithRetry(event);
        
        if (success) {
          successCount++;
        } else {
          failureCount++;
        }

        // Add delay before next event (except for the last one)
        if (i < scoreSequence.length - 1) {
          console.log(`  Waiting ${this.delay}ms before next event...`);
          await this.sleep(this.delay);
        }
      }

      console.log('\n=====================================');
      console.log('Main sequence completed!');
      console.log(`Success: ${successCount}, Failures: ${failureCount}`);
      
      // Wait before sending correction
      console.log('\nWaiting 3 seconds before sending correction...');
      await this.sleep(3000);
      
      // Send correction for 4.2
      console.log('\n[CORRECTION] Correcting 4.2: changing 6 runs to 0 runs');
      const correctionEvent = this.getCorrectionEvent();
      const correctionSuccess = await this.sendEventWithRetry(correctionEvent);
      
      if (correctionSuccess) {
        console.log('\n✓ Correction applied successfully!');
        console.log('  The score should now reflect the corrected value.');
        console.log('  Previous: 4.2 with 6 runs → Current: 4.2 with 0 runs');
      } else {
        console.log('\n✗ Failed to apply correction');
        failureCount++;
      }

      // Final summary
      console.log('\n=====================================');
      console.log('SIMULATION COMPLETE');
      console.log('=====================================');
      console.log(`Match ID: ${this.matchId}`);
      console.log(`Total Events: ${scoreSequence.length + 1} (including correction)`);
      console.log(`Successful: ${correctionSuccess ? successCount + 1 : successCount}`);
      console.log(`Failed: ${correctionSuccess ? failureCount : failureCount + 1}`);
      console.log(`Completion Time: ${new Date().toISOString()}`);
      
      if (correctionSuccess && failureCount === 0) {
        console.log('\n🎉 All events processed successfully!');
        console.log('   Check your frontend to see the real-time updates.');
        return true;
      } else {
        console.log(`\n⚠️  Simulation completed with ${failureCount} failures.`);
        return false;
      }

    } catch (error) {
      console.error('\n❌ Simulation failed with error:', error.message);
      console.error('Stack trace:', error.stack);
      return false;
    }
  }

  /**
   * Test backend connectivity
   */
  async testConnection() {
    try {
      console.log('Testing backend connectivity...');
      
      // Try to send a simple test request
      const testEvent = { over: 999, ball: 1, runs: 0, wicket: false, matchId: 'test-connection' };
      const response = await this.sendHttpRequest('/update', testEvent);
      
      if (response.success || response.statusCode === 400) {
        // 400 is expected for invalid over number, but means server is responding
        console.log('✓ Backend is reachable');
        return true;
      } else {
        console.log(`✗ Backend responded with status ${response.statusCode}`);
        return false;
      }
    } catch (error) {
      console.log(`✗ Cannot reach backend: ${error.message}`);
      console.log('  Make sure the backend server is running on', this.baseUrl);
      return false;
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    } else if (arg === '--matchId' && i + 1 < args.length) {
      options.matchId = args[++i];
    } else if (arg === '--delay' && i + 1 < args.length) {
      options.delay = args[++i];
    } else if (arg === '--maxRetries' && i + 1 < args.length) {
      options.maxRetries = args[++i];
    } else if (arg === '--baseUrl' && i + 1 < args.length) {
      options.baseUrl = args[++i];
    } else if (arg.startsWith('--')) {
      console.error(`Unknown option: ${arg}`);
      console.error('Use --help for usage information');
      process.exit(1);
    }
  }
  
  return options;
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`
Cricket Score Simulation Script
===============================

This script simulates cricket score events by sending HTTP requests to the backend API.
It implements the same score sequence as the backend simulation endpoint.

Usage:
  node simulate.js [options]

Options:
  --matchId <id>     Match ID to simulate (default: "default")
  --delay <ms>       Delay between events in milliseconds (default: 2500)
  --maxRetries <n>   Maximum retry attempts per event (default: 3)
  --baseUrl <url>    Backend server URL (default: "http://localhost:5000")
  --help, -h         Show this help information

Examples:
  node simulate.js
  node simulate.js --matchId "match-001" --delay 1000
  node simulate.js --baseUrl "http://localhost:3001" --maxRetries 5

Score Sequence:
  The script simulates the following events:
  - Over 4.1: 1 run
  - Over 4.2: 6 runs (deliberate error)
  - Over 4.3: 0 runs
  - Over 4.4: 4 runs
  - Over 4.5: 2 runs
  - Over 4.6: 1 run
  - Over 5.1: 0 runs + wicket
  - Correction: 4.2 changed from 6 runs to 0 runs

This demonstrates the system's ability to handle score corrections in real-time.
`);
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Parse command line arguments
    const options = parseArguments();
    
    // Create simulator instance
    const simulator = new CricketScoreSimulator(options);
    
    // Test backend connectivity first
    const isConnected = await simulator.testConnection();
    if (!isConnected) {
      console.error('\n❌ Cannot connect to backend server.');
      console.error('   Please ensure the backend is running and accessible.');
      process.exit(1);
    }
    
    console.log(''); // Add spacing
    
    // Run the simulation
    const success = await simulator.runSimulation();
    
    // Exit with appropriate code
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    
    if (error.message.includes('Delay must be') || 
        error.message.includes('Max retries must be') || 
        error.message.includes('Invalid base URL')) {
      console.error('   Please check your command line arguments.');
      console.error('   Use --help for usage information.');
    }
    
    process.exit(1);
  }
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Simulation interrupted by user (Ctrl+C)');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Simulation terminated');
  process.exit(143);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught exception:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled promise rejection:', reason);
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main();
}

module.exports = CricketScoreSimulator;