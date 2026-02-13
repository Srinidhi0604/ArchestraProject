from __future__ import annotations

import logging
import os
import sys

from mcp.server.fastmcp import FastMCP
from mcp.server.streamable_http import TransportSecuritySettings

from simulation import UniversalSimulationEngine
from tools import UniversalInfrastructureTools

logger = logging.getLogger("universal-infra-mcp")
logger.addHandler(logging.StreamHandler(sys.stderr))
logger.setLevel(logging.INFO)

_allow_all_hosts = os.getenv("MCP_ALLOW_ALL_HOSTS", "false").lower() in {"1", "true", "yes"}

if _allow_all_hosts:
    transport_security = TransportSecuritySettings(enable_dns_rebinding_protection=False)
else:
    transport_security = TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=[
            "127.0.0.1",
            "127.0.0.1:*",
            "localhost",
            "localhost:*",
            "[::1]",
            "[::1]:*",
            "host.docker.internal",
            "host.docker.internal:*",
        ],
        allowed_origins=[
            "http://127.0.0.1",
            "http://127.0.0.1:*",
            "http://localhost",
            "http://localhost:*",
            "http://[::1]",
            "http://[::1]:*",
            "http://host.docker.internal",
            "http://host.docker.internal:*",
            "https://host.docker.internal",
            "https://host.docker.internal:*",
        ],
    )

mcp = FastMCP("universal-infrastructure-mcp", transport_security=transport_security)

simulation_engine = UniversalSimulationEngine()
simulation_engine.initialize_sample_systems()

logger.info("Initializing Universal Infrastructure MCP server")
logger.info("Sample systems loaded: power_grid, hydro_plant, sewage_plant")

UniversalInfrastructureTools(mcp, simulation_engine).register()

logger.info("Universal infrastructure MCP initialized")


if __name__ == "__main__":
    mcp.run()
