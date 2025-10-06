const { MongoClient } = require('mongodb');

class DatabaseManager {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    this.databaseName = 'cricket';
    this.collectionName = 'events';
    this.maxRetries = 3;
    this.retryDelay = 1000; // Start with 1 second
  }

  /**
   * Connect to MongoDB with retry logic and connection pooling
   */
  async connect() {
    if (this.isConnected && this.client) {
      return this.db;
    }

    let retries = 0;
    while (retries < this.maxRetries) {
      try {
        console.log(`Attempting to connect to MongoDB (attempt ${retries + 1}/${this.maxRetries})...`);
        
        // MongoDB connection options with connection pooling
        const options = {
          maxPoolSize: 10, // Maximum number of connections in the pool
          minPoolSize: 2,  // Minimum number of connections in the pool
          maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
          serverSelectionTimeoutMS: 5000, // How long to try selecting a server
          socketTimeoutMS: 45000, // How long a send or receive on a socket can take
          connectTimeoutMS: 10000, // How long to wait for a connection to be established
          retryWrites: true, // Retry writes on network errors
          retryReads: true,  // Retry reads on network errors
        };

        this.client = new MongoClient(this.connectionString, options);
        await this.client.connect();
        
        // Test the connection
        await this.client.db('admin').command({ ping: 1 });
        
        this.db = this.client.db(this.databaseName);
        this.isConnected = true;
        
        console.log(`Successfully connected to MongoDB database: ${this.databaseName}`);
        
        // Set up connection event listeners
        this.setupEventListeners();
        
        return this.db;
      } catch (error) {
        console.error(`MongoDB connection attempt ${retries + 1} failed:`, error.message);
        retries++;
        
        if (retries < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, retries - 1); // Exponential backoff
          console.log(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
        } else {
          console.error('Max retry attempts reached. Could not connect to MongoDB.');
          throw new Error(`Failed to connect to MongoDB after ${this.maxRetries} attempts: ${error.message}`);
        }
      }
    }
  }

  /**
   * Set up event listeners for connection monitoring
   */
  setupEventListeners() {
    if (!this.client) return;

    this.client.on('connectionPoolCreated', () => {
      console.log('MongoDB connection pool created');
    });

    this.client.on('connectionPoolClosed', () => {
      console.log('MongoDB connection pool closed');
      this.isConnected = false;
    });

    this.client.on('serverHeartbeatFailed', (event) => {
      console.warn('MongoDB server heartbeat failed:', event);
    });

    this.client.on('topologyDescriptionChanged', (event) => {
      console.log('MongoDB topology changed:', event.newDescription.type);
    });
  }

  /**
   * Get the events collection with proper error handling
   */
  async getEventsCollection() {
    try {
      if (!this.isConnected || !this.db) {
        await this.connect();
      }
      return this.db.collection(this.collectionName);
    } catch (error) {
      console.error('Error getting events collection:', error.message);
      throw new Error(`Failed to access events collection: ${error.message}`);
    }
  }

  /**
   * Check if the database connection is healthy
   */
  async healthCheck() {
    try {
      if (!this.isConnected || !this.client) {
        throw new Error('Not connected to database');
      }
      
      await this.client.db('admin').command({ ping: 1 });
      return { status: 'healthy', database: this.databaseName };
    } catch (error) {
      console.error('Database health check failed:', error.message);
      return { status: 'unhealthy', error: error.message };
    }
  }

  /**
   * Gracefully close the database connection
   */
  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
        this.db = null;
        this.isConnected = false;
        console.log('MongoDB connection closed successfully');
      }
    } catch (error) {
      console.error('Error closing MongoDB connection:', error.message);
      throw error;
    }
  }

  /**
   * Utility function for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      databaseName: this.databaseName,
      collectionName: this.collectionName
    };
  }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing MongoDB connection...');
  await databaseManager.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing MongoDB connection...');
  await databaseManager.disconnect();
  process.exit(0);
});

module.exports = databaseManager;