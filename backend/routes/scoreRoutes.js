const express = require('express');
const ScoreController = require('../controllers/scoreController');
const SimulationController = require('../controllers/simulationController');

const router = express.Router();

/**
 * Score Management Routes
 */

// POST /update - Submit score updates
router.post('/update', ScoreController.updateScore);

// GET /score - Get current score
router.get('/score', ScoreController.getScore);

// GET /events - Get recent events log
router.get('/events', ScoreController.getRecentEvents);

// POST /correct - Explicit score correction
router.post('/correct', ScoreController.correctScore);

/**
 * Simulation Routes
 */

// GET /simulate - Start predefined simulation sequence
router.get('/simulate', SimulationController.simulateScore);

// GET /simulate/status - Get simulation status
router.get('/simulate/status', SimulationController.getSimulationStatus);

// POST /simulate/custom - Run custom simulation sequence
router.post('/simulate/custom', SimulationController.customSimulation);

/**
 * Socket.io Management Routes
 */

// GET /socket/stats - Get Socket.io connection statistics
router.get('/socket/stats', (req, res) => {
  try {
    const socketManager = req.app.get('socketManager');
    if (!socketManager) {
      return res.status(500).json({
        success: false,
        error: 'SocketManager not available'
      });
    }

    const stats = socketManager.getConnectionStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /socket/match/:matchId - Get clients for specific match
router.get('/socket/match/:matchId', (req, res) => {
  try {
    const socketManager = req.app.get('socketManager');
    const matchId = req.params.matchId;
    
    if (!socketManager) {
      return res.status(500).json({
        success: false,
        error: 'SocketManager not available'
      });
    }

    const clients = socketManager.getMatchClients(matchId);
    const clientCount = socketManager.getRoomClientCount(matchId);
    
    res.json({
      success: true,
      data: {
        matchId,
        clientCount,
        clients: clients.map(client => ({
          socketId: client.socketId,
          connectedAt: client.connectedAt,
          joinedAt: client.joinedAt
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;