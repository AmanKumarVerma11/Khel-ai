# Cricket Score Tracker - Backend

Node.js/Express backend API for the live cricket score tracker.

## Technology Stack

- **Framework**: Express.js
- **Database**: MongoDB
- **Real-time**: Socket.io
- **Language**: JavaScript/Node.js

## Project Structure

```
backend/
├── app.js              # Main server file
├── controllers/        # API endpoint controllers
├── services/           # Business logic services
├── models/            # Data models and schemas
├── routes/            # API route definitions
├── utils/             # Utility functions
├── .env               # Environment variables
└── package.json       # Dependencies and scripts
```

## Development

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```

### Run Production Server
```bash
npm start
```

### Run Tests
```bash
npm test
```

## Environment Variables

Create a `.env` file:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/cricket
NODE_ENV=development
```

## API Endpoints (To be implemented)

- `POST /update` - Submit score updates
- `GET /simulate` - Trigger score simulation
- `GET /score/:matchId` - Get current score for a match

## Services (To be implemented)

- `EventProcessor` - Handle score events and corrections
- `ScoreComputer` - Calculate current match state
- `SocketManager` - Manage real-time communication
- `ScoreSimulator` - Generate automated score sequences

## Database Schema

Events are stored in MongoDB with the following structure:

```javascript
{
  key: "4.2",              // over.ball format
  matchId: "default",      // match identifier
  over: 4,                 // over number
  ball: 2,                 // ball number (1-6)
  runs: 0,                 // runs scored (0-6)
  wicket: false,           // wicket status
  timestamp: Date,         // event timestamp
  eventType: "new",        // "new" or "correction"
  version: 1,              // version for corrections
  previousData: {},        // original data for corrections
  enteredBy: "user"        // user identifier
}
```