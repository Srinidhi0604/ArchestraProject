# SentinelGrid

Autonomous infrastructure orchestration with AI agents, real-time monitoring, and interactive 3D visualization.

## Architecture

- **Frontend**: Next.js + Cesium 3D map (port 3001)
- **Orchestration**: Archestra A2A master agent (port 9000)
- **Backend**: Python MCP servers for power, hydro, sewage (ports 8001-8003)

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose

### Setup

```bash
# 1. Configure environment
cp .env.example .env.local
# Edit .env.local with your Archestra API key

# 2. Start infrastructure
docker-compose up -d

# 3. Start MCP servers
cd archestra-mcp-poc
python start_mcps_http.py

# 4. Start frontend
cd ../control-center
npm install
npm run dev
```

Open http://localhost:3001

## Features

- Interactive 3D infrastructure map with live telemetry
- Real-time incident detection and severity ranking
- Autonomous orchestration via AI agents
- Multi-domain system monitoring (energy, water, etc.)
- One-click issue resolution with visual feedback
