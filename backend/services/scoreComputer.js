const Event = require('../models/Event');

/**
 * Score Computer Service
 * Handles computation of current match state from stored events
 * Provides efficient score calculation and aggregation functionality
 */
class ScoreComputer {

  /**
   * Compute current score for a match
   * @param {string} matchId - Match identifier (defaults to 'default')
   * @returns {Promise<Object>} Current score with runs, wickets, and overs
   */
  static async computeScore(matchId = 'default') {
    try {
      // Fetch and sort events by matchId
      const events = await this.getEventsByMatch(matchId);
      
      if (events.length === 0) {
        return {
          matchId,
          runs: 0,
          wickets: 0,
          overs: '0.0',
          ballsFaced: 0,
          lastEvent: null,
          computedAt: new Date()
        };
      }

      // Aggregate statistics from events
      const stats = this.aggregateStats(events);
      
      return {
        matchId,
        runs: stats.totalRuns,
        wickets: stats.totalWickets,
        overs: stats.oversDisplay,
        ballsFaced: stats.ballsFaced,
        lastEvent: stats.lastEvent,
        computedAt: new Date(),
        eventCount: events.length
      };

    } catch (error) {
      console.error('Error computing score:', error.message);
      throw new Error(`Failed to compute score for match ${matchId}: ${error.message}`);
    }
  }

  /**
   * Fetch and sort events by matchId
   * Returns the latest version of each event, sorted chronologically
   * @param {string} matchId - Match identifier
   * @returns {Promise<Array>} Sorted array of events
   */
  static async getEventsByMatch(matchId = 'default') {
    try {
      // Use the Event model's method to get latest version of each event
      const events = await Event.findByMatchId(matchId);
      
      // Sort by over and ball to ensure chronological order
      events.sort((a, b) => {
        if (a.over !== b.over) {
          return a.over - b.over;
        }
        return a.ball - b.ball;
      });

      return events;

    } catch (error) {
      console.error('Error fetching events by match:', error.message);
      throw new Error(`Failed to fetch events for match ${matchId}: ${error.message}`);
    }
  }

  /**
   * Aggregate statistics from a sorted array of events
   * @param {Array} events - Sorted array of events
   * @returns {Object} Aggregated statistics
   */
  static aggregateStats(events) {
    let totalRuns = 0;
    let totalWickets = 0;
    let ballsFaced = 0;
    let currentOver = 0;
    let currentBall = 0;
    let lastEvent = null;

    // Process each event to build up the score
    events.forEach(event => {
      // Add runs
      totalRuns += event.runs;
      
      // Add wickets
      if (event.wicket) {
        totalWickets++;
      }
      
      // Track balls faced
      ballsFaced++;
      
      // Update current over and ball
      currentOver = event.over;
      currentBall = event.ball;
      
      // Keep reference to last event
      lastEvent = {
        key: event.key,
        over: event.over,
        ball: event.ball,
        runs: event.runs,
        wicket: event.wicket,
        timestamp: event.timestamp,
        eventType: event.eventType
      };
    });

    // Calculate overs display (e.g., "4.5" for 4 overs and 5 balls)
    const oversDisplay = events.length > 0 ? `${currentOver}.${currentBall}` : '0.0';

    return {
      totalRuns,
      totalWickets,
      ballsFaced,
      currentOver,
      currentBall,
      oversDisplay,
      lastEvent
    };
  }

