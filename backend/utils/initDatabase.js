// Try MongoDB first, fallback to in-memory database
let databaseManager;
try {
  databaseManager = require('./database');
} catch (error) {
  console.log('MongoDB not available, using in-memory database');
  databaseManager = require('./memoryDatabase');
}
const Event = require('../models/Event');

/**
 * Initialize database connection and create necessary indexes
 */
async function initializeDatabase() {
  try {
    console.log('Initializing database...');

    // Try MongoDB first, fallback to in-memory database
    try {
      const mongoManager = require('./database');
      await mongoManager.connect();
      databaseManager = mongoManager;
      console.log('MongoDB connection established');
    } catch (mongoError) {
      console.log('MongoDB connection failed, switching to in-memory database');
      console.log('MongoDB error:', mongoError.message);
      databaseManager = require('./memoryDatabase');
      await databaseManager.connect();
      console.log('In-memory database connection established');
    }

    // Create indexes for optimal performance
    await Event.createIndexes();
    console.log('Database indexes created');

    // Verify database health
    const healthCheck = await databaseManager.healthCheck();
    if (healthCheck.status === 'healthy') {
      console.log('Database initialization completed successfully');

      // Log collection statistics
      const stats = await Event.getCollectionStats();
      if (stats) {
        console.log('Collection statistics:', {
          documents: stats.documentCount,
          indexes: stats.indexCount,
          storageSize: `${Math.round(stats.storageSize / 1024)} KB`,
          indexSize: `${Math.round(stats.totalIndexSize / 1024)} KB`
        });
      }

      return true;
    } else {
      throw new Error(`Database health check failed: ${healthCheck.error}`);
    }
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    throw error;
  }
}

/**
 * Cleanup database resources
 */
async function cleanupDatabase() {
  try {
    await databaseManager.disconnect();
    console.log('Database cleanup completed');
  } catch (error) {
    console.error('Database cleanup failed:', error.message);
    throw error;
  }
}

module.exports = {
  initializeDatabase,
  cleanupDatabase
};