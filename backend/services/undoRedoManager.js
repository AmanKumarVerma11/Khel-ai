const Event = require('../models/Event');
const ScoreComputer = require('./scoreComputer');

/**
 * Undo/Redo Manager Service
 * Handles undo and redo operations for score ranges
 * Allows removing events from a range and restoring them later
 */
class UndoRedoManager {

  /**
   * Undo events in a specific range (e.g., from over 1.2 to 1.5)
   * This removes events from the active score but keeps them in history
   * @param {string} matchId - Match identifier
   * @param {string} fromKey - Starting event key (e.g., "1.2")
   * @param {string} toKey - Ending event key (e.g., "1.5")
   * @param {string} undoneBy - User performing the undo operation
   * @param {string} reason - Reason for undoing (optional)
   * @returns {Promise<Object>} Undo operation result
   */
  static async undoRange(matchId = 'default', fromKey, toKey, undoneBy = 'system', reason = '') {
    try {
      // Validate input parameters
      const validation = this.validateRangeKeys(fromKey, toKey);
      if (!validation.isValid) {
        return {
          success: false,
          error: {
            code: 'INVALID_RANGE',
            message: 'Invalid range keys provided',
            details: validation.errors
          }
        };
      }

      // Get current events in the range
      const eventsInRange = await this.getEventsInRange(matchId, fromKey, toKey);
      
      if (eventsInRange.length === 0) {
        return {
          success: false,
          error: {
            code: 'NO_EVENTS_IN_RANGE',
            message: `No events found in range ${fromKey} to ${toKey}`,
            details: { matchId, fromKey, toKey }
          }
        };
      }

      // Create undo operation record
      const undoOperation = {
        operationId: this.generateOperationId(),
        matchId,
        operationType: 'undo',
        range: { from: fromKey, to: toKey },
        undoneBy,
        reason,
        timestamp: new Date(),
        eventsUndone: eventsInRange.map(event => ({
          key: event.key,
          over: event.over,
          ball: event.ball,
          runs: event.runs,
          wicket: event.wicket,
          version: event.version,
          originalTimestamp: event.timestamp
        }))
      };

      // Mark events as undone by creating new versions with 'undone' status
      const undoResults = [];
      for (const event of eventsInRange) {
        const undoResult = await this.markEventAsUndone(event, undoOperation.operationId, undoneBy);
        undoResults.push(undoResult);
      }

      // Store the undo operation for potential redo
      await this.storeUndoOperation(undoOperation);

      // Recompute score after undo
      const newScore = await ScoreComputer.recomputeAfterCorrection(matchId, `${fromKey}-${toKey}`);

      return {
        success: true,
        data: {
          operationId: undoOperation.operationId,
          matchId,
          range: { from: fromKey, to: toKey },
          eventsUndone: eventsInRange.length,
          undoResults,
          newScore,
          canRedo: true,
          undoneAt: undoOperation.timestamp
        }
      };

    } catch (error) {
      console.error('Error undoing range:', error.message);
      return {
        success: false,
        error: {
          code: 'UNDO_ERROR',
          message: 'Failed to undo range',
          details: error.message
        }
      };
    }
  }

  /**
   * Redo a previously undone range
   * @param {string} operationId - The operation ID from the undo operation
   * @param {string} redoneBy - User performing the redo operation
   * @returns {Promise<Object>} Redo operation result
   */
  static async redoOperation(operationId, redoneBy = 'system') {
    try {
      // Get the undo operation details
      const undoOperation = await this.getUndoOperation(operationId);
      
      if (!undoOperation) {
        return {
          success: false,
          error: {
            code: 'OPERATION_NOT_FOUND',
            message: `Undo operation ${operationId} not found`,
            details: { operationId }
          }
        };
      }

      if (undoOperation.redoneAt) {
        return {
          success: false,
          error: {
            code: 'ALREADY_REDONE',
            message: 'This operation has already been redone',
            details: { operationId, redoneAt: undoOperation.redoneAt }
          }
        };
      }

      // Restore the events by creating new versions with original data
      const redoResults = [];
      for (const eventData of undoOperation.eventsUndone) {
        const redoResult = await this.restoreEvent(eventData, operationId, redoneBy);
        redoResults.push(redoResult);
      }

      // Mark the undo operation as redone
      await this.markOperationAsRedone(operationId, redoneBy);

      // Recompute score after redo
      const newScore = await ScoreComputer.recomputeAfterCorrection(
        undoOperation.matchId, 
        `${undoOperation.range.from}-${undoOperation.range.to}`
      );

      return {
        success: true,
        data: {
          operationId,
          matchId: undoOperation.matchId,
          range: undoOperation.range,
          eventsRestored: undoOperation.eventsUndone.length,
          redoResults,
          newScore,
          canUndo: true,
          redoneAt: new Date()
        }
      };

    } catch (error) {
      console.error('Error redoing operation:', error.message);
      return {
        success: false,
        error: {
          code: 'REDO_ERROR',
          message: 'Failed to redo operation',
          details: error.message
        }
      };
    }
  }

