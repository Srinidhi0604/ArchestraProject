# Archestra MCP Proof of Concept

A minimal, production-ready MCP (Model Context Protocol) server for Archestra AI with pluggable domain adapters.

## Quick Start

### Installation

```bash
cd archestra-mcp-poc
pip install -r requirements.txt
```

### Run the Server

```bash
# FastAPI + MCP SSE transport
uvicorn app:app --reload

# Then access:
# GET  http://localhost:8000/
# POST http://localhost:8000/set_domain/{domain}
# GET  http://localhost:8000/active_domain
# GET  http://localhost:8000/mcp/        (MCP endpoint)
```

### Test with MCP Inspector

```bash
mcp dev core/mcp_server.py
```

## Architecture

### Core Modules

- **`core/domain_context.py`**: Per-request domain isolation using `contextvars` with thread-safe server-wide default.
- **`core/schemas.py`**: Pydantic models for Forecast, Risk, and Action requests/responses.
- **`core/registry.py`**: Plugin registry using `Protocol` for type-safe domain adapters.
- **`core/mcp_server.py`**: FastMCP instance with three tools: `get_forecast`, `evaluate_risk`, `execute_action`.

### Domain Adapters

- **`domains/energy/`**: Energy grid forecasting, outage risk, dispatch actions.
- **`domains/logistics/`**: Shipment forecasting, delay risk, routing actions.
- **`domains/healthcare/`**: Patient admission forecasting, surge risk, admission actions.

### API Integration

- **`app.py`**: FastAPI application mounting MCP SSE transport at `/mcp`.
- **`run_mcp.py`**: Standalone stdio entry point for local testing.

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Health check + endpoint directory |
| `/mcp/` | GET/POST | MCP SSE transport (Archestra discovery) |
| `/set_domain/{domain}` | POST | Switch active domain (persists) |
| `/active_domain` | GET | Return current active domain |

## Domain Switching

```bash
# Switch to logistics domain
curl -X POST http://localhost:8000/set_domain/logistics

# All subsequent tool calls use logistics adapter
```

## Integration with Archestra

1. **Register MCP Server**
   - Open Archestra UI → MCP Registry → Add New Server
   - Name: `Generic Orchestration MCP`
   - URL: `http://host.docker.internal:8000/mcp` (Docker) or `http://localhost:8000/mcp` (native)
   - Test Connection → Should discover 3 tools

2. **Attach to Agents**
   - Forecast and Planning Agent → Add MCP
   - Operations & Execution Agent → Add MCP
   - Safety & Compliance Agent → Add MCP

## Design Principles

- **Domain agnostic at MCP layer**: Tools remain stateless; delegation to adapters.
- **No mutable globals**: All state via `contextvars` or passed parameters.
- **Type-safe protocols**: `DomainAdapter` protocol over inheritance.
- **Async-first**: All tools and adapters are async.
- **Minimal error handling**: Core exceptions logged to stderr; upstream handles recovery.

## Testing

```bash
# Forecast
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list_tools","id":1}'

# After MCP inspect/client handshake, call tools via tool_call messages
```

## Project Structure

```
archestra-mcp-poc/
├── core/
│   ├── __init__.py
│   ├── domain_context.py      # ContextVar management
│   ├── schemas.py              # Pydantic models
│   ├── registry.py             # Plugin registry with Protocol
│   └── mcp_server.py           # FastMCP tools
├── domains/
│   ├── energy/tools.py
│   ├── logistics/tools.py
│   └── healthcare/tools.py
├── app.py                      # FastAPI + MCP mount
├── run_mcp.py                  # Stdio entry
├── requirements.txt
├── pyproject.toml
└── README.md
```

## Requirements

- Python 3.11+
- FastAPI 0.110.0+
- Uvicorn 0.27.0+
- MCP SDK 1.0.0+
- Pydantic 2.6.0+

## License

MIT
