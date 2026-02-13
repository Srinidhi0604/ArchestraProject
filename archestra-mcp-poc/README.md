# Universal Infrastructure MCP Server

Production-grade, domain-agnostic MCP server for monitoring, analysis, and control of infrastructure systems.

## Supported System Types (Sample Initialization)

- Power Grid
- Hydro Plant
- Sewage Treatment Plant

The abstraction layer is generic and extensible to logistics, factories, smart cities, and transportation networks.

## Implemented MCP Tools

1. `get_systems()`
2. `get_system_state(system_id)`
3. `get_component_state(component_id)`
4. `get_system_topology(system_id)`
5. `evaluate_system_risk(system_id)`
6. `execute_control_action(system_id, action_type, parameters)`

## Architecture

- `models.py` – Universal system/component/telemetry/topology/risk models
- `simulation.py` – Telemetry simulation engine with overload scenarios
- `tools.py` – FastMCP tool registrations
- `server.py` – FastMCP bootstrap and startup initialization
- `run_mcp.py` – stdio entrypoint used by Archestra self-hosted MCP runtime

## Run Locally (stdio)

```bash
cd archestra-mcp-poc
pip install -r requirements.txt
python run_mcp.py
```

This starts MCP in stdio mode and does not open HTTP ports.

## Build Container (Archestra self-hosted)

```bash
cd archestra-mcp-poc
docker build -t universal-infra-mcp .
```

## Run Container (stdio)

```bash
docker run -it universal-infra-mcp
```

## Run with Docker Compose (stdio)

```bash
docker compose up --build
```

## Archestra Self-hosted MCP Registry

- Docker Image: `universal-infra-mcp:latest`
- Transport: stdio
- Command in container: `python run_mcp.py`

## Example Test Calls

### 1) Validate tool discovery with MCP inspector

```bash
mcp dev core/mcp_server.py
```

### 2) Validate stdio directly

```bash
python run_mcp.py
```

## Confirmation Checklist

- [x] Uses stdio transport only for container runtime
- [x] Registers all required tools
- [x] Logs startup, tool registration, and request handling to stderr
- [x] Docker image starts via `python run_mcp.py`
- [x] Compatible with Archestra self-hosted MCP runtime