  /**
   * Compute detailed match statistics
   * @param {string} matchId - Match identifier
   * @returns {Promise<Object>} Detailed match statistics
   */
  static async computeDetailedStats(matchId = 'default') {
    try {
      const events = await this.getEventsByMatch(matchId);
      
      if (events.length === 0) {
        return {
          matchId,
          basicStats: await this.computeScore(matchId),
          overByOverStats: [],
          runRate: 0,
          boundaries: { fours: 0, sixes: 0 },
          extras: 0,
          dotBalls: 0
        };
      }

      const basicStats = this.aggregateStats(events);
      const overByOverStats = this.computeOverByOverStats(events);
      const boundaries = this.computeBoundaries(events);
      const runRate = this.computeRunRate(events);
      const dotBalls = events.filter(event => event.runs === 0 && !event.wicket).length;

      return {
        matchId,
        basicStats: {
          runs: basicStats.totalRuns,
          wickets: basicStats.totalWickets,
          overs: basicStats.oversDisplay,
          ballsFaced: basicStats.ballsFaced
        },
        overByOverStats,
        runRate,
        boundaries,
        extras: 0, // Not implemented in current schema
        dotBalls,
        computedAt: new Date()
      };

    } catch (error) {
      console.error('Error computing detailed stats:', error.message);
      throw new Error(`Failed to compute detailed stats: ${error.message}`);
    }
  }

  /**
   * Compute over-by-over statistics
   * @param {Array} events - Sorted array of events
   * @returns {Array} Over-by-over statistics
   */
  static computeOverByOverStats(events) {
    const overStats = {};

    events.forEach(event => {
      const overNum = event.over;
      
      if (!overStats[overNum]) {
        overStats[overNum] = {
          over: overNum,
          runs: 0,
          wickets: 0,
          balls: 0,
          events: []
        };
      }

      overStats[overNum].runs += event.runs;
      if (event.wicket) {
        overStats[overNum].wickets++;
      }
      overStats[overNum].balls++;
      overStats[overNum].events.push({
        ball: event.ball,
        runs: event.runs,
        wicket: event.wicket,
        key: event.key
      });
    });

    // Convert to array and sort by over number
    return Object.values(overStats).sort((a, b) => a.over - b.over);
  }

  /**
   * Compute boundary statistics (fours and sixes)
   * @param {Array} events - Array of events
   * @returns {Object} Boundary statistics
   */
  static computeBoundaries(events) {
    const fours = events.filter(event => event.runs === 4).length;
    const sixes = events.filter(event => event.runs === 6).length;
    
    return {
      fours,
      sixes,
      total: fours + sixes,
      boundaryRuns: (fours * 4) + (sixes * 6)
    };
  }

  /**
   * Compute current run rate
   * @param {Array} events - Array of events
   * @returns {number} Run rate per over
   */
  static computeRunRate(events) {
    if (events.length === 0) return 0;

    const totalRuns = events.reduce((sum, event) => sum + event.runs, 0);
    const totalBalls = events.length;
    const oversPlayed = totalBalls / 6;

    return oversPlayed > 0 ? (totalRuns / oversPlayed) : 0;
  }

  /**
   * Recompute score after corrections
   * This method ensures efficient recomputation when events are corrected
   * @param {string} matchId - Match identifier
   * @param {string} correctedKey - The key of the corrected event (e.g., "4.2")
   * @returns {Promise<Object>} Recomputed score
   */
  static async recomputeAfterCorrection(matchId = 'default', correctedKey = null) {
    try {
      console.log(`Recomputing score for match ${matchId} after correction to ${correctedKey}`);
      
      // For now, we'll do a full recomputation
      // In a more optimized version, we could compute only from the corrected point forward
      const newScore = await this.computeScore(matchId);
      
      // Log the recomputation for debugging
      console.log(`Recomputed score for ${matchId}:`, {
        runs: newScore.runs,
        wickets: newScore.wickets,
        overs: newScore.overs,
        correctedEvent: correctedKey
      });

      return {
        ...newScore,
        recomputedAfterCorrection: true,
        correctedEvent: correctedKey,
        recomputedAt: new Date()
      };

    } catch (error) {
      console.error('Error recomputing score after correction:', error.message);
      throw new Error(`Failed to recompute score: ${error.message}`);
    }
  }

