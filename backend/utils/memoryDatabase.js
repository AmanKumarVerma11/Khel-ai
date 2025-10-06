/**
 * In-Memory Database Implementation
 * Simple alternative to MongoDB for development/demo purposes
 */

class MemoryDatabase {
  constructor() {
    this.events = new Map(); // Store events by key
    this.isConnected = true;
  }

  async connect() {
    console.log('Connected to in-memory database');
    return Promise.resolve();
  }

  async disconnect() {
    this.events.clear();
    this.isConnected = false;
    console.log('Disconnected from in-memory database');
  }

  async insertOne(document) {
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const docWithId = { ...document, _id: id };
    
    // Store by key for easy retrieval
    const key = `${document.matchId}_${document.key}`;
    
    if (!this.events.has(key)) {
      this.events.set(key, []);
    }
    
    this.events.get(key).push(docWithId);
    
    return { insertedId: id };
  }

  async find(query = {}) {
    const results = [];
    
    for (const [key, versions] of this.events.entries()) {
      for (const doc of versions) {
        let matches = true;
        
        // Simple query matching
        for (const [field, value] of Object.entries(query)) {
          if (doc[field] !== value) {
            matches = false;
            break;
          }
        }
        
        if (matches) {
          results.push(doc);
        }
      }
    }
    
    return {
      toArray: () => Promise.resolve(results),
      sort: (sortObj) => ({
        toArray: () => {
          const sorted = [...results].sort((a, b) => {
            for (const [field, direction] of Object.entries(sortObj)) {
              if (a[field] < b[field]) return direction === 1 ? -1 : 1;
              if (a[field] > b[field]) return direction === 1 ? 1 : -1;
            }
            return 0;
          });
          return Promise.resolve(sorted);
        }
      })
    };
  }

  async findOne(query) {
    const results = await this.find(query);
    const array = await results.toArray();
    return array.length > 0 ? array[0] : null;
  }

  async aggregate(pipeline) {
    // Simple aggregation for getting latest versions
    const results = [];
    
    for (const [key, versions] of this.events.entries()) {
      if (versions.length > 0) {
        // Get latest version (highest version number)
        const latest = versions.reduce((prev, current) => 
          (current.version > prev.version) ? current : prev
        );
        results.push(latest);
      }
    }
    
    return {
      toArray: () => Promise.resolve(results)
    };
  }

  async createIndex() {
    // No-op for in-memory database
    return Promise.resolve();
  }

  async stats() {
    return {
      count: Array.from(this.events.values()).reduce((sum, versions) => sum + versions.length, 0),
      storageSize: 0,
      nindexes: 1,
      totalIndexSize: 0
    };
  }

  async listIndexes() {
    return {
      toArray: () => Promise.resolve([{ name: '_id_' }])
    };
  }
}

// Create singleton instance
const memoryDb = new MemoryDatabase();

// Mock MongoDB-like interface
const mockCollection = {
  insertOne: (doc) => memoryDb.insertOne(doc),
  find: (query) => memoryDb.find(query),
  findOne: (query) => memoryDb.findOne(query),
  aggregate: (pipeline) => memoryDb.aggregate(pipeline),
  createIndex: () => memoryDb.createIndex(),
  stats: () => memoryDb.stats(),
  listIndexes: () => memoryDb.listIndexes()
};

const mockDatabase = {
  collection: () => mockCollection
};

const mockDatabaseManager = {
  connect: () => memoryDb.connect(),
  disconnect: () => memoryDb.disconnect(),
  getEventsCollection: () => Promise.resolve(mockCollection),
  healthCheck: () => Promise.resolve({ status: 'healthy', database: 'memory' }),
  getConnectionStatus: () => ({ isConnected: true, databaseName: 'memory', collectionName: 'events' })
};

module.exports = mockDatabaseManager;