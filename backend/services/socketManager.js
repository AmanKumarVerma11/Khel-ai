/**
 * Socket Manager Service
 * Handles Socket.io real-time communication with room-based architecture
 * Manages client connections, room joining/leaving, and score broadcasting
 */
class SocketManager {
  constructor(io) {
    this.io = io;
    this.connectedClients = new Map(); // Track connected clients
    this.roomStats = new Map(); // Track room statistics
    
    this.setupSocketHandlers();
  }

  /**
   * Set up Socket.io event handlers
   */
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      // Track connected client
      this.connectedClients.set(socket.id, {
        socketId: socket.id,
        connectedAt: new Date(),
        matchId: null,
        userAgent: socket.handshake.headers['user-agent'] || 'Unknown'
      });

      // Handle match room joining
      socket.on('join-match', (data) => {
        this.handleJoinMatch(socket, data);
      });

      // Handle match room leaving
      socket.on('leave-match', (data) => {
        this.handleLeaveMatch(socket, data);
      });

      // Handle client requesting current score
      socket.on('request-score', (data) => {
        this.handleScoreRequest(socket, data);
      });

      // Handle client disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnection(socket, reason);
      });

      // Handle connection errors
      socket.on('error', (error) => {
        console.error(`Socket error for client ${socket.id}:`, error);
      });
    });
  }

  /**
   * Handle client joining a match room
   * @param {Object} socket - Socket.io socket instance
   * @param {Object|string} data - Match data or matchId string
   */
  handleJoinMatch(socket, data) {
    try {
      // Handle both string matchId and object with matchId
      const matchId = typeof data === 'string' ? data : (data?.matchId || 'default');
      const roomName = this.getRoomName(matchId);

      // Leave any existing rooms first
      const clientInfo = this.connectedClients.get(socket.id);
      if (clientInfo && clientInfo.matchId) {
        const oldRoomName = this.getRoomName(clientInfo.matchId);
        socket.leave(oldRoomName);
        this.updateRoomStats(clientInfo.matchId, -1);
        console.log(`Client ${socket.id} left room: ${oldRoomName}`);
      }

      // Join the new room
      socket.join(roomName);
      
      // Update client info
      if (clientInfo) {
        clientInfo.matchId = matchId;
        clientInfo.joinedAt = new Date();
      }

      // Update room statistics
      this.updateRoomStats(matchId, 1);

      console.log(`Client ${socket.id} joined match room: ${roomName}`);

      // Send confirmation to client
      socket.emit('match-joined', {
        success: true,
        matchId: matchId,
        roomName: roomName,
        clientCount: this.getRoomClientCount(matchId),
        joinedAt: new Date()
      });

      // Notify other clients in the room about new client
      socket.to(roomName).emit('client-joined', {
        clientId: socket.id,
        clientCount: this.getRoomClientCount(matchId),
        joinedAt: new Date()
      });

    } catch (error) {
      console.error(`Error handling join-match for client ${socket.id}:`, error);
      socket.emit('match-join-error', {
        success: false,
        error: 'Failed to join match room',
        details: error.message
      });
    }
  }

  /**
   * Handle client leaving a match room
   * @param {Object} socket - Socket.io socket instance
   * @param {Object|string} data - Match data or matchId string
   */
  handleLeaveMatch(socket, data) {
    try {
      const matchId = typeof data === 'string' ? data : (data?.matchId || 'default');
      const roomName = this.getRoomName(matchId);

      // Leave the room
      socket.leave(roomName);

      // Update client info
      const clientInfo = this.connectedClients.get(socket.id);
      if (clientInfo) {
        clientInfo.matchId = null;
        clientInfo.leftAt = new Date();
      }

      // Update room statistics
      this.updateRoomStats(matchId, -1);

      console.log(`Client ${socket.id} left match room: ${roomName}`);

      // Send confirmation to client
      socket.emit('match-left', {
        success: true,
        matchId: matchId,
        leftAt: new Date()
      });

      // Notify other clients in the room
      socket.to(roomName).emit('client-left', {
        clientId: socket.id,
        clientCount: this.getRoomClientCount(matchId),
        leftAt: new Date()
      });

    } catch (error) {
      console.error(`Error handling leave-match for client ${socket.id}:`, error);
      socket.emit('match-leave-error', {
        success: false,
        error: 'Failed to leave match room',
        details: error.message
      });
    }
  }

  /**
   * Handle client requesting current score
   * @param {Object} socket - Socket.io socket instance
   * @param {Object} data - Request data with matchId
   */
  async handleScoreRequest(socket, data) {
    try {
      const matchId = data?.matchId || 'default';
      
      // Import ScoreComputer here to avoid circular dependencies
      const ScoreComputer = require('./scoreComputer');
      
      // Get current score
      const currentScore = await ScoreComputer.computeScore(matchId);
      
      // Send score to requesting client
      socket.emit('score-update', {
        matchId: matchId,
        score: {
          runs: currentScore.runs,
          wickets: currentScore.wickets,
          overs: currentScore.overs
        },
        lastEvent: currentScore.lastEvent,
        timestamp: new Date(),
        requestedBy: socket.id
      });

      console.log(`Sent current score to client ${socket.id} for match ${matchId}`);

    } catch (error) {
      console.error(`Error handling score request for client ${socket.id}:`, error);
      socket.emit('score-request-error', {
        success: false,
        error: 'Failed to get current score',
        details: error.message
      });
    }
  }

  /**
   * Handle client disconnection
   * @param {Object} socket - Socket.io socket instance
   * @param {string} reason - Disconnection reason
   */
  handleDisconnection(socket, reason) {
    try {
      const clientInfo = this.connectedClients.get(socket.id);
      
      if (clientInfo && clientInfo.matchId) {
        // Update room statistics
        this.updateRoomStats(clientInfo.matchId, -1);
        
        // Notify other clients in the room
        const roomName = this.getRoomName(clientInfo.matchId);
        socket.to(roomName).emit('client-disconnected', {
          clientId: socket.id,
          clientCount: this.getRoomClientCount(clientInfo.matchId),
          reason: reason,
          disconnectedAt: new Date()
        });
      }

      // Remove client from tracking
      this.connectedClients.delete(socket.id);

      console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);

    } catch (error) {
      console.error(`Error handling disconnection for client ${socket.id}:`, error);
    }
  }

  /**
   * Broadcast score update to all clients in a match room
   * @param {string} matchId - Match identifier
   * @param {Object} scoreData - Score data to broadcast
   * @param {Object} eventData - Event data that triggered the update
   */
  async broadcastScore(matchId, scoreData, eventData = null) {
    try {
      const roomName = this.getRoomName(matchId);
      const clientCount = this.getRoomClientCount(matchId);

      if (clientCount === 0) {
        console.log(`No clients in room ${roomName}, skipping broadcast`);
        return {
          success: true,
          clientCount: 0,
          message: 'No clients to broadcast to'
        };
      }

      const broadcastData = {
        matchId: matchId,
        score: {
          runs: scoreData.runs,
          wickets: scoreData.wickets,
          overs: scoreData.overs
        },
        lastEvent: eventData ? {
          key: eventData.key,
          over: eventData.over,
          ball: eventData.ball,
          runs: eventData.runs,
          wicket: eventData.wicket,
          isCorrection: eventData.isCorrection || false,
          eventType: eventData.eventType || 'new',
          previousData: eventData.previousData || null
        } : scoreData.lastEvent,
        timestamp: new Date(),
        broadcastId: this.generateBroadcastId()
      };

      // Broadcast to all clients in the room
      this.io.to(roomName).emit('score-update', broadcastData);

      console.log(`Broadcasted score update to ${clientCount} clients in room ${roomName}:`, {
        runs: scoreData.runs,
        wickets: scoreData.wickets,
        overs: scoreData.overs,
        lastEvent: broadcastData.lastEvent?.key
      });

      return {
        success: true,
        clientCount: clientCount,
        broadcastId: broadcastData.broadcastId,
        roomName: roomName,
        broadcastedAt: broadcastData.timestamp
      };

    } catch (error) {
      console.error(`Error broadcasting score for match ${matchId}:`, error);
      throw new Error(`Failed to broadcast score: ${error.message}`);
    }
  }

  /**
   * Get room name for a match
   * @param {string} matchId - Match identifier
   * @returns {string} Room name
   */
  getRoomName(matchId) {
    return `match-${matchId}`;
  }

  /**
   * Get number of clients in a match room
   * @param {string} matchId - Match identifier
   * @returns {number} Number of clients
   */
  getRoomClientCount(matchId) {
    const roomName = this.getRoomName(matchId);
    const room = this.io.sockets.adapter.rooms.get(roomName);
    return room ? room.size : 0;
  }

  /**
   * Update room statistics
   * @param {string} matchId - Match identifier
   * @param {number} delta - Change in client count (+1 or -1)
   */
  updateRoomStats(matchId, delta) {
    if (!this.roomStats.has(matchId)) {
      this.roomStats.set(matchId, {
        matchId: matchId,
        currentClients: 0,
        totalConnections: 0,
        createdAt: new Date(),
        lastActivity: new Date()
      });
    }

    const stats = this.roomStats.get(matchId);
    stats.currentClients = Math.max(0, stats.currentClients + delta);
    
    if (delta > 0) {
      stats.totalConnections += delta;
    }
    
    stats.lastActivity = new Date();
  }

  /**
   * Generate unique broadcast ID for tracking
   * @returns {string} Unique broadcast ID
   */
  generateBroadcastId() {
    return `broadcast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection statistics
   * @returns {Object} Connection statistics
   */
  getConnectionStats() {
    const totalClients = this.connectedClients.size;
    const roomsWithClients = Array.from(this.roomStats.values())
      .filter(stats => stats.currentClients > 0);

    return {
      totalConnectedClients: totalClients,
      activeRooms: roomsWithClients.length,
      roomStats: Array.from(this.roomStats.values()),
      connectedClients: Array.from(this.connectedClients.values()).map(client => ({
        socketId: client.socketId,
        matchId: client.matchId,
        connectedAt: client.connectedAt,
        joinedAt: client.joinedAt
      }))
    };
  }

  /**
   * Get clients in a specific match room
   * @param {string} matchId - Match identifier
   * @returns {Array} Array of client information
   */
  getMatchClients(matchId) {
    return Array.from(this.connectedClients.values())
      .filter(client => client.matchId === matchId);
  }

  /**
   * Broadcast a custom message to a match room
   * @param {string} matchId - Match identifier
   * @param {string} eventName - Event name
   * @param {Object} data - Data to broadcast
   */
  broadcastToMatch(matchId, eventName, data) {
    const roomName = this.getRoomName(matchId);
    this.io.to(roomName).emit(eventName, {
      ...data,
      matchId: matchId,
      timestamp: new Date()
    });
  }

  /**
   * Send message to specific client
   * @param {string} socketId - Socket ID
   * @param {string} eventName - Event name
   * @param {Object} data - Data to send
   */
  sendToClient(socketId, eventName, data) {
    this.io.to(socketId).emit(eventName, {
      ...data,
      timestamp: new Date()
    });
  }

  /**
   * Cleanup inactive rooms and connections
   * Should be called periodically to maintain performance
   */
  cleanup() {
    const now = new Date();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

    // Clean up room stats for inactive rooms
    for (const [matchId, stats] of this.roomStats.entries()) {
      if (stats.currentClients === 0 && 
          (now - stats.lastActivity) > inactiveThreshold) {
        this.roomStats.delete(matchId);
        console.log(`Cleaned up inactive room stats for match: ${matchId}`);
      }
    }

    console.log(`Cleanup completed. Active rooms: ${this.roomStats.size}, Connected clients: ${this.connectedClients.size}`);
  }
}

module.exports = SocketManager;