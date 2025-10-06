const EventProcessor = require('../services/eventProcessor');
const ScoreComputer = require('../services/scoreComputer');

/**
 * Score Controller
 * Handles HTTP requests for score updates and retrieval
 */
class ScoreController {

  /**
   * Handle POST /update endpoint for score submissions
   * Processes score events and broadcasts updates via Socket.io
   */
  static async updateScore(req, res) {
    try {
      const { over, ball, runs, wicket, matchId } = req.body;

      // Validate required fields
      if (over === undefined || ball === undefined || runs === undefined) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'Missing required fields: over, ball, runs are required',
            details: {
              received: { over, ball, runs, wicket, matchId },
              required: ['over', 'ball', 'runs']
            }
          }
        });
      }

      // Process the event using EventProcessor service
      const eventData = {
        over: parseInt(over),
        ball: parseInt(ball),
        runs: parseInt(runs),
        wicket: wicket === true || wicket === 'true',
        matchId: matchId || 'default',
        enteredBy: req.headers['x-user-id'] || 'api-user'
      };

      const processResult = await EventProcessor.processEvent(eventData);

      if (!processResult.success) {
        return res.status(400).json(processResult);
      }

      // Compute updated score
      const updatedScore = await ScoreComputer.computeScore(eventData.matchId);

      // Broadcast the updated score via SocketManager
      const socketManager = req.app.get('socketManager');
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
          eventType: processResult.data.isCorrection ? 'correction' : 'new'
        };

        // Add previous data for corrections
        if (processResult.data.isCorrection && processResult.data.event) {
          // Get the stored event to access previousData
          const Event = require('../models/Event');
          const collection = await require('../utils/database').getEventsCollection();
          const storedEvent = await collection.findOne({
            key: eventInfo.key,
            matchId: eventData.matchId,
            version: processResult.data.version
          });
          
          if (storedEvent && storedEvent.previousData) {
            eventInfo.previousData = storedEvent.previousData;
          }
        }

        await socketManager.broadcastScore(eventData.matchId, scoreData, eventInfo);
      }

      // Return success response
      res.status(200).json({
        success: true,
        message: processResult.data.isCorrection ? 'Score corrected successfully' : 'Score updated successfully',
        data: {
          eventStored: true,
          isCorrection: processResult.data.isCorrection,
          currentScore: {
            runs: updatedScore.runs,
            wickets: updatedScore.wickets,
            overs: updatedScore.overs
          },
          event: processResult.data.event
        }
      });

    } catch (error) {
      console.error('Error in updateScore controller:', error.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error occurred while processing score update',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }
  }

  /**
   * Handle GET /score endpoint to retrieve current score
   * Returns current match score without making any changes
   */
  static async getScore(req, res) {
    try {
      const matchId = req.query.matchId || 'default';
      
      const currentScore = await ScoreComputer.computeScore(matchId);
      
      res.status(200).json({
        success: true,
        data: {
          matchId: currentScore.matchId,
          score: {
            runs: currentScore.runs,
            wickets: currentScore.wickets,
            overs: currentScore.overs
          },
          ballsFaced: currentScore.ballsFaced,
          lastEvent: currentScore.lastEvent,
          computedAt: currentScore.computedAt
        }
      });

    } catch (error) {
      console.error('Error in getScore controller:', error.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error occurred while retrieving score',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }
  }

  /**
   * Handle GET /events endpoint to retrieve recent events
   * Returns chronological log of recent score events
   */
  static async getRecentEvents(req, res) {
    try {
      const matchId = req.query.matchId || 'default';
      const limit = parseInt(req.query.limit) || 20;
      
      const Event = require('../models/Event');
      const recentEvents = await Event.findRecentEvents(matchId, limit);
      
      res.status(200).json({
        success: true,
        data: {
          matchId,
          events: recentEvents.map(event => ({
            key: event.key,
            over: event.over,
            ball: event.ball,
            runs: event.runs,
            wicket: event.wicket,
            timestamp: event.timestamp,
            eventType: event.eventType,
            version: event.version
          })),
          count: recentEvents.length
        }
      });

    } catch (error) {
      console.error('Error in getRecentEvents controller:', error.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error occurred while retrieving events',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }
  }

  /**
   * Handle POST /correct endpoint for explicit corrections
   * Provides a dedicated endpoint for score corrections with additional metadata
   */
  static async correctScore(req, res) {
    try {
      const { over, ball, runs, wicket, matchId, reason } = req.body;

      // Validate required fields
      if (over === undefined || ball === undefined || runs === undefined) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'Missing required fields: over, ball, runs are required',
            details: {
              received: { over, ball, runs, wicket, matchId, reason },
              required: ['over', 'ball', 'runs']
            }
          }
        });
      }

      // Process the correction using EventProcessor service
      const correctionData = {
        over: parseInt(over),
        ball: parseInt(ball),
        runs: parseInt(runs),
        wicket: wicket === true || wicket === 'true',
        matchId: matchId || 'default',
        enteredBy: req.headers['x-user-id'] || 'api-user',
        reason: reason || 'Manual correction via API'
      };

      const correctionResult = await EventProcessor.handleCorrection(correctionData);

      if (!correctionResult.success) {
        return res.status(400).json(correctionResult);
      }

      // Compute updated score after correction
      const updatedScore = await ScoreComputer.recomputeAfterCorrection(
        correctionData.matchId, 
        `${correctionData.over}.${correctionData.ball}`
      );

      // Broadcast the corrected score via SocketManager
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        const scoreData = {
          runs: updatedScore.runs,
          wickets: updatedScore.wickets,
          overs: updatedScore.overs,
          lastEvent: updatedScore.lastEvent
        };

        const eventInfo = {
          key: `${correctionData.over}.${correctionData.ball}`,
          over: correctionData.over,
          ball: correctionData.ball,
          runs: correctionData.runs,
          wicket: correctionData.wicket,
          isCorrection: true,
          eventType: 'correction',
          reason: correctionData.reason
        };

        await socketManager.broadcastScore(correctionData.matchId, scoreData, eventInfo);
      }

      // Return success response with correction details
      res.status(200).json({
        success: true,
        message: 'Score corrected successfully',
        data: {
          eventStored: true,
          isCorrection: true,
          currentScore: {
            runs: updatedScore.runs,
            wickets: updatedScore.wickets,
            overs: updatedScore.overs
          },
          correction: correctionResult.data.correctionInfo,
          event: correctionResult.data.event
        }
      });

    } catch (error) {
      console.error('Error in correctScore controller:', error.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error occurred while processing correction',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }
  }
}

module.exports = ScoreController;