  /**
   * Get events within a specific range
   * @param {string} matchId - Match identifier
   * @param {string} fromKey - Starting event key
   * @param {string} toKey - Ending event key
   * @returns {Promise<Array>} Events in the range
   */
  static async getEventsInRange(matchId, fromKey, toKey) {
    try {
      const allEvents = await Event.findByMatchId(matchId);
      
      return allEvents.filter(event => {
        const [fromOver, fromBall] = fromKey.split('.').map(Number);
        const [toOver, toBall] = toKey.split('.').map(Number);
        
        const eventValue = event.over * 10 + event.ball;
        const fromValue = fromOver * 10 + fromBall;
        const toValue = toOver * 10 + toBall;
        
        return eventValue >= fromValue && eventValue <= toValue;
      });

    } catch (error) {
      console.error('Error getting events in range:', error.message);
      throw new Error(`Failed to get events in range: ${error.message}`);
    }
  }

  /**
   * Mark an event as undone by creating a new version
   * @param {Object} event - Event to mark as undone
   * @param {string} operationId - Undo operation ID
   * @param {string} undoneBy - User performing the undo
   * @returns {Promise<Object>} Result of marking event as undone
   */
  static async markEventAsUndone(event, operationId, undoneBy) {
    try {
      const databaseManager = require('../utils/database');
      const collection = await databaseManager.getEventsCollection();

      const undoDocument = {
        key: event.key,
        matchId: event.matchId,
        over: event.over,
        ball: event.ball,
        runs: event.runs,
        wicket: event.wicket,
        timestamp: new Date(),
        eventType: 'undone',
        version: event.version + 1,
        previousData: {
          runs: event.runs,
          wicket: event.wicket,
          version: event.version
        },
        enteredBy: undoneBy,
        undoOperationId: operationId,
        originalEventData: {
          runs: event.runs,
          wicket: event.wicket,
          originalTimestamp: event.timestamp
        }
      };

      const result = await collection.insertOne(undoDocument);
      
      return {
        success: true,
        eventKey: event.key,
        newVersion: undoDocument.version,
        insertedId: result.insertedId
      };

    } catch (error) {
      console.error('Error marking event as undone:', error.message);
      throw new Error(`Failed to mark event as undone: ${error.message}`);
    }
  }

  /**
   * Restore an event by creating a new version with original data
   * @param {Object} eventData - Original event data to restore
   * @param {string} operationId - Original undo operation ID
   * @param {string} redoneBy - User performing the redo
   * @returns {Promise<Object>} Result of restoring event
   */
  static async restoreEvent(eventData, operationId, redoneBy) {
    try {
      const databaseManager = require('../utils/database');
      const collection = await databaseManager.getEventsCollection();

      // Get the current (undone) version to determine next version number
      const currentEvent = await collection.findOne(
        { key: eventData.key, matchId: eventData.matchId },
        { sort: { version: -1 } }
      );

      const restoreDocument = {
        key: eventData.key,
        matchId: eventData.matchId,
        over: eventData.over,
        ball: eventData.ball,
        runs: eventData.runs,
        wicket: eventData.wicket,
        timestamp: new Date(),
        eventType: 'restored',
        version: currentEvent ? currentEvent.version + 1 : 1,
        previousData: currentEvent ? {
          eventType: currentEvent.eventType,
          version: currentEvent.version
        } : null,
        enteredBy: redoneBy,
        redoOperationId: operationId,
        restoredFromUndo: true
      };

      const result = await collection.insertOne(restoreDocument);
      
      return {
        success: true,
        eventKey: eventData.key,
        newVersion: restoreDocument.version,
        insertedId: result.insertedId
      };

    } catch (error) {
      console.error('Error restoring event:', error.message);
      throw new Error(`Failed to restore event: ${error.message}`);
    }
  }

  /**
   * Store undo operation for potential redo
   * @param {Object} undoOperation - Undo operation data
   * @returns {Promise<Object>} Storage result
   */
  static async storeUndoOperation(undoOperation) {
    try {
      const databaseManager = require('../utils/database');
      const db = await databaseManager.getDatabase();
      const collection = db.collection('undoOperations');

      const result = await collection.insertOne(undoOperation);
      
      return {
        success: true,
        insertedId: result.insertedId
      };

    } catch (error) {
      console.error('Error storing undo operation:', error.message);
      throw new Error(`Failed to store undo operation: ${error.message}`);
    }
  }

