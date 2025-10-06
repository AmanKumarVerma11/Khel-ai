# Cricket Score Tracker API Endpoints

This document describes the implemented API endpoints for the cricket score tracking system.

## Base URL
```
http://localhost:5000/api
```

## Endpoints

### 1. POST /update
Submit score updates for cricket matches.

**Request Body:**
```json
{
  "over": 4,
  "ball": 2,
  "runs": 6,
  "wicket": false,
  "matchId": "match-123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Score updated successfully",
  "data": {
    "eventStored": true,
    "isCorrection": false,
    "currentScore": {
      "runs": 25,
      "wickets": 1,
      "overs": "4.2"
    },
    "event": {
      "key": "4.2",
      "matchId": "match-123",
      "over": 4,
      "ball": 2,
      "runs": 6,
      "wicket": false,
      "timestamp": "2024-01-01T12:00:00.000Z",
      "eventType": "new"
    }
  }
}
```

**Features:**
- Validates input data (over > 0, ball 1-6, runs 0-6)
- Handles corrections automatically (same over.ball with different data)
- Broadcasts updates via Socket.io to all connected clients
- Returns current score after update

### 2. GET /simulate
Start automated score simulation with predefined sequence.

**Query Parameters:**
- `matchId` (optional): Match identifier (default: "default")
- `delay` (optional): Delay between events in ms (default: 2500)
- `maxRetries` (optional): Maximum retry attempts (default: 3)

**Example:**
```
GET /api/simulate?matchId=demo&delay=2000&maxRetries=3
```

**Response:**
```json
{
  "success": true,
  "message": "Score simulation started",
  "data": {
    "matchId": "demo",
    "delay": 2000,
    "maxRetries": 3,
    "sequence": "Over 4.1 to 5.1 with deliberate error at 4.2",
    "startedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

**Simulation Sequence:**
1. 4.1: 1 run
2. 4.2: 6 runs (deliberate error)
3. 4.3: 0 runs
4. 4.4: 4 runs
5. 4.5: 2 runs
6. 4.6: 1 run
7. 5.1: 0 runs + wicket
8. **Correction**: 4.2 changed from 6 runs to 0 runs

**Features:**
- Runs asynchronously (returns immediately)
- Implements exponential backoff retry logic
- Broadcasts each event via Socket.io
- Demonstrates correction handling

### 3. GET /score
Retrieve current score for a match.

**Query Parameters:**
- `matchId` (optional): Match identifier (default: "default")

**Example:**
```
GET /api/score?matchId=match-123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "matchId": "match-123",
    "score": {
      "runs": 25,
      "wickets": 1,
      "overs": "4.2"
    },
    "ballsFaced": 8,
    "lastEvent": {
      "key": "4.2",
      "over": 4,
      "ball": 2,
      "runs": 6,
      "wicket": false,
      "timestamp": "2024-01-01T12:00:00.000Z",
      "eventType": "new"
    },
    "computedAt": "2024-01-01T12:00:01.000Z"
  }
}
```

### 4. GET /events
Retrieve recent events log for a match.

**Query Parameters:**
- `matchId` (optional): Match identifier (default: "default")
- `limit` (optional): Number of events to return (default: 20)

**Example:**
```
GET /api/events?matchId=match-123&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "matchId": "match-123",
    "events": [
      {
        "key": "4.2",
        "over": 4,
        "ball": 2,
        "runs": 0,
        "wicket": false,
        "timestamp": "2024-01-01T12:00:02.000Z",
        "eventType": "correction",
        "version": 2
      },
      {
        "key": "4.1",
        "over": 4,
        "ball": 1,
        "runs": 1,
        "wicket": false,
        "timestamp": "2024-01-01T12:00:00.000Z",
        "eventType": "new",
        "version": 1
      }
    ],
    "count": 2
  }
}
```

### 5. POST /correct
Explicit score correction with additional metadata.

**Request Body:**
```json
{
  "over": 4,
  "ball": 2,
  "runs": 0,
  "wicket": false,
  "matchId": "match-123",
  "reason": "Scorer error - was 6 runs, should be 0"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Score corrected successfully",
  "data": {
    "eventStored": true,
    "isCorrection": true,
    "currentScore": {
      "runs": 19,
      "wickets": 1,
      "overs": "4.2"
    },
    "correction": {
      "originalEvent": {
        "runs": 6,
        "wicket": false,
        "version": 1
      },
      "reason": "Scorer error - was 6 runs, should be 0",
      "correctedAt": "2024-01-01T12:00:02.000Z"
    }
  }
}
```

### 6. GET /simulate/status
Get current simulation status and progress.

**Query Parameters:**
- `matchId` (optional): Match identifier (default: "default")

**Response:**
```json
{
  "success": true,
  "data": {
    "matchId": "default",
    "currentScore": {
      "runs": 8,
      "wickets": 1,
      "overs": "5.1"
    },
    "hasSimulatedEvents": true,
    "simulatedEventsCount": 8,
    "lastSimulatedEvent": {
      "key": "5.1",
      "runs": 0,
      "wicket": true,
      "timestamp": "2024-01-01T12:00:15.000Z"
    },
    "totalEvents": 8
  }
}
```

### 7. POST /simulate/custom
Run custom simulation sequence.

**Request Body:**
```json
{
  "matchId": "custom-match",
  "delay": 1500,
  "maxRetries": 2,
  "events": [
    { "over": 1, "ball": 1, "runs": 4, "wicket": false },
    { "over": 1, "ball": 2, "runs": 6, "wicket": false },
    { "over": 1, "ball": 3, "runs": 0, "wicket": true }
  ]
}
```

## Socket.io Events

The API broadcasts real-time updates via Socket.io:

### score-update
Broadcasted when scores are updated or corrected.

```json
{
  "matchId": "match-123",
  "score": {
    "runs": 25,
    "wickets": 1,
    "overs": "4.2"
  },
  "lastEvent": {
    "over": 4,
    "ball": 2,
    "runs": 6,
    "wicket": false,
    "isCorrection": false
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### simulation-complete
Broadcasted when simulation finishes.

```json
{
  "matchId": "demo",
  "message": "Score simulation completed with correction",
  "completedAt": "2024-01-01T12:00:30.000Z"
}
```

### simulation-error
Broadcasted when simulation encounters errors.

```json
{
  "matchId": "demo",
  "error": "Database connection failed",
  "failedAt": "2024-01-01T12:00:15.000Z"
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid event data",
    "details": ["Over must be a positive number", "Ball must be between 1 and 6"]
  }
}
```

Common error codes:
- `VALIDATION_ERROR`: Invalid input data
- `MISSING_FIELDS`: Required fields not provided
- `PROCESSING_ERROR`: Event processing failed
- `STORAGE_ERROR`: Database operation failed
- `INTERNAL_ERROR`: Unexpected server error

## Testing

Use the provided test script to verify endpoints:

```bash
node test-endpoints.js
```

This will test all endpoints with various scenarios including valid data, corrections, and error cases.