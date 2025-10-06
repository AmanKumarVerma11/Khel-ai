# Live Cricket Score Tracker

A real-time cricket score tracking application that handles live score updates and corrections using an event-sourced architecture.

## Project Structure

```
├── frontend/          # Next.js frontend application
├── backend/           # Node.js/Express backend API
└── README.md         # This file
```

## Features

- Real-time score updates using Socket.io
- Event-sourced architecture for handling corrections
- MongoDB for persistent event storage
- Responsive web interface with Tailwind CSS
- Automated score simulation for demonstration

## Quick Start

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

### Installation

1. Clone the repository
2. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

3. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```

4. Configure environment variables:
   - Copy `.env` files and update MongoDB connection strings
   - Ensure ports 3000 (frontend) and 5000 (backend) are available

### Running the Application

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Start the frontend development server:
   ```bash
   cd frontend
   npm run dev
   ```

3. Open http://localhost:3000 in your browser

### Score Simulation

The project includes a standalone simulation script that demonstrates the error correction capability:

```bash
# Run simulation with default settings
node simulate.js

# Run simulation with custom parameters
node simulate.js --matchId "demo-match" --delay 1000 --maxRetries 5

# Test backend connectivity
node simulate.js --test

# Show help
node simulate.js --help
```

The simulation script:
- Sends score events from over 4.1 to 5.1
- Includes a deliberate error at 4.2 (6 runs instead of 0)
- Applies a correction after the sequence completes
- Demonstrates real-time score updates and error handling

## Architecture

The application uses:
- **Frontend**: Next.js with Tailwind CSS for responsive UI
- **Backend**: Express.js with Socket.io for real-time communication
- **Database**: MongoDB for event storage with proper indexing
- **Real-time**: Socket.io for instant score updates across all clients

## Development

See individual README files in `frontend/` and `backend/` directories for detailed development instructions.