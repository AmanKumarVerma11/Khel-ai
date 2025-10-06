# Cricket Score Tracker - Frontend

Next.js frontend application for the live cricket score tracker.

## Technology Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **Real-time**: Socket.io Client
- **Language**: JavaScript/JSX

## Project Structure

```
frontend/
├── app/
│   ├── globals.css       # Global styles with Tailwind
│   ├── layout.jsx        # Root layout component
│   └── page.jsx          # Main page component
├── components/           # Reusable React components
├── hooks/               # Custom React hooks
├── utils/               # Utility functions
├── public/              # Static assets
└── package.json         # Dependencies and scripts
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

### Build for Production
```bash
npm run build
npm start
```

## Environment Variables

Create a `.env.local` file:

```
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

## Features

- Responsive design for mobile and desktop
- Real-time score updates via Socket.io
- Manual score entry form with validation
- Update log showing recent events
- Simulation controls for demonstration

## Components (To be implemented)

- `ScoreDisplay`: Shows current match score
- `ScoreEntryForm`: Manual score input form
- `UpdateLog`: Chronological event display
- `SimulationControls`: Automated score generation