  /**
   * Get score progression over time
   * Useful for charts and visualizations
   * @param {string} matchId - Match identifier
   * @returns {Promise<Array>} Array of score points over time
   */
  static async getScoreProgression(matchId = 'default') {
    try {
      const events = await this.getEventsByMatch(matchId);
      const progression = [];
      
      let cumulativeRuns = 0;
      let cumulativeWickets = 0;

      events.forEach((event, index) => {
        cumulativeRuns += event.runs;
        if (event.wicket) {
          cumulativeWickets++;
        }

        progression.push({
          eventIndex: index + 1,
          key: event.key,
          over: event.over,
          ball: event.ball,
          runs: cumulativeRuns,
          wickets: cumulativeWickets,
          overs: `${event.over}.${event.ball}`,
          eventRuns: event.runs,
          eventWicket: event.wicket,
          timestamp: event.timestamp
        });
      });

      return progression;

    } catch (error) {
      console.error('Error getting score progression:', error.message);
      throw new Error(`Failed to get score progression: ${error.message}`);
    }
  }

  /**
   * Compare scores between two points in time
   * Useful for understanding the impact of corrections
   * @param {string} matchId - Match identifier
   * @param {string} fromKey - Starting event key (e.g., "4.1")
   * @param {string} toKey - Ending event key (e.g., "4.6")
   * @returns {Promise<Object>} Score comparison
   */
  static async compareScoreRange(matchId = 'default', fromKey, toKey) {
    try {
      const events = await this.getEventsByMatch(matchId);
      
      // Filter events within the range
      const rangeEvents = events.filter(event => {
        const [fromOver, fromBall] = fromKey.split('.').map(Number);
        const [toOver, toBall] = toKey.split('.').map(Number);
        
        const eventValue = event.over * 10 + event.ball;
        const fromValue = fromOver * 10 + fromBall;
        const toValue = toOver * 10 + toBall;
        
        return eventValue >= fromValue && eventValue <= toValue;
      });

      const rangeStats = this.aggregateStats(rangeEvents);

      return {
        matchId,
        range: { from: fromKey, to: toKey },
        eventsInRange: rangeEvents.length,
        runsInRange: rangeStats.totalRuns,
        wicketsInRange: rangeStats.totalWickets,
        events: rangeEvents.map(event => ({
          key: event.key,
          runs: event.runs,
          wicket: event.wicket,
          eventType: event.eventType
        }))
      };

    } catch (error) {
      console.error('Error comparing score range:', error.message);
      throw new Error(`Failed to compare score range: ${error.message}`);
    }
  }

  /**
   * Validate computed score against stored events
   * Useful for debugging and ensuring data integrity
   * @param {string} matchId - Match identifier
   * @returns {Promise<Object>} Validation result
   */
  static async validateComputedScore(matchId = 'default') {
    try {
      const events = await this.getEventsByMatch(matchId);
      const computedScore = await this.computeScore(matchId);
      
      // Manual calculation for verification
      const manualRuns = events.reduce((sum, event) => sum + event.runs, 0);
      const manualWickets = events.filter(event => event.wicket).length;
      const manualBalls = events.length;
      
      const lastEvent = events[events.length - 1];
      const manualOvers = lastEvent ? `${lastEvent.over}.${lastEvent.ball}` : '0.0';

      const isValid = (
        computedScore.runs === manualRuns &&
        computedScore.wickets === manualWickets &&
        computedScore.ballsFaced === manualBalls &&
        computedScore.overs === manualOvers
      );

      return {
        matchId,
        isValid,
        computed: {
          runs: computedScore.runs,
          wickets: computedScore.wickets,
          balls: computedScore.ballsFaced,
          overs: computedScore.overs
        },
        manual: {
          runs: manualRuns,
          wickets: manualWickets,
          balls: manualBalls,
          overs: manualOvers
        },
        differences: isValid ? null : {
          runs: computedScore.runs - manualRuns,
          wickets: computedScore.wickets - manualWickets,
          balls: computedScore.ballsFaced - manualBalls
        }
      };

    } catch (error) {
      console.error('Error validating computed score:', error.message);
      throw new Error(`Failed to validate computed score: ${error.message}`);
    }
  }
}

module.exports = ScoreComputer;