  /**
   * Get undo operation by ID
   * @param {string} operationId - Operation ID
   * @returns {Promise<Object|null>} Undo operation data
   */
  static async getUndoOperation(operationId) {
    try {
      const databaseManager = require('../utils/database');
      const db = await databaseManager.getDatabase();
      const collection = db.collection('undoOperations');

      return await collection.findOne({ operationId });

    } catch (error) {
      console.error('Error getting undo operation:', error.message);
      throw new Error(`Failed to get undo operation: ${error.message}`);
    }
  }

  /**
   * Mark undo operation as redone
   * @param {string} operationId - Operation ID
   * @param {string} redoneBy - User performing the redo
   * @returns {Promise<Object>} Update result
   */
  static async markOperationAsRedone(operationId, redoneBy) {
    try {
      const databaseManager = require('../utils/database');
      const db = await databaseManager.getDatabase();
      const collection = db.collection('undoOperations');

      const result = await collection.updateOne(
        { operationId },
        { 
          $set: { 
            redoneAt: new Date(),
            redoneBy 
          } 
        }
      );

      return {
        success: result.modifiedCount > 0,
        modifiedCount: result.modifiedCount
      };

    } catch (error) {
      console.error('Error marking operation as redone:', error.message);
      throw new Error(`Failed to mark operation as redone: ${error.message}`);
    }
  }

  /**
   * Get undo/redo history for a match
   * @param {string} matchId - Match identifier
   * @param {number} limit - Maximum number of operations to return
   * @returns {Promise<Array>} Undo/redo history
   */
  static async getUndoRedoHistory(matchId = 'default', limit = 20) {
    try {
      const databaseManager = require('../utils/database');
      const db = await databaseManager.getDatabase();
      const collection = db.collection('undoOperations');

      const operations = await collection
        .find({ matchId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

      return operations.map(op => ({
        operationId: op.operationId,
        range: op.range,
        eventsCount: op.eventsUndone.length,
        undoneBy: op.undoneBy,
        reason: op.reason,
        timestamp: op.timestamp,
        redoneAt: op.redoneAt,
        redoneBy: op.redoneBy,
        canRedo: !op.redoneAt
      }));

    } catch (error) {
      console.error('Error getting undo/redo history:', error.message);
      throw new Error(`Failed to get undo/redo history: ${error.message}`);
    }
  }

  /**
   * Validate range keys format and logic
   * @param {string} fromKey - Starting key
   * @param {string} toKey - Ending key
   * @returns {Object} Validation result
   */
  static validateRangeKeys(fromKey, toKey) {
    const errors = [];

    // Validate format (should be "over.ball")
    const keyPattern = /^\d+\.\d+$/;
    
    if (!keyPattern.test(fromKey)) {
      errors.push(`Invalid fromKey format: ${fromKey}. Expected format: "over.ball"`);
    }
    
    if (!keyPattern.test(toKey)) {
      errors.push(`Invalid toKey format: ${toKey}. Expected format: "over.ball"`);
    }

    if (errors.length === 0) {
      // Validate logical order
      const [fromOver, fromBall] = fromKey.split('.').map(Number);
      const [toOver, toBall] = toKey.split('.').map(Number);
      
      const fromValue = fromOver * 10 + fromBall;
      const toValue = toOver * 10 + toBall;
      
      if (fromValue > toValue) {
        errors.push(`Invalid range: fromKey (${fromKey}) must be less than or equal to toKey (${toKey})`);
      }

      // Validate ball numbers
      if (fromBall < 1 || fromBall > 6) {
        errors.push(`Invalid ball number in fromKey: ${fromBall}. Must be between 1 and 6`);
      }
      
      if (toBall < 1 || toBall > 6) {
        errors.push(`Invalid ball number in toKey: ${toBall}. Must be between 1 and 6`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate unique operation ID
   * @returns {string} Unique operation ID
   */
  static generateOperationId() {
    return `undo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current active events (excluding undone events)
   * @param {string} matchId - Match identifier
   * @returns {Promise<Array>} Active events
   */
  static async getActiveEvents(matchId = 'default') {
    try {
      const databaseManager = require('../utils/database');
      const collection = await databaseManager.getEventsCollection();
      
      // Get latest version of each event that is not undone
      const pipeline = [
        { $match: { matchId } },
        { $sort: { key: 1, version: -1 } },
        {
          $group: {
            _id: '$key',
            latestEvent: { $first: '$$ROOT' }
          }
        },
        { $replaceRoot: { newRoot: '$latestEvent' } },
        { $match: { eventType: { $ne: 'undone' } } },
        { $sort: { over: 1, ball: 1 } }
      ];

      const events = await collection.aggregate(pipeline).toArray();
      return events.map(doc => Event.fromDocument(doc));

    } catch (error) {
      console.error('Error getting active events:', error.message);
      throw new Error(`Failed to get active events: ${error.message}`);
    }
  }
}

module.exports = UndoRedoManager;