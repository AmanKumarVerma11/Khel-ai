const EventProcessor = require('../services/eventProcessor');
const ScoreComputer = require('../services/scoreComputer');

/**
 * Simulation Controller
 * Handles automated score simulation for demonstration purposes
 */
class SimulationController {

  /**
   * Handle GET /simulate endpoint for automated score generation
   * Creates predefined score sequence (4.1 to 5.1 with 4.2 error)
   */
  static async simulateScore(req, res) {
    try {
      const matchId = req.query.matchId || 'default';
      const delay = parseInt(req.query.delay) || 2500; // Default 2.5 seconds
      const maxRetries = parseInt(req.query.maxRetries) || 3;

      console.log(`Starting score simulation for match ${matchId} with ${delay}ms delay`);

      // Send immediate response to client
      res.status(200).json({
        success: true,
        message: 'Score simulation started',
        data: {
          matchId,
          delay,
          maxRetries,
          sequence: 'Over 4.1 to 5.1 with deliberate error at 4.2',
          startedAt: new Date()
        }
      });

      // Start the simulation asynchronously
      SimulationController.runSimulation(matchId, delay, maxRetries, req.app.get('socketManager'));

    } catch (error) {
      console.error('Error starting simulation:', error.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'SIMULATION_ERROR',
          message: 'Failed to start score simulation',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }
  }

  /**
   * Run the actual simulation sequence
   * Executes the predefined score sequence with delays and error handling
   */
  static async runSimulation(matchId, delay, maxRetries, socketManager) {
    try {
      // Define the predefined score sequence
      const scoreSequence = [
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

      console.log(`Simulating ${scoreSequence.length} events for match ${matchId}`);

      // Process each event in sequence
      for (let i = 0; i < scoreSequence.length; i++) {
        const event = scoreSequence[i];
        
        console.log(`Simulating event ${i + 1}/${scoreSequence.length}: ${event.over}.${event.ball} - ${event.runs} runs${event.wicket ? ' + wicket' : ''}`);

        // Send the event with retry logic
        const success = await SimulationController.sendEventWithRetry(
          { ...event, matchId, enteredBy: 'simulation' },
          maxRetries,
          socketManager
        );

        if (!success) {
          console.error(`Failed to send event ${event.over}.${event.ball} after ${maxRetries} retries`);
          // Continue with next event rather than stopping entire simulation
        }

        // Add delay before next event (except for the last one)
        if (i < scoreSequence.length - 1) {
          await SimulationController.sleep(delay);
        }
      }

      console.log(`Simulation completed for match ${matchId}. Now waiting 3 seconds before correction...`);
      
      // Wait 3 seconds, then send the correction for 4.2
      await SimulationController.sleep(3000);
      
      console.log('Sending correction for 4.2: changing 6 runs to 0 runs');
      
      // Send correction for 4.2 (change from 6 runs to 0 runs)
      const correctionSuccess = await SimulationController.sendEventWithRetry(
        { 
          over: 4, 
          ball: 2, 
          runs: 0, 
          wicket: false, 
          matchId, 
          enteredBy: 'simulation-correction' 
        },
        maxRetries,
        socketManager
      );

      if (correctionSuccess) {
        console.log('Simulation and correction completed successfully');
        
        // Broadcast simulation completion
        if (socketManager) {
          socketManager.broadcastToMatch(matchId, 'simulation-complete', {
            message: 'Score simulation completed with correction',
            completedAt: new Date()
          });
        }
      } else {
        console.error('Failed to send correction after retries');
      }

    } catch (error) {
      console.error('Error during simulation:', error.message);
      
      // Broadcast simulation error
      if (socketManager) {
        socketManager.broadcastToMatch(matchId, 'simulation-error', {
          error: error.message,
          failedAt: new Date()
        });
      }
    }
  }

  /**
   * Send a single event with exponential backoff retry logic
   */
  static async sendEventWithRetry(eventData, maxRetries, socketManager) {
    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`Attempt ${attempt}/${maxRetries} for event ${eventData.over}.${eventData.ball}`);

        // Process the event
        const processResult = await EventProcessor.processEvent(eventData);

        if (!processResult.success) {
          throw new Error(`Event processing failed: ${processResult.error.message}`);
        }

        // Compute updated score
        const updatedScore = await ScoreComputer.computeScore(eventData.matchId);

        // Broadcast the update via SocketManager
        if (socketManager) {
          const scoreData = {
            runs: updatedScore.runs,
            wickets: updatedScore.wickets,
            overs: updatedScore.overs,
            lastEvent: updatedScore.lastEvent
          };

          const eventInfo = {
            key: `${eventData.over}.${eventData.ball}`,
            over: eventData.over,
            ball: eventData.ball,
            runs: eventData.runs,
            wicket: eventData.wicket,
            isCorrection: processResult.data.isCorrection,
            eventType: processResult.data.isCorrection ? 'correction' : 'new',
            isSimulated: true
          };

          await socketManager.broadcastScore(eventData.matchId, scoreData, eventInfo);
        }

        console.log(`Successfully processed event ${eventData.over}.${eventData.ball}`);
        return true;

      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt} failed for event ${eventData.over}.${eventData.ball}:`, error.message);

        if (attempt < maxRetries) {
          // Exponential backoff: wait 2^attempt seconds
          const backoffDelay = Math.pow(2, attempt) * 1000;
          console.log(`Waiting ${backoffDelay}ms before retry...`);
          await SimulationController.sleep(backoffDelay);
        }
      }
    }

    console.error(`All ${maxRetries} attempts failed for event ${eventData.over}.${eventData.ball}. Last error:`, lastError.message);
    return false;
  }

  /**
   * Sleep utility function for delays
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle GET /simulate/status endpoint
   * Returns current simulation status (if any)
   */
  static async getSimulationStatus(req, res) {
    try {
      const matchId = req.query.matchId || 'default';
      
      // Get current score to show simulation progress
      const currentScore = await ScoreComputer.computeScore(matchId);
      
      // Get recent events to show what's been simulated
      const Event = require('../models/Event');
      const recentEvents = await Event.findRecentEvents(matchId, 10);
      
      // Check if any events are from simulation
      const simulatedEvents = recentEvents.filter(event => 
        event.enteredBy && event.enteredBy.includes('simulation')
      );

      res.status(200).json({
        success: true,
        data: {
          matchId,
          currentScore: {
            runs: currentScore.runs,
            wickets: currentScore.wickets,
            overs: currentScore.overs
          },
          hasSimulatedEvents: simulatedEvents.length > 0,
          simulatedEventsCount: simulatedEvents.length,
          lastSimulatedEvent: simulatedEvents.length > 0 ? {
            key: simulatedEvents[0].key,
            runs: simulatedEvents[0].runs,
            wicket: simulatedEvents[0].wicket,
            timestamp: simulatedEvents[0].timestamp
          } : null,
          totalEvents: currentScore.eventCount || 0
        }
      });

    } catch (error) {
      console.error('Error getting simulation status:', error.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'STATUS_ERROR',
          message: 'Failed to get simulation status',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }
  }

  /**
   * Handle POST /simulate/custom endpoint
   * Allows custom simulation sequences
   */
  static async customSimulation(req, res) {
    try {
      const { matchId = 'default', events, delay = 2000, maxRetries = 3 } = req.body;

      if (!events || !Array.isArray(events) || events.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SEQUENCE',
            message: 'Events array is required and must not be empty',
            details: 'Provide an array of events with over, ball, runs, and wicket properties'
          }
        });
      }

      // Validate each event in the sequence
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const validation = EventProcessor.validateEvent(event);
        
        if (!validation.isValid) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_EVENT',
              message: `Invalid event at index ${i}`,
              details: validation.errors
            }
          });
        }
      }

      console.log(`Starting custom simulation for match ${matchId} with ${events.length} events`);

      // Send immediate response
      res.status(200).json({
        success: true,
        message: 'Custom simulation started',
        data: {
          matchId,
          eventCount: events.length,
          delay,
          maxRetries,
          startedAt: new Date()
        }
      });

      // Run custom simulation asynchronously
      SimulationController.runCustomSimulation(matchId, events, delay, maxRetries, req.app.get('socketManager'));

    } catch (error) {
      console.error('Error starting custom simulation:', error.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'CUSTOM_SIMULATION_ERROR',
          message: 'Failed to start custom simulation',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }
  }

  /**
   * Run custom simulation sequence
   */
  static async runCustomSimulation(matchId, events, delay, maxRetries, socketManager) {
    try {
      console.log(`Running custom simulation with ${events.length} events for match ${matchId}`);

      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < events.length; i++) {
        const event = { ...events[i], matchId, enteredBy: 'custom-simulation' };
        
        console.log(`Processing custom event ${i + 1}/${events.length}: ${event.over}.${event.ball}`);

        const success = await SimulationController.sendEventWithRetry(event, maxRetries, socketManager);
        
        if (success) {
          successCount++;
        } else {
          failureCount++;
        }

        // Add delay between events
        if (i < events.length - 1) {
          await SimulationController.sleep(delay);
        }
      }

      console.log(`Custom simulation completed: ${successCount} successful, ${failureCount} failed`);

      // Broadcast completion
      if (socketManager) {
        socketManager.broadcastToMatch(matchId, 'custom-simulation-complete', {
          totalEvents: events.length,
          successCount,
          failureCount,
          completedAt: new Date()
        });
      }

    } catch (error) {
      console.error('Error during custom simulation:', error.message);
      
      if (socketManager) {
        socketManager.broadcastToMatch(matchId, 'simulation-error', {
          error: error.message,
          simulationType: 'custom',
          failedAt: new Date()
        });
      }
    }
  }
}

module.exports = SimulationController;