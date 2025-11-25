// Dynamic database manager (MongoDB or in-memory fallback)
let databaseManager;
try {
  databaseManager = require('../utils/database');
} catch (error) {
  databaseManager = require('../utils/memoryDatabase');
}

class Event {
  constructor(data) {
    this.key = `${data.over}.${data.ball}`;
    this.matchId = data.matchId || 'default';
    this.over = data.over;
    this.ball = data.ball;
    this.runs = data.runs;
    this.wicket = data.wicket || false;
    this.timestamp = data.timestamp || new Date();
    this.eventType = data.eventType || 'new';
    this.version = data.version || 1;
    this.previousData = data.previousData || null;
    this.enteredBy = data.enteredBy || 'system';
  }

  /**
   * Validate event data according to cricket rules
   */
  static validate(data) {
    const errors = [];

    // Required fields validation
    if (!data.over || typeof data.over !== 'number' || data.over <= 0) {
      errors.push('Over must be a positive number');
    }

    if (!data.ball || typeof data.ball !== 'number' || data.ball < 1 || data.ball > 6) {
      errors.push('Ball must be a number between 1 and 6');
    }

    if (typeof data.runs !== 'number' || data.runs < 0 || data.runs > 6) {
      errors.push('Runs must be a number between 0 and 6');
    }

    if (data.wicket !== undefined && typeof data.wicket !== 'boolean') {
      errors.push('Wicket must be a boolean value');
    }

    if (data.matchId && typeof data.matchId !== 'string') {
      errors.push('MatchId must be a string');
    }

    if (data.eventType && !['new', 'correction', 'undone', 'restored'].includes(data.eventType)) {
      errors.push('EventType must be one of: "new", "correction", "undone", "restored"');
    }

    if (data.version && (typeof data.version !== 'number' || data.version < 1)) {
      errors.push('Version must be a positive number');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Convert event instance to MongoDB document format
   */
  toDocument() {
    return {
      key: this.key,
      matchId: this.matchId,
      over: this.over,
      ball: this.ball,
      runs: this.runs,
      wicket: this.wicket,
      timestamp: this.timestamp,
      eventType: this.eventType,
      version: this.version,
      previousData: this.previousData,
      enteredBy: this.enteredBy
    };
  }

  /**
   * Create event from MongoDB document
   */
  static fromDocument(doc) {
    return new Event({
      over: doc.over,
      ball: doc.ball,
      runs: doc.runs,
      wicket: doc.wicket,
      matchId: doc.matchId,
      timestamp: doc.timestamp,
      eventType: doc.eventType,
      version: doc.version,
      previousData: doc.previousData,
      enteredBy: doc.enteredBy
    });
  }

  /**
   * Save event to database with upsert logic
   */
  async save() {
    try {
      const collection = await databaseManager.getEventsCollection();
      const document = this.toDocument();

      // Check if event already exists for this key and matchId
      const existingEvent = await collection.findOne({
        key: this.key,
        matchId: this.matchId
      }, { sort: { version: -1 } });

      if (existingEvent) {
        // This is a correction - increment version and store previous data
        document.eventType = 'correction';
        document.version = existingEvent.version + 1;
        document.previousData = {
          runs: existingEvent.runs,
          wicket: existingEvent.wicket
        };
      }

      const result = await collection.insertOne(document);
      return {
        success: true,
        insertedId: result.insertedId,
        isCorrection: document.eventType === 'correction',
        version: document.version
      };
    } catch (error) {
      console.error('Error saving event:', error.message);
      throw new Error(`Failed to save event: ${error.message}`);
    }
  }

  /**
   * Find events by matchId, sorted by over and ball
   */
  static async findByMatchId(matchId = 'default') {
    try {
      const collection = await databaseManager.getEventsCollection();
      
      // Get the latest version of each event (key) for the match
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
        { $sort: { over: 1, ball: 1 } }
      ];

      const events = await collection.aggregate(pipeline).toArray();
      return events.map(doc => Event.fromDocument(doc));
    } catch (error) {
      console.error('Error finding events by matchId:', error.message);
      throw new Error(`Failed to find events: ${error.message}`);
    }
  }

  /**
   * Find all versions of events for audit purposes
   */
  static async findAllVersionsByMatchId(matchId = 'default') {
    try {
      const collection = await databaseManager.getEventsCollection();
      const events = await collection.find({ matchId })
        .sort({ over: 1, ball: 1, version: 1 })
        .toArray();
      
      return events.map(doc => Event.fromDocument(doc));
    } catch (error) {
      console.error('Error finding all event versions:', error.message);
      throw new Error(`Failed to find event versions: ${error.message}`);
    }
  }

  /**
   * Find recent events for display log (last 20 events)
   */
  static async findRecentEvents(matchId = 'default', limit = 20) {
    try {
      const collection = await databaseManager.getEventsCollection();
      
      // Get latest version of each event, sorted by timestamp descending
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
        { $sort: { timestamp: -1 } },
        { $limit: limit }
      ];

      const events = await collection.aggregate(pipeline).toArray();
      return events.map(doc => Event.fromDocument(doc));
    } catch (error) {
      console.error('Error finding recent events:', error.message);
      throw new Error(`Failed to find recent events: ${error.message}`);
    }
  }

  /**
   * Initialize database indexes for optimal performance
   */
  static async createIndexes() {
    try {
      const collection = await databaseManager.getEventsCollection();
      
      console.log('Creating database indexes...');
      
      // Compound index for efficient querying by matchId and key
      await collection.createIndex(
        { matchId: 1, key: 1 },
        { 
          name: 'matchId_key_compound',
          background: true 
        }
      );

      // Compound index for time-based queries
      await collection.createIndex(
        { matchId: 1, timestamp: 1 },
        { 
          name: 'matchId_timestamp_compound',
          background: true 
        }
      );

      // Compound index for over-based queries
      await collection.createIndex(
        { matchId: 1, over: 1, ball: 1 },
        { 
          name: 'matchId_over_ball_compound',
          background: true 
        }
      );

      // Index for version-based queries (for corrections)
      await collection.createIndex(
        { matchId: 1, key: 1, version: -1 },
        { 
          name: 'matchId_key_version_compound',
          background: true 
        }
      );

      console.log('Database indexes created successfully');
      
      // List all indexes for verification
      const indexes = await collection.listIndexes().toArray();
      console.log('Current indexes:', indexes.map(idx => idx.name));
      
      return true;
    } catch (error) {
      console.error('Error creating indexes:', error.message);
      throw new Error(`Failed to create indexes: ${error.message}`);
    }
  }

  /**
   * Get collection statistics
   */
  static async getCollectionStats() {
    try {
      const collection = await databaseManager.getEventsCollection();
      const stats = await collection.stats();
      
      return {
        documentCount: stats.count,
        storageSize: stats.storageSize,
        indexCount: stats.nindexes,
        totalIndexSize: stats.totalIndexSize
      };
    } catch (error) {
      console.error('Error getting collection stats:', error.message);
      return null;
    }
  }
}

module.exports = Event;