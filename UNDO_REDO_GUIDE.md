# Undo/Redo Functionality Guide

This guide explains how to use the new undo/redo functionality for cricket score ranges.

## Overview

The undo/redo system allows you to:
- Remove events from a specific range (e.g., from over 1.2 to 1.5)
- Restore previously undone events
- Track the history of undo/redo operations
- Maintain data integrity while allowing corrections

## Features

### 1. Range-Based Undo
- Specify a range using over.ball format (e.g., "1.2" to "1.5")
- Preview events before undoing them
- See the impact on runs and wickets
- Undo multiple events at once

### 2. Redo Operations
- Restore previously undone ranges
- View undo history with redo options
- Track who performed each operation and when

### 3. Data Integrity
- Events are never deleted, only marked as undone
- Full audit trail of all operations
- Score computation automatically excludes undone events
- Version tracking for all event changes

## API Endpoints

### POST /api/undo-range
Undo events in a specific range.

**Request Body:**
```json
{
  "matchId": "default",
  "fromKey": "1.2",
  "toKey": "1.5",
  "undoneBy": "user",
  "reason": "Correcting scoring error"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "operationId": "undo_1234567890_abc123",
    "matchId": "default",
    "range": { "from": "1.2", "to": "1.5" },
    "eventsUndone": 4,
    "newScore": {
      "runs": 45,
      "wickets": 2,
      "overs": "5.3"
    },
    "canRedo": true
  }
}
```

### POST /api/redo
Redo a previously undone operation.

**Request Body:**
```json
{
  "operationId": "undo_1234567890_abc123",
  "redoneBy": "user"
}
```

### GET /api/undo-history
Get undo/redo history for a match.

**Query Parameters:**
- `matchId` (optional): Match identifier (default: "default")
- `limit` (optional): Maximum operations to return (default: 20, max: 100)

### GET /api/range-preview
Preview events in a range before undoing.

**Query Parameters:**
- `matchId` (optional): Match identifier
- `fromKey` (required): Starting event key (e.g., "1.2")
- `toKey` (required): Ending event key (e.g., "1.5")

### GET /api/active-events
Get currently active events (excluding undone events).

## Frontend Usage

### UndoRedoPanel Component
The `UndoRedoPanel` component provides a complete UI for undo/redo operations:

```jsx
import UndoRedoPanel from '../components/UndoRedoPanel';

<UndoRedoPanel matchId="default" />
```

### Features:
- **Range Input**: Enter from/to keys in over.ball format
- **Preview**: See events and impact before undoing
- **Undo History**: View past operations with redo buttons
- **Real-time Updates**: Automatically refreshes score after operations

## Usage Examples

### Example 1: Undo a Single Over
```
From: 2.1
To: 2.6
```
This will undo all events in over 2.

### Example 2: Undo Specific Balls
```
From: 1.3
To: 1.5
```
This will undo events from ball 3 to ball 5 of over 1.

### Example 3: Undo Across Overs
```
From: 1.5
To: 2.2
```
This will undo from ball 5 of over 1 through ball 2 of over 2.

## Testing

### Backend Testing
Run the test script to verify undo/redo functionality:

```bash
cd backend
node test-undo-redo.js
```

This will:
1. Create test events
2. Show initial score
3. Preview a range to undo
4. Perform undo operation
5. Verify score changes
6. Perform redo operation
7. Verify score restoration

### Manual Testing via API

1. **Create some events:**
```bash
curl -X POST http://localhost:5000/api/update \
  -H "Content-Type: application/json" \
  -d '{"over":1,"ball":1,"runs":4,"wicket":false,"matchId":"test"}'
```

2. **Preview range:**
```bash
curl "http://localhost:5000/api/range-preview?matchId=test&fromKey=1.1&toKey=1.1"
```

3. **Undo range:**
```bash
curl -X POST http://localhost:5000/api/undo-range \
  -H "Content-Type: application/json" \
  -d '{"matchId":"test","fromKey":"1.1","toKey":"1.1","undoneBy":"tester"}'
```

4. **Check undo history:**
```bash
curl "http://localhost:5000/api/undo-history?matchId=test"
```

5. **Redo operation:**
```bash
curl -X POST http://localhost:5000/api/redo \
  -H "Content-Type: application/json" \
  -d '{"operationId":"OPERATION_ID_FROM_UNDO","redoneBy":"tester"}'
```

## Data Model

### Event Types
- `new`: Original event entry
- `correction`: Manual correction of existing event
- `undone`: Event marked as undone (excluded from score)
- `restored`: Event restored from undo (included in score)

### Undo Operations Collection
```javascript
{
  operationId: "undo_1234567890_abc123",
  matchId: "default",
  operationType: "undo",
  range: { from: "1.2", to: "1.5" },
  undoneBy: "user",
  reason: "Correcting scoring error",
  timestamp: "2024-01-01T12:00:00Z",
  eventsUndone: [
    {
      key: "1.2",
      over: 1,
      ball: 2,
      runs: 4,
      wicket: false,
      version: 1,
      originalTimestamp: "2024-01-01T11:55:00Z"
    }
    // ... more events
  ],
  redoneAt: null, // Set when operation is redone
  redoneBy: null
}
```

## Best Practices

1. **Always Preview First**: Use the preview feature to understand the impact before undoing
2. **Provide Reasons**: Include meaningful reasons for undo operations for audit purposes
3. **Check History**: Review undo history to avoid duplicate operations
4. **Validate Ranges**: Ensure from/to keys are in correct format and logical order
5. **Monitor Performance**: Large ranges may take longer to process

## Error Handling

Common errors and solutions:

- **Invalid Range**: Check that keys are in "over.ball" format and from ≤ to
- **No Events Found**: Verify events exist in the specified range
- **Operation Not Found**: Check that the operation ID is correct for redo
- **Already Redone**: Cannot redo an operation that has already been redone

## Integration Notes

- The undo/redo system integrates seamlessly with existing score computation
- Socket.io broadcasts notify all connected clients of undo/redo operations
- The system maintains full backward compatibility with existing functionality
- All operations are logged for audit and debugging purposes