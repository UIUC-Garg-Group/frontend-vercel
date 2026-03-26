# UR2 Frontend

React web application for the UR2 (Universal Reagent 2) laboratory automation system. Provides a dashboard for creating, monitoring, and managing chemical analysis tests in real time.

## Features

- **Test Management** — Create and configure analysis runs through an intuitive form
- **Real-time Monitoring** — Live progress tracking with stage-by-stage status updates
- **Results Display** — View concentration results, dissolution index, and captured images
- **Image Analysis** — Upload images manually for offline aluminum/silicon analysis
- **Team Management** — Google OAuth authentication with team-based access control
- **Responsive Design** — Works on desktop and mobile

## Getting Started

### Prerequisites
- Node.js 14+
- npm

### Setup

```bash
npm install
cp .env.example .env   # configure environment variables
npm start              # dev server on http://localhost:3000
```

### Environment Variables

Copy `.env.example` and fill in the required values. See the example file for details.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start development server |
| `npm run build` | Production build |
| `npm test` | Run test suite |

## Deployment

Deployed on Vercel. See `VERCEL-DEPLOYMENT.md` for details.

## Tech Stack

- React 18
- Tailwind CSS
- Material UI (stepper components)
- Socket.io (real-time updates)
- MQTT.js (device communication)
