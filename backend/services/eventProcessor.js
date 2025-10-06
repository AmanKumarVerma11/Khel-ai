const Event = require('../models/Event');

/**
 * Event Processor Service
 * Handles the core business logic for processing cricket score events
 * including validation, upsert logic, and correction handling
 */
class EventProcessor {
  
  /**
   * Process a score event (new submission or correction)
   * @param {Object} eventData - The event data to process
   * @param {number} eventData.over - Over number (must be > 0)
   * @param {number} eventData.ball - Ball number (1-6)
   * @param {number} eventData.runs - Runs scored (0-6)
   * @param {boolean} eventData.wicket - Whether wicket fell
   * @param {string} eventData.matchId - Match identifier (optional, defaults to 'default')
   * @param {string} eventData.enteredBy - User who entered the event (optional, defaults to 'system')
   * @returns {Promise<Object>} Processing result with success status and event details
   */
  static async processEvent(eventData) {
    try {
      // Step 1: Validate the event data
      const validationResult = this.validateEvent(eventData);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid event data',
            details: validationResult.errors
          }
        };
      }

      // Step 2: Create event instance
      const event = new Event({
        over: eventData.over,
        ball: eventData.ball,
        runs: eventData.runs,
        wicket: eventData.wicket || false,
        matchId: eventData.matchId || 'default',
        enteredBy: eventData.enteredBy || 'system',
        timestamp: new Date()
      });

      // Step 3: Save event (handles upsert logic and corrections internally)
      const saveResult = await event.save();

      if (!saveResult.success) {
        return {
          success: false,
          error: {
            code: 'STORAGE_ERROR',
            message: 'Failed to store event',
            details: saveResult.error
          }
        };
      }

      // Step 4: Return success result with event details
      return {
        success: true,
        data: {
          eventId: saveResult.insertedId,
          isCorrection: saveResult.isCorrection,
          version: saveResult.version,
          event: {
            key: event.key,
            matchId: event.matchId,
            over: event.over,
            ball: event.ball,
            runs: event.runs,
            wicket: event.wicket,
            timestamp: event.timestamp,
            eventType: saveResult.isCorrection ? 'correction' : 'new'
          }
        }
      };

    } catch (error) {
      console.error('Error processing event:', error.message);
      return {
        success: false,
        error: {
          code: 'PROCESSING_ERROR',
          message: 'Failed to process event',
          details: error.message
        }
      };
    }
  }

  /**
   * Validate event data according to cricket rules and system requirements
   * @param {Object} eventData - The event data to validate
   * @returns {Object} Validation result with isValid flag and errors array
   */
  static validateEvent(eventData) {
    const errors = [];

    // Use the Event model's validation method
    const modelValidation = Event.validate(eventData);
    if (!modelValidation.isValid) {
      errors.push(...modelValidation.errors);
    }

    // Additional business logic validation can be added here
    // For example, checking if the over/ball sequence makes sense
    if (eventData.over && eventData.ball) {
      // Validate that we're not going backwards in time significantly
      // (allowing some flexibility for corrections)
      // This could be enhanced with more sophisticated logic
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Handle correction of a previously entered event
   * This method provides explicit correction handling with additional validation
   * @param {Object} correctionData - The correction data
   * @param {number} correctionData.over - Over number
   * @param {number} correctionData.ball - Ball number  
   * @param {number} correctionData.runs - Corrected runs
   * @param {boolean} correctionData.wicket - Corrected wicket status
   * @param {string} correctionData.matchId - Match identifier
   * @param {string} correctionData.enteredBy - User making the correction
   * @param {string} correctionData.reason - Reason for correction (optional)
   * @returns {Promise<Object>} Correction result
   */
  static async handleCorrection(correctionData) {
    try {
      // Validate correction data
      const validationResult = this.validateEvent(correctionData);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid correction data',
            details: validationResult.errors
          }
        };
      }

      // Check if original event exists
      const matchId = correctionData.matchId || 'default';
      const key = `${correctionData.over}.${correctionData.ball}`;
      
      // Get existing events to understand what we're correcting
      const existingEvents = await Event.findByMatchId(matchId);
      const existingEvent = existingEvents.find(event => event.key === key);

      // Process the correction (Event.save() handles the correction logic)
      const result = await this.processEvent({
        ...correctionData,
        eventType: 'correction' // Explicitly mark as correction
      });

      if (result.success) {
        // Add correction-specific metadata
        result.data.correctionInfo = {
          originalEvent: existingEvent ? {
            runs: existingEvent.runs,
            wicket: existingEvent.wicket,
            version: existingEvent.version
          } : null,
          reason: correctionData.reason || 'Manual correction',
          correctedAt: new Date()
        };
      }

      return result;

    } catch (error) {
      console.error('Error handling correction:', error.message);
      return {
        success: false,
        error: {
          code: 'CORRECTION_ERROR',
          message: 'Failed to handle correction',
          details: error.message
        }
      };
    }
  }

  /**
   * Get processing statistics for monitoring and debugging
   * @param {string} matchId - Match identifier
   * @returns {Promise<Object>} Processing statistics
   */
  static async getProcessingStats(matchId = 'default') {
    try {
      const allVersions = await Event.findAllVersionsByMatchId(matchId);
      const latestEvents = await Event.findByMatchId(matchId);
      
      // Count corrections
      const corrections = allVersions.filter(event => event.eventType === 'correction');
      const correctionsByKey = {};
      
      corrections.forEach(correction => {
        if (!correctionsByKey[correction.key]) {
          correctionsByKey[correction.key] = 0;
        }
        correctionsByKey[correction.key]++;
      });

      return {
        matchId,
        totalEvents: latestEvents.length,
        totalVersions: allVersions.length,
        totalCorrections: corrections.length,
        eventsWithCorrections: Object.keys(correctionsByKey).length,
        correctionsByKey,
        lastProcessed: allVersions.length > 0 ? 
          Math.max(...allVersions.map(e => e.timestamp.getTime())) : null
      };

    } catch (error) {
      console.error('Error getting processing stats:', error.message);
      return {
        error: error.message
      };
    }
  }

  /**
   * Validate event sequence for logical consistency
   * This can be used to detect potential issues in the event stream
   * @param {string} matchId - Match identifier
   * @returns {Promise<Object>} Validation result with any issues found
   */
  static async validateEventSequence(matchId = 'default') {
    try {
      const events = await Event.findByMatchId(matchId);
      const issues = [];

      // Sort events by over and ball
      events.sort((a, b) => {
        if (a.over !== b.over) return a.over - b.over;
        return a.ball - b.ball;
      });

      // Check for sequence issues
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        
        // Check ball sequence within over
        if (i > 0) {
          const prevEvent = events[i - 1];
          
          // If same over, ball should increment by 1 (or reset to 1 for new over)
          if (event.over === prevEvent.over) {
            if (event.ball !== prevEvent.ball + 1) {
              issues.push({
                type: 'BALL_SEQUENCE_GAP',
                event: event.key,
                message: `Ball sequence gap: ${prevEvent.key} -> ${event.key}`
              });
            }
          } else if (event.over === prevEvent.over + 1) {
            // New over should start with ball 1
            if (event.ball !== 1) {
              issues.push({
                type: 'NEW_OVER_INVALID_BALL',
                event: event.key,
                message: `New over should start with ball 1, got ball ${event.ball}`
              });
            }
          } else if (event.over > prevEvent.over + 1) {
            issues.push({
              type: 'OVER_SEQUENCE_GAP',
              event: event.key,
              message: `Over sequence gap: ${prevEvent.over} -> ${event.over}`
            });
          }
        }

        // Check for impossible values
        if (event.runs > 6) {
          issues.push({
            type: 'IMPOSSIBLE_RUNS',
            event: event.key,
            message: `Impossible runs value: ${event.runs}`
          });
        }

        if (event.ball > 6 || event.ball < 1) {
          issues.push({
            type: 'INVALID_BALL',
            event: event.key,
            message: `Invalid ball number: ${event.ball}`
          });
        }
      }

      return {
        matchId,
        totalEvents: events.length,
        issuesFound: issues.length,
        issues,
        isValid: issues.length === 0
      };

    } catch (error) {
      console.error('Error validating event sequence:', error.message);
      return {
        error: error.message
      };
    }
  }
}

module.exports = EventProcessor;