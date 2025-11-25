const UndoRedoManager = require('../services/undoRedoManager');
const ScoreComputer = require('../services/scoreComputer');

/**
 * Undo/Redo Controller
 * Handles HTTP requests for undo and redo operations
 */
class UndoRedoController {

  /**
   * Undo events in a specific range
   * POST /api/undo-range
   * Body: { matchId?, fromKey, toKey, undoneBy?, reason? }
   */
  static async undoRange(req, res) {
    try {
      const { 
        matchId = 'default', 
        fromKey, 
        toKey, 
        undoneBy = 'user', 
        reason = '' 
      } = req.body;

      // Validate required parameters
      if (!fromKey || !toKey) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'fromKey and toKey are required',
            details: { fromKey, toKey }
          }
        });
      }

      // Perform undo operation
      const result = await UndoRedoManager.undoRange(matchId, fromKey, toKey, undoneBy, reason);

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Broadcast the update via Socket.io if available
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.broadcastScoreUpdate(matchId, {
          type: 'undo_range',
          range: { from: fromKey, to: toKey },
          score: result.data.newScore,
          operationId: result.data.operationId,
          eventsUndone: result.data.eventsUndone
        });
      }

      res.json(result);

    } catch (error) {
      console.error('Error in undoRange controller:', error.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          details: error.message
        }
      });
    }
  }

  /**
   * Redo a previously undone operation
   * POST /api/redo
   * Body: { operationId, redoneBy? }
   */
  static async redoOperation(req, res) {
    try {
      const { operationId, redoneBy = 'user' } = req.body;

      // Validate required parameters
      if (!operationId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'operationId is required',
            details: { operationId }
          }
        });
      }

      // Perform redo operation
      const result = await UndoRedoManager.redoOperation(operationId, redoneBy);

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Broadcast the update via Socket.io if available
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.broadcastScoreUpdate(result.data.matchId, {
          type: 'redo_operation',
          range: result.data.range,
          score: result.data.newScore,
          operationId: result.data.operationId,
          eventsRestored: result.data.eventsRestored
        });
      }

      res.json(result);

    } catch (error) {
      console.error('Error in redoOperation controller:', error.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          details: error.message
        }
      });
    }
  }

  /**
   * Get undo/redo history for a match
   * GET /api/undo-history?matchId=default&limit=20
   */
  static async getUndoHistory(req, res) {
    try {
      const { matchId = 'default', limit = 20 } = req.query;
      
      // Convert limit to number and validate
      const limitNum = parseInt(limit, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_LIMIT',
            message: 'Limit must be a number between 1 and 100',
            details: { limit }
          }
        });
      }

      // Get undo/redo history
      const history = await UndoRedoManager.getUndoRedoHistory(matchId, limitNum);

      res.json({
        success: true,
        data: {
          matchId,
          history,
          totalOperations: history.length
        }
      });

    } catch (error) {
      console.error('Error in getUndoHistory controller:', error.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          details: error.message
        }
      });
    }
  }

  /**
   * Get currently active events (excluding undone events)
   * GET /api/active-events?matchId=default
   */
  static async getActiveEvents(req, res) {
    try {
      const { matchId = 'default' } = req.query;

      // Get active events
      const events = await UndoRedoManager.getActiveEvents(matchId);

      // Also compute current score based on active events
      const score = await ScoreComputer.computeScore(matchId);

      res.json({
        success: true,
        data: {
          matchId,
          events: events.map(event => ({
            key: event.key,
            over: event.over,
            ball: event.ball,
            runs: event.runs,
            wicket: event.wicket,
            timestamp: event.timestamp,
            eventType: event.eventType,
            version: event.version
          })),
          eventCount: events.length,
          currentScore: score
        }
      });

    } catch (error) {
      console.error('Error in getActiveEvents controller:', error.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          details: error.message
        }
      });
    }
  }

  /**
   * Get events in a specific range (for preview before undo)
   * GET /api/range-preview?matchId=default&fromKey=1.2&toKey=1.5
   */
  static async getRangePreview(req, res) {
    try {
      const { matchId = 'default', fromKey, toKey } = req.query;

      // Validate required parameters
      if (!fromKey || !toKey) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'fromKey and toKey are required',
            details: { fromKey, toKey }
          }
        });
      }

      // Validate range keys
      const validation = UndoRedoManager.validateRangeKeys(fromKey, toKey);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_RANGE',
            message: 'Invalid range keys',
            details: validation.errors
          }
        });
      }

      // Get events in range
      const eventsInRange = await UndoRedoManager.getEventsInRange(matchId, fromKey, toKey);

      // Calculate impact on score
      const totalRuns = eventsInRange.reduce((sum, event) => sum + event.runs, 0);
      const totalWickets = eventsInRange.filter(event => event.wicket).length;

      res.json({
        success: true,
        data: {
          matchId,
          range: { from: fromKey, to: toKey },
          events: eventsInRange.map(event => ({
            key: event.key,
            over: event.over,
            ball: event.ball,
            runs: event.runs,
            wicket: event.wicket,
            timestamp: event.timestamp
          })),
          eventCount: eventsInRange.length,
          impact: {
            runsToRemove: totalRuns,
            wicketsToRemove: totalWickets
          }
        }
      });

    } catch (error) {
      console.error('Error in getRangePreview controller:', error.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          details: error.message
        }
      });
    }
  }
}

module.exports = UndoRedoController;